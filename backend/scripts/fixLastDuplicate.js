const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(require('path').join(__dirname, '..', 'purchase_requisition.db'));

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
    });
}
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
}

async function main() {
    const tables = ['requisitions', 'petty_cash_forms', 'fuel_request_forms', 'travel_request_forms', 'issue_slips', 'picking_slips'];

    for (const table of tables) {
        try {
            const r1 = await dbRun(`UPDATE ${table} SET initiator_id = 29 WHERE initiator_id = 36`);
            if (r1.changes > 0) console.log(`Moved ${r1.changes} records in ${table} (initiator_id)`);
        } catch(e) {}
        try {
            const r2 = await dbRun(`UPDATE ${table} SET user_id = 29 WHERE user_id = 36`);
            if (r2.changes > 0) console.log(`Moved ${r2.changes} records in ${table} (user_id)`);
        } catch(e) {}
    }

    // id 36 (nashon.nguni) already has correct data from sync
    // Move any records from id 29 to id 36, then delete id 29
    for (const table of tables) {
        try {
            const r3 = await dbRun(`UPDATE ${table} SET initiator_id = 36 WHERE initiator_id = 29`);
            if (r3.changes > 0) console.log(`Moved ${r3.changes} records in ${table} from 29→36 (initiator_id)`);
        } catch(e) {}
        try {
            const r4 = await dbRun(`UPDATE ${table} SET user_id = 36 WHERE user_id = 29`);
            if (r4.changes > 0) console.log(`Moved ${r4.changes} records in ${table} from 29→36 (user_id)`);
        } catch(e) {}
    }

    // Delete the old duplicate id 29
    await dbRun('DELETE FROM users WHERE id = 29');
    console.log('Deleted duplicate id 29 (nason.nguni)');

    // Final state
    const rows = await dbAll('SELECT id, username, full_name, role, department, employee_number, assigned_hod FROM users ORDER BY id');
    console.log(`\nFinal user count: ${rows.length}`);
    for (const u of rows) {
        console.log(`${u.id} | ${u.username} | ${u.full_name} | ${u.role} | ${u.department} | ${u.employee_number || '-'} | sup:${u.assigned_hod || '-'}`);
    }

    db.close();
}

main().catch(err => { console.error(err); db.close(); });
