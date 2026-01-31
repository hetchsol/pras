const { getUsers } = require('../database');

const users = getUsers();

console.log('\n📋 Complete Users List:\n');
console.log('ID | Name                      | Username              | Role         | Department');
console.log('---+---------------------------+-----------------------+--------------+----------------');

users.forEach(u => {
    const id = u.id.toString().padStart(2);
    const name = u.name.padEnd(25);
    const username = u.username.padEnd(21);
    const role = u.role.padEnd(12);
    const dept = u.department;
    console.log(`${id} | ${name} | ${username} | ${role} | ${dept}`);
});

console.log(`\n✅ Total: ${users.length} users`);
console.log('\n📌 Default Password for all users: Password123\n');
