const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new Database(dbPath);

console.log('🔍 Checking users in database...\n');

const users = db.prepare(`
    SELECT id, username, full_name, role, department, is_hod
    FROM users
    ORDER BY id
`).all();

console.log('Users:');
users.forEach(u => {
    console.log(`  ID: ${u.id}, Username: ${u.username}, Name: ${u.full_name}, Role: ${u.role}, Dept: ${u.department}`);
});

console.log('\n🔍 Checking requisitions with status pending_finance...\n');

const financeReqs = db.prepare(`
    SELECT r.id, r.req_number, r.status, r.description, u.full_name as creator
    FROM requisitions r
    JOIN users u ON r.created_by = u.id
    WHERE r.status = 'pending_finance'
    ORDER BY r.created_at DESC
`).all();

console.log(`Found ${financeReqs.length} requisition(s) pending finance approval:`);
financeReqs.forEach(r => {
    console.log(`  ID: ${r.id}, Req#: ${r.req_number}, Status: ${r.status}, Creator: ${r.creator}`);
    console.log(`  Description: ${r.description}`);
});

db.close();
