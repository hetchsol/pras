const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

console.log('\n📋 Users in purchase_requisition.db:\n');
console.log('ID | Full Name                 | Username              | Role         | Department');
console.log('---+---------------------------+-----------------------+--------------+----------------');

const users = db.prepare('SELECT * FROM users ORDER BY id').all();

users.forEach(u => {
    const id = u.id.toString().padStart(2);
    const name = (u.full_name || u.name || '').padEnd(25);
    const username = u.username.padEnd(21);
    const role = u.role.padEnd(12);
    const dept = u.department || '';
    console.log(`${id} | ${name} | ${username} | ${role} | ${dept}`);
});

console.log(`\n✅ Total: ${users.length} users\n`);

db.close();
