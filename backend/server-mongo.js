require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database-mongo');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, file://)
    if (!origin) return callback(null, true);
    if (origin.startsWith('file://') || origin === 'null') return callback(null, true);
    callback(null, true); // Allow all origins in this version
  },
  credentials: true
}));

app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// JWT Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Helper function to get department filter based on user role
// Finance, MD, Admin see everything; HODs see their department's forms; Others see only their own
const getDepartmentFilter = async (user) => {
  const userRole = user.role?.toLowerCase();

  // Finance, MD, Admin can see everything
  if (['finance', 'md', 'admin'].includes(userRole)) {
    return {}; // No filter - see all
  }

  // Get full user details including department and name
  const fullUser = await db.getUserById(user.id);
  if (!fullUser) {
    return { initiator_id: user.id }; // Fallback to own forms only
  }

  // HODs see forms from users in their department who have them as supervisor
  if (userRole === 'hod' || fullUser.is_hod === 1) {
    // Get all users who have this HOD as their supervisor
    const subordinates = await db.User.find({
      supervisor_name: fullUser.full_name
    }).select('_id full_name username');

    const subordinateIds = subordinates.map(u => u._id);
    const subordinateNames = subordinates.map(u => u.full_name);

    // HOD can see their own forms + forms from subordinates
    return {
      $or: [
        { initiator_id: user.id },
        { initiator_id: fullUser._id },
        { initiator_id: { $in: subordinateIds } },
        { initiator_name: fullUser.full_name },
        { initiator_name: { $in: subordinateNames } },
        // Also match by department for forms where supervisor isn't set
        { department: fullUser.department }
      ]
    };
  }

  // Initiators and other roles see only their own forms
  return {
    $or: [
      { initiator_id: user.id },
      { initiator_id: fullUser?._id },
      { initiator_name: fullUser?.full_name }
    ]
  };
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Purchase Requisition API is running', database: 'MongoDB' });
});

