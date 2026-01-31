const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');

console.log('='.repeat(70));
console.log('NORMALIZING INITIATOR ROLES IN DATABASE');
console.log('='.repeat(70));
console.log();

const db = new sqlite3.Database(dbPath);

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function normalizeRoles() {
    try {
        // Check current initiator users
        console.log('Step 1: Checking current initiator role variations...');
        const initiators = await allAsync(
            "SELECT id, username, full_name, role FROM users WHERE role IN ('initiator', 'Initiator')"
        );

        console.log(`Found ${initiators.length} users with initiator role:`);
        const capitalized = initiators.filter(u => u.role === 'Initiator').length;
        const lowercase = initiators.filter(u => u.role === 'initiator').length;
        console.log(`  - Lowercase 'initiator': ${lowercase}`);
        console.log(`  - Capitalized 'Initiator': ${capitalized}`);
        console.log();

        if (capitalized > 0) {
            console.log('Step 2: Normalizing all to lowercase "initiator"...');
            const result = await runAsync(
                "UPDATE users SET role = 'initiator' WHERE role = 'Initiator'"
            );
            console.log(`✅ Updated ${result.changes} user(s) from 'Initiator' to 'initiator'`);
        } else {
            console.log('Step 2: All roles already normalized ✅');
        }

        console.log();

        // Also normalize HOD role if there are variations
        console.log('Step 3: Checking and normalizing HOD role...');
        const hodUpdate = await runAsync(
            "UPDATE users SET role = 'hod' WHERE role = 'HOD'"
        );
        if (hodUpdate.changes > 0) {
            console.log(`✅ Updated ${hodUpdate.changes} user(s) from 'HOD' to 'hod'`);
        } else {
            console.log('✅ HOD roles already normalized');
        }

        console.log();

        // Show final role distribution
        console.log('Step 4: Final role distribution:');
        const roles = await allAsync(
            'SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC'
        );

        roles.forEach(r => {
            console.log(`  ${r.role}: ${r.count} user(s)`);
        });

        console.log();
        console.log('='.repeat(70));
        console.log('ROLE NORMALIZATION COMPLETE');
        console.log('='.repeat(70));
        console.log();
        console.log('All initiator users now have consistent role: "initiator"');
        console.log('Backend and frontend are now case-insensitive for role checks.');
        console.log();

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        db.close();
    }
}

normalizeRoles().then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
