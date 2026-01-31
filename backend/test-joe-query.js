const Database = require('better-sqlite3');
const db = new Database('purchase_requisition.db');

const userId = 40; // Joe's ID

const query = `
    SELECT r.*, u.full_name as created_by_name, u.department
    FROM requisitions r
    JOIN users u ON r.created_by = u.id
    WHERE 1=1
    AND (u.department = (SELECT department FROM users WHERE id = ?) OR r.assigned_hod_id = ?)
    ORDER BY r.created_at DESC
`;

console.log('Testing query for Joe (user_id:', userId, ')');
const rows = db.prepare(query).all(userId, userId);

console.log('\nResults:', rows.length, 'requisitions found');
rows.forEach(r => {
    console.log({
        id: r.id,
        req_number: r.req_number,
        status: r.status,
        creator_department: r.department,
        assigned_hod_id: r.assigned_hod_id
    });
});

db.close();
