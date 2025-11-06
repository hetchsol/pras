const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new Database(dbPath);

console.log('🔧 Creating Finance Manager user...\n');

// Check if finance user exists
const existing = db.prepare("SELECT id, username, role FROM users WHERE role = 'finance'").get();

if (existing) {
    console.log(`✅ Finance user already exists: ${existing.username} (ID: ${existing.id})`);
} else {
    console.log('Creating new finance user: sarah.banda');

    try {
        db.prepare(`
            INSERT INTO users (username, password, full_name, email, role, department, is_hod)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('sarah.banda', 'password123', 'Sarah Banda', 'sarah@company.zm', 'finance', 'Finance', 1);

        console.log('✅ Finance Manager user created successfully!');
        console.log('   Username: sarah.banda');
        console.log('   Password: password123');
        console.log('   Role: finance');
        console.log('   Department: Finance');
    } catch (error) {
        console.error('❌ Error creating user:', error.message);
    }
}

console.log('\n🔍 Current users with their roles:\n');
const users = db.prepare(`
    SELECT id, username, full_name, role, department
    FROM users
    ORDER BY role, username
`).all();

const roleGroups = {};
users.forEach(u => {
    if (!roleGroups[u.role]) roleGroups[u.role] = [];
    roleGroups[u.role].push(u);
});

Object.keys(roleGroups).sort().forEach(role => {
    console.log(`${role.toUpperCase()}:`);
    roleGroups[role].forEach(u => {
        console.log(`  - ${u.username} (${u.full_name}) - ${u.department}`);
    });
    console.log('');
});

db.close();
