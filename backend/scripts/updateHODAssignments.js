/**
 * Update HOD Assignments from Spreadsheet
 *
 * This script reads the Users_Depts spreadsheet and updates all users
 * with their correct supervisor/HOD assignments.
 */

const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://hloaboratoryservices:EjPLGbgXdMzwP9j@hla.uy7v7.mongodb.net/purchase_requisition_db?retryWrites=true&w=majority&appName=HLA';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  full_name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  department: { type: String, required: true },
  employee_number: { type: String },
  is_hod: { type: Number, default: 0 },
  assigned_hod: { type: mongoose.Schema.Types.Mixed },
  supervisor_name: { type: String },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function updateHODAssignments() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Read the spreadsheet
    const workbook = XLSX.readFile(path.join(__dirname, '..', 'Users_Depts (1).xlsx'));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`\nProcessing ${data.length} users from spreadsheet...\n`);

    // Role mapping from spreadsheet to system roles
    const roleMapping = {
      'Initiator': 'initiator',
      'HOD': 'hod',
      'Finance Manager': 'finance',
      'MD': 'md',
      'Procurement': 'procurement',
      'Admin': 'admin'
    };

    // First pass: Identify HODs and their user IDs
    const hodMap = {};  // Map supervisor name -> user info

    for (const row of data) {
      const role = roleMapping[row.Role] || row.Role.toLowerCase();
      if (role === 'hod' || role === 'finance' || role === 'md') {
        hodMap[row.FullName] = {
          username: row['User Name'],
          fullName: row.FullName,
          department: row.Department,
          role: role
        };
      }
    }

    console.log('HODs identified:');
    for (const [name, info] of Object.entries(hodMap)) {
      console.log(`  - ${name} (${info.role}) - ${info.department}`);
    }
    console.log('');

    // Second pass: Update all users
    let updated = 0;
    let created = 0;
    let errors = 0;

    for (const row of data) {
      const username = row['User Name'];
      const fullName = row.FullName;
      const role = roleMapping[row.Role] || row.Role.toLowerCase();
      const department = row.Department;
      const supervisorName = row.Supervisor;
      const employeeNumber = row['Employee Number'];
      const email = row.Email;

      // Determine if user is HOD
      const isHod = (role === 'hod' || role === 'finance') ? 1 : 0;

      try {
        // Find existing user
        let user = await User.findOne({ username: username });

        if (user) {
          // Update existing user
          user.full_name = fullName;
          user.role = role;
          user.department = department;
          user.supervisor_name = supervisorName || null;
          user.is_hod = isHod;
          user.employee_number = employeeNumber;
          user.email = email;
          await user.save();
          console.log(`Updated: ${username} (${role}) - Supervisor: ${supervisorName || 'None'}`);
          updated++;
        } else {
          // User doesn't exist - just log it
          console.log(`Not found in DB: ${username} (${fullName})`);
          errors++;
        }
      } catch (err) {
        console.error(`Error processing ${username}: ${err.message}`);
        errors++;
      }
    }

    console.log('\n========================================');
    console.log('HOD Assignment Update Complete');
    console.log('========================================');
    console.log(`Updated: ${updated}`);
    console.log(`Not found: ${errors}`);
    console.log('');

    // Verify HOD structure
    console.log('\nVerifying HOD structure...\n');

    const departments = await User.distinct('department');
    for (const dept of departments) {
      console.log(`\n${dept} Department:`);
      const deptUsers = await User.find({ department: dept }).select('username full_name role supervisor_name is_hod');
      for (const u of deptUsers) {
        const hodIndicator = u.is_hod ? ' [HOD]' : '';
        const supervisor = u.supervisor_name ? ` -> Supervisor: ${u.supervisor_name}` : '';
        console.log(`  - ${u.full_name} (${u.role})${hodIndicator}${supervisor}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

updateHODAssignments();
