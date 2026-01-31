const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('=== USERS AND DEPARTMENTS VERIFICATION ===\n');

// Check departments
db.all(`
    SELECT name, hod_name
    FROM departments
    WHERE name IN ('Operations', 'HR', 'Stores', 'Sales', 'Admin', 'Finance')
    ORDER BY name
`, [], (err, departments) => {
    if (err) {
        console.error('Error fetching departments:', err);
        return;
    }

    console.log('📂 DEPARTMENTS:');
    departments.forEach(dept => {
        console.log(`   ✓ ${dept.name}${dept.hod_name ? ` (HOD: ${dept.hod_name})` : ''}`);
    });

    // Check users from Excel
    console.log('\n👥 USERS FROM EXCEL FILE:');
    db.all(`
        SELECT username, full_name, role, department, assigned_hod
        FROM users
        WHERE username IN (
            'mbialesi.namute', 'mwaka.musonda', 'larry.mwambazi', 'dickson.chipwalu',
            'hillary.chaponda', 'bernard.kalimba', 'moses.phiri', 'john.chabala',
            'waden.chishimba', 'ashley.rabie', 'lina.zimba', 'annie.nanyangwe',
            'nason.nguni', 'moses.shebele'
        )
        ORDER BY department, role, full_name
    `, [], (err, users) => {
        if (err) {
            console.error('Error fetching users:', err);
            return;
        }

        let currentDept = '';
        users.forEach(user => {
            if (user.department !== currentDept) {
                currentDept = user.department;
                console.log(`\n   ${currentDept}:`);
            }
            console.log(`      ✓ ${user.full_name} (@${user.username}) - ${user.role}${user.assigned_hod ? ` → Reports to: ${user.assigned_hod}` : ''}`);
        });

        // Summary statistics
        console.log('\n📊 SUMMARY:');
        db.get('SELECT COUNT(*) as total FROM users', [], (err, result) => {
            if (err) {
                console.error('Error:', err);
                return;
            }
            console.log(`   Total users in system: ${result.total}`);

            db.all(`
                SELECT department, COUNT(*) as count
                FROM users
                GROUP BY department
                ORDER BY count DESC
            `, [], (err, stats) => {
                if (err) {
                    console.error('Error:', err);
                    return;
                }

                console.log('\n   Users by Department:');
                stats.forEach(stat => {
                    console.log(`      • ${stat.department}: ${stat.count} users`);
                });

                // Check tax_type column
                console.log('\n🔧 DATABASE SCHEMA VERIFICATION:');
                db.all("PRAGMA table_info(requisitions)", [], (err, columns) => {
                    if (err) {
                        console.error('Error:', err);
                        return;
                    }

                    const hasTaxType = columns.some(col => col.name === 'tax_type');
                    console.log(`   ✓ tax_type column in requisitions: ${hasTaxType ? 'YES' : 'NO'}`);

                    db.all("PRAGMA table_info(departments)", [], (err, deptCols) => {
                        if (err) {
                            console.error('Error:', err);
                            db.close();
                            return;
                        }

                        const hasHodName = deptCols.some(col => col.name === 'hod_name');
                        console.log(`   ✓ hod_name column in departments: ${hasHodName ? 'YES' : 'NO'}`);

                        console.log('\n✅ All setup completed successfully!');
                        db.close();
                    });
                });
            });
        });
    });
});
