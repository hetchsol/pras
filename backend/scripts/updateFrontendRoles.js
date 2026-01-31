const fs = require('fs');
const path = require('path');

const frontendAppPath = path.join(__dirname, '..', '..', 'frontend', 'app.js');

console.log('Updating role comparisons in frontend/app.js...');
console.log('='.repeat(70));

// Read the file
let content = fs.readFileSync(frontendAppPath, 'utf8');
let updateCount = 0;

// Replace all user.role === 'initiator' or user.role === 'Initiator'
content = content.replace(/user\.role\s*===\s*['"](?:initiator|Initiator)['"]/g, (match) => {
    updateCount++;
    return `hasRole(user.role, 'initiator')`;
});

// Replace all user.role !== 'initiator' or user.role !== 'Initiator'
content = content.replace(/user\.role\s*!==\s*['"](?:initiator|Initiator)['"]/g, (match) => {
    updateCount++;
    return `!hasRole(user.role, 'initiator')`;
});

// Write the updated content back
fs.writeFileSync(frontendAppPath, content, 'utf8');

console.log(`✅ Updated ${updateCount} initiator role comparisons`);
console.log('='.repeat(70));
console.log('File saved: frontend/app.js');
console.log('\nAll "initiator" and "Initiator" role checks are now case-insensitive.');
