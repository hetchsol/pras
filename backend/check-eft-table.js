const db = require('better-sqlite3')('requisitions.db');

console.log('EFT Requisitions Table Schema:');
try {
  const schema = db.prepare('PRAGMA table_info(eft_requisitions)').all();
  if (schema.length === 0) {
    console.log('  Table does not exist or is empty');
  } else {
    schema.forEach(col => console.log(`  ${col.name.padEnd(25)} ${col.type}`));
  }
} catch (e) {
  console.log('  Error:', e.message);
}

db.close();