// Manual seed endpoint (for initial setup)
app.get('/api/seed', async (req, res) => {
  try {
    await db.initializeDatabase();
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Setup specific user roles endpoint
app.get('/api/setup-roles', async (req, res) => {
  try {
    const roleUpdates = [
      { username: 'kanyembo.ndhlovu', role: 'md' },
      { username: 'anne.banda', role: 'finance' },
      { username: 'clarence.simwanza', role: 'procurement' }
    ];

    const results = [];
    for (const update of roleUpdates) {
      const result = await db.User.findOneAndUpdate(
        { username: update.username.toLowerCase() },
        { role: update.role },
        { new: true }
      );
      if (result) {
        results.push({ username: update.username, role: update.role, status: 'updated' });
      } else {
        results.push({ username: update.username, role: update.role, status: 'user not found' });
      }
    }

    res.json({ success: true, message: 'Roles updated', results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Setup HOD assignments based on spreadsheet data
app.post('/api/setup-hod-assignments', authenticate, authorize('admin'), async (req, res) => {
  try {
    // HOD assignment data from spreadsheet
    // Ndhlovu Kanyembo (MD) supervises all HODs and key staff directly
    // Supervisor names match full_name format from spreadsheet
    const assignments = [
      // Operations Department - Joe Munthali is HOD (reports to MD)
      { username: 'joe.munthali', role: 'hod', department: 'Operations', supervisor_name: 'Ndhlovu Kanyembo', is_hod: 1 },
      { username: 'chabala.john', role: 'initiator', department: 'Operations', supervisor_name: 'Munthali Joe Chabawela', is_hod: 0 },
      { username: 'kaluya.justin', role: 'initiator', department: 'Operations', supervisor_name: 'Munthali Joe Chabawela', is_hod: 0 },
      { username: 'phiri.isaac', role: 'initiator', department: 'Operations', supervisor_name: 'Munthali Joe Chabawela', is_hod: 0 },
      { username: 'emmanuel.mumbi', role: 'initiator', department: 'Operations', supervisor_name: 'Munthali Joe Chabawela', is_hod: 0 },
      { username: 'abraham.mubanga', role: 'initiator', department: 'Operations', supervisor_name: 'Munthali Joe Chabawela', is_hod: 0 },

      // Sales Department - Moses Shebele is HOD (reports to MD)
      { username: 'moses.shebele', role: 'hod', department: 'Sales', supervisor_name: 'Ndhlovu Kanyembo', is_hod: 1 },
      { username: 'waden.chishimba', role: 'initiator', department: 'Sales', supervisor_name: 'Shebele Moses', is_hod: 0 },
      { username: 'lina.zimba', role: 'initiator', department: 'Sales', supervisor_name: 'Shebele Moses', is_hod: 0 },
      { username: 'clarence.simwanza', role: 'procurement', department: 'Sales', supervisor_name: 'Ndhlovu Kanyembo', is_hod: 0 },

      // Finance Department - Anne Banda is Finance Manager (reports to MD)
      { username: 'anne.banda', role: 'finance', department: 'Finance', supervisor_name: 'Ndhlovu Kanyembo', is_hod: 1 },
      { username: 'annie.nanyangwe', role: 'initiator', department: 'Finance', supervisor_name: 'Banda Anne', is_hod: 0 },
      { username: 'nashon.nguni', role: 'initiator', department: 'Finance', supervisor_name: 'Banda Anne', is_hod: 0 },
      { username: 'mwelwa.mwansa', role: 'initiator', department: 'Finance', supervisor_name: 'Banda Anne', is_hod: 0 },

      // Lusaka Department - Larry Mwambazi is HOD (reports to MD)
      { username: 'larry.mwambazi', role: 'hod', department: 'Lusaka', supervisor_name: 'Ndhlovu Kanyembo', is_hod: 1 },
      { username: 'bernard.kalimba', role: 'initiator', department: 'Lusaka', supervisor_name: 'Mwambazi Larry', is_hod: 0 },
      { username: 'moses.phiri', role: 'initiator', department: 'Lusaka', supervisor_name: 'Mwambazi Larry', is_hod: 0 },
      { username: 'hillary.chaponda', role: 'initiator', department: 'Lusaka', supervisor_name: 'Mwambazi Larry', is_hod: 0 },
      { username: 'clever.malambo', role: 'initiator', department: 'Lusaka', supervisor_name: 'Mwambazi Larry', is_hod: 0 },
      { username: 'mwaka.musonda', role: 'initiator', department: 'Lusaka', supervisor_name: 'Mwambazi Larry', is_hod: 0 },
      { username: 'dickson.chipwalu', role: 'initiator', department: 'Lusaka', supervisor_name: 'Mwambazi Larry', is_hod: 0 },
      { username: 'nkandu.mulobeka', role: 'initiator', department: 'Lusaka', supervisor_name: 'Mwambazi Larry', is_hod: 0 },
      { username: 'edward.nkonde', role: 'initiator', department: 'Lusaka', supervisor_name: 'Mwambazi Larry', is_hod: 0 },

      // HR Department (reports to MD)
      { username: 'mbialesi.namute', role: 'initiator', department: 'HR', supervisor_name: 'Ndhlovu Kanyembo', is_hod: 0 },

      // IT Department (reports to MD)
      { username: 'hetch.mbunda', role: 'admin', department: 'IT', supervisor_name: 'Ndhlovu Kanyembo', is_hod: 0 },

      // Executive - MD has no supervisor
      { username: 'kanyembo.ndhlovu', role: 'md', department: 'Executive', supervisor_name: null, is_hod: 0 },

      // Solwezi (reports to MD)
      { username: 'ashley.rabie', role: 'initiator', department: 'Solwezi', supervisor_name: 'Ndhlovu Kanyembo', is_hod: 0 }
    ];

    const results = [];
    for (const assignment of assignments) {
      const updateData = {
        role: assignment.role,
        department: assignment.department,
        supervisor_name: assignment.supervisor_name,
        is_hod: assignment.is_hod
      };

      const result = await db.User.findOneAndUpdate(
        { username: assignment.username.toLowerCase() },
        updateData,
        { new: true }
      );

      if (result) {
        results.push({
          username: assignment.username,
          status: 'updated',
          role: assignment.role,
          department: assignment.department,
          supervisor: assignment.supervisor_name
        });
      } else {
        results.push({
          username: assignment.username,
          status: 'user not found'
        });
      }
    }

    // Also update full names for HODs to ensure matching
    const hodFullNames = [
      { username: 'joe.munthali', full_name: 'Munthali Joe Chabawela' },
      { username: 'moses.shebele', full_name: 'Shebele Moses' },
      { username: 'larry.mwambazi', full_name: 'Mwambazi Larry' },
      { username: 'anne.banda', full_name: 'Banda Anne' },
      { username: 'kanyembo.ndhlovu', full_name: 'Ndhlovu Kanyembo' }
    ];

    for (const hod of hodFullNames) {
      await db.User.findOneAndUpdate(
        { username: hod.username.toLowerCase() },
        { full_name: hod.full_name }
      );
    }

    res.json({
      success: true,
      message: 'HOD assignments updated',
      updated: results.filter(r => r.status === 'updated').length,
      notFound: results.filter(r => r.status === 'user not found').length,
      results
    });
  } catch (error) {
    console.error('Error setting up HOD assignments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get HOD structure endpoint
app.get('/api/hod-structure', authenticate, async (req, res) => {
  try {
    const users = await db.User.find().select('username full_name role department supervisor_name is_hod').lean();

    // Group by department
    const departments = {};
    for (const user of users) {
      if (!departments[user.department]) {
        departments[user.department] = { hod: null, members: [] };
      }
      if (user.is_hod === 1 || user.role === 'hod') {
        departments[user.department].hod = user;
      }
      departments[user.department].members.push(user);
    }

    res.json({ success: true, departments, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import users endpoint (for bulk import)
app.post('/api/import-users', async (req, res) => {
  try {
    const { users, clearExisting } = req.body;

    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ error: 'Users array required' });
    }

    // Clear existing users if requested
    if (clearExisting) {
      await db.User.deleteMany({});
    }

    const defaultPassword = await bcrypt.hash('password123', 10);
    const adminPassword = await bcrypt.hash('password123', 10);

    let imported = 0;
    let failed = 0;
    const errors = [];

    for (const user of users) {
      try {
        const role = (user.role || 'initiator').toLowerCase();
        await db.User.create({
          username: user.username.toLowerCase().trim(),
          password: role === 'admin' ? adminPassword : defaultPassword,
          full_name: user.full_name || user.fullName,
          email: user.email,
          role: role,
          department: user.department || 'General',
          employee_number: user.employee_number || '',
          is_hod: role === 'hod' || role === 'md' ? 1 : 0,
          supervisor: user.supervisor || ''
        });
        imported++;
      } catch (err) {
        failed++;
        errors.push({ username: user.username, error: err.message });
      }
    }

    res.json({
      success: true,
      imported,
      failed,
      errors: errors.slice(0, 10), // Return first 10 errors only
      message: `Imported ${imported} users, ${failed} failed`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id || user.id, username: user.username, role: user.role, full_name: user.full_name, department: user.department },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    const refreshToken = require('crypto').randomBytes(40).toString('hex');

    res.json({
      success: true,
      token,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      user: {
        id: user._id || user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        department: user.department,
        employee_number: user.employee_number || '',
        is_hod: user.is_hod,
        can_access_stores: user.can_access_stores || false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    // For simplicity, just return an error - user needs to login again
    res.status(401).json({ error: 'Session expired, please login again' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user._id || user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department: user.department,
      is_hod: user.is_hod,
      employee_number: user.employee_number,
      can_access_stores: user.can_access_stores || false
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// USER ROUTES
// ============================================

app.get('/api/users', authenticate, async (req, res) => {
  try {
    const users = await db.getUsers();
    res.json(users.map(u => ({
      id: u._id || u.id,
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      department: u.department,
      is_hod: u.is_hod
    })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { username, password, full_name, email, role, department, is_hod } = req.body;
    const hashedPassword = await bcrypt.hash(password || 'Password123', 10);

    await db.createUser({
      username,
      password: hashedPassword,
      full_name,
      email,
      role,
      department,
      is_hod: is_hod || 0
    });

    res.status(201).json({ success: true, message: 'User created' });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

app.get('/api/admin/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await db.User.countDocuments();
    const requisitions = await db.Requisition.countDocuments();
    const pendingRequisitions = await db.Requisition.countDocuments({ status: { $regex: /pending/i } });
    const vendors = await db.Vendor.countDocuments();
    const departments = await db.Department.countDocuments();

    res.json({
      users,
      requisitions,
      pendingRequisitions,
      vendors,
      departments
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await db.User.find().select('-password').lean();
    res.json(users.map(u => ({ ...u, id: u._id })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { username, password, full_name, email, role, department, is_hod } = req.body;
    const hashedPassword = await bcrypt.hash(password || 'password123', 10);

    const user = await db.User.create({
      username,
      password: hashedPassword,
      full_name,
      email,
      role,
      department,
      is_hod: is_hod || 0
    });

    res.status(201).json({ success: true, id: user._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { username, full_name, email, role, department, is_hod, assigned_hod, can_access_stores, password } = req.body;
    const updateData = { full_name, email, role, department, is_hod };

    if (username) updateData.username = username;
    if (assigned_hod !== undefined) updateData.assigned_hod = assigned_hod || null;
    if (can_access_stores !== undefined) updateData.can_access_stores = can_access_stores ? true : false;

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await db.User.findByIdAndUpdate(req.params.id, updateData);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/vendors', authenticate, async (req, res) => {
  try {
    const vendors = await db.Vendor.find().sort({ name: 1 }).lean();
    res.json(vendors.map(v => ({ ...v, id: v._id })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/vendors', authenticate, authorize('admin'), async (req, res) => {
  try {
    const vendor = await db.Vendor.create(req.body);
    res.status(201).json({ success: true, id: vendor._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/vendors/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.Vendor.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/vendors/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.Vendor.findByIdAndUpdate(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/vendors/bulk-upload', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    const ops = items.map(item => {
      const filter = item.code ? { code: item.code } : { name: item.name };
      return {
        updateOne: {
          filter,
          update: { $set: item, $setOnInsert: { created_at: new Date() } },
          upsert: true
        }
      };
    });

    const result = await db.Vendor.bulkWrite(ops, { ordered: false });
    const created = result.upsertedCount || 0;
    const updated = result.modifiedCount || 0;
    res.json({
      success: true,
      message: `Imported ${created} new, updated ${updated} existing vendors (${items.length} total processed)`,
      created,
      updated
    });
  } catch (error) {
    console.error('Vendor bulk upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Client routes
app.get('/api/admin/clients', authenticate, async (req, res) => {
  try {
    const clients = await db.Client.find().sort({ name: 1 }).lean();
    res.json(clients.map(c => ({ ...c, id: c._id })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/clients', authenticate, authorize('admin'), async (req, res) => {
  try {
    const client = await db.Client.create(req.body);
    res.status(201).json({ success: true, id: client._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/clients/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.Client.findByIdAndUpdate(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/clients/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.Client.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/clients/bulk-upload', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    const ops = items.map(item => {
      const filter = item.code ? { code: item.code } : { name: item.name };
      return {
        updateOne: {
          filter,
          update: { $set: item, $setOnInsert: { created_at: new Date() } },
          upsert: true
        }
      };
    });

    const result = await db.Client.bulkWrite(ops, { ordered: false });
    const created = result.upsertedCount || 0;
    const updated = result.modifiedCount || 0;
    res.json({
      success: true,
      message: `Imported ${created} new, updated ${updated} existing clients (${items.length} total processed)`,
      created,
      updated
    });
  } catch (error) {
    console.error('Client bulk upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public client list (for dropdowns)
app.get('/api/clients', authenticate, async (req, res) => {
  try {
    const clients = await db.Client.find().sort({ name: 1 }).lean();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/departments', authenticate, async (req, res) => {
  try {
    const departments = await db.Department.find().lean();
    res.json(departments.map(d => ({ ...d, id: d._id })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/budgets', authenticate, async (req, res) => {
  try {
    const departments = await db.Department.find().lean();
    res.json(departments.map(d => ({ ...d, id: d._id })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/budgets', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, budget } = req.body;
    const dept = await db.Department.create({ name, budget, spent: 0 });
    res.status(201).json({ success: true, id: dept._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/budgets/:department', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { budget } = req.body;
    await db.Department.findOneAndUpdate({ name: req.params.department }, { budget });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/pending-requisitions', authenticate, authorize('admin'), async (req, res) => {
  try {
    const requisitions = await db.Requisition.find({ status: { $regex: /pending/i } }).lean();
    res.json(requisitions);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/reassign/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { newUserId } = req.body;
    await db.Requisition.findOneAndUpdate({ id: req.params.id }, { initiator_id: newUserId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/reports/summary', authenticate, authorize('admin'), async (req, res) => {
  try {
    const totalRequisitions = await db.Requisition.countDocuments();
    const approved = await db.Requisition.countDocuments({ status: 'approved' });
    const pending = await db.Requisition.countDocuments({ status: { $regex: /pending/i } });
    const rejected = await db.Requisition.countDocuments({ status: 'rejected' });

    res.json({
      totalRequisitions,
      approved,
      pending,
      rejected,
      totalValue: 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// GRN APPROVER ASSIGNMENT ROUTES (Admin)
// ============================================

// List all GRN approver assignments
app.get('/api/admin/grn-approvers', authenticate, authorize('admin'), async (req, res) => {
  try {
    const assignments = await GRNApproverAssignment.find().sort({ created_at: -1 }).lean();
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching GRN approver assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Create/update a GRN approver assignment
app.post('/api/admin/grn-approvers', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { initiator_name, approver_name } = req.body;
    if (!initiator_name || !approver_name) {
      return res.status(400).json({ error: 'Both initiator_name and approver_name are required' });
    }
    const assignment = await GRNApproverAssignment.findOneAndUpdate(
      { initiator_name },
      { initiator_name, approver_name },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json({ message: 'Assignment saved', assignment });
  } catch (error) {
    console.error('Error saving GRN approver assignment:', error);
    res.status(500).json({ error: 'Failed to save assignment' });
  }
});

// Delete a GRN approver assignment
app.delete('/api/admin/grn-approvers/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await GRNApproverAssignment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Assignment deleted' });
  } catch (error) {
    console.error('Error deleting GRN approver assignment:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// ============================================
// REQUISITION ROUTES
// ============================================

app.get('/api/requisitions', authenticate, async (req, res) => {
  try {
    // Get department-based filter for requisitions
    const userRole = req.user.role?.toLowerCase();

    // Finance, MD, Admin, Procurement can see all requisitions
    if (['finance', 'md', 'admin', 'procurement'].includes(userRole)) {
      const requisitions = await db.getRequisitions();
      return res.json(requisitions);
    }

    // Get full user details
    const fullUser = await db.getUserById(req.user.id);

    // HODs see requisitions from their department
    if (userRole === 'hod' || fullUser?.is_hod === 1) {
      // Get subordinates
      const subordinates = await db.User.find({
        supervisor_name: fullUser.full_name
      }).select('_id full_name username');

      const subordinateIds = subordinates.map(u => u._id);
      const subordinateNames = subordinates.map(u => u.full_name);

      const filter = {
        $or: [
          { initiator_id: req.user.id },
          { initiator_id: fullUser._id },
          { initiator_id: { $in: subordinateIds } },
          { initiator_name: fullUser.full_name },
          { initiator_name: { $in: subordinateNames } },
          { department: fullUser.department }
        ]
      };

      const requisitions = await db.Requisition.find(filter).sort({ created_at: -1 }).lean();
      return res.json(requisitions);
    }

    // Initiators see only their own requisitions
    const filter = {
      $or: [
        { initiator_id: req.user.id },
        { initiator_id: fullUser?._id },
        { initiator_name: fullUser?.full_name }
      ]
    };
    const requisitions = await db.Requisition.find(filter).sort({ created_at: -1 }).lean();
    res.json(requisitions);
  } catch (error) {
    console.error('Error fetching requisitions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/requisitions/:id', authenticate, async (req, res) => {
  try {
    const requisition = await db.getRequisitionById(req.params.id);
    if (!requisition) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    res.json(requisition);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create requisition (handles both simple and full format)
const createRequisitionHandler = async (req, res) => {
  try {
    const { description, quantity, estimatedCost, amount, justification, urgency, items, delivery_location, required_date } = req.body;
    const user = await db.getUserById(req.user.id);
    const department = req.body.department || user?.department || 'General';

    // Generate requisition ID
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    const deptCode = (department || 'GEN').substring(0, 3).toUpperCase();
    const userInitials = req.user.username.substring(0, 2).toUpperCase();
    const reqId = `KSB-${deptCode}-${userInitials}-${dateStr}${timeStr}`;

    // Calculate totals from items if provided
    let totalAmount = amount || estimatedCost || 0;
    let totalQuantity = quantity || 1;
    let desc = description || '';

    if (items && items.length > 0) {
      totalAmount = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
      totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      desc = items.map(i => i.item_name).join(', ');
    }

    await db.createRequisition({
      id: reqId,
      description: desc,
      quantity: totalQuantity,
      estimatedCost: totalAmount,
      amount: totalAmount,
      justification: justification || '',
      department,
      urgency: urgency || 'standard',
      initiatorId: req.user.id,
      initiatorName: user?.full_name || req.user.username,
      status: 'pending_hod'
    });

    res.status(201).json({ success: true, id: reqId, req_number: reqId, message: 'Requisition created' });
  } catch (error) {
    console.error('Create requisition error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

app.post('/api/requisitions', authenticate, createRequisitionHandler);
app.post('/api/requisitions/simple', authenticate, createRequisitionHandler);

app.put('/api/requisitions/:id/approve', authenticate, async (req, res) => {
  try {
    const { action, comment, nextStatus } = req.body;
    const reqId = req.params.id;

    await db.createApproval({
      requisition_id: reqId,
      role: req.user.role,
      userName: req.user.username,
      action,
      comment
    });

    if (nextStatus) {
      await db.updateRequisitionStatus(reqId, nextStatus);
    }

    res.json({ success: true, message: `Requisition ${action}` });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/requisitions/:id/approvals', authenticate, async (req, res) => {
  try {
    const approvals = await db.getApprovalsByRequisitionId(req.params.id);
    res.json(approvals);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit requisition for approval
app.put('/api/requisitions/:id/submit', authenticate, async (req, res) => {
  try {
    const reqId = req.params.id;
    const { selected_hod_id } = req.body;

    await db.updateRequisitionStatus(reqId, 'pending_hod');

    await db.createApproval({
      requisition_id: reqId,
      role: 'initiator',
      userName: req.user.username,
      action: 'submitted',
      comment: 'Submitted for approval'
    });

    res.json({ success: true, message: 'Requisition submitted for approval' });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// HOD approve/reject requisition
app.put('/api/requisitions/:id/hod-approve', authenticate, async (req, res) => {
  try {
    const reqId = req.params.id;
    const { approve, comments } = req.body;

    const newStatus = approve ? 'pending_finance' : 'rejected';
    await db.updateRequisitionStatus(reqId, newStatus);

    await db.createApproval({
      requisition_id: reqId,
      role: 'hod',
      userName: req.user.username,
      action: approve ? 'approved' : 'rejected',
      comment: comments || ''
    });

    res.json({ success: true, message: approve ? 'Approved by HOD' : 'Rejected by HOD' });
  } catch (error) {
    console.error('HOD approve error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Finance approve/reject requisition
app.put('/api/requisitions/:id/finance-approve', authenticate, async (req, res) => {
  try {
    const reqId = req.params.id;
    const { approve, comments } = req.body;

    const newStatus = approve ? 'pending_md' : 'rejected';
    await db.updateRequisitionStatus(reqId, newStatus);

    await db.createApproval({
      requisition_id: reqId,
      role: 'finance',
      userName: req.user.username,
      action: approve ? 'approved' : 'rejected',
      comment: comments || ''
    });

    res.json({ success: true, message: approve ? 'Approved by Finance' : 'Rejected by Finance' });
  } catch (error) {
    console.error('Finance approve error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// MD approve/reject requisition
app.put('/api/requisitions/:id/md-approve', authenticate, async (req, res) => {
  try {
    const reqId = req.params.id;
    const { approve, comments } = req.body;

    const newStatus = approve ? 'approved' : 'rejected';
    await db.updateRequisitionStatus(reqId, newStatus);

    await db.createApproval({
      requisition_id: reqId,
      role: 'md',
      userName: req.user.username,
      action: approve ? 'approved' : 'rejected',
      comment: comments || ''
    });

    res.json({ success: true, message: approve ? 'Approved by MD' : 'Rejected by MD' });
  } catch (error) {
    console.error('MD approve error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ============================================
// VENDOR ROUTES
// ============================================

app.get('/api/vendors', authenticate, async (req, res) => {
  try {
    const vendors = await db.getVendors();
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// DEPARTMENT ROUTES
// ============================================

app.get('/api/departments', authenticate, async (req, res) => {
  try {
    const departments = await db.getDepartments();
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// FX RATES ROUTES
// ============================================

app.get('/api/fx-rates', authenticate, async (req, res) => {
  try {
    const rates = await db.getFXRates();
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// EFT REQUISITION ROUTES
// ============================================

app.get('/api/eft-requisitions', authenticate, async (req, res) => {
  try {
    const filter = await getDepartmentFilter(req.user);
    const efts = await db.EFTRequisition.find(filter).sort({ created_at: -1 }).lean();
    res.json(efts);
  } catch (error) {
    console.error('Error fetching EFT requisitions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/eft-requisitions', authenticate, async (req, res) => {
  try {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    const eftId = `KSB-EFT-${dateStr}${timeStr}`;

    await db.createEFTRequisition({
      id: eftId,
      ...req.body,
      initiator_id: req.user.id,
      initiator_name: req.user.username,
      status: 'pending_hod'
    });

    res.status(201).json({ success: true, id: eftId });
  } catch (error) {
    console.error('Create EFT error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// EXPENSE CLAIM ROUTES
// ============================================

app.get('/api/expense-claims', authenticate, async (req, res) => {
  try {
    const filter = await getDepartmentFilter(req.user);
    const claims = await db.ExpenseClaim.find(filter).sort({ created_at: -1 }).lean();
    res.json(claims);
  } catch (error) {
    console.error('Error fetching expense claims:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/expense-claims', authenticate, async (req, res) => {
  try {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    const claimId = `KSB-EXP-${dateStr}${timeStr}`;

    await db.createExpenseClaim({
      id: claimId,
      ...req.body,
      initiator_id: req.user.id,
      initiator_name: req.user.username,
      status: 'pending_hod'
    });

    res.status(201).json({ success: true, id: claimId });
  } catch (error) {
    console.error('Create expense claim error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// FORMS ROUTES (aliases for expense claims and EFT)
// ============================================

app.get('/api/forms/expense-claims', authenticate, async (req, res) => {
  try {
    const filter = await getDepartmentFilter(req.user);
    const claims = await db.ExpenseClaim.find(filter).sort({ created_at: -1 }).lean();
    res.json(claims);
  } catch (error) {
    console.error('Error fetching expense claims:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/forms/eft-requisitions', authenticate, async (req, res) => {
  try {
    const filter = await getDepartmentFilter(req.user);
    const efts = await db.EFTRequisition.find(filter).sort({ created_at: -1 }).lean();
    res.json(efts);
  } catch (error) {
    console.error('Error fetching EFT requisitions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/forms/petty-cash-requisitions', authenticate, async (req, res) => {
  try {
    const filter = await getDepartmentFilter(req.user);
    const pettyCash = await db.PettyCashRequisition.find(filter).sort({ created_at: -1 }).lean();
    res.json(pettyCash);
  } catch (error) {
    console.error('Error fetching petty cash requisitions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST forms - create expense claims
app.post('/api/forms/expense-claims', authenticate, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    const claimId = `KSB-EXP-${dateStr}${timeStr}`;

    const claim = await db.ExpenseClaim.create({
      id: claimId,
      employee_name: req.body.employee_name || user?.full_name,
      employee_number: req.body.employee_number || user?.employee_number || '',
      department: req.body.department || user?.department || 'General',
      reason_for_trip: req.body.reason_for_trip || req.body.purpose || '',
      total_kilometers: req.body.total_kilometers || 0,
      km_rate: req.body.km_rate || 0,
      sub_total: req.body.sub_total || 0,
      total_travel: req.body.total_travel || 0,
      total_claim: req.body.total_claim || req.body.amount || 0,
      amount_advanced: req.body.amount_advanced || 0,
      amount_due: req.body.amount_due || 0,
      initiator_id: req.user.id,
      initiator_name: user?.full_name || req.user.username,
      status: 'pending_hod',
      items: req.body.items || []
    });

    res.status(201).json({ success: true, id: claimId, claim_number: claimId });
  } catch (error) {
    console.error('Create expense claim error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// POST forms - create EFT requisitions
app.post('/api/forms/eft-requisitions', authenticate, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    const eftId = `KSB-EFT-${dateStr}${timeStr}`;

    const eft = await db.EFTRequisition.create({
      id: eftId,
      eft_chq_number: req.body.eft_chq_number || null,
      amount: req.body.amount || 0,
      amount_in_words: req.body.amount_in_words || '',
      in_favour_of: req.body.in_favour_of || req.body.payee || '',
      bank_account_number: req.body.bank_account_number || '',
      bank_name: req.body.bank_name || '',
      branch: req.body.branch || '',
      purpose: req.body.purpose || req.body.description || '',
      account_code: req.body.account_code || '',
      description: req.body.description || '',
      department: req.body.department || user?.department || '',
      initiator_id: req.user.id,
      initiator_name: user?.full_name || req.user.username,
      status: 'pending_hod'
    });

    res.status(201).json({ success: true, id: eftId, eft_number: eftId });
  } catch (error) {
    console.error('Create EFT requisition error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// POST forms - create Petty Cash requisitions
app.post('/api/forms/petty-cash-requisitions', authenticate, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    const pettyCashId = `KSB-PC-${dateStr}${timeStr}`;

    const pettyCash = await db.PettyCashRequisition.create({
      id: pettyCashId,
      payee_name: req.body.payee_name || user?.full_name || '',
      department: req.body.department || user?.department || '',
      purpose: req.body.purpose || '',
      description: req.body.description || '',
      amount: req.body.amount || 0,
      amount_in_words: req.body.amount_in_words || '',
      items: req.body.items || [],
      initiator_id: req.user.id,
      initiator_name: user?.full_name || req.user.username,
      status: 'pending_hod'
    });

    res.status(201).json({ success: true, id: pettyCashId, petty_cash_number: pettyCashId });
  } catch (error) {
    console.error('Create petty cash requisition error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// PDF Generation endpoints
const { generateExpenseClaimPDF, generateEFTPDF, generatePettyCashPDF } = require('./utils/formsPDFGenerator');
const os = require('os');

// Expense Claim PDF
app.get('/api/forms/expense-claims/:id/pdf', authenticate, async (req, res) => {
  try {
    const claimId = req.params.id;
    let claim = null;
    try {
      claim = await db.ExpenseClaim.findById(claimId).lean();
    } catch (e) {}
    if (!claim) {
      claim = await db.ExpenseClaim.findOne({ id: claimId }).lean();
    }
    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    const outputPath = path.join(os.tmpdir(), `expense_claim_${claim.id}.pdf`);
    await generateExpenseClaimPDF(claim, claim.items || [], claim.approvals || [], outputPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ExpenseClaim_${claim.id}.pdf"`);

    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);
    fileStream.on('end', () => {
      fs.unlink(outputPath, () => {});
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// EFT Requisition PDF
app.get('/api/forms/eft-requisitions/:id/pdf', authenticate, async (req, res) => {
  try {
    const reqId = req.params.id;
    let eft = null;
    try {
      eft = await db.EFTRequisition.findById(reqId).lean();
    } catch (e) {}
    if (!eft) {
      eft = await db.EFTRequisition.findOne({ id: reqId }).lean();
    }
    if (!eft) {
      return res.status(404).json({ error: 'EFT requisition not found' });
    }

    const outputPath = path.join(os.tmpdir(), `eft_${eft.id}.pdf`);
    await generateEFTPDF(eft, eft.approvals || [], outputPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="EFT_${eft.id}.pdf"`);

    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);
    fileStream.on('end', () => {
      fs.unlink(outputPath, () => {});
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Petty Cash PDF
app.get('/api/forms/petty-cash-requisitions/:id/pdf', authenticate, async (req, res) => {
  try {
    const reqId = req.params.id;
    let pc = null;
    try {
      pc = await db.PettyCashRequisition.findById(reqId).lean();
    } catch (e) {}
    if (!pc) {
      pc = await db.PettyCashRequisition.findOne({ id: reqId }).lean();
    }
    if (!pc) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    const outputPath = path.join(os.tmpdir(), `petty_cash_${pc.id}.pdf`);
    await generatePettyCashPDF(pc, pc.items || [], pc.approvals || [], outputPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="PettyCash_${pc.id}.pdf"`);

    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);
    fileStream.on('end', () => {
      fs.unlink(outputPath, () => {});
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Purchase Requisition PDF (placeholder)
app.get('/api/requisitions/:id/pdf', authenticate, (req, res) => {
  res.status(501).json({ error: 'PDF generation not available for purchase requisitions in this version' });
});

// ============================================
// APPROVAL ENDPOINTS FOR ALL FORM TYPES
// ============================================

// Approve/Reject Expense Claim
app.put('/api/forms/expense-claims/:id/approve', authenticate, async (req, res) => {
  try {
    const { approved, approver_role, approver_name, comments } = req.body;
    const claimId = req.params.id;

    // Try to find by ObjectId first, then by custom id field
    let claim = null;
    try {
      claim = await db.ExpenseClaim.findById(claimId);
    } catch (e) {
      // Not a valid ObjectId, try finding by custom id
    }
    if (!claim) {
      claim = await db.ExpenseClaim.findOne({ id: claimId });
    }
    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    // Determine new status based on approver role and approval decision
    let newStatus;
    if (!approved) {
      newStatus = 'rejected';
    } else if (approver_role === 'hod') {
      newStatus = 'pending_finance';
    } else if (approver_role === 'finance') {
      newStatus = 'pending_md';
    } else if (approver_role === 'md' || approver_role === 'admin') {
      newStatus = 'approved';
    } else {
      newStatus = 'pending_finance';
    }

    // Add approval record
    const approvalRecord = {
      role: approver_role,
      name: approver_name,
      action: approved ? 'approved' : 'rejected',
      comments: comments,
      date: new Date()
    };

    // Update claim
    claim.status = newStatus;
    if (!claim.approvals) claim.approvals = [];
    claim.approvals.push(approvalRecord);
    claim.updated_at = new Date();

    await claim.save();

    res.json({ success: true, message: `Expense claim ${approved ? 'approved' : 'rejected'}`, claim });
  } catch (error) {
    console.error('Error approving expense claim:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Approve/Reject EFT Requisition
app.put('/api/forms/eft-requisitions/:id/approve', authenticate, async (req, res) => {
  try {
    const { approved, approver_role, approver_name, comments } = req.body;
    const reqId = req.params.id;

    // Try to find by ObjectId first, then by custom id field
    let eftReq = null;
    try {
      eftReq = await db.EFTRequisition.findById(reqId);
    } catch (e) {
      // Not a valid ObjectId, try finding by custom id
    }
    if (!eftReq) {
      eftReq = await db.EFTRequisition.findOne({ id: reqId });
    }
    if (!eftReq) {
      return res.status(404).json({ error: 'EFT requisition not found' });
    }

    // Determine new status based on approver role and approval decision
    let newStatus;
    if (!approved) {
      newStatus = 'rejected';
    } else if (approver_role === 'hod') {
      newStatus = 'pending_finance';
    } else if (approver_role === 'finance') {
      newStatus = 'pending_md';
    } else if (approver_role === 'md' || approver_role === 'admin') {
      newStatus = 'approved';
    } else {
      newStatus = 'pending_finance';
    }

    // Add approval record
    const approvalRecord = {
      role: approver_role,
      name: approver_name,
      action: approved ? 'approved' : 'rejected',
      comments: comments,
      date: new Date()
    };

    // Update requisition
    eftReq.status = newStatus;
    if (!eftReq.approvals) eftReq.approvals = [];
    eftReq.approvals.push(approvalRecord);
    eftReq.updated_at = new Date();

    await eftReq.save();

    res.json({ success: true, message: `EFT requisition ${approved ? 'approved' : 'rejected'}`, requisition: eftReq });
  } catch (error) {
    console.error('Error approving EFT requisition:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Approve/Reject Petty Cash Requisition
app.put('/api/forms/petty-cash-requisitions/:id/approve', authenticate, async (req, res) => {
  try {
    const { approved, approver_role, approver_name, comments } = req.body;
    const reqId = req.params.id;

    // Try to find by ObjectId first, then by custom id field
    let pcReq = null;
    try {
      pcReq = await db.PettyCashRequisition.findById(reqId);
    } catch (e) {
      // Not a valid ObjectId, try finding by custom id
    }
    if (!pcReq) {
      pcReq = await db.PettyCashRequisition.findOne({ id: reqId });
    }
    if (!pcReq) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    // Determine new status based on approver role and approval decision
    let newStatus;
    if (!approved) {
      newStatus = 'rejected';
    } else if (approver_role === 'hod') {
      newStatus = 'pending_finance';
    } else if (approver_role === 'finance') {
      newStatus = 'pending_md';
    } else if (approver_role === 'md' || approver_role === 'admin') {
      newStatus = 'approved';
    } else {
      newStatus = 'pending_finance';
    }

    // Add approval record
    const approvalRecord = {
      role: approver_role,
      name: approver_name,
      action: approved ? 'approved' : 'rejected',
      comments: comments,
      date: new Date()
    };

    // Update requisition
    pcReq.status = newStatus;
    if (!pcReq.approvals) pcReq.approvals = [];
    pcReq.approvals.push(approvalRecord);
    pcReq.updated_at = new Date();

    await pcReq.save();

    res.json({ success: true, message: `Petty cash requisition ${approved ? 'approved' : 'rejected'}`, requisition: pcReq });
  } catch (error) {
    console.error('Error approving petty cash requisition:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Simple requisitions list
app.get('/api/requisitions/simple', authenticate, async (req, res) => {
  try {
    const requisitions = await db.Requisition.find().select('id description status department created_at').lean();
    res.json(requisitions);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Purchase orders (empty for now)
app.get('/api/purchase-orders', authenticate, async (req, res) => {
  res.json([]);
});

// Budget endpoints
app.get('/api/budgets/all-departments', authenticate, async (req, res) => {
  try {
    const departments = await db.Department.find().lean();
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/budgets/overview', authenticate, async (req, res) => {
  try {
    const departments = await db.Department.find().lean();
    const totalBudget = departments.reduce((sum, d) => sum + (d.budget || 0), 0);
    const totalSpent = departments.reduce((sum, d) => sum + (d.spent || 0), 0);
    res.json({ totalBudget, totalSpent, departments });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/budgets/department/:department', authenticate, async (req, res) => {
  try {
    const dept = await db.Department.findOne({ name: req.params.department }).lean();
    res.json(dept || { budget: 0, spent: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// FX rates additional endpoints
app.get('/api/fx-rates/all', authenticate, async (req, res) => {
  try {
    const rates = await db.FXRate.find().lean();
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// STORES ROUTES (Issue Slips & Picking Slips)
// ============================================

const IssueSlip = require('./models/IssueSlip');
const PickingSlip = require('./models/PickingSlip');
const GoodsReceiptNote = require('./models/GoodsReceiptNote');
const GRNApproverAssignment = require('./models/GRNApproverAssignment');

// Fix: drop old non-sparse unique indexes on slip_number (allows multiple null values)
(async () => {
  try {
    await IssueSlip.collection.dropIndex('slip_number_1').catch(() => {});
    await PickingSlip.collection.dropIndex('slip_number_1').catch(() => {});
    await IssueSlip.syncIndexes();
    await PickingSlip.syncIndexes();
  } catch (e) { /* indexes may not exist yet */ }
})();

// Get all issue slips (filtered by user role)
app.get('/api/stores/issue-slips', authenticate, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    const userDepartment = req.user.department;

    let filter = {};

    if (userRole === 'admin' || userRole === 'finance' || userRole === 'finance_manager' || userRole === 'md') {
      // Admin, Finance, MD can see all issue slips
      filter = {};
    } else if (userRole === 'hod') {
      // HODs can see issue slips from their department or pending their approval
      filter = {
        $or: [
          { department: userDepartment },
          { status: 'pending_hod' }
        ]
      };
    } else {
      // Regular users can only see their own issue slips
      filter = {
        $or: [
          { initiator_id: userId },
          { initiator_name: req.user.full_name }
        ]
      };
    }

    const slips = await IssueSlip.find(filter).sort({ created_at: -1 }).lean();

    // Map to match SQLite response format
    const result = slips.map(s => ({
      ...s,
      initiator_full_name: s.initiator_name,
      initiator_department: s.department
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching issue slips:', error);
    res.status(500).json({ error: 'Failed to fetch issue slips' });
  }
});

// Get single issue slip with items and approvals
app.get('/api/stores/issue-slips/:id', authenticate, async (req, res) => {
  try {
    const slip = await IssueSlip.findOne({ id: req.params.id }).lean();

    if (!slip) {
      return res.status(404).json({ error: 'Issue slip not found' });
    }

    slip.initiator_full_name = slip.initiator_name;
    slip.initiator_department = slip.department;

    res.json(slip);
  } catch (error) {
    console.error('Error fetching issue slip:', error);
    res.status(500).json({ error: 'Failed to fetch issue slip' });
  }
});

// Create new issue slip
app.post('/api/stores/issue-slips', authenticate, async (req, res) => {
  try {
    const {
      issued_to,
      department,
      delivery_location,
      delivery_date,
      delivered_by,
      reference_number,
      customer,
      remarks,
      items
    } = req.body;

    const userId = req.user.id;
    const userName = req.user.full_name || req.user.name;

    // Generate unique ID with milliseconds to avoid collisions
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 17);
    const slipId = `KSB-ISS-${timestamp}`;

    // === GRN Stock Validation ===
    if (reference_number) {
      // Validate GRN exists and is received
      const grn = await GoodsReceiptNote.findOne({ id: reference_number }).lean();
      if (!grn) {
        return res.status(400).json({ error: `GRN ${reference_number} not found` });
      }
      if (grn.status !== 'approved') {
        return res.status(400).json({ error: `GRN ${reference_number} is not approved` });
      }

      // Check customer reservation
      if (grn.customer) {
        if (!customer || customer !== grn.customer) {
          return res.status(400).json({ error: `GRN ${reference_number} is reserved for customer "${grn.customer}". Issue slip customer must match.` });
        }
      }

      // Calculate already-issued quantities from this GRN (pending + approved issue slips)
      const existingSlips = await IssueSlip.find({
        reference_number: reference_number,
        status: { $in: ['pending_hod', 'pending_finance', 'approved'] }
      }).lean();

      // Build a map of total issued per item_code/description
      const issuedMap = {};
      existingSlips.forEach(s => {
        (s.items || []).forEach(item => {
          const key = item.item_code || item.description || item.item_name;
          issuedMap[key] = (issuedMap[key] || 0) + (item.quantity || 0);
        });
      });

      // Validate each item against GRN remaining stock
      for (const item of (items || [])) {
        const key = item.item_code || item.description || item.item_name;
        const grnItem = grn.items.find(gi =>
          (gi.item_code && gi.item_code === item.item_code) ||
          (gi.description || gi.item_name) === (item.description || item.item_name)
        );

        if (!grnItem) {
          return res.status(400).json({ error: `Item "${key}" not found on GRN ${reference_number}` });
        }

        const alreadyIssued = issuedMap[key] || 0;
        const remaining = grnItem.quantity_received - alreadyIssued;

        if (item.quantity > remaining) {
          return res.status(400).json({
            error: `Insufficient stock for "${key}": requested ${item.quantity}, available ${remaining} (received ${grnItem.quantity_received}, already issued ${alreadyIssued})`
          });
        }
      }
    }

    const slipItems = (items || []).map(item => ({
      item_code: item.item_code || '',
      item_name: item.item_name,
      description: item.description || '',
      quantity: item.quantity,
      unit: item.unit || 'pcs'
    }));

    const slip = await IssueSlip.create({
      id: slipId,
      issued_to,
      department: department || req.user.department,
      delivery_location,
      delivery_date: delivery_date || null,
      delivered_by,
      reference_number,
      customer,
      remarks,
      initiator_id: userId,
      initiator_name: userName,
      status: 'pending_hod',
      items: slipItems,
      approvals: [{
        role: 'hod',
        name: '',
        action: 'pending',
        comments: '',
        date: new Date()
      }]
    });

    res.status(201).json({
      message: 'Issue slip created successfully',
      slip
    });
  } catch (error) {
    console.error('Error creating issue slip:', error);
    res.status(500).json({ error: 'Failed to create issue slip', details: error.message });
  }
});

// HOD action on issue slip
app.put('/api/stores/issue-slips/:id/hod-action', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userName = req.user.full_name || req.user.name;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const newStatus = action === 'approved' ? 'pending_finance' : 'rejected';

    // Update the HOD approval entry and status
    const updateOps = {
      status: newStatus,
      'approvals.$[hodApproval].name': userName,
      'approvals.$[hodApproval].action': action,
      'approvals.$[hodApproval].comments': comments || '',
      'approvals.$[hodApproval].date': new Date()
    };

    const slip = await IssueSlip.findOneAndUpdate(
      { id },
      { $set: updateOps },
      { arrayFilters: [{ 'hodApproval.role': 'hod' }], new: true }
    );

    if (!slip) {
      return res.status(404).json({ error: 'Issue slip not found' });
    }

    // If approved, add Finance approval entry
    if (action === 'approved') {
      await IssueSlip.findOneAndUpdate(
        { id },
        { $push: { approvals: { role: 'finance', name: '', action: 'pending', comments: '', date: new Date() } } }
      );
    }

    res.json({ message: `Issue slip ${action} by HOD successfully` });
  } catch (error) {
    console.error('Error processing HOD action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  }
});

// Finance action on issue slip
app.put('/api/stores/issue-slips/:id/finance-action', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userName = req.user.full_name || req.user.name;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const newStatus = action === 'approved' ? 'approved' : 'rejected';

    const slip = await IssueSlip.findOneAndUpdate(
      { id },
      {
        $set: {
          status: newStatus,
          'approvals.$[finApproval].name': userName,
          'approvals.$[finApproval].action': action,
          'approvals.$[finApproval].comments': comments || '',
          'approvals.$[finApproval].date': new Date()
        }
      },
      { arrayFilters: [{ 'finApproval.role': 'finance' }], new: true }
    );

    if (!slip) {
      return res.status(404).json({ error: 'Issue slip not found' });
    }

    res.json({ message: `Issue slip ${action} by Finance successfully` });
  } catch (error) {
    console.error('Error processing Finance action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  }
});

// Generate Issue Slip PDF
app.get('/api/stores/issue-slips/:id/pdf', authenticate, async (req, res) => {
  try {
    const slip = await IssueSlip.findOne({ id: req.params.id }).lean();

    if (!slip) {
      return res.status(404).json({ error: 'Issue slip not found' });
    }

    slip.initiator_full_name = slip.initiator_name;
    slip.initiator_department = slip.department;

    const { generateIssueSlipPDF } = require('./utils/storesPDFGenerator');
    const outputPath = path.join(__dirname, `${req.params.id}.pdf`);

    await generateIssueSlipPDF(slip, slip.items || [], slip.approvals || [], outputPath);

    res.download(outputPath, `${req.params.id}.pdf`, (err) => {
      if (err) console.error('Error sending PDF:', err);
      const fs = require('fs');
      try { fs.unlinkSync(outputPath); } catch(e) {}
    });
  } catch (error) {
    console.error('Error generating issue slip PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Get all picking slips (filtered by user role)
app.get('/api/stores/picking-slips', authenticate, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    let filter = {};

    if (userRole === 'admin' || userRole === 'finance' || userRole === 'finance_manager' || userRole === 'md' || userRole === 'hod') {
      // Admin, Finance, MD, HOD can see all picking slips
      filter = {};
    } else {
      // Regular users can only see their own picking slips
      filter = {
        $or: [
          { initiator_id: userId },
          { initiator_name: req.user.full_name }
        ]
      };
    }

    const slips = await PickingSlip.find(filter).sort({ created_at: -1 }).lean();

    const result = slips.map(s => ({
      ...s,
      initiator_full_name: s.initiator_name,
      initiator_department: s.department
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching picking slips:', error);
    res.status(500).json({ error: 'Failed to fetch picking slips' });
  }
});

// Get single picking slip with items
app.get('/api/stores/picking-slips/:id', authenticate, async (req, res) => {
  try {
    const slip = await PickingSlip.findOne({ id: req.params.id }).lean();

    if (!slip) {
      return res.status(404).json({ error: 'Picking slip not found' });
    }

    slip.initiator_full_name = slip.initiator_name;
    slip.initiator_department = slip.department;

    res.json(slip);
  } catch (error) {
    console.error('Error fetching picking slip:', error);
    res.status(500).json({ error: 'Failed to fetch picking slip' });
  }
});

// Create new picking slip
app.post('/api/stores/picking-slips', authenticate, async (req, res) => {
  try {
    const {
      picked_by,
      destination,
      delivery_location,
      department,
      reference_number,
      customer,
      remarks,
      items
    } = req.body;

    const userId = req.user.id;
    const userName = req.user.full_name || req.user.name;

    // Generate unique ID with milliseconds to avoid collisions
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 17);
    const slipId = `KSB-PKS-${timestamp}`;

    const slipItems = (items || []).map(item => ({
      item_code: item.item_code || '',
      item_name: item.item_name,
      description: item.description || '',
      quantity: item.quantity,
      unit: item.unit || 'pcs'
    }));

    const slip = await PickingSlip.create({
      id: slipId,
      picked_by,
      destination,
      delivery_location,
      department: department || req.user.department,
      reference_number,
      customer,
      remarks,
      initiator_id: userId,
      initiator_name: userName,
      status: 'completed',
      items: slipItems
    });

    res.status(201).json({
      message: 'Picking slip created successfully',
      slip
    });
  } catch (error) {
    console.error('Error creating picking slip:', error);
    res.status(500).json({ error: 'Failed to create picking slip', details: error.message });
  }
});

// Generate Picking Slip PDF
app.get('/api/stores/picking-slips/:id/pdf', authenticate, async (req, res) => {
  try {
    const slip = await PickingSlip.findOne({ id: req.params.id }).lean();

    if (!slip) {
      return res.status(404).json({ error: 'Picking slip not found' });
    }

    slip.initiator_full_name = slip.initiator_name;
    slip.initiator_department = slip.department;

    const { generatePickingSlipPDF } = require('./utils/storesPDFGenerator');
    const outputPath = path.join(__dirname, `${req.params.id}.pdf`);

    await generatePickingSlipPDF(slip, slip.items || [], outputPath);

    res.download(outputPath, `${req.params.id}.pdf`, (err) => {
      if (err) console.error('Error sending PDF:', err);
      const fs = require('fs');
      try { fs.unlinkSync(outputPath); } catch(e) {}
    });
  } catch (error) {
    console.error('Error generating picking slip PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ============================================
// GRN (Goods Receipt Notes) ROUTES
// ============================================

// Get approved PRs for GRN dropdown
app.get('/api/stores/approved-prs', authenticate, async (req, res) => {
  try {
    const Requisition = require('./models/Requisition');
    const approvedPRs = await Requisition.find({ status: 'approved' }).sort({ created_at: -1 }).lean();
    res.json(approvedPRs);
  } catch (error) {
    console.error('Error fetching approved PRs:', error);
    res.status(500).json({ error: 'Failed to fetch approved PRs' });
  }
});

// Get all GRNs (filtered by user role)
app.get('/api/stores/grns', authenticate, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    let filter = {};
    if (userRole === 'admin' || userRole === 'finance' || userRole === 'finance_manager' || userRole === 'md') {
      filter = {};
    } else if (userRole === 'hod') {
      filter = {
        $or: [
          { department: req.user.department },
          { initiator_id: userId },
          { assigned_approver: req.user.full_name }
        ]
      };
    } else {
      filter = {
        $or: [
          { initiator_id: userId },
          { initiator_name: req.user.full_name },
          { assigned_approver: req.user.full_name }
        ]
      };
    }

    const grns = await GoodsReceiptNote.find(filter).sort({ created_at: -1 }).lean();
    res.json(grns);
  } catch (error) {
    console.error('Error fetching GRNs:', error);
    res.status(500).json({ error: 'Failed to fetch GRNs' });
  }
});

// Get single GRN
app.get('/api/stores/grns/:id', authenticate, async (req, res) => {
  try {
    const grn = await GoodsReceiptNote.findOne({ id: req.params.id }).lean();
    if (!grn) {
      return res.status(404).json({ error: 'GRN not found' });
    }
    res.json(grn);
  } catch (error) {
    console.error('Error fetching GRN:', error);
    res.status(500).json({ error: 'Failed to fetch GRN' });
  }
});

// Create new GRN
app.post('/api/stores/grns', authenticate, async (req, res) => {
  try {
    const {
      pr_id, pr_description, supplier, receipt_date,
      delivery_note_number, invoice_number, received_by,
      department, customer, remarks, items
    } = req.body;

    if (!pr_id) {
      return res.status(400).json({ error: 'PR reference is required' });
    }
    if (!received_by) {
      return res.status(400).json({ error: 'Received By is required' });
    }

    // Validate PR exists and is approved
    const Requisition = require('./models/Requisition');
    const pr = await Requisition.findOne({ id: pr_id }).lean();
    if (!pr) {
      return res.status(400).json({ error: `PR ${pr_id} not found` });
    }
    if (pr.status !== 'approved') {
      return res.status(400).json({ error: `PR ${pr_id} is not approved (status: ${pr.status})` });
    }

    const userId = req.user.id;
    const userName = req.user.full_name || req.user.name;

    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 17);
    const grnId = `KSB-GRN-${timestamp}`;

    const grnItems = (items || []).map(item => ({
      item_code: item.item_code || '',
      item_name: item.item_name || item.description || '',
      description: item.description || '',
      quantity_ordered: item.quantity_ordered || 0,
      quantity_received: item.quantity_received || 0,
      unit: item.unit || 'pcs',
      condition_notes: item.condition_notes || ''
    }));

    // Look up approver assignment for this initiator
    const approverAssignment = await GRNApproverAssignment.findOne({ initiator_name: userName }).lean();
    const assignedApprover = approverAssignment ? approverAssignment.approver_name : null;

    const grn = await GoodsReceiptNote.create({
      id: grnId,
      receipt_date: receipt_date || now,
      pr_id,
      pr_description: pr_description || pr.description,
      supplier: supplier || pr.selected_vendor || '',
      delivery_note_number,
      invoice_number,
      received_by,
      department: department || req.user.department,
      customer,
      remarks,
      initiator_id: userId,
      initiator_name: userName,
      assigned_approver: assignedApprover,
      approvals: [{ role: 'finance', name: '', action: 'pending' }],
      status: 'pending_approval',
      items: grnItems
    });

    res.status(201).json({ message: 'GRN created successfully - pending approval', grn });
  } catch (error) {
    console.error('Error creating GRN:', error);
    res.status(500).json({ error: 'Failed to create GRN', details: error.message });
  }
});

// Approve/Reject GRN
app.put('/api/stores/grns/:id/approve', authenticate, async (req, res) => {
  try {
    const { action, comments } = req.body;
    if (!action || !['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "approved" or "rejected"' });
    }

    const grn = await GoodsReceiptNote.findOne({ id: req.params.id });
    if (!grn) {
      return res.status(404).json({ error: 'GRN not found' });
    }
    if (grn.status !== 'pending_approval') {
      return res.status(400).json({ error: `GRN is already ${grn.status}` });
    }

    const userName = req.user.full_name || req.user.name;

    // Check if user is the assigned approver or has admin/finance role
    const userRole = req.user.role;
    const isAssignedApprover = grn.assigned_approver && grn.assigned_approver === userName;
    const isPrivilegedRole = ['admin', 'finance', 'finance_manager', 'md'].includes(userRole);

    if (!isAssignedApprover && !isPrivilegedRole) {
      return res.status(403).json({ error: 'You are not authorized to approve this GRN' });
    }

    grn.status = action;
    grn.approvals = [{
      role: 'finance',
      name: userName,
      action: action,
      comments: comments || '',
      date: new Date()
    }];

    await grn.save();

    res.json({ message: `GRN ${action} successfully`, grn });
  } catch (error) {
    console.error('Error approving GRN:', error);
    res.status(500).json({ error: 'Failed to process GRN approval' });
  }
});

// Generate GRN PDF
app.get('/api/stores/grns/:id/pdf', authenticate, async (req, res) => {
  try {
    const grn = await GoodsReceiptNote.findOne({ id: req.params.id }).lean();
    if (!grn) {
      return res.status(404).json({ error: 'GRN not found' });
    }

    const { generateGRNPDF } = require('./utils/storesPDFGenerator');
    const outputPath = path.join(__dirname, `${req.params.id}.pdf`);

    await generateGRNPDF(grn, grn.items || [], outputPath);

    res.download(outputPath, `${req.params.id}.pdf`, (err) => {
      if (err) console.error('Error sending PDF:', err);
      const fs = require('fs');
      try { fs.unlinkSync(outputPath); } catch(e) {}
    });
  } catch (error) {
    console.error('Error generating GRN PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Stock Register - computed on the fly
app.get('/api/stores/stock-register', authenticate, async (req, res) => {
  try {
    // Get all approved GRNs (only approved GRNs count toward stock)
    const grns = await GoodsReceiptNote.find({ status: 'approved' }).lean();

    // Get all approved issue slips
    const issueSlips = await IssueSlip.find({
      status: { $in: ['pending_hod', 'pending_finance', 'approved'] }
    }).lean();

    // Build stock map keyed by item identifier
    const stockMap = {};

    // Stock In from GRNs
    grns.forEach(grn => {
      (grn.items || []).forEach(item => {
        const key = item.item_code || item.description || item.item_name;
        if (!stockMap[key]) {
          stockMap[key] = {
            item_code: item.item_code || '',
            item_name: item.item_name || item.description || key,
            unit: item.unit || 'pcs',
            stock_in: 0,
            stock_out: 0,
            reserved: 0
          };
        }
        stockMap[key].stock_in += (item.quantity_received || 0);

        // If GRN has customer reservation, mark as reserved
        if (grn.customer) {
          stockMap[key].reserved += (item.quantity_received || 0);
        }
      });
    });

    // Stock Out from approved issue slips
    issueSlips.forEach(slip => {
      if (slip.status === 'approved') {
        (slip.items || []).forEach(item => {
          const key = item.item_code || item.description || item.item_name;
          if (stockMap[key]) {
            stockMap[key].stock_out += (item.quantity || 0);
          }
        });
      }
    });

    // Calculate available and convert to array
    const register = Object.values(stockMap).map(item => ({
      ...item,
      available: item.stock_in - item.stock_out - item.reserved
    }));

    res.json(register);
  } catch (error) {
    console.error('Error computing stock register:', error);
    res.status(500).json({ error: 'Failed to compute stock register' });
  }
});

// GRNs with remaining stock for issue slip creation
app.get('/api/stores/grns-for-issue', authenticate, async (req, res) => {
  try {
    const grns = await GoodsReceiptNote.find({ status: 'approved' }).sort({ created_at: -1 }).lean();

    // Get all non-rejected issue slips to calculate issued quantities
    const issueSlips = await IssueSlip.find({
      status: { $in: ['pending_hod', 'pending_finance', 'approved'] }
    }).lean();

    // Build issued map: grn_id -> { item_key -> quantity_issued }
    const issuedByGRN = {};
    issueSlips.forEach(slip => {
      if (slip.reference_number) {
        if (!issuedByGRN[slip.reference_number]) {
          issuedByGRN[slip.reference_number] = {};
        }
        (slip.items || []).forEach(item => {
          const key = item.item_code || item.description || item.item_name;
          issuedByGRN[slip.reference_number][key] = (issuedByGRN[slip.reference_number][key] || 0) + (item.quantity || 0);
        });
      }
    });

    // Add remaining quantities to each GRN item
    const result = grns.map(grn => {
      const issuedMap = issuedByGRN[grn.id] || {};
      const itemsWithRemaining = (grn.items || []).map(item => {
        const key = item.item_code || item.description || item.item_name;
        const issued = issuedMap[key] || 0;
        return {
          ...item,
          quantity_issued: issued,
          quantity_remaining: (item.quantity_received || 0) - issued
        };
      });

      const hasRemaining = itemsWithRemaining.some(i => i.quantity_remaining > 0);

      return {
        ...grn,
        items: itemsWithRemaining,
        has_remaining: hasRemaining
      };
    }).filter(grn => grn.has_remaining);

    res.json(result);
  } catch (error) {
    console.error('Error fetching GRNs for issue:', error);
    res.status(500).json({ error: 'Failed to fetch GRNs for issue' });
  }
});

// Catch-all for undefined API routes - return JSON error
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.path}` });
});

// Serve frontend for all other non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const startServer = async () => {
  await db.connectDB();
  await db.initializeDatabase();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🗄️  Database: MongoDB`);
  });
};

startServer();
