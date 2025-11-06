const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new Database(dbPath);

console.log('🔍 Checking Finance → MD Flow...\n');

// Check requisitions with pending_finance status
console.log('1️⃣ Requisitions waiting for Finance approval:\n');
const pendingFinance = db.prepare(`
    SELECT r.id, r.req_number, r.status, r.finance_approval_status, r.md_approval_status,
           u.full_name as creator, u.department
    FROM requisitions r
    JOIN users u ON r.created_by = u.id
    WHERE r.status = 'pending_finance'
    ORDER BY r.created_at DESC
`).all();

if (pendingFinance.length > 0) {
    pendingFinance.forEach(r => {
        console.log(`  ID: ${r.id}`);
        console.log(`  Req#: ${r.req_number}`);
        console.log(`  Status: ${r.status}`);
        console.log(`  Finance Status: ${r.finance_approval_status}`);
        console.log(`  Creator: ${r.creator} (${r.department})`);
        console.log('  ---');
    });
} else {
    console.log('  ✅ No requisitions waiting for Finance approval\n');
}

// Check requisitions with pending_md status
console.log('\n2️⃣ Requisitions waiting for MD approval:\n');
const pendingMD = db.prepare(`
    SELECT r.id, r.req_number, r.status, r.finance_approval_status, r.md_approval_status,
           u.full_name as creator, u.department,
           fin.full_name as finance_approver
    FROM requisitions r
    JOIN users u ON r.created_by = u.id
    LEFT JOIN users fin ON r.finance_approved_by = fin.id
    WHERE r.status = 'pending_md'
    ORDER BY r.created_at DESC
`).all();

if (pendingMD.length > 0) {
    pendingMD.forEach(r => {
        console.log(`  ID: ${r.id}`);
        console.log(`  Req#: ${r.req_number}`);
        console.log(`  Status: ${r.status}`);
        console.log(`  Finance Status: ${r.finance_approval_status}`);
        console.log(`  Finance Approved By: ${r.finance_approver || 'N/A'}`);
        console.log(`  MD Status: ${r.md_approval_status}`);
        console.log(`  Creator: ${r.creator} (${r.department})`);
        console.log('  ---');
    });
} else {
    console.log('  ℹ️  No requisitions waiting for MD approval\n');
}

// Check all requisition statuses
console.log('\n3️⃣ All requisition statuses summary:\n');
const statusSummary = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM requisitions
    GROUP BY status
    ORDER BY count DESC
`).all();

statusSummary.forEach(s => {
    console.log(`  ${s.status}: ${s.count} requisition(s)`);
});

// Check if MD user exists
console.log('\n4️⃣ Checking MD user:\n');
const mdUser = db.prepare(`
    SELECT id, username, full_name, role, department
    FROM users
    WHERE role = 'md'
`).get();

if (mdUser) {
    console.log(`  ✅ MD user exists: ${mdUser.username} (${mdUser.full_name})`);
    console.log(`     ID: ${mdUser.id}, Department: ${mdUser.department}`);
} else {
    console.log('  ❌ No MD user found!');
}

// Check recent finance approvals
console.log('\n5️⃣ Recent Finance approvals:\n');
const recentFinanceApprovals = db.prepare(`
    SELECT r.id, r.req_number, r.status, r.finance_approval_status,
           r.finance_approved_at, fin.full_name as finance_approver
    FROM requisitions r
    LEFT JOIN users fin ON r.finance_approved_by = fin.id
    WHERE r.finance_approval_status = 'approved'
    ORDER BY r.finance_approved_at DESC
    LIMIT 5
`).all();

if (recentFinanceApprovals.length > 0) {
    recentFinanceApprovals.forEach(r => {
        console.log(`  Req #${r.req_number}:`);
        console.log(`    Current Status: ${r.status}`);
        console.log(`    Finance Approved By: ${r.finance_approver || 'N/A'}`);
        console.log(`    Finance Approved At: ${r.finance_approved_at || 'N/A'}`);
        console.log('  ---');
    });
} else {
    console.log('  ℹ️  No Finance approvals yet\n');
}

db.close();

console.log('\n✅ Check complete!');
