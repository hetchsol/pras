const {
  createTables,
  db
} = require('./database');

console.log('🔄 Initializing database...');

// Create tables
createTables();

// Real users from production database
const users = [
  { username: 'hetch.mbunda', password: 'KSB@2024!', full_name: 'Mbunda Haggai', role: 'admin', department: 'IT', email: 'haggai.mbunda@ksb.com', is_hod: 0, employee_number: 'AAL56' },
  { username: 'mbialesi.namute', password: 'KSB@2024!', full_name: 'Namute Mbialesi', role: 'initiator', department: 'HR', email: 'mbialesi.namute@ksb.com', is_hod: 0, employee_number: 'AAL34' },
  { username: 'mwaka.musonda', password: 'KSB@2024!', full_name: 'Musonda Mwaka', role: 'initiator', department: 'Lusaka', email: 'mwaka.musonda@ksb.com', is_hod: 0, employee_number: 'AAL52' },
  { username: 'larry.mwambazi', password: 'KSB@2024!', full_name: 'Mwambazi Larry', role: 'hod', department: 'Lusaka', email: 'larry.mwambazi@ksb.com', is_hod: 1, employee_number: 'AAL48' },
  { username: 'dickson.chipwalu', password: 'KSB@2024!', full_name: 'Chipwalu Dickson', role: 'initiator', department: 'Lusaka', email: 'dickson.chipwalu@ksb.com', is_hod: 0, employee_number: 'AAL53' },
  { username: 'hillary.chaponda', password: 'KSB@2024!', full_name: 'Chaponda Hillary', role: 'initiator', department: 'Lusaka', email: 'hillary.chaponda@ksb.com', is_hod: 0, employee_number: 'AAL47' },
  { username: 'bernard.kalimba', password: 'KSB@2024!', full_name: 'Kalimba Bernard', role: 'initiator', department: 'Lusaka', email: 'no.address@ksb.com', is_hod: 0, employee_number: 'AAL32' },
  { username: 'moses.phiri', password: 'KSB@2024!', full_name: 'Phiri Moses', role: 'initiator', department: 'Lusaka', email: 'moses.phiri@ksb.com', is_hod: 0, employee_number: 'AAL33' },
  { username: 'john.chabala', password: 'KSB@2024!', full_name: 'John Chabala', role: 'initiator', department: 'Operations', email: 'john.chabala@ksb.com', is_hod: 0, employee_number: 'AAL02' },
  { username: 'waden.chishimba', password: 'KSB@2024!', full_name: 'Waden Chishimba', role: 'initiator', department: 'Sales', email: 'waden.chishimba@ksb.com', is_hod: 0, employee_number: 'AAL27' },
  { username: 'ashley.rabie', password: 'KSB@2024!', full_name: 'Rabie Ashley', role: 'initiator', department: 'Solwezi', email: 'ashley.rabie@ksb.com', is_hod: 0, employee_number: 'AAL55' },
  { username: 'lina.zimba', password: 'KSB@2024!', full_name: 'Zimba Lina', role: 'initiator', department: 'Sales', email: 'lina.zimba@ksb.com', is_hod: 0, employee_number: 'AAL46' },
  { username: 'annie.nanyangwe', password: 'KSB@2024!', full_name: 'Nanyangwe Annie', role: 'initiator', department: 'Finance', email: 'annie.nanyangwe@ksb.com', is_hod: 0, employee_number: 'AAL26' },
  { username: 'nason.nguni', password: 'KSB@2024!', full_name: 'Nason Nguni', role: 'initiator', department: 'Finance', email: 'nason.nguni@ksb.com', is_hod: 0, employee_number: 'AAL51' },
  { username: 'moses.shebele', password: 'KSB@2024!', full_name: 'Shebele Moses', role: 'hod', department: 'Sales', email: 'moses.shebele@ksb.com', is_hod: 1, employee_number: 'AAL12' },
  { username: 'anne.banda', password: 'KSB@2024!', full_name: 'Banda Anne', role: 'finance', department: 'Finance', email: 'anne.banda@ksb.com', is_hod: 0, employee_number: 'AAL43' },
  { username: 'kanyembo.ndhlovu', password: 'KSB@2024!', full_name: 'Ndhlovu Kanyembo', role: 'md', department: 'Executive', email: 'kanyembo.ndhlovu@ksb.com', is_hod: 0, employee_number: 'AAL42' },
  { username: 'kaluya.justin', password: 'KSB@2024!', full_name: 'Kaluya Justin', role: 'initiator', department: 'Operations', email: 'justin.kaluya@ksb.com', is_hod: 0, employee_number: 'AAL03' },
  { username: 'phiri.isaac', password: 'KSB@2024!', full_name: 'Phiri Isaac', role: 'initiator', department: 'Operations', email: 'no.address@ksb.com', is_hod: 0, employee_number: 'AAL09' },
  { username: 'clarence.simwanza', password: 'KSB@2024!', full_name: 'Simwanza Clarence', role: 'procurement', department: 'Sales', email: 'clarence.simwanza@ksb.com', is_hod: 0, employee_number: 'AAL24' },
  { username: 'emmanuel.mumbi', password: 'KSB@2024!', full_name: 'Mumbi Emmanuel', role: 'initiator', department: 'Operations', email: 'no.address@ksb.com', is_hod: 0, employee_number: 'AAL28' },
  { username: 'abraham.mubanga', password: 'KSB@2024!', full_name: 'Mubanga Abraham', role: 'initiator', department: 'Operations', email: 'no.address@ksb.com', is_hod: 0, employee_number: 'AAL38' },
  { username: 'clever.malambo', password: 'KSB@2024!', full_name: 'Malambo Clever', role: 'initiator', department: 'Lusaka', email: 'no.address@ksb.com', is_hod: 0, employee_number: 'AAL49' },
  { username: 'joe.munthali', password: 'KSB@2024!', full_name: 'Munthali Joe Chabawela ', role: 'hod', department: 'Operations', email: 'joe.munthali@ksb.com', is_hod: 1, employee_number: 'AAL50' },
  { username: 'nashon.nguni', password: 'KSB@2024!', full_name: 'Nguni Nashon', role: 'initiator', department: 'Finance', email: 'nashon.nguni@ksb.com', is_hod: 0, employee_number: 'AAL51' },
  { username: 'nkandu.mulobeka', password: 'KSB@2024!', full_name: 'Molobeka Nkandu', role: 'initiator', department: 'Lusaka', email: 'no.address@ksb.com', is_hod: 0, employee_number: 'AAL54' },
  { username: 'mwelwa.mwansa', password: 'KSB@2024!', full_name: 'Mwansa Mwelwa', role: 'initiator', department: 'Finance', email: 'mwelwa.mwansa@ksb.com', is_hod: 0, employee_number: 'AAL57' },
  { username: 'edward.nkonde', password: 'KSB@2024!', full_name: 'Nkonde Edward', role: 'initiator', department: 'Lusaka', email: 'no.address@ksb.com', is_hod: 0, employee_number: 'AAL58' }
];

