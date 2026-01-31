const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// User Schema (inline to avoid path issues)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  full_name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  department: { type: String, required: true },
  employee_number: { type: String },
  is_hod: { type: Number, default: 0 },
  supervisor: { type: String },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function importUsers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/purchase_requisition_db';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Read Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(__dirname, '../Users_Depts (1).xlsx'));

    const sheet = workbook.getWorksheet('Sheet1');
    const users = [];
    const defaultPassword = await bcrypt.hash('Password123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);

    // Skip header row
    let isHeader = true;
    sheet.eachRow((row, rowNum) => {
      if (isHeader) {
        isHeader = false;
        return;
      }

      const values = row.values;
      const employeeNumber = values[2];
      const fullName = values[3];
      const username = values[4];
      const emailObj = values[5];
      const role = values[6];
      const department = values[7];
      const supervisor = values[8];

      // Skip empty rows
      if (!username || !fullName) return;

      // Extract email text
      const email = typeof emailObj === 'object' ? emailObj.text : emailObj;

      // Normalize role
      let normalizedRole = (role || '').toLowerCase().trim();
      if (normalizedRole === 'hod' || normalizedRole === 'head of department') {
        normalizedRole = 'hod';
      } else if (normalizedRole === 'md' || normalizedRole === 'managing director') {
        normalizedRole = 'md';
      } else if (normalizedRole === 'admin' || normalizedRole === 'administrator') {
        normalizedRole = 'admin';
      } else if (normalizedRole === 'finance' || normalizedRole === 'finance manager') {
        normalizedRole = 'finance';
      } else if (normalizedRole === 'procurement' || normalizedRole === 'procurement officer') {
        normalizedRole = 'procurement';
      } else {
        normalizedRole = 'initiator';
      }

      // Determine if HOD
      const isHod = normalizedRole === 'hod' || normalizedRole === 'md' ? 1 : 0;

      users.push({
        username: username.toLowerCase().trim(),
        password: normalizedRole === 'admin' ? adminPassword : defaultPassword,
        full_name: fullName,
        email: email || `${username}@company.com`,
        role: normalizedRole,
        department: department || 'General',
        employee_number: employeeNumber || '',
        is_hod: isHod,
        supervisor: supervisor || ''
      });
    });

    console.log(`\nFound ${users.length} users to import\n`);

    // Clear existing users (optional - comment out to keep existing)
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Insert users
    let imported = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await User.create(user);
        console.log(`✅ Imported: ${user.username} (${user.role})`);
        imported++;
      } catch (err) {
        if (err.code === 11000) {
          console.log(`⚠️  Skipped duplicate: ${user.username}`);
        } else {
          console.log(`❌ Failed: ${user.username} - ${err.message}`);
        }
        failed++;
      }
    }

    // Add admin user if not exists
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      await User.create({
        username: 'admin',
        password: adminPassword,
        full_name: 'System Administrator',
        email: 'admin@ksb.com',
        role: 'admin',
        department: 'IT',
        is_hod: 0
      });
      console.log('✅ Created admin user');
      imported++;
    }

    console.log(`\n========================================`);
    console.log(`Import complete!`);
    console.log(`✅ Imported: ${imported}`);
    console.log(`❌ Failed/Skipped: ${failed}`);
    console.log(`========================================`);
    console.log(`\nDefault password for all users: Password123`);
    console.log(`Admin password: admin123`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

importUsers();
