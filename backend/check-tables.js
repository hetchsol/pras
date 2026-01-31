const db = require('better-sqlite3')('database.db');

console.log('Existing tables:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => console.log('  -', t.name));

console.log('\nEFT Requisitions Table Schema:');
try {
  const schema = db.prepare('PRAGMA table_info(eft_requisitions)').all();
  schema.forEach(col => console.log(`  ${col.name} (${col.type})`));
} catch (e) {
  console.log('  Table does not exist');
}

db.close();
