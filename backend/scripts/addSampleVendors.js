const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisitions.db');
const db = new Database(dbPath);

console.log('📦 Setting up vendors...\n');

// Create vendors table if it doesn't exist
console.log('Creating vendors table...');
db.prepare(`
  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    tier INTEGER NOT NULL,
    rating REAL NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

console.log('✅ Vendors table created/verified\n');
console.log('📦 Adding sample vendors...\n');

const vendors = [
  { name: 'ABC Suppliers Ltd', code: 'ABC001', tier: 1, rating: 4.5, category: 'Office Supplies', status: 'active', email: 'sales@abcsuppliers.com', phone: '+260 211 123456' },
  { name: 'XYZ Trading Company', code: 'XYZ002', tier: 2, rating: 4.2, category: 'IT Equipment', status: 'active', email: 'info@xyztrading.com', phone: '+260 211 234567' },
  { name: 'Global Tech Solutions', code: 'GTS003', tier: 1, rating: 4.8, category: 'Technology', status: 'active', email: 'contact@globaltech.com', phone: '+260 211 345678' },
  { name: 'Premier Office Furniture', code: 'POF004', tier: 2, rating: 4.0, category: 'Furniture', status: 'active', email: 'sales@premierfurniture.com', phone: '+260 211 456789' },
  { name: 'FastTrack Logistics', code: 'FTL005', tier: 3, rating: 3.8, category: 'Transportation', status: 'active', email: 'bookings@fasttrack.com', phone: '+260 211 567890' },
  { name: 'Quality Stationery Mart', code: 'QSM006', tier: 2, rating: 4.3, category: 'Stationery', status: 'active', email: 'orders@qualitymart.com', phone: '+260 211 678901' },
  { name: 'TechHub Electronics', code: 'THE007', tier: 1, rating: 4.6, category: 'Electronics', status: 'active', email: 'sales@techhub.com', phone: '+260 211 789012' },
  { name: 'BuildRight Construction', code: 'BRC008', tier: 2, rating: 4.1, category: 'Construction', status: 'active', email: 'projects@buildright.com', phone: '+260 211 890123' },
  { name: 'Green Valley Supplies', code: 'GVS009', tier: 3, rating: 3.9, category: 'General Supplies', status: 'active', email: 'info@greenvalley.com', phone: '+260 211 901234' },
  { name: 'ProServe Maintenance', code: 'PSM010', tier: 2, rating: 4.4, category: 'Maintenance', status: 'active', email: 'service@proserve.com', phone: '+260 211 012345' }
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO vendors (name, code, tier, rating, category, status, email, phone)
  VALUES (@name, @code, @tier, @rating, @category, @status, @email, @phone)
`);

const insertMany = db.transaction((vendors) => {
  for (const vendor of vendors) {
    insert.run(vendor);
  }
});

insertMany(vendors);

// Check what we inserted
const count = db.prepare('SELECT COUNT(*) as count FROM vendors').get();
console.log(`✅ Sample vendors added successfully!`);
console.log(`📊 Total vendors in database: ${count.count}\n`);

// Show all vendors
const allVendors = db.prepare('SELECT id, name, code, tier, rating, category, status FROM vendors').all();
console.log('Vendors in database:');
allVendors.forEach(v => {
  console.log(`  ${v.id}. ${v.name} (${v.code}) - ${v.category} - Tier ${v.tier} - Rating: ${v.rating} - Status: ${v.status}`);
});

db.close();
console.log('\n✅ Done!');
