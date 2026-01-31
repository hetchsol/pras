const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

console.log('\n' + '='.repeat(80));
console.log('INVESTIGATION: WHY HOD JOE CAN\'T SEE ABRAHAM\'S EFT');
console.log('='.repeat(80) + '\n');

// Find Joe
console.log('1️⃣ FINDING JOE:\n');
const joes = db.prepare(`
    SELECT * FROM users
    WHERE full_name LIKE '%Joe%' OR username LIKE '%joe%'
`).all();

console.log(`   Users matching "Joe": ${joes.length}`);
joes.forEach(u => {
    console.log(`   - ID: ${u.id}, Name: ${u.full_name}, Username: ${u.username}, Role: ${u.role}, Dept: ${u.department}`);
});
console.log('');

// Find all HODs
console.log('2️⃣ ALL HOD USERS:\n');
const hods = db.prepare(`
    SELECT * FROM users
    WHERE role = 'hod'
`).all();

console.log(`   Total HODs: ${hods.length}`);
hods.forEach(h => {
    console.log(`   - ID: ${h.id}, Name: ${h.full_name}, Dept: ${h.department}, Username: ${h.username}`);
});
console.log('');

// Find Abraham's most recent EFT
console.log('3️⃣ ABRAHAM\'S MOST RECENT EFT:\n');
const abraham = db.prepare(`
    SELECT * FROM users
    WHERE full_name LIKE '%Abraham%' OR full_name LIKE '%Mubanga%'
`).get();

if (!abraham) {
    console.log('   ❌ Abraham not found!');
} else {
    console.log(`   ✅ Abraham: ID ${abraham.id}, Dept: ${abraham.department}`);

    const recentEFT = db.prepare(`
        SELECT * FROM eft_requisitions
        WHERE initiator_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    `).get(abraham.id);

    if (!recentEFT) {
        console.log('   ❌ No EFT found for Abraham');
    } else {
        console.log(`\n   📄 Most Recent EFT:`);
        console.log(`      ID: ${recentEFT.id}`);
        console.log(`      In Favour Of: ${recentEFT.in_favour_of}`);
        console.log(`      Amount: ${recentEFT.amount}`);
        console.log(`      Purpose: ${recentEFT.purpose || 'N/A'}`);
        console.log(`      Status: ${recentEFT.status}`);
        console.log(`      Initiator ID: ${recentEFT.initiator_id}`);
        console.log(`      Initiator Name: ${recentEFT.initiator_name}`);
        console.log(`      Created: ${recentEFT.created_at}`);
        console.log('');

        // Find the HOD for Abraham's department
        console.log('4️⃣ WHO SHOULD SEE THIS EFT:\n');
        const abrahamHOD = db.prepare(`
            SELECT * FROM users
            WHERE role = 'hod' AND department = ?
        `).get(abraham.department);

        if (!abrahamHOD) {
            console.log(`   ❌ No HOD found for department: ${abraham.department}`);
        } else {
            console.log(`   ✅ HOD for ${abraham.department}:`);
            console.log(`      Name: ${abrahamHOD.full_name}`);
            console.log(`      Username: ${abrahamHOD.username}`);
            console.log(`      ID: ${abrahamHOD.id}`);
            console.log('');
        }

        // Check if the EFT status is appropriate for HOD to see
        console.log('5️⃣ SHOULD HOD SEE THIS EFT:\n');
        if (recentEFT.status === 'pending_hod' || recentEFT.status === 'draft') {
            console.log(`   ✅ YES - Status is "${recentEFT.status}" which requires HOD approval`);
        } else if (recentEFT.status.includes('pending')) {
            console.log(`   ⚠️  MAYBE - Status is "${recentEFT.status}" - depends on workflow`);
        } else {
            console.log(`   ❌ NO - Status is "${recentEFT.status}" - past HOD approval stage`);
        }
        console.log('');

        // Check what the frontend filter would do
        console.log('6️⃣ FRONTEND FILTERING LOGIC:\n');
        console.log('   For HOD role, the backend should return EFTs where:');
        console.log(`   - Status includes "pending_hod" OR`);
        console.log(`   - Status includes "pending" and HOD department matches initiator department`);
        console.log('');
        console.log(`   This EFT:`);
        console.log(`   - Status: ${recentEFT.status}`);
        console.log(`   - Initiator Dept: ${abraham.department}`);
        console.log(`   - HOD Dept: ${abrahamHOD ? abrahamHOD.department : 'N/A'}`);
        console.log(`   - Match: ${abraham.department === (abrahamHOD ? abrahamHOD.department : null)}`);
        console.log('');

        // Check if there are approval records
        console.log('7️⃣ APPROVAL RECORDS:\n');
        const approvals = db.prepare(`
            SELECT * FROM form_approvals
            WHERE form_type = 'eft' AND form_id = ?
            ORDER BY created_at ASC
        `).all(recentEFT.id);

        if (approvals.length === 0) {
            console.log('   ⚠️  No approval records yet');
        } else {
            approvals.forEach((a, i) => {
                console.log(`   ${i + 1}. ${a.approver_role}: ${a.approver_name} - ${a.action}`);
            });
        }
    }
}

console.log('\n' + '='.repeat(80));
console.log('✅ Investigation complete!');
console.log('='.repeat(80) + '\n');

db.close();
