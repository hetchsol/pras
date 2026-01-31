const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

console.log('\n=== CONSOLIDATING JUSTIN/JUSTINE ACCOUNTS ===\n');

// Justine Kaluya (ID: 21) -> Kaluya Justin (ID: 34)
const justineId = 21;
const justinId = 34;

try {
    // 1. Get both users
    const justine = db.prepare('SELECT * FROM users WHERE id = ?').get(justineId);
    const justin = db.prepare('SELECT * FROM users WHERE id = ?').get(justinId);

    console.log('1️⃣ CURRENT USERS:');
    console.log('   Justine Kaluya (ID: 21):', justine?.full_name, '-', justine?.username);
    console.log('   Kaluya Justin (ID: 34):', justin?.full_name, '-', justin?.username);
    console.log('');

    // 2. Update petty cash requisitions
    console.log('2️⃣ TRANSFERRING PETTY CASH REQUISITIONS:');
    const pettyCashUpdate = db.prepare(`
        UPDATE petty_cash_requisitions
        SET initiator_id = ?,
            initiator_name = ?
        WHERE initiator_id = ?
    `).run(justinId, 'Kaluya Justin', justineId);
    console.log(`   ✅ Updated ${pettyCashUpdate.changes} petty cash requisitions`);

    // 3. Update EFT requisitions
    console.log('3️⃣ TRANSFERRING EFT REQUISITIONS:');
    const eftUpdate = db.prepare(`
        UPDATE eft_requisitions
        SET initiator_id = ?,
            initiator_name = ?
        WHERE initiator_id = ?
    `).run(justinId, 'Kaluya Justin', justineId);
    console.log(`   ✅ Updated ${eftUpdate.changes} EFT requisitions`);

    // 4. Update expense claims
    console.log('4️⃣ TRANSFERRING EXPENSE CLAIMS:');
    const expenseUpdate = db.prepare(`
        UPDATE expense_claims
        SET initiator_id = ?
        WHERE initiator_id = ?
    `).run(justinId, justineId);
    console.log(`   ✅ Updated ${expenseUpdate.changes} expense claims`);

    // 5. Update purchase requisitions (uses created_by)
    console.log('5️⃣ TRANSFERRING PURCHASE REQUISITIONS:');
    const prUpdate = db.prepare(`
        UPDATE requisitions
        SET created_by = ?
        WHERE created_by = ?
    `).run(justinId, justineId);
    console.log(`   ✅ Updated ${prUpdate.changes} purchase requisitions`);

    // 6. Update form approvals
    console.log('6️⃣ TRANSFERRING FORM APPROVALS:');
    try {
        const approvalsUpdate = db.prepare(`
            UPDATE form_approvals
            SET approver_id = ?,
                approver_name = ?
            WHERE approver_id = ?
        `).run(justinId, 'Kaluya Justin', justineId);
        console.log(`   ✅ Updated ${approvalsUpdate.changes} form approvals`);
    } catch (err) {
        console.log(`   ⚠️  Form approvals update skipped (table might not exist)`);
    }

    // 7. Delete Justine account
    console.log('7️⃣ DELETING JUSTINE ACCOUNT:');
    const deleteUser = db.prepare('DELETE FROM users WHERE id = ?').run(justineId);
    console.log(`   ✅ Deleted Justine Kaluya account (ID: ${justineId})`);

    console.log('\n' + '─'.repeat(60));
    console.log('✅ CONSOLIDATION COMPLETE!');
    console.log('─'.repeat(60));
    console.log('\nAll data from "Justine Kaluya" has been moved to "Kaluya Justin" (ID: 34)');
    console.log('Justine account has been deleted.');
    console.log('\n✅ Justin can now log in with username: kaluya.justin\n');

} catch (error) {
    console.error('❌ Error:', error);
    db.close();
    process.exit(1);
}

db.close();
