const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

console.log('\n=== ALL EFTs FOR ABRAHAM (ID 38) ===\n');

const efts = db.prepare(`
    SELECT id, in_favour_of, amount, purpose, status, created_at, updated_at
    FROM eft_requisitions
    WHERE initiator_id = 38
    ORDER BY created_at DESC
`).all();

console.log(`Total EFTs: ${efts.length}\n`);

efts.forEach((e, i) => {
    console.log(`${i + 1}. ${e.id}`);
    console.log(`   Purpose: ${e.purpose || 'N/A'}`);
    console.log(`   Amount: ${e.amount}`);
    console.log(`   Status: ${e.status}`);
    console.log(`   Created: ${e.created_at}`);
    console.log(`   Updated: ${e.updated_at}`);
    console.log('');
});

// Check for EFTs created in the last hour
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
console.log(`\n=== EFTs CREATED IN LAST HOUR (after ${oneHourAgo}) ===\n`);

const recentEFTs = efts.filter(e => e.created_at > oneHourAgo);
console.log(`Recent EFTs: ${recentEFTs.length}`);
recentEFTs.forEach(e => {
    console.log(`   - ${e.id} (${e.purpose}) - Status: ${e.status}`);
});

db.close();
