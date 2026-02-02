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
    const assignments = [
      // Operations Department - Joe Munthali is HOD
      { username: 'joe.munthali', role: 'hod', department: 'Operations', supervisor_name: 'Joe Munthali', is_hod: 1 },
      { username: 'chabala.john', role: 'initiator', department: 'Operations', supervisor_name: 'Joe Munthali', is_hod: 0 },
      { username: 'kaluya.justin', role: 'initiator', department: 'Operations', supervisor_name: 'Joe Munthali', is_hod: 0 },
      { username: 'phiri.isaac', role: 'initiator', department: 'Operations', supervisor_name: 'Joe Munthali', is_hod: 0 },
      { username: 'emmanuel.mumbi', role: 'initiator', department: 'Operations', supervisor_name: 'Joe Munthali', is_hod: 0 },
      { username: 'abraham.mubanga', role: 'initiator', department: 'Operations', supervisor_name: 'Joe Munthali', is_hod: 0 },

      // Sales Department - Moses Shebele is HOD
      { username: 'moses.shebele', role: 'hod', department: 'Sales', supervisor_name: 'Moses Shebele', is_hod: 1 },
      { username: 'waden.chishimba', role: 'initiator', department: 'Sales', supervisor_name: 'Moses Shebele', is_hod: 0 },
      { username: 'lina.zimba', role: 'initiator', department: 'Sales', supervisor_name: 'Moses Shebele', is_hod: 0 },
      { username: 'clarence.simwanza', role: 'procurement', department: 'Sales', supervisor_name: 'Kanyembo Ndhlovu', is_hod: 0 },

      // Finance Department - Anne Banda is Finance Manager (acts as HOD)
      { username: 'anne.banda', role: 'finance', department: 'Finance', supervisor_name: 'Kanyembo Ndhlovu', is_hod: 1 },
      { username: 'annie.nanyangwe', role: 'initiator', department: 'Finance', supervisor_name: 'Anne Banda', is_hod: 0 },
      { username: 'nashon.nguni', role: 'initiator', department: 'Finance', supervisor_name: 'Anne Banda', is_hod: 0 },
      { username: 'mwelwa.mwansa', role: 'initiator', department: 'Finance', supervisor_name: 'Anne Banda', is_hod: 0 },

      // Lusaka Department - Larry Mwambazi is HOD
      { username: 'larry.mwambazi', role: 'hod', department: 'Lusaka', supervisor_name: 'Larry Mwambazi', is_hod: 1 },
      { username: 'bernard.kalimba', role: 'initiator', department: 'Lusaka', supervisor_name: 'Larry Mwambazi', is_hod: 0 },
      { username: 'moses.phiri', role: 'initiator', department: 'Lusaka', supervisor_name: 'Larry Mwambazi', is_hod: 0 },
      { username: 'hillary.chaponda', role: 'initiator', department: 'Lusaka', supervisor_name: 'Larry Mwambazi', is_hod: 0 },
      { username: 'clever.malambo', role: 'initiator', department: 'Lusaka', supervisor_name: 'Larry Mwambazi', is_hod: 0 },
      { username: 'mwaka.musonda', role: 'initiator', department: 'Lusaka', supervisor_name: 'Larry Mwambazi', is_hod: 0 },
      { username: 'dickson.chipwalu', role: 'initiator', department: 'Lusaka', supervisor_name: 'Larry Mwambazi', is_hod: 0 },
      { username: 'nkandu.mulobeka', role: 'initiator', department: 'Lusaka', supervisor_name: 'Larry Mwambazi', is_hod: 0 },
      { username: 'edward.nkonde', role: 'initiator', department: 'Lusaka', supervisor_name: 'Larry Mwambazi', is_hod: 0 },

      // HR Department
      { username: 'mbialesi.namute', role: 'initiator', department: 'HR', supervisor_name: 'Kanyembo Ndhlovu', is_hod: 0 },

      // IT Department
      { username: 'hetch.mbunda', role: 'admin', department: 'IT', supervisor_name: 'Kanyembo Ndhlovu', is_hod: 0 },

      // Executive
      { username: 'kanyembo.ndhlovu', role: 'md', department: 'Executive', supervisor_name: null, is_hod: 0 },

      // Solwezi
      { username: 'ashley.rabie', role: 'initiator', department: 'Solwezi', supervisor_name: 'Kanyembo Ndhlovu', is_hod: 0 }
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
      { id: user._id || user.id, username: user.username, role: user.role },
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
        is_hod: user.is_hod
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
      is_hod: user.is_hod
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
    const { full_name, email, role, department, is_hod } = req.body;
    await db.User.findByIdAndUpdate(req.params.id, { full_name, email, role, department, is_hod });
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
    const vendors = await db.Vendor.find().lean();
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