// Insert users with bcrypt hashing
const bcrypt = require('bcryptjs');
users.forEach(user => {
  try {
    const hashedPassword = bcrypt.hashSync(user.password, 10);
    db.prepare(`
      INSERT INTO users (username, password, name, role, department, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      user.username,
      hashedPassword,
      user.full_name,
      user.role,
      user.department,
      user.email
    );
    console.log(`✅ Created user: ${user.username}`);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.log(`ℹ️  User ${user.username} already exists`);
    } else {
      console.error(`❌ Error creating user ${user.username}:`, err.message);
    }
  }
});

// Real departments from production database
const departments = [
  { name: 'IT', code: 'IT', description: 'Information Technology Department' },
  { name: 'HR', code: 'HR', description: 'Human Resources Department' },
  { name: 'Finance', code: 'FIN', description: 'Finance Department' },
  { name: 'Operations', code: 'OPS', description: 'Operations Department' },
  { name: 'Procurement', code: 'PROC', description: 'Procurement Department' },
  { name: 'Executive', code: 'EXEC', description: 'Executive Management' },
  { name: 'Sales', code: 'SALES', description: 'Sales and Business Development Department' },
  { name: 'Lusaka', code: 'LUS009', description: 'Lusaka Department' },
  { name: 'Solwezi', code: 'SOL010', description: 'Solwezi Department' }
];

departments.forEach(dept => {
  try {
    db.prepare(`
      INSERT INTO departments (name, budget, spent)
      VALUES (?, 100000, 0)
    `).run(dept.name);
    console.log(`✅ Created department: ${dept.name}`);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.log(`ℹ️  Department ${dept.name} already exists`);
    } else {
      console.error(`❌ Error creating department ${dept.name}:`, err.message);
    }
  }
});

// Real vendors from production database (top 20 active vendors)
const vendors = [
  { name: 'Tech Solutions Ltd', code: 'TSL001', tier: 1, rating: 4.5, category: 'Technology', status: 'active', email: 'sales@techsolutions.zm', phone: '+260 211 123456', currency: 'ZMW', country: 'Zambia' },
  { name: 'Office Supplies Co', code: 'OSC002', tier: 1, rating: 4.8, category: 'Office Supplies', status: 'active', email: 'info@officesupplies.zm', phone: '+260 211 234567', currency: 'ZMW', country: 'Zambia' },
  { name: 'Bearing Man Group (BMG)', code: 'ZV00424', tier: 1, rating: 4.0, category: 'Vendor', status: 'active', email: 'bmg@zambia.co.zm', phone: '+260 211 345678', currency: 'ZMW', country: 'Zambia' },
  { name: 'BOLLORE Logistics', code: 'ZV00431', tier: 1, rating: 4.5, category: 'Vendor', status: 'active', email: 'info@bollore.zm', phone: '+260 211 456789', currency: 'ZMW', country: 'Zambia' },
  { name: 'BUILDERS WAREHOUSE INTERNATIONAL', code: 'ZV00440', tier: 1, rating: 4.3, category: 'Vendor', status: 'active', email: 'builders@bw.zm', phone: '+260 211 567890', currency: 'ZMW', country: 'Zambia' },
  { name: 'CAMCO Equipment (Z) Limited', code: 'ZV00442', tier: 1, rating: 4.4, category: 'Vendor', status: 'active', email: 'camco@zambia.co.zm', phone: '+260 211 678901', currency: 'ZMW', country: 'Zambia' },
  { name: 'Game Stores Zambia', code: 'ZV00501', tier: 1, rating: 4.2, category: 'Vendor', status: 'active', email: 'game@zambia.co.zm', phone: '+260 211 789012', currency: 'ZMW', country: 'Zambia' },
  { name: 'PICK N PAY', code: 'ZV00616', tier: 1, rating: 4.6, category: 'Vendor', status: 'active', email: 'pnp@zambia.co.zm', phone: '+260 211 890123', currency: 'ZMW', country: 'Zambia' },
  { name: 'Power Tools Logistics Limited', code: 'ZV00623', tier: 1, rating: 4.1, category: 'Vendor', status: 'active', email: 'powertools@zambia.co.zm', phone: '+260 211 901234', currency: 'ZMW', country: 'Zambia' },
  { name: 'Microsoft', code: 'ZV00584', tier: 1, rating: 5.0, category: 'Vendor', status: 'active', email: 'africa@microsoft.com', phone: '+1 800 642 7676', currency: 'USD', country: 'USA' }
];

vendors.forEach(vendor => {
  try {
    db.prepare(`
      INSERT INTO vendors (name, code, tier, rating, category, status, email, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      vendor.name,
      vendor.code,
      vendor.tier,
      vendor.rating,
      vendor.category,
      vendor.status,
      vendor.email,
      vendor.phone
    );
    console.log(`✅ Created vendor: ${vendor.name}`);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.log(`ℹ️  Vendor ${vendor.name} already exists`);
    } else {
      console.error(`❌ Error creating vendor ${vendor.name}:`, err.message);
    }
  }
});

console.log('✅ Database initialization complete!');
console.log('\n📝 Default password for all users: KSB@2024!');
console.log('⚠️  IMPORTANT: Change passwords after first login!\n');
process.exit(0);
