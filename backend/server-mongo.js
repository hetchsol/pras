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

    const defaultPassword = await bcrypt.hash('Password123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);

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
        is_hod: user.is_hod
      }
    });
  } catch (error) {
    console.error('Login error:', error);
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
// REQUISITION ROUTES
// ============================================

app.get('/api/requisitions', authenticate, async (req, res) => {
  try {
    const requisitions = await db.getRequisitions();
    res.json(requisitions);
  } catch (error) {
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

app.post('/api/requisitions', authenticate, async (req, res) => {
  try {
    const { description, quantity, estimatedCost, amount, justification, department, urgency } = req.body;

    // Generate requisition ID
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    const deptCode = department.substring(0, 3).toUpperCase();
    const userInitials = req.user.username.substring(0, 2).toUpperCase();
    const reqId = `KSB-${deptCode}-${userInitials}-${dateStr}${timeStr}`;

    await db.createRequisition({
      id: reqId,
      description,
      quantity,
      estimatedCost,
      amount,
      justification,
      department,
      urgency,
      initiatorId: req.user.id,
      initiatorName: req.user.username,
      status: 'pending_hod'
    });

    res.status(201).json({ success: true, id: reqId, message: 'Requisition created' });
  } catch (error) {
    console.error('Create requisition error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

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
    const efts = await db.getEFTRequisitions();
    res.json(efts);
  } catch (error) {
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
    const claims = await db.getExpenseClaims();
    res.json(claims);
  } catch (error) {
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

// Serve frontend for all other routes
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
