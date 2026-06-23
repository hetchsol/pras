require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const multer = require('multer');
const db = require('./database-mongo');
const { sendStatusNotification } = require('./utils/emailService');

// ── Receipt upload middleware ──────────────────────────────────────────────
const RECEIPT_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    cb(null, RECEIPT_ALLOWED_TYPES.includes(file.mimetype));
  }
});

// ── 48-hour receipt cleanup (runs every hour) ──────────────────────────────
const RECEIPT_TTL_MS = 48 * 60 * 60 * 1000;
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - RECEIPT_TTL_MS);
    await db.PettyCashRequisition.updateMany(
      { 'receipts.0': { $exists: true } },
      { $pull: { receipts: { uploaded_at: { $lt: cutoff } } } }
    );
  } catch (e) { /* non-fatal background job */ }
}, 60 * 60 * 1000);

// Typed error for validation failures inside transactions. Thrown inside
// session.withTransaction to abort the transaction; caught in the route
// handler to return the correct HTTP status without a generic 500.
class HttpError extends Error {
  constructor(status, body) {
    super((body && body.error) || 'HTTP error');
    this.status = status;
    this.body = body;
    this.name = 'HttpError';
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Render (and most PaaS) sits behind a reverse proxy. Without trusting it,
// express-rate-limit keys all requests to the proxy IP, making limits useless.
app.set('trust proxy', 1);

const { loginLimiter, passwordResetLimiter } = require('./middleware/rateLimiter');
const {
  SECURITY_QUESTIONS,
  REQUIRED_ANSWER_COUNT,
  hashAnswer,
  verifyAnswer,
  isValidQuestionId
} = require('./utils/securityQuestions');
const { logger, logError } = require('./utils/logger');
const { validateLogin } = require('./middleware/validation');
const { assertTransition } = require('./utils/statusTransitions');
const { getPaginationParams, paginateFind } = require('./utils/pagination');
const { logAudit } = require('./utils/audit');
const { getEFTAccess, lockoutMessage } = require('./utils/eftSchedule');

// EFT module is time-gated (Africa/Lusaka, weekdays only). Returns
// 423 Locked outside the window. Admin bypasses approve checks but
// still follows the create window — see backend/utils/eftSchedule.js.
const EFT_BYPASS_ROLES = ['admin', 'finance_manager', 'md'];
const EFT_BYPASS_USERS = ['hetch.mbunda'];

function canBypassEFT(user) {
  if (!user) return false;
  return EFT_BYPASS_ROLES.includes(user.role) || EFT_BYPASS_USERS.includes(user.username);
}

async function isEFTBypassEnabled() {
  try {
    const doc = await db.SystemSetting.findOne({ key: 'eft_bypass' }).lean();
    if (!doc || doc.value !== true) return false;
    if (doc.bypass_until && new Date(doc.bypass_until) <= new Date()) {
      db.SystemSetting.updateOne({ key: 'eft_bypass' }, { $set: { value: false, bypass_until: null } }).catch(() => {});
      return false;
    }
    return true;
  } catch { return false; }
}

const requireEFTAccess = (action) => async (req, res, next) => {
  try {
    const bypassEnabled = await isEFTBypassEnabled();
    if (bypassEnabled && canBypassEFT(req.user)) return next();
    const access = getEFTAccess(req.user && req.user.role);
    const allowed = action === 'create' ? access.canCreate : access.canApprove;
    if (allowed) return next();
    return res.status(423).json({
      error: lockoutMessage(action, access),
      eft_schedule: access
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error checking EFT access' });
  }
};
const {
  getRequisitionAmountZMW,
  checkBudget,
  checkSolvency,
  commitToBudget,
  releaseCommit,
  shiftCommitToSpent
} = require('./utils/budget');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET environment variable is missing or shorter than 32 characters. Set a strong secret (64+ random bytes hex) in Render environment settings before starting the server.');
  process.exit(1);
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

// Security headers. CSP is intentionally disabled for now because the frontend
// still uses inline handlers in app.js and HTML pages; enable after inline
// handler extraction in a later phase.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS Configuration
// CORS_MODE=open (default) preserves previous allow-all behaviour.
// CORS_MODE=allowlist restricts to the comma-separated ALLOWED_ORIGINS list.
const CORS_MODE = process.env.CORS_MODE || 'open';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, file://)
    if (!origin) return callback(null, true);
    if (origin.startsWith('file://') || origin === 'null') return callback(null, true);
    if (CORS_MODE === 'open') return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('CORS blocked: origin ' + origin + ' not in allowlist'));
  },
  credentials: true
}));

app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// JWT Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  // Also accept ?token=<jwt> for direct browser download links (receipt files)
  const queryToken = req.query && req.query.token;
  if (!authHeader && !queryToken) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader ? authHeader.split(' ')[1] : queryToken;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
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

