const {
  createTables,
  createUser,
  createVendor,
  db
} = require('./database');

console.log('🔄 Initializing database...');

// Create tables
createTables();

// Seed users
const users = [
  { username: 'john.banda', password: 'password123', name: 'John Banda', role: 'initiator', department: 'IT', email: 'john.banda@company.com' },
  { username: 'sarah.mwansa', password: 'password123', name: 'Sarah Mwansa', role: 'hod', department: 'IT', email: 'sarah.mwansa@company.com' },
  { username: 'michael.phiri', password: 'password123', name: 'Michael Phiri', role: 'procurement', department: 'Procurement', email: 'michael.phiri@company.com' },
  { username: 'grace.banda', password: 'password123', name: 'Grace Banda', role: 'finance', department: 'Finance', email: 'grace.banda@company.com' },
  { username: 'robert.mulenga', password: 'password123', name: 'Dr. Robert Mulenga', role: 'md', department: 'Executive', email: 'robert.mulenga@company.com' },
  { username: 'admin', password: 'admin123', name: 'David Tembo', role: 'admin', department: 'IT', email: 'david.tembo@company.com' }
];

users.forEach(user => {
  try {
    createUser(user);
    console.log(`✅ Created user: ${user.username}`);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.log(`ℹ️  User ${user.username} already exists`);
    } else {
      console.error(`❌ Error creating user ${user.username}:`, err.message);
    }
  }
});

// Seed vendors
const vendors = [
  { name: 'Tech Hub Lusaka', code: 'VEN-THL-2023', tier: 1, rating: 4.5, category: 'IT Equipment', status: 'active', email: 'quotes@techhub.co.zm', phone: '+260 211 123456' },
  { name: 'Computer World Zambia', code: 'VEN-CWZ-2022', tier: 1, rating: 4.8, category: 'IT Equipment', status: 'active', email: 'info@computerworld.co.zm', phone: '+260 211 234567' },
  { name: 'Digital Solutions Ltd', code: 'VEN-DSL-2023', tier: 2, rating: 4.2, category: 'IT Equipment', status: 'active', email: 'sales@digitalsolutions.co.zm', phone: '+260 211 345678' }
];

vendors.forEach(vendor => {
  try {
    createVendor(vendor);
    console.log(`✅ Created vendor: ${vendor.name}`);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.log(`ℹ️  Vendor ${vendor.name} already exists`);
    } else {
      console.error(`❌ Error creating vendor ${vendor.name}:`, err.message);
    }
  }
});

// Seed departments
const departments = [
  { name: 'IT', budget: 500000, spent: 320000 },
  { name: 'HR', budget: 400000, spent: 280000 },
  { name: 'Finance', budget: 300000, spent: 200000 },
  { name: 'Marketing', budget: 600000, spent: 330000 }
];

departments.forEach(dept => {
  try {
    db.prepare(`
      INSERT INTO departments (name, budget, spent)
      VALUES (?, ?, ?)
    `).run(dept.name, dept.budget, dept.spent);
    console.log(`✅ Created department: ${dept.name}`);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.log(`ℹ️  Department ${dept.name} already exists`);
    } else {
      console.error(`❌ Error creating department ${dept.name}:`, err.message);
    }
  }
});

console.log('✅ Database initialization complete!');
process.exit(0);