const fs = require('fs');
const path = require('path');

const frontendAppPath = path.join(__dirname, 'frontend', 'app.js');

console.log('Updating role comparisons in frontend/app.js...');
console.log('='.repeat(60));

// Read the file
let content = fs.readFileSync(frontendAppPath, 'utf8');

const updates = [];

// Pattern 1: user.role === 'rolename' -> hasRole(user.role, 'rolename')
const pattern1 = /user\.role\s*===\s*'(initiator|Initiator)'/g;
let match1Count = 0;
content = content.replace(pattern1, (match, role) => {
    match1Count++;
    return `hasRole(user.role, 'initiator')`;
});
if (match1Count > 0) updates.push(`Updated ${match1Count} simple initiator equality checks`);

// Pattern 2: user.role !== 'initiator' -> !hasRole(user.role, 'initiator')
const pattern2 = /user\.role\s*!==\s*'initiator'/gi;
let match2Count = 0;
content = content.replace(pattern2, () => {
    match2Count++;
    return `!hasRole(user.role, 'initiator')`;
});
if (match2Count > 0) updates.push(`Updated ${match2Count} initiator inequality checks`);

// Pattern 3: user.role === 'procurement' || user.role === 'admin'
// -> hasRole(user.role, 'procurement', 'admin')
const pattern3 = /user\.role\s*===\s*'initiator'\s*\|\|\s*user\.role\s*===\s*'(\w+)'/g;
let match3Count = 0;
content = content.replace(pattern3, (match, role2) => {
    match3Count++;
    return `hasRole(user.role, 'initiator', '${role2}')`;
});
if (match3Count > 0) updates.push(`Updated ${match3Count} multi-role OR checks with initiator`);

// Pattern 4: ['role1', 'role2'].includes(user.role) where initiator is in array
const pattern4 = /\[([\s\S]*?'initiator'[\s\S]*?)\]\.includes\(user\.role\)/gi;
let match4Count = 0;
content = content.replace(pattern4, (match, rolesStr) => {
    match4Count++;
    // Extract roles from the array
    const roles = rolesStr.match(/'([^']+)'/g) || [];
    return `hasAnyRole(user.role, [${roles.join(', ')}])`;
});
if (match4Count > 0) updates.push(`Updated ${match4Count} array.includes() checks with initiator`);

// Write the updated content back
fs.writeFileSync(frontendAppPath, content, 'utf8');

console.log('\nUpdates completed:');
updates.forEach(update => console.log('✓', update));
console.log('\n' + '='.repeat(60));
console.log('Total patterns updated:', updates.length);
console.log('File saved: frontend/app.js');
console.log('\nNote: Please review the changes to ensure correctness.');
console.log('All "initiator" and "Initiator" role checks are now case-insensitive.');
