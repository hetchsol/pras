const Database = require('better-sqlite3');
const path = require('path');

console.log('🔄 Checking for Forms Data to Migrate\n');

const sourceDb = new Database(path.join(__dirname, '..', 'requisitions.db'));
const targetDb = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

try {
    // Check EFT Requisitions
    const eftRecords = sourceDb.prepare('SELECT * FROM eft_requisitions').all();
    console.log(`📊 EFT Requisitions in source: ${eftRecords.length}`);

    if (eftRecords.length > 0) {
        console.log('   Migrating EFT requisitions...');
        const insertEft = targetDb.prepare(`
            INSERT INTO eft_requisitions (
                id, eft_chq_number, amount, amount_in_words, in_favour_of,
                bank_account_number, bank_name, branch,
                purpose, account_code, description,
                initiator_id, initiator_name, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const record of eftRecords) {
            insertEft.run(
                record.id, record.eft_chq_number, record.amount, record.amount_in_words,
                record.in_favour_of, record.bank_account_number, record.bank_name, record.branch,
                record.purpose, record.account_code, record.description,
                record.initiator_id, record.initiator_name, record.status,
                record.created_at, record.updated_at
            );
        }
        console.log(`   ✅ Migrated ${eftRecords.length} EFT requisitions\n`);
    } else {
        console.log('   ℹ️  No EFT requisitions to migrate\n');
    }

    // Check Expense Claims
    const expenseRecords = sourceDb.prepare('SELECT * FROM expense_claims').all();
    console.log(`📊 Expense Claims in source: ${expenseRecords.length}`);

    if (expenseRecords.length > 0) {
        console.log('   Migrating expense claims...');
        const insertExpense = targetDb.prepare(`
            INSERT INTO expense_claims (
                id, claim_number, claimant_name, department,
                period_from, period_to, total_amount,
                initiator_id, initiator_name, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const record of expenseRecords) {
            insertExpense.run(
                record.id, record.claim_number, record.claimant_name, record.department,
                record.period_from, record.period_to, record.total_amount,
                record.initiator_id, record.initiator_name, record.status,
                record.created_at, record.updated_at
            );
        }
        console.log(`   ✅ Migrated ${expenseRecords.length} expense claims`);

        // Migrate expense claim items
        const itemRecords = sourceDb.prepare('SELECT * FROM expense_claim_items').all();
        console.log(`   📊 Expense claim items: ${itemRecords.length}`);

        if (itemRecords.length > 0) {
            const insertItem = targetDb.prepare(`
                INSERT INTO expense_claim_items (
                    id, claim_id, date, description, amount, receipt_attached, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            for (const item of itemRecords) {
                insertItem.run(
                    item.id, item.claim_id, item.date, item.description,
                    item.amount, item.receipt_attached, item.created_at
                );
            }
            console.log(`   ✅ Migrated ${itemRecords.length} expense claim items\n`);
        }
    } else {
        console.log('   ℹ️  No expense claims to migrate\n');
    }

    // Check Form Approvals
    const approvalRecords = sourceDb.prepare('SELECT * FROM form_approvals').all();
    console.log(`📊 Form Approvals in source: ${approvalRecords.length}`);

    if (approvalRecords.length > 0) {
        console.log('   Migrating form approvals...');
        const insertApproval = targetDb.prepare(`
            INSERT INTO form_approvals (
                id, form_id, form_type, approver_role,
                approver_id, approver_name, action, comments, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const record of approvalRecords) {
            insertApproval.run(
                record.id, record.form_id, record.form_type, record.approver_role,
                record.approver_id, record.approver_name, record.action,
                record.comments, record.created_at
            );
        }
        console.log(`   ✅ Migrated ${approvalRecords.length} form approvals\n`);
    } else {
        console.log('   ℹ️  No form approvals to migrate\n');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Forms Data Migration Complete!\n');

} catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
}

sourceDb.close();
targetDb.close();
process.exit(0);
