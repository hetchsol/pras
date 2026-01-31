const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const XLSX = require('xlsx');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

// HOD assignments as specified
const hodAssignments = {
    'Operations': 'Joel Munthali',
    'HR': 'Kanyembo Ndhlovu',
    'Stores': 'Anne Banda',
    'Sales': 'Moses Shebele',
    'Admin': 'Kanyembo Ndhlovu',
    'Finance': null // No HOD specified for Finance
};

async function setupDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // First, let's check if we need to add tax_type column to requisitions
            db.all("PRAGMA table_info(requisitions)", [], (err, columns) => {
                if (err) {
                    console.error('Error checking requisitions table:', err);
                    return reject(err);
                }

                const hasTaxType = columns.some(col => col.name === 'tax_type');

                if (!hasTaxType) {
                    console.log('Adding tax_type column to requisitions table...');
                    db.run(`ALTER TABLE requisitions ADD COLUMN tax_type TEXT DEFAULT 'VAT'`, (err) => {
                        if (err) {
                            console.error('Error adding tax_type column:', err);
                        } else {
                            console.log('✓ Added tax_type column');
                        }
                    });
                }
            });

            resolve();
        });
    });
}

async function createDepartments() {
    return new Promise((resolve, reject) => {
        console.log('\n=== Creating Departments ===');

        const departments = ['Operations', 'HR', 'Stores', 'Sales', 'Admin', 'Finance'];

        db.serialize(() => {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO departments (name, hod_name)
                VALUES (?, ?)
            `);

            departments.forEach(dept => {
                const hodName = hodAssignments[dept];
                stmt.run(dept, hodName, function(err) {
                    if (err) {
                        console.error(`Error creating department ${dept}:`, err);
                    } else {
                        console.log(`✓ Department: ${dept}${hodName ? ` (HOD: ${hodName})` : ''}`);
                    }
                });
            });

            stmt.finalize((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

async function createUsers() {
    return new Promise((resolve, reject) => {
        console.log('\n=== Creating Users ===');

        // Read the Excel file
        const filePath = path.join(__dirname, '..', 'Users_Depts.xlsx');
        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const users = XLSX.utils.sheet_to_json(worksheet);

        db.serialize(() => {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO users (username, password, full_name, email, role, department)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            let completed = 0;
            const total = users.length;

            users.forEach(user => {
                const username = user['User Name'];
                const password = user['Password'];
                const fullName = user['Full Name'];
                const email = user['Email'];
                const role = user['Role'];
                const department = user['Department'];

                // Hash the password
                bcrypt.hash(password, 10, (err, hashedPassword) => {
                    if (err) {
                        console.error(`Error hashing password for ${username}:`, err);
                        completed++;
                        if (completed === total) {
                            stmt.finalize((err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        }
                        return;
                    }

                    stmt.run(username, hashedPassword, fullName, email, role, department, function(err) {
                        if (err) {
                            console.error(`Error creating user ${username}:`, err);
                        } else {
                            console.log(`✓ User: ${username} (${fullName}) - ${role} in ${department}`);
                        }

                        completed++;
                        if (completed === total) {
                            stmt.finalize((err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        }
                    });
                });
            });
        });
    });
}

async function updateHODAssignments() {
    return new Promise((resolve, reject) => {
        console.log('\n=== Updating HOD Assignments in Users Table ===');

        db.serialize(() => {
            // Set assigned_hod for all users based on their department
            const updates = [];

            for (const [dept, hodName] of Object.entries(hodAssignments)) {
                if (hodName) {
                    updates.push(new Promise((res, rej) => {
                        db.run(`
                            UPDATE users
                            SET assigned_hod = ?
                            WHERE department = ? AND role != 'HOD'
                        `, [hodName, dept], function(err) {
                            if (err) {
                                console.error(`Error updating HOD for ${dept}:`, err);
                                rej(err);
                            } else {
                                console.log(`✓ Assigned ${hodName} as HOD for ${dept} department (${this.changes} users updated)`);
                                res();
                            }
                        });
                    }));
                }
            }

            Promise.all(updates)
                .then(() => resolve())
                .catch(reject);
        });
    });
}

async function displaySummary() {
    return new Promise((resolve, reject) => {
        console.log('\n=== Summary ===');

        db.all('SELECT name, hod_name FROM departments ORDER BY name', [], (err, depts) => {
            if (err) {
                console.error('Error fetching departments:', err);
                return reject(err);
            }

            console.log('\nDepartments:');
            depts.forEach(dept => {
                console.log(`  - ${dept.name}${dept.hod_name ? ` (HOD: ${dept.hod_name})` : ''}`);
            });

            db.all(`
                SELECT department, role, COUNT(*) as count
                FROM users
                GROUP BY department, role
                ORDER BY department, role
            `, [], (err, counts) => {
                if (err) {
                    console.error('Error fetching user counts:', err);
                    return reject(err);
                }

                console.log('\nUsers by Department and Role:');
                counts.forEach(row => {
                    console.log(`  - ${row.department} ${row.role}: ${row.count}`);
                });

                db.get('SELECT COUNT(*) as total FROM users', [], (err, result) => {
                    if (err) {
                        console.error('Error fetching total users:', err);
                        return reject(err);
                    }
                    console.log(`\nTotal Users: ${result.total}`);
                    resolve();
                });
            });
        });
    });
}

async function main() {
    try {
        await setupDatabase();
        await createDepartments();
        await createUsers();
        await updateHODAssignments();
        await displaySummary();

        console.log('\n✓ Setup completed successfully!');
        db.close();
    } catch (error) {
        console.error('Error during setup:', error);
        db.close();
        process.exit(1);
    }
}

main();
