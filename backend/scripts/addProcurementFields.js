const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'requisitions.db'));

console.log('Adding procurement fields to requisitions table...');

try {
  db.prepare('ALTER TABLE requisitions ADD COLUMN vendor_currency TEXT DEFAULT "ZMW"').run();
  console.log('✅ Added vendor_currency column');
} catch(e) {
  if(e.message.includes('duplicate column name')) {
    console.log('⚠️  vendor_currency column already exists');
  } else {
    console.error('❌ Error adding vendor_currency:', e.message);
  }
}

try {
  db.prepare('ALTER TABLE requisitions ADD COLUMN unit_price REAL').run();
  console.log('✅ Added unit_price column');
} catch(e) {
  if(e.message.includes('duplicate column name')) {
    console.log('⚠️  unit_price column already exists');
  } else {
    console.error('❌ Error adding unit_price:', e.message);
  }
}

try {
  db.prepare('ALTER TABLE requisitions ADD COLUMN total_cost REAL').run();
  console.log('✅ Added total_cost column');
} catch(e) {
  if(e.message.includes('duplicate column name')) {
    console.log('⚠️  total_cost column already exists');
  } else {
    console.error('❌ Error adding total_cost:', e.message);
  }
}

console.log('\n✅ Procurement fields migration completed!');
db.close();