// Map MongoDB requisition fields to frontend-expected field names
const mapRequisitionFields = (req) => {
  if (!req) return req;
  return {
    ...req,
    created_by: req.initiator_id,
    created_by_name: req.initiator_name,
    req_number: req.id,
    created_by_department: req.department
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
    // Build name variants to handle "Lastname Firstname" vs "Firstname Lastname" format
    const nameParts = fullUser.full_name.trim().split(/\s+/);
    const nameVariants = [fullUser.full_name];
    if (nameParts.length >= 2) {
      nameVariants.push(nameParts.reverse().join(' '));
    }

    // Get all users who have this HOD as their supervisor
    const subordinates = await db.User.find({
      supervisor_name: { $in: nameVariants }
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

// Health check. Reports 200 only when MongoDB is connected so Render's
// load balancer can distinguish an unhealthy instance.
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  const state = mongoose.connection.readyState; // 1 = connected
  const healthy = state === 1;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    message: 'Purchase Requisition API',
    database: 'MongoDB',
    dbState: state,
    uptime: process.uptime()
  });
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

app.post('/api/auth/login', loginLimiter, validateLogin, async (req, res) => {
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
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
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
        can_access_stores: user.can_access_stores || false,
        must_change_password: !!user.must_change_password,
        has_security_questions: Array.isArray(user.security_questions) && user.security_questions.length >= REQUIRED_ANSWER_COUNT
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/refresh', loginLimiter, async (req, res) => {
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
      can_access_stores: user.can_access_stores || false,
      must_change_password: !!user.must_change_password,
      has_security_questions: Array.isArray(user.security_questions) && user.security_questions.length >= REQUIRED_ANSWER_COUNT
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// PASSWORD CHANGE / RESET
// ============================================

const MIN_PASSWORD_LENGTH = 8;

function validateNewPassword(newPassword, currentPassword) {
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (currentPassword && newPassword === currentPassword) {
    return 'New password must be different from current password';
  }
  return null;
}

async function buildSecurityQuestionEntries(securityQuestions) {
  if (!Array.isArray(securityQuestions) || securityQuestions.length < REQUIRED_ANSWER_COUNT) {
    return { error: `Please answer at least ${REQUIRED_ANSWER_COUNT} security questions` };
  }
  const seen = new Set();
  const entries = [];
  for (const item of securityQuestions) {
    if (!item || !isValidQuestionId(item.question_id)) {
      return { error: 'Invalid security question selected' };
    }
    if (seen.has(item.question_id)) {
      return { error: 'Each security question can only be used once' };
    }
    if (typeof item.answer !== 'string' || item.answer.trim().length < 2) {
      return { error: 'Security answers must be at least 2 characters' };
    }
    seen.add(item.question_id);
    entries.push({
      question_id: item.question_id,
      answer_hash: await hashAnswer(item.answer)
    });
  }
  return { entries };
}

// Public: list of available security questions (for dropdowns).
app.get('/api/auth/security-questions', (req, res) => {
  res.json({ questions: SECURITY_QUESTIONS });
});

// Authenticated: change password (forced first-login OR voluntary).
// On first-login (must_change_password=true), security questions are required.
app.post('/api/auth/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword, securityQuestions } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    const user = await db.User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });

    const pwError = validateNewPassword(newPassword, currentPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    const update = {
      password: await bcrypt.hash(newPassword, 10),
      must_change_password: false,
      password_changed_at: new Date()
    };

    const needsQuestions = user.must_change_password ||
      !Array.isArray(user.security_questions) ||
      user.security_questions.length < REQUIRED_ANSWER_COUNT;

    if (needsQuestions || securityQuestions) {
      if (needsQuestions && !securityQuestions) {
        return res.status(400).json({ error: 'Security questions are required on first password change' });
      }
      const built = await buildSecurityQuestionEntries(securityQuestions);
      if (built.error) return res.status(400).json({ error: built.error });
      update.security_questions = built.entries;
    }

    await db.User.updateOne({ _id: user._id }, { $set: update });

    logAudit(req, {
      entity_type: 'user',
      entity_id: user._id,
      action: 'password_changed',
      metadata: { self_service: true, security_questions_set: !!update.security_questions }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public, rate-limited: returns the question IDs the user previously chose,
// so the frontend can show those specific questions during reset.
app.post('/api/auth/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username required' });

    const user = await db.getUserByUsername(username);
    if (!user || !Array.isArray(user.security_questions) || user.security_questions.length < REQUIRED_ANSWER_COUNT) {
      return res.status(404).json({
        error: 'Self-service reset is not available for this account. Please contact an administrator.'
      });
    }

    const questions = user.security_questions.map(q => {
      const def = SECURITY_QUESTIONS.find(d => d.id === q.question_id);
      return { question_id: q.question_id, text: def ? def.text : q.question_id };
    });

    res.json({ questions });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public, rate-limited: verify all answers and set a new password.
app.post('/api/auth/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const { username, answers, newPassword } = req.body || {};
    if (!username || !Array.isArray(answers) || !newPassword) {
      return res.status(400).json({ error: 'Username, answers, and new password are required' });
    }

    const pwError = validateNewPassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    const user = await db.getUserByUsername(username);
    if (!user || !Array.isArray(user.security_questions) || user.security_questions.length < REQUIRED_ANSWER_COUNT) {
      return res.status(400).json({ error: 'Unable to reset password' });
    }

    if (answers.length !== user.security_questions.length) {
      return res.status(400).json({ error: 'All security questions must be answered' });
    }

    for (const stored of user.security_questions) {
      const provided = answers.find(a => a && a.question_id === stored.question_id);
      if (!provided) return res.status(400).json({ error: 'Missing answer for one or more questions' });
      const ok = await verifyAnswer(provided.answer, stored.answer_hash);
      if (!ok) return res.status(401).json({ error: 'One or more answers are incorrect' });
    }

    await db.User.updateOne(
      { _id: user._id },
      { $set: {
          password: await bcrypt.hash(newPassword, 10),
          must_change_password: false,
          password_changed_at: new Date()
        }
      }
    );

    logAudit(
      { user: { id: user._id, full_name: user.full_name, role: user.role, username: user.username }, ip: req.ip, get: (h) => req.get(h) },
      { entity_type: 'user', entity_id: user._id, action: 'password_reset_self_service' }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: reset a user's password to a temporary value and force change at next login.
app.post('/api/admin/users/:id/reset-password', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { tempPassword: providedTemp } = req.body || {};
    const user = await db.User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const tempPassword = providedTemp || generateTempPassword();
    const pwError = validateNewPassword(tempPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    await db.User.updateOne(
      { _id: user._id },
      { $set: {
          password: await bcrypt.hash(tempPassword, 10),
          must_change_password: true,
          password_changed_at: new Date()
        }
      }
    );

    logAudit(req, {
      entity_type: 'user',
      entity_id: user._id,
      action: 'password_reset_by_admin',
      metadata: { target_username: user.username }
    });

    res.json({ success: true, tempPassword, username: user.username });
  } catch (error) {
    console.error('Admin reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

function generateTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  let pw = pick(upper) + pick(lower) + pick(digits);
  for (let i = 0; i < 9; i++) pw += pick(all);
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

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
    const { username, password, full_name, email, role, department, is_hod, can_access_stores, can_override_budget } = req.body;
    const hashedPassword = await bcrypt.hash(password || 'password123', 10);

    const user = await db.User.create({
      username,
      password: hashedPassword,
      full_name,
      email,
      role,
      department,
      is_hod: is_hod || 0,
      can_access_stores: !!can_access_stores,
      can_override_budget: !!can_override_budget,
      must_change_password: true
    });

    res.status(201).json({ success: true, id: user._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { username, full_name, email, role, department, is_hod, assigned_hod, can_access_stores, can_override_budget, password } = req.body;
    const updateData = { full_name, email, role, department, is_hod };

    if (username) updateData.username = username;
    if (assigned_hod !== undefined) updateData.assigned_hod = assigned_hod || null;
    if (can_access_stores !== undefined) updateData.can_access_stores = can_access_stores ? true : false;
    if (can_override_budget !== undefined) updateData.can_override_budget = can_override_budget ? true : false;

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
      updateData.must_change_password = true;
      updateData.password_changed_at = new Date();
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

app.delete('/api/admin/requisitions/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.Requisition.findOneAndDelete({ id: req.params.id });
    if (!result) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
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
    const departments = await db.Department.find().sort({ name: 1 }).lean();
    res.json(departments.map(d => ({ ...d, id: d._id })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/departments', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, code, description, is_active } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Department name is required' });
    const existing = await db.Department.findOne({ name: name.trim() }).lean();
    if (existing) return res.status(409).json({ error: `Department "${name.trim()}" already exists` });
    const dept = await db.Department.create({
      name: name.trim(),
      code: (code || '').trim(),
      description: (description || '').trim(),
      is_active: is_active !== undefined ? Number(is_active) : 1,
      budget: 0, spent: 0, committed: 0
    });
    res.status(201).json({ ...dept.toObject(), id: dept._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/departments/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, code, description, is_active } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Department name is required' });
    const dept = await db.Department.findByIdAndUpdate(
      req.params.id,
      { $set: { name: name.trim(), code: (code || '').trim(), description: (description || '').trim(), is_active: Number(is_active !== undefined ? is_active : 1) } },
      { new: true }
    ).lean();
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    res.json({ ...dept, id: dept._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/departments/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const dept = await db.Department.findById(req.params.id).lean();
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    if ((dept.committed || 0) > 0 || (dept.spent || 0) > 0) {
      return res.status(409).json({ error: 'Cannot delete a department with committed or spent budget — remove all requisitions first' });
    }
    await db.Department.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.json(requisitions.map(mapRequisitionFields));
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
// REQUISITION REROUTING
// ============================================

// Get all users for rerouting (dropdown options)
app.get('/api/admin/reroute-users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;

    const users = await db.User.find(filter)
      .select('full_name role department')
      .sort({ full_name: 1 })
      .lean();

    // Map _id to id for frontend compatibility
    res.json(users.map(u => ({ id: u._id, full_name: u.full_name, role: u.role, department: u.department })));
  } catch (error) {
    console.error('Error fetching reroute users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Reroute requisition to another approver
app.post('/api/admin/reroute/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const reqId = req.params.id;
    const { to_user_id, reason, new_status } = req.body;

    if (!to_user_id || !reason) {
      return res.status(400).json({ error: 'Target user and reason are required' });
    }

    // Get target user info
    const targetUser = await db.User.findById(to_user_id).select('full_name role department').lean();
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Build update
    const update = { updated_at: new Date(), assigned_to: to_user_id, assigned_role: targetUser.role };
    if (new_status) update.status = new_status;
    if (targetUser.role === 'hod') update.assigned_hod_id = to_user_id;

    const result = await db.Requisition.findOneAndUpdate({ id: reqId }, update, { new: true });
    if (!result) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    // Log the reroute action in approvals
    await db.createApproval({
      requisition_id: reqId,
      role: 'admin',
      user_name: req.user.full_name || 'Admin',
      action: 'rerouted',
      comment: `Rerouted to ${targetUser.full_name} (${targetUser.role}). Reason: ${reason}`
    });

    res.json({
      success: true,
      message: `Requisition rerouted to ${targetUser.full_name}`,
      target_user: { id: targetUser._id, full_name: targetUser.full_name, role: targetUser.role, department: targetUser.department }
    });
  } catch (error) {
    console.error('Error rerouting requisition:', error);
    res.status(500).json({ error: 'Failed to reroute requisition' });
  }
});

// Admin override - skip stage or reassign department
app.put('/api/requisitions/:id/admin-override', authenticate, authorize('admin'), async (req, res) => {
  try {
    const reqId = req.params.id;
    const { action, new_status, new_department, comment } = req.body;

    if (!action || !['skip_stage', 'reassign_department'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be skip_stage or reassign_department' });
    }

    if (action === 'skip_stage') {
      if (!new_status || !comment) {
        return res.status(400).json({ error: 'new_status and comment are required for skip_stage' });
      }

      const result = await db.Requisition.findOneAndUpdate(
        { id: reqId },
        { status: new_status, updated_at: new Date() },
        { new: true }
      );

      if (!result) {
        return res.status(404).json({ error: 'Requisition not found' });
      }

      await db.createApproval({
        requisition_id: reqId,
        role: 'admin',
        user_name: req.user.full_name || 'Admin',
        action: 'admin_skip_stage',
        comment: `Admin skipped stage to ${new_status}: ${comment}`
      });

      res.json({ success: true, message: `Successfully moved to ${new_status}`, status: new_status });

    } else if (action === 'reassign_department') {
      if (!new_department) {
        return res.status(400).json({ error: 'new_department is required for reassign_department' });
      }

      const result = await db.Requisition.findOneAndUpdate(
        { id: reqId },
        { department: new_department, updated_at: new Date() },
        { new: true }
      );

      if (!result) {
        return res.status(404).json({ error: 'Requisition not found' });
      }

      await db.createApproval({
        requisition_id: reqId,
        role: 'admin',
        user_name: req.user.full_name || 'Admin',
        action: 'admin_reassign_dept',
        comment: `Admin reassigned to department: ${new_department}`
      });

      res.json({ success: true, message: `Successfully reassigned to ${new_department}`, department: new_department });
    }
  } catch (error) {
    console.error('Error in admin override:', error);
    res.status(500).json({ error: 'Failed to perform admin override' });
  }
});

// Admin override for EFT requisitions
app.put('/api/forms/eft-requisitions/:id/admin-override', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { action, new_status, new_department, comment } = req.body;

    if (action === 'skip_stage') {
      if (!new_status || !comment) return res.status(400).json({ error: 'new_status and comment are required' });
      const result = await db.EFTRequisition.findOneAndUpdate({ id: req.params.id }, { status: new_status }, { new: true });
      if (!result) return res.status(404).json({ error: 'EFT requisition not found' });
      await db.createFormApproval({ form_type: 'eft', form_id: req.params.id, role: 'admin', user_name: req.user.full_name || 'Admin', action: 'admin_skip_stage', comment: `Admin skipped stage to ${new_status}: ${comment}` });
      res.json({ success: true, message: `Successfully moved to ${new_status}` });
    } else if (action === 'reassign_department') {
      if (!new_department) return res.status(400).json({ error: 'new_department is required' });
      const result = await db.EFTRequisition.findOneAndUpdate({ id: req.params.id }, { department: new_department }, { new: true });
      if (!result) return res.status(404).json({ error: 'EFT requisition not found' });
      res.json({ success: true, message: `Successfully reassigned to ${new_department}` });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error in EFT admin override:', error);
    res.status(500).json({ error: 'Failed to perform admin override' });
  }
});

// Admin override for petty cash requisitions
app.put('/api/forms/petty-cash-requisitions/:id/admin-override', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { action, new_status, new_department, comment } = req.body;

    if (action === 'skip_stage') {
      if (!new_status || !comment) return res.status(400).json({ error: 'new_status and comment are required' });
      const result = await db.PettyCashRequisition.findOneAndUpdate({ id: req.params.id }, { status: new_status }, { new: true });
      if (!result) return res.status(404).json({ error: 'Petty cash requisition not found' });
      await db.createFormApproval({ form_type: 'petty_cash', form_id: req.params.id, role: 'admin', user_name: req.user.full_name || 'Admin', action: 'admin_skip_stage', comment: `Admin skipped stage to ${new_status}: ${comment}` });
      res.json({ success: true, message: `Successfully moved to ${new_status}` });
    } else if (action === 'reassign_department') {
      if (!new_department) return res.status(400).json({ error: 'new_department is required' });
      const result = await db.PettyCashRequisition.findOneAndUpdate({ id: req.params.id }, { department: new_department }, { new: true });
      if (!result) return res.status(404).json({ error: 'Petty cash requisition not found' });
      res.json({ success: true, message: `Successfully reassigned to ${new_department}` });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error in petty cash admin override:', error);
    res.status(500).json({ error: 'Failed to perform admin override' });
  }
});

// Admin override for expense claims
app.put('/api/forms/expense-claims/:id/admin-override', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { action, new_status, new_department, comment } = req.body;

    if (action === 'skip_stage') {
      if (!new_status || !comment) return res.status(400).json({ error: 'new_status and comment are required' });
      const result = await db.ExpenseClaim.findOneAndUpdate({ id: req.params.id }, { status: new_status }, { new: true });
      if (!result) return res.status(404).json({ error: 'Expense claim not found' });
      await db.createFormApproval({ form_type: 'expense_claim', form_id: req.params.id, role: 'admin', user_name: req.user.full_name || 'Admin', action: 'admin_skip_stage', comment: `Admin skipped stage to ${new_status}: ${comment}` });
      res.json({ success: true, message: `Successfully moved to ${new_status}` });
    } else if (action === 'reassign_department') {
      if (!new_department) return res.status(400).json({ error: 'new_department is required' });
      const result = await db.ExpenseClaim.findOneAndUpdate({ id: req.params.id }, { department: new_department }, { new: true });
      if (!result) return res.status(404).json({ error: 'Expense claim not found' });
      res.json({ success: true, message: `Successfully reassigned to ${new_department}` });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error in expense claim admin override:', error);
    res.status(500).json({ error: 'Failed to perform admin override' });
  }
});

// ============================================
// FIX APPROVAL NAMES (one-time migration)
// ============================================
app.post('/api/admin/fix-approval-names', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await db.User.find({}).lean();
    const usersByRole = {};
    users.forEach(u => {
      const role = (u.role || '').toLowerCase();
      if (!usersByRole[role]) usersByRole[role] = [];
      usersByRole[role].push(u);
    });

    function findApproverName(approval, document) {
      const role = (approval.role || '').toLowerCase();
      const candidates = usersByRole[role] || [];
      if (candidates.length === 1) return candidates[0].full_name;
      if (candidates.length > 1) {
        const dept = (document.department || document.initiator_department || '').toLowerCase();
        const deptMatch = candidates.find(u => (u.department || '').toLowerCase() === dept);
        if (deptMatch) return deptMatch.full_name;
        return candidates[0].full_name;
      }
      return null;
    }

    const IssueSlipModel = require('./models/IssueSlip');
    const collections = [
      { name: 'ExpenseClaims', model: db.ExpenseClaim },
      { name: 'EFTRequisitions', model: db.EFTRequisition },
      { name: 'PettyCashRequisitions', model: db.PettyCashRequisition },
      { name: 'IssueSlips', model: IssueSlipModel }
    ];

    let totalFixed = 0;
    const details = [];

    for (const { name, model } of collections) {
      const docs = await model.find({ approvals: { $exists: true, $ne: [] } });
      let fixed = 0;
      for (const doc of docs) {
        let modified = false;
        if (doc.approvals && doc.approvals.length > 0) {
          for (let i = 0; i < doc.approvals.length; i++) {
            const approval = doc.approvals[i];
            if (!approval.name || approval.name === 'undefined' || approval.name === 'null') {
              const resolvedName = findApproverName(approval, doc);
              if (resolvedName) {
                details.push(`${name} [${doc.id || doc._id}] ${approval.role}: -> ${resolvedName}`);
                doc.approvals[i].name = resolvedName;
                modified = true;
                fixed++;
              }
            }
          }
        }
        if (modified) {
          doc.markModified('approvals');
          await doc.save();
        }
      }
      totalFixed += fixed;
    }

    // Also fix GRNs
    const GoodsReceiptNote = require('./models/GoodsReceiptNote');
    const grns = await GoodsReceiptNote.find({ approvals: { $exists: true, $ne: [] } });
    for (const grn of grns) {
      let modified = false;
      if (grn.approvals && grn.approvals.length > 0) {
        for (let i = 0; i < grn.approvals.length; i++) {
          const approval = grn.approvals[i];
          if (!approval.name || approval.name === 'undefined' || approval.name === 'null') {
            const resolvedName = findApproverName(approval, grn);
            if (resolvedName) {
              details.push(`GRN [${grn.id || grn._id}] ${approval.role}: -> ${resolvedName}`);
              grn.approvals[i].name = resolvedName;
              modified = true;
              totalFixed++;
            }
          }
        }
      }
      if (modified) {
        grn.markModified('approvals');
        await grn.save();
      }
    }

    res.json({ success: true, totalFixed, details });
  } catch (error) {
    console.error('Fix approval names error:', error);
    res.status(500).json({ error: error.message });
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
      return res.json(requisitions.map(mapRequisitionFields));
    }

    // Get full user details
    const fullUser = await db.getUserById(req.user.id);

    // HODs see requisitions from their department
    if (userRole === 'hod' || fullUser?.is_hod === 1) {
      // Build name variants to handle "Lastname Firstname" vs "Firstname Lastname" format
      const nameParts = fullUser.full_name.trim().split(/\s+/);
      const nameVariants = [fullUser.full_name];
      if (nameParts.length >= 2) {
        nameVariants.push(nameParts.reverse().join(' '));
      }

      // Get subordinates
      const subordinates = await db.User.find({
        supervisor_name: { $in: nameVariants }
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
      return res.json(requisitions.map(mapRequisitionFields));
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
    res.json(requisitions.map(mapRequisitionFields));
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
    res.json(mapRequisitionFields(requisition));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create requisition (handles both simple and full format)
const createRequisitionHandler = async (req, res) => {
  try {
    const { description, quantity, estimatedCost, amount, justification, urgency, items, delivery_location, required_date, tax_type } = req.body;
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

    // Extract justification from items specifications if not provided directly
    const reqJustification = justification || (items && items.length > 0 ? items[0].specifications : '') || '';

    await db.createRequisition({
      id: reqId,
      description: desc,
      quantity: totalQuantity,
      estimatedCost: totalAmount,
      amount: totalAmount,
      justification: reqJustification,
      department,
      urgency: urgency || 'standard',
      initiatorId: req.user.id,
      initiatorName: user?.full_name || req.user.username,
      status: 'pending_hod',
      items: items || [],
      tax_type: tax_type || null,
      delivery_location: delivery_location || 'Office',
      required_date: required_date || null
    });

    // Soft-warn if this PR would breach the department budget. Non-blocking:
    // the PR is already created; approvers will hit the hard-block later.
    let budgetWarning = null;
    try {
      const amountZMW = await getRequisitionAmountZMW({
        items: items || [],
        amount: totalAmount,
        vendor_currency: req.body.vendor_currency || 'ZMW'
      });
      const check = await checkBudget(department, amountZMW);
      if (!check.ok) {
        budgetWarning = {
          message: 'This requisition exceeds the available department budget.',
          amount_zmw: amountZMW,
          available_zmw: check.available,
          over_by_zmw: check.over_by
        };
      }
    } catch (err) {
      logError(err, { type: 'BUDGET_CHECK_ON_CREATE_FAILED', reqId });
    }

    res.status(201).json({
      success: true,
      id: reqId,
      req_number: reqId,
      message: 'Requisition created',
      budget_warning: budgetWarning
    });

    // Fire-and-forget email notification
    sendStatusNotification({
      formType: 'purchase-requisition',
      formId: reqId,
      newStatus: 'pending_hod',
      department,
      initiatorId: req.user.id,
      initiatorName: user?.full_name || req.user.username,
      description: desc,
      amount: totalAmount
    });
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

    // Fire-and-forget email notification
    if (nextStatus) {
      db.Requisition.findOne({ id: reqId }).lean().then(requisition => {
        if (requisition) {
          sendStatusNotification({
            formType: 'purchase-requisition',
            formId: reqId,
            newStatus: nextStatus,
            department: requisition.department,
            initiatorId: requisition.initiator_id,
            initiatorName: requisition.initiator_name,
            description: requisition.description,
            amount: requisition.amount || requisition.estimatedCost,
            approverName: req.user.username,
            comments: comment
          });
        }
      }).catch(() => {});
    }
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
    const { comments } = req.body;
    // Accept both `approve` and `approved` to match inconsistent frontend callers.
    const approve = req.body.approve ?? req.body.approved;

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

    logAudit(req, {
      entity_type: 'Requisition',
      entity_id: reqId,
      action: approve ? 'hod-approved' : 'hod-rejected',
      from_status: 'pending_hod',
      to_status: newStatus,
      comments
    });

    // Fire-and-forget email notification
    db.Requisition.findOne({ id: reqId }).lean().then(requisition => {
      if (requisition) {
        sendStatusNotification({
          formType: 'purchase-requisition',
          formId: reqId,
          newStatus,
          department: requisition.department,
          initiatorId: requisition.initiator_id,
          initiatorName: requisition.initiator_name,
          description: requisition.description,
          amount: requisition.amount || requisition.estimatedCost,
          approverName: req.user.username,
          comments
        });
      }
    }).catch(() => {});
  } catch (error) {
    console.error('HOD approve error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Finance approve/reject requisition
app.put('/api/requisitions/:id/finance-approve', authenticate, async (req, res) => {
  try {
    const reqId = req.params.id;
    const { comments, override } = req.body;
    const approve = req.body.approve ?? req.body.approved;

    const pr = await db.Requisition.findOne({ id: reqId }).lean();
    if (!pr) return res.status(404).json({ error: 'Requisition not found' });

    let auditAction = approve ? 'finance-approved' : 'finance-rejected';
    let amountZMW = 0;

    // Budget gate only applies on approve. Reject is free.
    if (approve) {
      // Block approval if the department budget is locked by Finance
      const deptRecord = await db.Department.findOne({ name: pr.department }).lean();
      if (deptRecord && deptRecord.budget_locked) {
        return res.status(409).json({
          error: `The ${pr.department} department budget is currently locked.`,
          locked: true,
          reason: deptRecord.budget_locked_reason || ''
        });
      }

      amountZMW = await getRequisitionAmountZMW(pr);
      const check = await checkBudget(pr.department, amountZMW);

      if (!check.ok) {
        if (!override) {
          return res.status(409).json({
            error: 'This requisition exceeds the available department budget.',
            override_required: true,
            amount_zmw: amountZMW,
            available_zmw: check.available,
            over_by_zmw: check.over_by
          });
        }
        const actingUser = await db.getUserById(req.user.id);
        if (!actingUser || !actingUser.can_override_budget) {
          return res.status(403).json({
            error: 'You do not have permission to override the budget.'
          });
        }
        if (!comments || !comments.trim()) {
          return res.status(400).json({
            error: 'A justification comment is required when overriding the budget.'
          });
        }
        auditAction = 'finance-approved-with-override';
      }

      await commitToBudget(pr.department, amountZMW);
    }

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

    logAudit(req, {
      entity_type: 'Requisition',
      entity_id: reqId,
      action: auditAction,
      from_status: 'pending_finance',
      to_status: newStatus,
      comments,
      metadata: approve ? { amount_zmw: amountZMW } : undefined
    });

    // Fire-and-forget email notification
    db.Requisition.findOne({ id: reqId }).lean().then(requisition => {
      if (requisition) {
        sendStatusNotification({
          formType: 'purchase-requisition',
          formId: reqId,
          newStatus,
          department: requisition.department,
          initiatorId: requisition.initiator_id,
          initiatorName: requisition.initiator_name,
          description: requisition.description,
          amount: requisition.amount || requisition.estimatedCost,
          approverName: req.user.username,
          comments
        });
      }
    }).catch(() => {});
  } catch (error) {
    console.error('Finance approve error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// MD approve/reject requisition
app.put('/api/requisitions/:id/md-approve', authenticate, async (req, res) => {
  try {
    const reqId = req.params.id;
    const { comments, override } = req.body;
    const approve = req.body.approve ?? req.body.approved;

    const pr = await db.Requisition.findOne({ id: reqId }).lean();
    if (!pr) return res.status(404).json({ error: 'Requisition not found' });

    let auditAction = approve ? 'md-approved' : 'md-rejected';
    const amountZMW = await getRequisitionAmountZMW(pr);

    if (approve) {
      // Defense-in-depth: department must still be solvent overall.
      // The PR amount is already in `committed` (locked at Finance approve).
      const solvency = await checkSolvency(pr.department);
      if (!solvency.ok) {
        if (!override) {
          return res.status(409).json({
            error: 'Department is over-budget. MD approval requires an override.',
            override_required: true,
            available_zmw: solvency.available
          });
        }
        const actingUser = await db.getUserById(req.user.id);
        if (!actingUser || !actingUser.can_override_budget) {
          return res.status(403).json({
            error: 'You do not have permission to override the budget.'
          });
        }
        if (!comments || !comments.trim()) {
          return res.status(400).json({
            error: 'A justification comment is required when overriding the budget.'
          });
        }
        auditAction = 'md-approved-with-override';
      }
    } else {
      // MD reject: release the commitment locked by Finance approve.
      await releaseCommit(pr.department, amountZMW);
    }

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

    logAudit(req, {
      entity_type: 'Requisition',
      entity_id: reqId,
      action: auditAction,
      from_status: 'pending_md',
      to_status: newStatus,
      comments,
      metadata: { amount_zmw: amountZMW }
    });

    // Fire-and-forget email notification
    db.Requisition.findOne({ id: reqId }).lean().then(requisition => {
      if (requisition) {
        sendStatusNotification({
          formType: 'purchase-requisition',
          formId: reqId,
          newStatus,
          department: requisition.department,
          initiatorId: requisition.initiator_id,
          initiatorName: requisition.initiator_name,
          description: requisition.description,
          amount: requisition.amount || requisition.estimatedCost,
          approverName: req.user.username,
          comments
        });
      }
    }).catch(() => {});
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

app.post('/api/vendors', authenticate, authorize('procurement', 'admin'), async (req, res) => {
  try {
    const { name, contact_person, email, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }
    // Check for duplicate name (case-insensitive)
    const Vendor = require('./models/Vendor');
    const existing = await Vendor.findOne({ name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ error: 'A vendor with this name already exists' });
    }
    // Generate unique vendor code
    const vendorCode = `VEN-${Date.now().toString(36).toUpperCase()}`;
    const vendorData = {
      name: name.trim(),
      code: vendorCode,
      contact_person: contact_person || '',
      email: email || '',
      phone: phone || '',
      status: 'active'
    };
    const newVendor = new Vendor(vendorData);
    const saved = await newVendor.save();
    const vendor = saved.toObject();
    vendor.id = vendor._id.toString();
    res.status(201).json(vendor);
  } catch (error) {
    console.error('Error creating vendor:', error);
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

// Authoritative time-window state for the EFT module. Frontend reads
// this to grey out controls; backend re-checks on every mutation.
app.get('/api/eft-requisitions/schedule', authenticate, async (req, res) => {
  const access = getEFTAccess(req.user && req.user.role);
  const bypassEnabled = await isEFTBypassEnabled();
  const canBypass = bypassEnabled && canBypassEFT(req.user);
  let bypass_until = null;
  if (canBypass) {
    try {
      const doc = await db.SystemSetting.findOne({ key: 'eft_bypass' }).lean();
      bypass_until = doc?.bypass_until || null;
    } catch {}
  }
  res.json({ ...access, bypass_active: canBypass, bypass_until });
});

// EFT bypass toggle — readable and writable by admin / finance_manager / md / hetch.mbunda
app.get('/api/system-settings/eft-bypass', authenticate, async (req, res) => {
  if (!canBypassEFT(req.user)) return res.status(403).json({ error: 'Not authorised' });
  try {
    const doc = await db.SystemSetting.findOne({ key: 'eft_bypass' }).lean();
    const enabled = doc?.value === true && (!doc.bypass_until || new Date(doc.bypass_until) > new Date());
    res.json({ enabled, bypass_until: doc?.bypass_until || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read EFT bypass setting', detail: err.message });
  }
});

app.put('/api/system-settings/eft-bypass', authenticate, async (req, res) => {
  if (!canBypassEFT(req.user)) return res.status(403).json({ error: 'Not authorised' });
  try {
    const { enabled, bypass_until } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });
    if (enabled && !bypass_until) return res.status(400).json({ error: 'bypass_until is required when enabling' });
    const until = enabled ? new Date(bypass_until) : null;
    if (enabled && (!until || isNaN(until.getTime()))) return res.status(400).json({ error: 'bypass_until must be a valid ISO date string' });
    if (enabled && until <= new Date()) return res.status(400).json({ error: 'bypass_until must be in the future' });
    await db.SystemSetting.findOneAndUpdate(
      { key: 'eft_bypass' },
      { $set: { value: enabled, bypass_until: until } },
      { upsert: true }
    );
    res.json({ enabled, bypass_until: until });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update EFT bypass setting', detail: err.message });
  }
});

app.post('/api/eft-requisitions', authenticate, requireEFTAccess('create'), async (req, res) => {
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

    // Fire-and-forget email notification
    sendStatusNotification({
      formType: 'expense-claim',
      formId: claimId,
      newStatus: 'pending_hod',
      department: req.body.department || user?.department || 'General',
      initiatorId: req.user.id,
      initiatorName: user?.full_name || req.user.username,
      amount: req.body.total_claim || req.body.amount || 0
    });
  } catch (error) {
    console.error('Create expense claim error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// POST forms - create EFT requisitions
app.post('/api/forms/eft-requisitions', authenticate, requireEFTAccess('create'), async (req, res) => {
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

    // Fire-and-forget email notification
    sendStatusNotification({
      formType: 'eft-requisition',
      formId: eftId,
      newStatus: 'pending_hod',
      department: req.body.department || user?.department || '',
      initiatorId: req.user.id,
      initiatorName: user?.full_name || req.user.username,
      description: req.body.purpose || req.body.description || '',
      amount: req.body.amount || 0
    });
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

    // Fire-and-forget email notification
    sendStatusNotification({
      formType: 'petty-cash',
      formId: pettyCashId,
      newStatus: 'pending_hod',
      department: req.body.department || user?.department || '',
      initiatorId: req.user.id,
      initiatorName: user?.full_name || req.user.username,
      description: req.body.purpose || req.body.description || '',
      amount: req.body.amount || 0
    });
  } catch (error) {
    console.error('Create petty cash requisition error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// PDF Generation endpoints
const { generateExpenseClaimPDF, generateEFTPDF, generatePettyCashPDF } = require('./utils/formsPDFGenerator');
const { generateRequisitionPDF } = require('./utils/pdfGenerator');
const { generateRequisitionSummaryPDF, generateBudgetReportPDF, generateDepartmentalSpendingPDF } = require('./utils/reportPDFGenerator');
const { generateRequisitionSummaryExcel, generateBudgetReportExcel, generateFXRatesExcel } = require('./utils/excelReportGenerator');
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

// Purchase Requisition PDF
app.get('/api/requisitions/:id/pdf', authenticate, async (req, res) => {
  try {
    const reqId = req.params.id;
    let requisition = null;
    try {
      requisition = await db.Requisition.findById(reqId).lean();
    } catch (e) {}
    if (!requisition) {
      requisition = await db.Requisition.findOne({ id: reqId }).lean();
    }
    if (!requisition) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    const mapped = {
      ...mapRequisitionFields(requisition),
      approved_vendor: requisition.selected_vendor || 'TBD',
      account_code: requisition.account_code || 'N/A',
      md_approved_at: requisition.md_approved_at || null,
    };

    const pdfBuffer = await new Promise((resolve, reject) => {
      generateRequisitionPDF(mapped, mapped.items || [], (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="PR_${mapped.req_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PR PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF. Please try again.' });
  }
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

    // Fire-and-forget email notification
    sendStatusNotification({
      formType: 'expense-claim',
      formId: claim.id,
      newStatus,
      department: claim.department,
      initiatorId: claim.initiator_id,
      initiatorName: claim.initiator_name,
      amount: claim.total_claim || claim.amount_due || 0,
      approverName: approver_name || req.user.username,
      comments
    });
  } catch (error) {
    console.error('Error approving expense claim:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Approve/Reject EFT Requisition
app.put('/api/forms/eft-requisitions/:id/approve', authenticate, requireEFTAccess('approve'), async (req, res) => {
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

    // Fire-and-forget email notification
    sendStatusNotification({
      formType: 'eft-requisition',
      formId: eftReq.id,
      newStatus,
      department: eftReq.department,
      initiatorId: eftReq.initiator_id,
      initiatorName: eftReq.initiator_name,
      description: eftReq.purpose || eftReq.description || '',
      amount: eftReq.amount || 0,
      approverName: approver_name || req.user.username,
      comments
    });
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

    // Fire-and-forget email notification
    sendStatusNotification({
      formType: 'petty-cash',
      formId: pcReq.id,
      newStatus,
      department: pcReq.department,
      initiatorId: pcReq.initiator_id,
      initiatorName: pcReq.initiator_name,
      description: pcReq.purpose || pcReq.description || '',
      amount: pcReq.amount || 0,
      approverName: approver_name || req.user.username,
      comments
    });
  } catch (error) {
    console.error('Error approving petty cash requisition:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Simple requisitions list
app.get('/api/requisitions/simple', authenticate, async (req, res) => {
  try {
    const requisitions = await db.Requisition.find().select('id description status department created_at initiator_id initiator_name').lean();
    res.json(requisitions.map(mapRequisitionFields));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Purchase orders (empty for now)
app.get('/api/purchase-orders', authenticate, async (req, res) => {
  res.json([]);
});

// ============================================
// REPORT DOWNLOAD ROUTES
// ============================================

app.get('/api/reports/requisitions/pdf', authenticate, async (req, res) => {
  try {
    const { dateFrom, dateTo, status, department } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (dateFrom || dateTo) {
      filter.created_at = {};
      if (dateFrom) filter.created_at.$gte = new Date(dateFrom);
      if (dateTo) filter.created_at.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }
    const requisitions = await db.Requisition.find(filter).sort({ created_at: -1 }).lean();
    const mapped = requisitions.map(mapRequisitionFields);
    const doc = generateRequisitionSummaryPDF(mapped, { dateFrom, dateTo, status, department });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Requisitions_Report.pdf"');
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Report PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

app.get('/api/reports/requisitions/excel', authenticate, async (req, res) => {
  try {
    const { dateFrom, dateTo, status, department } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (dateFrom || dateTo) {
      filter.created_at = {};
      if (dateFrom) filter.created_at.$gte = new Date(dateFrom);
      if (dateTo) filter.created_at.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }
    const requisitions = await db.Requisition.find(filter).sort({ created_at: -1 }).lean();
    const mapped = requisitions.map(mapRequisitionFields);
    const buffer = await generateRequisitionSummaryExcel(mapped, { dateFrom, dateTo, status, department });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Requisitions_Report.xlsx"');
    res.send(buffer);
  } catch (error) {
    console.error('Report Excel error:', error);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
});

app.get('/api/reports/budgets/pdf', authenticate, async (req, res) => {
  try {
    const { fiscal_year } = req.query;
    const departments = await db.Department.find().lean();
    const enriched = departments.map(withAvailable);
    const doc = generateBudgetReportPDF(enriched, fiscal_year || new Date().getFullYear().toString());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Budget_Report.pdf"');
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Budget PDF error:', error);
    res.status(500).json({ error: 'Failed to generate budget PDF report' });
  }
});

app.get('/api/reports/budgets/excel', authenticate, async (req, res) => {
  try {
    const { fiscal_year } = req.query;
    const departments = await db.Department.find().lean();
    const enriched = departments.map(withAvailable);
    const buffer = await generateBudgetReportExcel(enriched, fiscal_year || new Date().getFullYear().toString());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Budget_Report.xlsx"');
    res.send(buffer);
  } catch (error) {
    console.error('Budget Excel error:', error);
    res.status(500).json({ error: 'Failed to generate budget Excel report' });
  }
});

app.get('/api/reports/fx-rates/excel', authenticate, async (req, res) => {
  try {
    const fxRates = await db.FXRate.find().sort({ currency_code: 1 }).lean();
    const buffer = await generateFXRatesExcel(fxRates);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="FX_Rates.xlsx"');
    res.send(buffer);
  } catch (error) {
    console.error('FX Rates Excel error:', error);
    res.status(500).json({ error: 'Failed to generate FX rates report' });
  }
});

app.get('/api/reports/department/:department/pdf', authenticate, async (req, res) => {
  try {
    const { department } = req.params;
    const { fiscal_year } = req.query;
    const requisitions = await db.Requisition.find({ department }).sort({ created_at: -1 }).lean();
    const mapped = requisitions.map(mapRequisitionFields);
    const doc = generateDepartmentalSpendingPDF(department, mapped, fiscal_year || new Date().getFullYear().toString());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${department}_Spending_Report.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Departmental PDF error:', error);
    res.status(500).json({ error: 'Failed to generate departmental report' });
  }
});

// Budget endpoints
// Enrich a Department doc with derived `available` = budget - spent - committed.
// Emits both the canonical field names (budget/spent/committed/available) and
// the legacy names the frontend BudgetManagement component was coded against
// (allocated_amount/committed_amount/available_amount/etc.).
function withAvailable(dept) {
  if (!dept) return null;
  const committed = dept.committed || 0;
  const spent = dept.spent || 0;
  const budget = dept.budget || 0;
  const available = budget - spent - committed;
  const utilization = budget > 0 ? ((spent + committed) / budget) * 100 : 0;
  return {
    ...dept,
    budget, spent, committed, available,
    // Legacy names consumed by BudgetManagement:
    department: dept.name,
    budget_id: dept._id,
    dept_code: dept.name,
    allocated_amount: budget,
    spent_amount: spent,
    committed_amount: committed,
    available_amount: available,
    utilization_percentage: utilization,
    budget_locked: dept.budget_locked || false,
    budget_locked_reason: dept.budget_locked_reason || '',
    finance_notes: dept.finance_notes || ''
  };
}

app.get('/api/budgets/all-departments', authenticate, async (req, res) => {
  try {
    const departments = await db.Department.find().lean();
    res.json(departments.map(withAvailable));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/budgets/overview', authenticate, async (req, res) => {
  try {
    const departments = await db.Department.find().lean();
    const enriched = departments.map(withAvailable);
    const totalBudget = enriched.reduce((sum, d) => sum + (d.budget || 0), 0);
    const totalSpent = enriched.reduce((sum, d) => sum + (d.spent || 0), 0);
    const totalCommitted = enriched.reduce((sum, d) => sum + (d.committed || 0), 0);
    res.json({
      totalBudget,
      totalSpent,
      totalCommitted,
      totalAvailable: totalBudget - totalSpent - totalCommitted,
      departments: enriched
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/budgets/department/:department', authenticate, async (req, res) => {
  try {
    const deptName = req.params.department;
    const fiscalYear = req.query.fiscal_year || String(new Date().getFullYear());
    const yearStart = new Date(`${fiscalYear}-01-01`);
    const yearEnd   = new Date(`${parseInt(fiscalYear) + 1}-01-01`);

    const dept = await db.Department.findOne({ name: deptName }).lean();
    const budget = withAvailable(dept) || {
      allocated_amount: 0, committed_amount: 0, available_amount: 0, spent_amount: 0
    };

    const reqs = await db.Requisition.find({
      department: deptName,
      status: { $in: ['pending_finance', 'pending_md', 'approved', 'completed'] },
      created_at: { $gte: yearStart, $lt: yearEnd }
    }).lean();

    const expenses = reqs.map(r => ({
      id: r._id,
      req_number: r.req_number,
      title: r.description || r.title || 'N/A',
      amount: r.amount || r.total_amount || 0,
      expense_type: ['approved', 'completed'].includes(r.status) ? 'spent' : 'committed',
      created_at: r.created_at
    }));

    res.json({ budget, expenses });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

const BUDGET_MGMT_ROLES = ['admin', 'finance', 'finance_manager', 'md'];

// Create or upsert a budget allocation for a department
app.post('/api/budgets/create', authenticate, async (req, res) => {
  try {
    if (!BUDGET_MGMT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised to manage budgets' });
    }
    const { department, allocated_amount } = req.body;
    if (!department || !allocated_amount || Number(allocated_amount) <= 0) {
      return res.status(400).json({ error: 'department and a positive allocated_amount are required' });
    }
    const dept = await db.Department.findOneAndUpdate(
      { name: department },
      { $set: { budget: parseFloat(allocated_amount) } },
      { new: true, upsert: true }
    ).lean();
    await db.BudgetChangeLog.create({
      department,
      fiscal_year: req.body.fiscal_year || String(new Date().getFullYear()),
      change_type: 'initial_allocation',
      old_amount: 0,
      new_amount: parseFloat(allocated_amount),
      reason: 'Initial allocation',
      changed_by: req.user.username,
      changed_by_name: req.user.full_name
    });
    res.json(withAvailable(dept));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update an existing department's budget allocation (budgetId = dept _id)
app.put('/api/budgets/:budgetId/allocate', authenticate, async (req, res) => {
  try {
    if (!BUDGET_MGMT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised to manage budgets' });
    }
    const { allocated_amount } = req.body;
    if (!allocated_amount || Number(allocated_amount) <= 0) {
      return res.status(400).json({ error: 'A positive allocated_amount is required' });
    }
    const oldDept = await db.Department.findById(req.params.budgetId).lean();
    const dept = await db.Department.findByIdAndUpdate(
      req.params.budgetId,
      { $set: { budget: parseFloat(allocated_amount) } },
      { new: true }
    ).lean();
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    await db.BudgetChangeLog.create({
      department: dept.name,
      fiscal_year: req.body.fiscal_year || String(new Date().getFullYear()),
      change_type: 'direct_edit',
      old_amount: oldDept ? (oldDept.budget || 0) : 0,
      new_amount: parseFloat(allocated_amount),
      reason: req.body.reason || 'Direct allocation update',
      changed_by: req.user.username,
      changed_by_name: req.user.full_name
    });
    res.json(withAvailable(dept));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Lock / unlock a department budget
app.put('/api/budgets/:budgetId/lock', authenticate, async (req, res) => {
  try {
    if (!BUDGET_MGMT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised to lock budgets' });
    }
    const { locked, reason } = req.body;
    const dept = await db.Department.findByIdAndUpdate(
      req.params.budgetId,
      { $set: { budget_locked: !!locked, budget_locked_reason: reason || '' } },
      { new: true }
    ).lean();
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    res.json(withAvailable(dept));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reallocate budget between two departments atomically
app.post('/api/budgets/reallocate', authenticate, async (req, res) => {
  try {
    if (!BUDGET_MGMT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised to reallocate budgets' });
    }
    const { from_department, to_department, amount, reason } = req.body;
    if (!from_department || !to_department || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'from_department, to_department and a positive amount are required' });
    }
    if (from_department === to_department) {
      return res.status(400).json({ error: 'Source and destination departments must differ' });
    }
    const fromDept = await db.Department.findOne({ name: from_department }).lean();
    if (!fromDept) return res.status(404).json({ error: `Department '${from_department}' not found` });
    const available = (fromDept.budget || 0) - (fromDept.spent || 0) - (fromDept.committed || 0);
    if (available < Number(amount)) {
      return res.status(400).json({ error: `Insufficient available budget in ${from_department}. Available: ZMW ${available.toLocaleString()}` });
    }
    await db.Department.updateOne({ name: from_department }, { $inc: { budget: -Number(amount) } });
    await db.Department.updateOne({ name: to_department },   { $inc: { budget:  Number(amount) } });
    const updatedFrom = withAvailable(await db.Department.findOne({ name: from_department }).lean());
    const updatedTo   = withAvailable(await db.Department.findOne({ name: to_department }).lean());
    res.json({ from: updatedFrom, to: updatedTo, amount: Number(amount), reason });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update finance notes on a department budget
app.patch('/api/budgets/:budgetId/notes', authenticate, async (req, res) => {
  try {
    if (!BUDGET_MGMT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised to update budget notes' });
    }
    const dept = await db.Department.findByIdAndUpdate(
      req.params.budgetId,
      { $set: { finance_notes: req.body.notes || '' } },
      { new: true }
    ).lean();
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    res.json(withAvailable(dept));
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
const StockItem = require('./models/StockItem');

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

    const mapRow = s => ({ ...s, initiator_full_name: s.initiator_name, initiator_department: s.department });

    const pageParams = getPaginationParams(req);
    if (pageParams) {
      const envelope = await paginateFind(IssueSlip, filter, { created_at: -1 }, pageParams);
      return res.json({ ...envelope, items: envelope.items.map(mapRow) });
    }

    const slips = await IssueSlip.find(filter).sort({ created_at: -1 }).lean();
    res.json(slips.map(mapRow));
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

// Create new issue slip.
// Wrapped in a MongoDB transaction so the GRN stock read and the IssueSlip
// write are atomic: two concurrent POSTs against the same GRN cannot both
// pass validation and leave the GRN over-issued. Requires a replica set
// (Atlas deployments are replica sets; satisfied by our MONGODB_URI).
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

    const slipItems = (items || []).map(item => ({
      item_code: item.item_code || '',
      item_name: item.item_name,
      description: item.description || '',
      quantity: item.quantity,
      unit: item.unit || 'pcs'
    }));

    let createdSlip;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // === GRN Stock Validation ===
        if (reference_number) {
          const grn = await GoodsReceiptNote.findOne({ id: reference_number }).session(session).lean();
          if (!grn) {
            throw new HttpError(400, { error: `GRN ${reference_number} not found` });
          }
          if (grn.status !== 'approved') {
            throw new HttpError(400, { error: `GRN ${reference_number} is not approved` });
          }

          if (grn.customer) {
            if (!customer || customer !== grn.customer) {
              throw new HttpError(400, { error: `GRN ${reference_number} is reserved for customer "${grn.customer}". Issue slip customer must match.` });
            }
          }

          const existingSlips = await IssueSlip.find({
            reference_number: reference_number,
            status: { $in: ['pending_hod', 'pending_finance', 'approved'] }
          }).session(session).lean();

          const issuedMap = {};
          existingSlips.forEach(s => {
            (s.items || []).forEach(item => {
              const key = item.item_code || item.description || item.item_name;
              issuedMap[key] = (issuedMap[key] || 0) + (item.quantity || 0);
            });
          });

          for (const item of (items || [])) {
            const key = item.item_code || item.description || item.item_name;
            const grnItem = grn.items.find(gi =>
              (gi.item_code && gi.item_code === item.item_code) ||
              (gi.description || gi.item_name) === (item.description || item.item_name)
            );

            if (!grnItem) {
              throw new HttpError(400, { error: `Item "${key}" not found on GRN ${reference_number}` });
            }

            const alreadyIssued = issuedMap[key] || 0;
            const remaining = grnItem.quantity_received - alreadyIssued;

            if (item.quantity > remaining) {
              throw new HttpError(400, {
                error: `Insufficient stock for "${key}": requested ${item.quantity}, available ${remaining} (received ${grnItem.quantity_received}, already issued ${alreadyIssued})`
              });
            }
          }
        }

        const slipDoc = new IssueSlip({
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
        await slipDoc.save({ session });
        createdSlip = slipDoc;
      });
    } finally {
      await session.endSession();
    }

    res.status(201).json({
      message: 'Issue slip created successfully',
      slip: createdSlip
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json(error.body);
    }
    console.error('Error creating issue slip:', error);
    res.status(500).json({ error: 'Failed to create issue slip', details: error.message });
  }
});

// HOD action on issue slip. Wrapped in a transaction so we cannot leave
// the slip in pending_finance without its finance approval entry if the
// second update fails.
app.put('/api/stores/issue-slips/:id/hod-action', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userName = req.user.full_name || req.user.name;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const newStatus = action === 'approved' ? 'pending_finance' : 'rejected';

    const updateOps = {
      status: newStatus,
      'approvals.$[hodApproval].name': userName,
      'approvals.$[hodApproval].action': action,
      'approvals.$[hodApproval].comments': comments || '',
      'approvals.$[hodApproval].date': new Date()
    };

    let slip;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        slip = await IssueSlip.findOneAndUpdate(
          { id },
          { $set: updateOps },
          { arrayFilters: [{ 'hodApproval.role': 'hod' }], new: true, session }
        );

        if (!slip) {
          throw new HttpError(404, { error: 'Issue slip not found' });
        }

        if (action === 'approved') {
          await IssueSlip.findOneAndUpdate(
            { id },
            { $push: { approvals: { role: 'finance', name: '', action: 'pending', comments: '', date: new Date() } } },
            { session }
          );
        }
      });
    } finally {
      await session.endSession();
    }

    res.json({ message: `Issue slip ${action} by HOD successfully` });

    logAudit(req, {
      entity_type: 'IssueSlip',
      entity_id: id,
      action: `hod-${action}`,
      from_status: 'pending_hod',
      to_status: newStatus,
      comments
    });

    // Fire-and-forget email notification
    sendStatusNotification({
      formType: 'issue-slip',
      formId: id,
      newStatus,
      department: slip.department,
      initiatorId: slip.initiator_id,
      initiatorName: slip.initiator_name,
      approverName: userName,
      comments
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json(error.body);
    }
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

    logAudit(req, {
      entity_type: 'IssueSlip',
      entity_id: id,
      action: `finance-${action}`,
      from_status: 'pending_finance',
      to_status: newStatus,
      comments
    });

    // Fire-and-forget email notification
    sendStatusNotification({
      formType: 'issue-slip',
      formId: id,
      newStatus,
      department: slip.department,
      initiatorId: slip.initiator_id,
      initiatorName: slip.initiator_name,
      approverName: userName,
      comments
    });
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

    const mapRow = s => ({ ...s, initiator_full_name: s.initiator_name, initiator_department: s.department });

    const pageParams = getPaginationParams(req);
    if (pageParams) {
      const envelope = await paginateFind(PickingSlip, filter, { created_at: -1 }, pageParams);
      return res.json({ ...envelope, items: envelope.items.map(mapRow) });
    }

    const slips = await PickingSlip.find(filter).sort({ created_at: -1 }).lean();
    res.json(slips.map(mapRow));
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

    const pageParams = getPaginationParams(req);
    if (pageParams) {
      const envelope = await paginateFind(GoodsReceiptNote, filter, { created_at: -1 }, pageParams);
      return res.json(envelope);
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
      department, customer, reservation_type, remarks, items
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
      reservation_type: reservation_type || 'none',
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

    // Load the GRN once to run authorization checks; the actual status
    // flip is done via a conditional findOneAndUpdate so two concurrent
    // approvals cannot both succeed (the second will find status !=
    // pending_approval and return null).
    const existing = await GoodsReceiptNote.findOne({ id: req.params.id }).lean();
    if (!existing) {
      return res.status(404).json({ error: 'GRN not found' });
    }
    if (existing.status !== 'pending_approval') {
      return res.status(400).json({ error: `GRN is already ${existing.status}` });
    }

    const userName = req.user.full_name || req.user.name;
    const userRole = req.user.role;
    const isAssignedApprover = existing.assigned_approver && existing.assigned_approver === userName;
    const isPrivilegedRole = ['admin', 'finance', 'finance_manager', 'md'].includes(userRole);

    if (!isAssignedApprover && !isPrivilegedRole) {
      return res.status(403).json({ error: 'You are not authorized to approve this GRN' });
    }

    const grn = await GoodsReceiptNote.findOneAndUpdate(
      { id: req.params.id, status: 'pending_approval' },
      {
        $set: {
          status: action,
          approvals: [{
            role: 'finance',
            name: userName,
            action: action,
            comments: comments || '',
            date: new Date()
          }]
        }
      },
      { new: true }
    );

    if (!grn) {
      // Lost the race: another approver committed first.
      return res.status(409).json({ error: 'GRN was just updated by another approver. Refresh and try again.' });
    }

    // Shift committed -> spent on the linked PR's department. Idempotent via
    // Requisition.budget_settled: only the first approved GRN for a PR moves
    // the money. Best-effort — if this fails we log but do not fail the
    // approval (GRN status is already flipped).
    if (action === 'approved' && grn.pr_id) {
      try {
        const Requisition = require('./models/Requisition');
        const settled = await Requisition.findOneAndUpdate(
          { id: grn.pr_id, budget_settled: { $ne: true } },
          { $set: { budget_settled: true } },
          { new: false }
        ).lean();
        if (settled) {
          const amtZMW = await getRequisitionAmountZMW(settled);
          await shiftCommitToSpent(settled.department, amtZMW);
        }
      } catch (err) {
        logError(err, {
          type: 'BUDGET_SHIFT_ON_GRN_APPROVE_FAILED',
          grn_id: req.params.id,
          pr_id: grn.pr_id
        });
      }
    }

    res.json({ message: `GRN ${action} successfully`, grn });

    logAudit(req, {
      entity_type: 'GRN',
      entity_id: req.params.id,
      action: `approve-${action}`,
      from_status: 'pending_approval',
      to_status: action,
      comments
    });
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

// ============================================
// STOCK ITEMS MASTER CATALOG
// ============================================

// List all stock items (sorted A-Z by description)
app.get('/api/stores/stock-items', authenticate, async (req, res) => {
  try {
    const items = await StockItem.find().sort({ item_description: 1 }).lean();
    res.json(items);
  } catch (error) {
    console.error('Error fetching stock items:', error);
    res.status(500).json({ error: 'Failed to fetch stock items' });
  }
});

// Create a stock item
app.post('/api/stores/stock-items', authenticate, async (req, res) => {
  try {
    const item = new StockItem(req.body);
    const saved = await item.save();
    res.json({ success: true, item: saved });
  } catch (error) {
    console.error('Error creating stock item:', error);
    res.status(500).json({ error: error.message || 'Failed to create stock item' });
  }
});

// Bulk upload stock items (upsert on item_number) - must be before :id route
app.post('/api/stores/stock-items/bulk-upload', authenticate, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    // Separate items with and without item_number
    const withNumber = items.filter(i => i.item_number && i.item_number.trim());
    const withoutNumber = items.filter(i => !i.item_number || !i.item_number.trim());

    let upsertedCount = 0;
    let modifiedCount = 0;

    // Upsert items that have an item_number
    if (withNumber.length > 0) {
      const ops = withNumber.map(item => ({
        updateOne: {
          filter: { item_number: item.item_number.trim() },
          update: { $set: { ...item, item_number: item.item_number.trim() } },
          upsert: true
        }
      }));
      const result = await StockItem.bulkWrite(ops);
      upsertedCount = result.upsertedCount;
      modifiedCount = result.modifiedCount;
    }

    // Insert items without item_number directly
    if (withoutNumber.length > 0) {
      const cleaned = withoutNumber.map(i => {
        const { item_number, ...rest } = i;
        return rest;
      });
      await StockItem.insertMany(cleaned);
      upsertedCount += cleaned.length;
    }

    res.json({
      success: true,
      imported: items.length,
      upserted: upsertedCount,
      modified: modifiedCount
    });
  } catch (error) {
    console.error('Error bulk uploading stock items:', error);
    res.status(500).json({ error: 'Failed to bulk upload stock items' });
  }
});

// Update a stock item
app.put('/api/stores/stock-items/:id', authenticate, async (req, res) => {
  try {
    const updated = await StockItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Stock item not found' });
    res.json({ success: true, item: updated });
  } catch (error) {
    console.error('Error updating stock item:', error);
    res.status(500).json({ error: error.message || 'Failed to update stock item' });
  }
});

// Delete a stock item
app.delete('/api/stores/stock-items/:id', authenticate, async (req, res) => {
  try {
    const deleted = await StockItem.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Stock item not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting stock item:', error);
    res.status(500).json({ error: 'Failed to delete stock item' });
  }
});

// Email notification test/diagnostic endpoint
app.get('/api/test-email', authenticate, async (req, res) => {
  try {
    const User = require('./models/User');

    const resendKey = process.env.RESEND_API_KEY;
    const config = {
      RESEND_API_KEY: resendKey ? `${resendKey.substring(0, 8)}***` : '(not set)',
      RESEND_FROM: process.env.RESEND_FROM || '(not set)',
      SMTP_HOST: process.env.SMTP_HOST || '(not set)',
      SMTP_PORT: process.env.SMTP_PORT || '(not set)',
      SMTP_USER: process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}***` : '(not set)',
      SMTP_PASS: process.env.SMTP_PASS ? '***set***' : '(not set)',
      SMTP_FROM: process.env.SMTP_FROM || '(not set)',
      provider: resendKey ? 'Resend (HTTP)' : (process.env.SMTP_USER ? 'SMTP' : 'none')
    };

    const currentUser = await User.findById(req.user.id).select('full_name email role department').lean();
    const department = currentUser?.department;
    const hods = await User.find({ is_hod: 1, department }).select('full_name email department').lean();

    const initiator = await User.findById(req.user.id).select('supervisor_name').lean();
    let supervisorEmail = null;
    if (initiator?.supervisor_name) {
      const supervisor = await User.findOne({ full_name: initiator.supervisor_name }).select('full_name email').lean();
      supervisorEmail = supervisor?.email || `(supervisor "${initiator.supervisor_name}" not found)`;
    }

    let emailStatus = 'not configured';
    if (resendKey) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(resendKey);
        // Test by listing API keys (lightweight check)
        await resend.apiKeys.list();
        emailStatus = 'Resend connected OK';
      } catch (e) {
        emailStatus = `Resend connection failed: ${e.message}`;
      }
    } else if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      emailStatus = 'SMTP configured (may be blocked on Render)';
    }

    res.json({
      emailConfig: config,
      emailStatus,
      currentUser,
      department,
      hodsForDepartment: hods,
      supervisorFallback: supervisorEmail || initiator?.supervisor_name || '(no supervisor set)',
      note: 'If hodsForDepartment is empty and supervisor has no email, no recipient can be found for pending_hod notifications.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PETTY CASH RECEIPT ROUTES
// ============================================

// POST /api/forms/petty-cash-requisitions/:id/receipts
// Upload 1–3 receipts (JPEG / WebP / PDF, max 2 MB each).
// Returns the updated receipts array (metadata only — no base64).
app.post(
  '/api/forms/petty-cash-requisitions/:id/receipts',
  authenticate,
  receiptUpload.array('receipts', 3),
  async (req, res) => {
    try {
      const pc = await db.PettyCashRequisition.findOne({ id: req.params.id });
      if (!pc) return res.status(404).json({ error: 'Petty cash requisition not found' });

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No valid files uploaded. Accepted: JPEG, WebP, PDF (max 2 MB each).' });
      }

      const existing = pc.receipts ? pc.receipts.length : 0;
      if (existing + req.files.length > 3) {
        return res.status(400).json({ error: `Maximum 3 receipts allowed. This request already has ${existing}.` });
      }

      const newReceipts = req.files.map(f => ({
        filename:    f.originalname,
        mimetype:    f.mimetype,
        size:        f.size,
        data:        f.buffer.toString('base64'),
        uploaded_by: req.user.full_name || req.user.username,
        uploaded_at: new Date()
      }));

      pc.receipts.push(...newReceipts);
      await pc.save();

      // Return metadata only (omit base64 data for bandwidth)
      const meta = pc.receipts.map(r => ({
        _id: r._id, filename: r.filename, mimetype: r.mimetype,
        size: r.size, uploaded_by: r.uploaded_by, uploaded_at: r.uploaded_at
      }));
      res.json({ receipts: meta });
    } catch (e) {
      console.error('Receipt upload error:', e);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// GET /api/forms/petty-cash-requisitions/:id/receipts
// Returns receipt metadata list (no base64 blobs).
app.get('/api/forms/petty-cash-requisitions/:id/receipts', authenticate, async (req, res) => {
  try {
    const pc = await db.PettyCashRequisition.findOne({ id: req.params.id }).lean();
    if (!pc) return res.status(404).json({ error: 'Not found' });
    const meta = (pc.receipts || []).map(r => ({
      _id: r._id, filename: r.filename, mimetype: r.mimetype,
      size: r.size, uploaded_by: r.uploaded_by, uploaded_at: r.uploaded_at
    }));
    res.json({ receipts: meta });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/forms/petty-cash-requisitions/:id/receipts/:receiptId
// Stream a single receipt file for download / inline view.
app.get('/api/forms/petty-cash-requisitions/:id/receipts/:receiptId', authenticate, async (req, res) => {
  try {
    const pc = await db.PettyCashRequisition.findOne({ id: req.params.id }).lean();
    if (!pc) return res.status(404).json({ error: 'Not found' });
    const receipt = (pc.receipts || []).find(r => String(r._id) === req.params.receiptId);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    const buf = Buffer.from(receipt.data, 'base64');
    res.setHeader('Content-Type', receipt.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.filename}"`);
    res.setHeader('Content-Length', buf.length);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/forms/petty-cash-requisitions/:id/receipts/:receiptId
app.delete('/api/forms/petty-cash-requisitions/:id/receipts/:receiptId', authenticate, async (req, res) => {
  try {
    const pc = await db.PettyCashRequisition.findOne({ id: req.params.id });
    if (!pc) return res.status(404).json({ error: 'Not found' });
    // Only uploader, admin, finance, finance_manager can delete
    const receipt = (pc.receipts || []).find(r => String(r._id) === req.params.receiptId);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    const canDelete = ['admin', 'finance', 'finance_manager'].includes(req.user.role)
      || receipt.uploaded_by === (req.user.full_name || req.user.username);
    if (!canDelete) return res.status(403).json({ error: 'Not authorised to delete this receipt' });
    pc.receipts.pull({ _id: req.params.receiptId });
    await pc.save();
    const meta = pc.receipts.map(r => ({
      _id: r._id, filename: r.filename, mimetype: r.mimetype,
      size: r.size, uploaded_by: r.uploaded_by, uploaded_at: r.uploaded_at
    }));
    res.json({ receipts: meta });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// BUDGET SUPPLEMENT ROUTES
// ============================================

// GET /api/budget-supplements
// HOD: own department only. Finance/MD/Admin: all supplements (filtered by status they can act on)
app.get('/api/budget-supplements', authenticate, async (req, res) => {
  try {
    const { role, department, is_hod } = req.user;
    let filter = {};
    if (is_hod && !['finance', 'finance_manager', 'md', 'admin'].includes(role)) {
      filter = { department };
    }
    const supplements = await db.BudgetSupplement.find(filter).sort({ created_at: -1 }).lean();
    res.json(supplements);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/budget-supplements  — HOD creates a supplement request
app.post('/api/budget-supplements', authenticate, async (req, res) => {
  try {
    if (!req.user.is_hod) {
      return res.status(403).json({ error: 'Only HODs can request budget supplements' });
    }
    const { requested_amount, justification } = req.body;
    if (!requested_amount || Number(requested_amount) <= 0) {
      return res.status(400).json({ error: 'A positive requested_amount is required' });
    }
    if (!justification || !justification.trim()) {
      return res.status(400).json({ error: 'A justification is required' });
    }
    const supplement = await db.BudgetSupplement.create({
      department: req.user.department,
      requested_amount: parseFloat(requested_amount),
      justification: justification.trim(),
      requested_by: req.user.id,
      requested_by_name: req.user.full_name || req.user.name
    });
    res.status(201).json(supplement);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/budget-supplements/:id/review  — Finance or MD approves/rejects
app.put('/api/budget-supplements/:id/review', authenticate, async (req, res) => {
  try {
    const { role } = req.user;
    const { action, comments } = req.body;           // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }

    const supp = await db.BudgetSupplement.findById(req.params.id);
    if (!supp) return res.status(404).json({ error: 'Supplement request not found' });

    const reviewerName = req.user.full_name || req.user.name;

    // Finance / Finance Manager: can act on pending_finance
    if (['finance', 'finance_manager'].includes(role)) {
      if (supp.status !== 'pending_finance') {
        return res.status(400).json({ error: 'This request is not awaiting Finance review' });
      }
      supp.finance_reviewed_by      = req.user.id;
      supp.finance_reviewed_by_name = reviewerName;
      supp.finance_reviewed_at      = new Date();
      supp.finance_comments         = comments || '';
      supp.status = action === 'approve' ? 'pending_md' : 'rejected';
    }
    // MD / Admin: can act on pending_md
    else if (['md', 'admin'].includes(role)) {
      if (supp.status !== 'pending_md') {
        return res.status(400).json({ error: 'This request is not awaiting MD review' });
      }
      supp.md_reviewed_by      = req.user.id;
      supp.md_reviewed_by_name = reviewerName;
      supp.md_reviewed_at      = new Date();
      supp.md_comments         = comments || '';
      supp.status = action === 'approve' ? 'approved' : 'rejected';

      // When MD approves: increment the department's budget allocation
      if (action === 'approve') {
        const deptBefore = await db.Department.findOne({ name: supp.department }).lean();
        await db.Department.findOneAndUpdate(
          { name: supp.department },
          { $inc: { budget: supp.requested_amount } }
        );
        await db.BudgetChangeLog.create({
          department: supp.department,
          fiscal_year: String(new Date().getFullYear()),
          change_type: 'supplement_approved',
          old_amount: deptBefore ? (deptBefore.budget || 0) : 0,
          new_amount: (deptBefore ? (deptBefore.budget || 0) : 0) + supp.requested_amount,
          reason: `Budget supplement approved: ${supp.justification || ''}`,
          reference_id: String(supp._id),
          changed_by: req.user.username,
          changed_by_name: req.user.full_name
        });
      }
    } else {
      return res.status(403).json({ error: 'Not authorised to review supplement requests' });
    }

    await supp.save();
    res.json(supp);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// BUDGET PLAN ROUTES
// ============================================

// GET /api/budget-plans
app.get('/api/budget-plans', authenticate, async (req, res) => {
  try {
    if (!BUDGET_MGMT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const filter = {};
    if (req.query.fiscal_year) filter.fiscal_year = req.query.fiscal_year;
    const plans = await db.BudgetPlan.find(filter).sort({ createdAt: -1 }).lean();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/budget-plans — Finance Manager/Admin creates a draft
app.post('/api/budget-plans', authenticate, async (req, res) => {
  try {
    if (!['finance_manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only Finance Manager or Admin can create budget plans' });
    }
    const { fiscal_year, allocations, notes } = req.body;
    if (!fiscal_year || !Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ error: 'fiscal_year and allocations are required' });
    }
    const plan = await db.BudgetPlan.create({
      fiscal_year,
      allocations,
      notes: notes || '',
      prepared_by: req.user.username,
      prepared_by_name: req.user.full_name,
      status: 'draft'
    });
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/budget-plans/:id
app.get('/api/budget-plans/:id', authenticate, async (req, res) => {
  try {
    if (!BUDGET_MGMT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const plan = await db.BudgetPlan.findById(req.params.id).lean();
    if (!plan) return res.status(404).json({ error: 'Budget plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/budget-plans/:id — update draft allocations
app.put('/api/budget-plans/:id', authenticate, async (req, res) => {
  try {
    if (!['finance_manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const plan = await db.BudgetPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Budget plan not found' });
    if (plan.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft plans can be edited' });
    }
    const { allocations, notes } = req.body;
    if (Array.isArray(allocations)) plan.allocations = allocations;
    if (notes !== undefined) plan.notes = notes;
    await plan.save();
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/budget-plans/:id/submit — Finance Manager submits draft to MD
app.post('/api/budget-plans/:id/submit', authenticate, async (req, res) => {
  try {
    if (!['finance_manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const plan = await db.BudgetPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Budget plan not found' });
    if (plan.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft plans can be submitted' });
    }
    plan.status = 'pending_md';
    plan.submitted_at = new Date();
    await plan.save();
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/budget-plans/:id/review — MD approves/rejects
app.put('/api/budget-plans/:id/review', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'md' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only MD or Admin can review budget plans' });
    }
    const { action, comments } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }
    const plan = await db.BudgetPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Budget plan not found' });
    if (plan.status !== 'pending_md') {
      return res.status(400).json({ error: 'This plan is not awaiting MD review' });
    }
    plan.md_reviewed_by = req.user.username;
    plan.md_reviewed_by_name = req.user.full_name;
    plan.md_reviewed_at = new Date();
    plan.md_comments = comments || '';
    plan.status = action === 'approve' ? 'approved' : 'rejected';

    if (action === 'approve') {
      for (const alloc of plan.allocations) {
        const deptBefore = await db.Department.findOne({ name: alloc.department }).lean();
        await db.Department.findOneAndUpdate(
          { name: alloc.department },
          { $set: { budget: alloc.amount } },
          { upsert: true }
        );
        await db.BudgetChangeLog.create({
          department: alloc.department,
          fiscal_year: plan.fiscal_year,
          change_type: 'plan_approved',
          old_amount: deptBefore ? (deptBefore.budget || 0) : 0,
          new_amount: alloc.amount,
          reason: `Budget plan approved for FY ${plan.fiscal_year}${comments ? ': ' + comments : ''}`,
          reference_id: String(plan._id),
          changed_by: req.user.username,
          changed_by_name: req.user.full_name
        });
      }
    }

    await plan.save();
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/budget-plans/:id — delete draft
app.delete('/api/budget-plans/:id', authenticate, async (req, res) => {
  try {
    if (!['finance_manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const plan = await db.BudgetPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Budget plan not found' });
    if (plan.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft plans can be deleted' });
    }
    await plan.deleteOne();
    res.json({ message: 'Budget plan deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// BUDGET AMENDMENT ROUTES
// ============================================

// GET /api/budget-amendments
app.get('/api/budget-amendments', authenticate, async (req, res) => {
  try {
    if (!BUDGET_MGMT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const filter = {};
    if (req.query.fiscal_year) filter.fiscal_year = req.query.fiscal_year;
    const amendments = await db.BudgetAmendment.find(filter).sort({ createdAt: -1 }).lean();
    res.json(amendments);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/budget-amendments — Finance Manager creates amendment request
app.post('/api/budget-amendments', authenticate, async (req, res) => {
  try {
    if (!['finance_manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only Finance Manager or Admin can request amendments' });
    }
    const { department, fiscal_year, requested_amount, reason } = req.body;
    if (!department || !fiscal_year || !requested_amount || !reason) {
      return res.status(400).json({ error: 'department, fiscal_year, requested_amount and reason are required' });
    }
    if (Number(requested_amount) <= 0) {
      return res.status(400).json({ error: 'requested_amount must be positive' });
    }
    const dept = await db.Department.findOne({ name: department }).lean();
    const current_amount = dept ? (dept.budget || 0) : 0;
    const amendment = await db.BudgetAmendment.create({
      department,
      fiscal_year,
      current_amount,
      requested_amount: parseFloat(requested_amount),
      reason: reason.trim(),
      status: 'pending_md',
      requested_by: req.user.username,
      requested_by_name: req.user.full_name
    });
    res.status(201).json(amendment);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/budget-amendments/:id/review — MD approves/rejects
app.put('/api/budget-amendments/:id/review', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'md' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only MD or Admin can review amendments' });
    }
    const { action, comments } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }
    const amendment = await db.BudgetAmendment.findById(req.params.id);
    if (!amendment) return res.status(404).json({ error: 'Amendment not found' });
    if (amendment.status !== 'pending_md') {
      return res.status(400).json({ error: 'This amendment is not awaiting MD review' });
    }
    amendment.md_reviewed_by = req.user.username;
    amendment.md_reviewed_by_name = req.user.full_name;
    amendment.md_reviewed_at = new Date();
    amendment.md_comments = comments || '';
    amendment.status = action === 'approve' ? 'approved' : 'rejected';

    if (action === 'approve') {
      await db.Department.findOneAndUpdate(
        { name: amendment.department },
        { $set: { budget: amendment.requested_amount } }
      );
      await db.BudgetChangeLog.create({
        department: amendment.department,
        fiscal_year: amendment.fiscal_year,
        change_type: 'amendment_approved',
        old_amount: amendment.current_amount,
        new_amount: amendment.requested_amount,
        reason: `Amendment approved: ${amendment.reason}${comments ? ' — ' + comments : ''}`,
        reference_id: String(amendment._id),
        changed_by: req.user.username,
        changed_by_name: req.user.full_name
      });
    }

    await amendment.save();
    res.json(amendment);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// BUDGET CHANGE LOG ROUTE
// ============================================

// GET /api/budget-change-log
app.get('/api/budget-change-log', authenticate, async (req, res) => {
  try {
    if (!BUDGET_MGMT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.fiscal_year) filter.fiscal_year = req.query.fiscal_year;
    const logs = await db.BudgetChangeLog.find(filter).sort({ createdAt: -1 }).lean();
    res.json(logs);
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🗄️  Database: MongoDB`);
    logger.info({ type: 'STARTUP', port: PORT, env: process.env.NODE_ENV || 'development' });
  });

  // Graceful shutdown: drain in-flight requests then disconnect Mongo.
  // Render sends SIGTERM before killing the container during redeploys.
  const shutdown = async (signal) => {
    logger.info({ type: 'SHUTDOWN', signal });
    server.close(async () => {
      try { await require('mongoose').disconnect(); } catch (_) {}
      process.exit(0);
    });
    // Hard timeout if anything is stuck.
    setTimeout(() => process.exit(1), 15000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logError(err instanceof Error ? err : new Error(String(err)), { type: 'UNHANDLED_REJECTION' }));
  process.on('uncaughtException', (err) => { logError(err, { type: 'UNCAUGHT_EXCEPTION' }); });
};

if (require.main === module) {
  startServer();
}

module.exports = app;
