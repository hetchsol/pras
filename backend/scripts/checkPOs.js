const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new Database(dbPath);

console.log('🔍 Checking Purchase Orders...\n');

// Check if purchase_orders table exists
console.log('1️⃣ Checking if purchase_orders table exists:\n');
const tableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='purchase_orders'
`).get();

if (tableExists) {
    console.log('  ✅ purchase_orders table exists\n');
} else {
    console.log('  ❌ purchase_orders table does NOT exist!\n');
}

// Check POs in database
console.log('2️⃣ Purchase Orders in database:\n');
const pos = db.prepare(`
    SELECT po.*, r.req_number, r.description, u.full_name as creator
    FROM purchase_orders po
    JOIN requisitions r ON po.requisition_id = r.id
    JOIN users u ON r.created_by = u.id
    ORDER BY po.created_at DESC
`).all();

if (pos.length > 0) {
    console.log(`  Found ${pos.length} Purchase Order(s):\n`);
    pos.forEach(po => {
        console.log(`  PO #: ${po.po_number}`);
        console.log(`  Req #: ${po.req_number}`);
        console.log(`  Amount: ZMW ${po.total_amount}`);
        console.log(`  Created: ${po.created_at}`);
        console.log(`  Created By: ${po.creator}`);
        console.log('  ---');
    });
} else {
    console.log('  ⚠️  No Purchase Orders found in database!\n');
}

// Check completed requisitions
console.log('\n3️⃣ Completed requisitions (should have POs):\n');
const completedReqs = db.prepare(`
    SELECT r.id, r.req_number, r.status, r.po_number, r.po_generated_at,
           r.total_amount, u.full_name as creator
    FROM requisitions r
    JOIN users u ON r.created_by = u.id
    WHERE r.status = 'completed'
    ORDER BY r.updated_at DESC
`).all();

if (completedReqs.length > 0) {
    console.log(`  Found ${completedReqs.length} completed requisition(s):\n`);
    completedReqs.forEach(r => {
        console.log(`  Req #: ${r.req_number}`);
        console.log(`  Status: ${r.status}`);
        console.log(`  PO Number: ${r.po_number || 'NOT GENERATED!'}`);
        console.log(`  PO Generated At: ${r.po_generated_at || 'N/A'}`);
        console.log(`  Amount: ZMW ${r.total_amount || 0}`);
        console.log(`  Creator: ${r.creator}`);
        console.log('  ---');
    });
} else {
    console.log('  ℹ️  No completed requisitions yet\n');
}

// Check requisition_items for details
console.log('\n4️⃣ Checking requisition items (procurement details):\n');
const sampleReq = db.prepare(`
    SELECT r.id, r.req_number, r.status
    FROM requisitions r
    WHERE r.status IN ('pending_finance', 'pending_md', 'completed')
    ORDER BY r.updated_at DESC
    LIMIT 1
`).get();

if (sampleReq) {
    console.log(`  Sample Requisition: ${sampleReq.req_number} (Status: ${sampleReq.status})\n`);

    const items = db.prepare(`
        SELECT ri.*, v.name as vendor_name
        FROM requisition_items ri
        LEFT JOIN vendors v ON ri.vendor_id = v.id
        WHERE ri.requisition_id = ?
    `).all(sampleReq.id);

    if (items.length > 0) {
        console.log(`  Found ${items.length} item(s):\n`);
        items.forEach((item, index) => {
            console.log(`  Item ${index + 1}:`);
            console.log(`    Name: ${item.item_name}`);
            console.log(`    Quantity: ${item.quantity}`);
            console.log(`    Unit Price: ZMW ${item.unit_price || 'Not set'}`);
            console.log(`    Vendor: ${item.vendor_name || 'Not assigned'}`);
            console.log(`    Specifications: ${item.specifications || 'N/A'}`);
            console.log('  ---');
        });
    } else {
        console.log('  ⚠️  No items found for this requisition!\n');
    }
} else {
    console.log('  ℹ️  No requisitions in Finance/MD/Completed status\n');
}

db.close();

console.log('\n✅ Check complete!');
