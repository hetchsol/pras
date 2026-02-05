require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { hashPassword, comparePassword, generateToken, generateRefreshToken, getRefreshTokenExpiry, verifyToken } = require('./utils/auth');
const { authenticate, authorize } = require('./middleware/auth');
const { errorHandler, notFound, AppError } = require('./middleware/errorHandler');
const {
  validateLogin,
  validateCreateRequisition,
  validateUpdateRequisition,
  validateId
} = require('./middleware/validation');
const { loginLimiter, apiLimiter } = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');
const { logger, logAuth, logSecurity, logError } = require('./utils/logger');
const { generateRequisitionPDF } = require('./utils/pdfGenerator');
const database = require('./database');
const { getUserById } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

    // Allow requests with no origin (like mobile apps, curl, or file:// protocol)
    if (!origin) return callback(null, true);

    // Allow file:// protocol (when opening HTML files directly)
    if (origin.startsWith('file://')) return callback(null, true);

    // Allow null origin (some browsers send this for file://)
    if (origin === 'null') return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // In development, allow all origins. In production, restrict!
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Middleware to disable all caching for HTML/JS/CSS
app.use((req, res, next) => {
    if (req.url.endsWith('.html') || req.url.endsWith('.js') || req.url.endsWith('.css') || req.url === '/') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        // Remove ETag to prevent conditional requests
        res.removeHeader('ETag');
        res.removeHeader('Last-Modified');
    }
    next();
});

// Serve static files with proper cache control headers
app.use(express.static('public', {
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        // Prevent caching of HTML, JS, and CSS files to avoid stale content
        if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
        }
    }
}));

// Serve frontend files with no-cache headers
app.use(express.static(path.join(__dirname, '../frontend'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
        // Prevent caching of HTML, JS, and CSS files
        if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
        }
    }
}));

app.use(requestLogger); // Log all requests

// Database setup
const db = new sqlite3.Database('./purchase_requisition.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT,
            role TEXT NOT NULL,
            department TEXT,
            is_hod BOOLEAN DEFAULT 0,
            assigned_hod INTEGER,
            can_access_stores BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assigned_hod) REFERENCES users(id)
        )`);

        // Add can_access_stores column to existing users table if not exists
        db.run(`ALTER TABLE users ADD COLUMN can_access_stores BOOLEAN DEFAULT 0`, (err) => {
            // Ignore error if column already exists
        });

        // Requisitions table
        db.run(`CREATE TABLE IF NOT EXISTS requisitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            req_number TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            delivery_location TEXT,
            urgency TEXT DEFAULT 'Medium',
            required_date DATE,
            account_code TEXT,
            created_by INTEGER NOT NULL,
            status TEXT DEFAULT 'draft',
            hod_approval_status TEXT DEFAULT 'pending',
            hod_approved_by INTEGER,
            hod_approved_at DATETIME,
            hod_comments TEXT,
            total_amount REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // Requisition items table
        db.run(`CREATE TABLE IF NOT EXISTS requisition_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requisition_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL DEFAULT 0,
            total_price REAL DEFAULT 0,
            specifications TEXT,
            vendor_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
            FOREIGN KEY (vendor_id) REFERENCES vendors(id)
        )`);

        // Vendors table
        db.run(`CREATE TABLE IF NOT EXISTS vendors (
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
        )`);

        // Audit log table
        db.run(`CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requisition_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Refresh tokens table
        db.run(`CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Departments table
        db.run(`CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            code TEXT UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Department codes table (for sub-codes or additional codes)
        db.run(`CREATE TABLE IF NOT EXISTS department_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            department_id INTEGER,
            code TEXT UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (department_id) REFERENCES departments(id)
        )`, () => {
            seedDefaultData();
        });
    });
}

// Seed default data
function seedDefaultData() {
    // Check if users exist
db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) {
            console.error('Error checking users:', err);
            return;
        }
        if (row && row.count === 0) {
            const defaultUsers = [
                ['john.banda', 'password123', 'John Banda', 'john@company.zm', 'initiator', 'IT', 0],
                ['mary.mwanza', 'password123', 'Mary Mwanza', 'mary@company.zm', 'hod', 'IT', 1],
                ['james.phiri', 'password123', 'James Phiri', 'james@company.zm', 'procurement', 'Procurement', 0],
                ['sarah.banda', 'password123', 'Sarah Banda', 'sarah@company.zm', 'finance', 'Finance', 1],
                ['david.mulenga', 'password123', 'David Mulenga', 'david@company.zm', 'md', 'Executive', 0],
                ['admin', 'admin123', 'System Admin', 'admin@company.zm', 'admin', 'IT', 0]
            ];

            const stmt = db.prepare("INSERT INTO users (username, password, full_name, email, role, department, is_hod) VALUES (?, ?, ?, ?, ?, ?, ?)");
            defaultUsers.forEach(user => stmt.run(user));
            stmt.finalize();
            console.log('✅ Default users created');
        }
    });

    // Check if vendors exist
    db.get("SELECT COUNT(*) as count FROM vendors", (err, row) => {
        if (row && row.count === 0) {
            const defaultVendors = [
                ['Tech Solutions Ltd', 'TSL001', 1, 4.5, 'Technology', 'active', 'sales@techsolutions.zm', '+260 211 123456'],
                ['Office Supplies Co', 'OSC002', 1, 4.8, 'Office Supplies', 'active', 'info@officesupplies.zm', '+260 211 234567'],
                ['Hardware Plus', 'HWP003', 2, 4.2, 'Hardware', 'active', 'sales@hardwareplus.zm', '+260 211 345678'],
                ['Zambia Furniture Co', 'ZFC004', 2, 4.0, 'Furniture', 'active', 'orders@zamfurniture.zm', '+260 211 456789'],
                ['Medical Supplies Ltd', 'MSL005', 1, 4.9, 'Medical', 'active', 'info@medsupplies.zm', '+260 211 567890']
            ];

            const stmt = db.prepare("INSERT INTO vendors (name, code, tier, rating, category, status, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            defaultVendors.forEach(vendor => stmt.run(vendor));
            stmt.finalize();
            console.log('✅ Default vendors created');
        }
    });

    // Check if departments exist
    db.get("SELECT COUNT(*) as count FROM departments", (err, row) => {
        if (row && row.count === 0) {
            const defaultDepartments = [
                ['IT', 'IT', 'Information Technology Department', 1],
                ['HR', 'HR', 'Human Resources Department', 1],
                ['Finance', 'FIN', 'Finance Department', 1],
                ['Operations', 'OPS', 'Operations Department', 1],
                ['Procurement', 'PROC', 'Procurement Department', 1],
                ['Executive', 'EXEC', 'Executive Management', 1]
            ];

            const stmt = db.prepare("INSERT INTO departments (name, code, description, is_active) VALUES (?, ?, ?, ?)");
            defaultDepartments.forEach(dept => stmt.run(dept));
            stmt.finalize();
            console.log('✅ Default departments created');
        }
    });
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Purchase Requisition API is running' });
});

// Authentication
app.post('/api/auth/login', loginLimiter, validateLogin, async (req, res, next) => {
    try {
        const { username, password } = req.body;

        db.get("SELECT * FROM users WHERE username = ?",
            [username],
            async (err, user) => {
                if (err) {
                    return next(new AppError('Database error', 500));
                }
                if (!user) {
                    logAuth('login_attempt', null, false, {
                        username,
                        reason: 'user_not_found',
                        ip: req.ip
                    });
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                // Compare password with hash
                const isPasswordValid = await comparePassword(password, user.password);
                if (!isPasswordValid) {
                    logAuth('login_attempt', user.id, false, {
                        username,
                        reason: 'invalid_password',
                        ip: req.ip
                    });
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                // Generate JWT access token and refresh token
                const token = generateToken(user);
                const refreshToken = generateRefreshToken();
                const refreshTokenExpiry = getRefreshTokenExpiry();

                // Store refresh token in database
                const ipAddress = req.ip || req.connection.remoteAddress;
                const userAgent = req.get('user-agent');

                db.run(
                    `INSERT INTO refresh_tokens (user_id, token, expires_at, ip_address, user_agent)
                     VALUES (?, ?, ?, ?, ?)`,
                    [user.id, refreshToken, refreshTokenExpiry, ipAddress, userAgent],
                    (err) => {
                        if (err) {
                            console.error('Error storing refresh token:', err);
                            logError(err, { context: 'storing_refresh_token', userId: user.id });
                            return next(new AppError('Failed to create session', 500));
                        }

                        // Log successful login
                        logAuth('login_success', user.id, true, {
                            username: user.username,
                            role: user.role,
                            ip: ipAddress,
                            userAgent
                        });

                        res.json({
                            success: true,
                            token,
                            refreshToken,
                            expiresIn: '15m', // Access token expiry
                            user: {
                                id: user.id,
                                username: user.username,
                                full_name: user.full_name,
                                email: user.email,
                                role: user.role,
                                department: user.department,
                                is_hod: user.is_hod
                            }
                        });
                    }
                );
            }
        );
    } catch (error) {
        next(error);
    }
});

// Get current user info
app.get('/api/auth/me', authenticate, (req, res, next) => {
    try {
        const user = getUserById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return user info without password
        res.json({
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            employee_number: user.employee_number,
            can_access_stores: user.can_access_stores || false
        });
    } catch (error) {
        next(error);
    }
});

// Refresh access token using refresh token
app.post('/api/auth/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }

        // Check if refresh token exists and is valid
        db.get(
            `SELECT rt.*, u.* FROM refresh_tokens rt
             JOIN users u ON rt.user_id = u.id
             WHERE rt.token = ? AND rt.revoked = 0`,
            [refreshToken],
            async (err, tokenRecord) => {
                if (err) {
                    return next(new AppError('Database error', 500));
                }

                if (!tokenRecord) {
                    return res.status(401).json({ error: 'Invalid or revoked refresh token' });
                }

                // Check if refresh token has expired
                const now = new Date();
                const expiryDate = new Date(tokenRecord.expires_at);

                if (now > expiryDate) {
                    // Revoke expired token
                    db.run(
                        `UPDATE refresh_tokens SET revoked = 1, revoked_at = CURRENT_TIMESTAMP
                         WHERE token = ?`,
                        [refreshToken]
                    );
                    return res.status(401).json({ error: 'Refresh token has expired. Please log in again.' });
                }

                // Generate new access token
                const user = {
                    id: tokenRecord.id,
                    username: tokenRecord.username,
                    role: tokenRecord.role
                };
                const newAccessToken = generateToken(user);

                res.json({
                    success: true,
                    token: newAccessToken,
                    expiresIn: '15m'
                });
            }
        );
    } catch (error) {
        next(error);
    }
});

// Logout - revoke refresh token
app.post('/api/auth/logout', authenticate, async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.json({ success: true, message: 'Logged out successfully' });
        }

        // Revoke the refresh token
        db.run(
            `UPDATE refresh_tokens SET revoked = 1, revoked_at = CURRENT_TIMESTAMP
             WHERE token = ? AND user_id = ?`,
            [refreshToken, req.user.id],
            (err) => {
                if (err) {
                    console.error('Error revoking refresh token:', err);
                    return next(new AppError('Failed to logout', 500));
                }

                res.json({ success: true, message: 'Logged out successfully' });
            }
        );
    } catch (error) {
        next(error);
    }
});

// Get all requisitions (with filters)
app.get('/api/requisitions', authenticate, (req, res, next) => {
    try {
        const { user_id, role, status } = req.query;
    
    let query = `
        SELECT r.*, u.full_name as created_by_name, u.department
        FROM requisitions r
        JOIN users u ON r.created_by = u.id
        WHERE 1=1
    `;
    const params = [];
    
    if (status) {
        query += " AND r.status = ?";
        params.push(status);
    }
    
    if (role === 'initiator' && user_id) {
        query += " AND r.created_by = ?";
        params.push(user_id);
    } else if (role === 'hod' && user_id) {
        // HODs see requisitions from their department OR specifically assigned to them
        query += " AND (u.department = (SELECT department FROM users WHERE id = ?) OR (r.assigned_to = ? AND r.assigned_role = 'hod'))";
        params.push(user_id);
        params.push(user_id);
    } else if (role === 'finance' && user_id) {
        // Finance sees requisitions assigned to them via universal assignment
        query += " AND (r.assigned_to = ? AND r.assigned_role = 'finance')";
        params.push(user_id);
    } else if (role === 'md' && user_id) {
        // MD sees requisitions assigned to them via universal assignment
        query += " AND (r.assigned_to = ? AND r.assigned_role = 'md')";
        params.push(user_id);
    } else if (role === 'procurement' && user_id) {
        // Procurement sees requisitions assigned to them via universal assignment
        query += " AND (r.assigned_to = ? AND r.assigned_role = 'procurement')";
        params.push(user_id);
    }
    
    query += " ORDER BY r.created_at DESC";

        db.all(query, params, (err, rows) => {
            if (err) {
                return next(new AppError('Database error', 500));
            }
            res.json(rows);
        });
    } catch (error) {
        next(error);
    }
});

// Get single requisition with items
app.get('/api/requisitions/:id', authenticate, validateId, (req, res, next) => {
    try {
        const reqId = req.params.id;
    
    db.get(`
        SELECT r.*, u.full_name as created_by_name, u.department
        FROM requisitions r
        JOIN users u ON r.created_by = u.id
        WHERE r.id = ?
    `, [reqId], (err, requisition) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!requisition) {
            return res.status(404).json({ error: 'Requisition not found' });
        }
        
            // Get items
            db.all(`
                SELECT ri.*, v.name as vendor_name
                FROM requisition_items ri
                LEFT JOIN vendors v ON ri.vendor_id = v.id
                WHERE ri.requisition_id = ?
            `, [reqId], (err, items) => {
                if (err) {
                    return next(new AppError('Database error', 500));
                }

                requisition.items = items;
                res.json(requisition);
            });
        });
    } catch (error) {
        next(error);
    }
});

// Create new requisition
app.post('/api/requisitions', authenticate, authorize('initiator', 'admin'), validateCreateRequisition, (req, res, next) => {
    try {
        const { description, delivery_location, urgency, required_date, account_code, created_by, items } = req.body;

        // Get user details to generate proper req number
        db.get('SELECT full_name, department FROM users WHERE id = ?', [created_by], (err, user) => {
            if (err || !user) {
                return next(new AppError('User not found', 404));
            }

            // Generate requisition number: KSB-DeptCode-InitiatorInitials-FullTimeStamp
            const deptCode = user.department ? user.department.substring(0, 3).toUpperCase() : 'GEN';
            const initials = user.full_name
                .split(' ')
                .map(name => name.charAt(0))
                .join('')
                .toUpperCase();
            const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14); // YYYYMMDDHHmmss
            const reqNumber = `KSB-${deptCode}-${initials}-${timestamp}`;

            // Use req_number as title for simplified flow
            const title = reqNumber;

            db.run(`
                INSERT INTO requisitions (req_number, title, description, delivery_location, urgency, required_date, account_code, created_by, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
            `, [reqNumber, title, description, delivery_location, urgency, required_date, account_code, created_by], function(err) {
                if (err) {
                    console.error('Database error creating requisition:', err.message);
                    return next(new AppError(`Database error: ${err.message}`, 500));
                }

                const requisitionId = this.lastID;

                // Insert items
                if (items && items.length > 0) {
                    const stmt = db.prepare(`
                        INSERT INTO requisition_items (requisition_id, item_name, quantity, specifications)
                        VALUES (?, ?, ?, ?)
                    `);

                    items.forEach(item => {
                        stmt.run([requisitionId, item.item_name, item.quantity, item.specifications]);
                    });

                    stmt.finalize();
                }

                // Log action
                db.run(`
                    INSERT INTO audit_log (requisition_id, user_id, action, details)
                    VALUES (?, ?, 'created', 'Requisition created')
                `, [requisitionId, created_by]);

                res.json({
                    success: true,
                    requisition_id: requisitionId,
                    req_number: reqNumber
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// Update draft requisition
app.put('/api/requisitions/:id/update-draft', authenticate, authorize('initiator', 'admin'), (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { description, quantity, required_date, justification, urgency, user_id } = req.body;

        // Check if requisition is in draft status
        db.get('SELECT status FROM requisitions WHERE id = ?', [reqId], (err, req) => {
            if (err) {
                return next(new AppError('Database error', 500));
            }
            if (!req) {
                return res.status(404).json({ error: 'Requisition not found' });
            }
            if (req.status !== 'draft') {
                return res.status(400).json({ error: 'Only draft requisitions can be edited' });
            }

            // Update requisition
            db.run(`
                UPDATE requisitions
                SET description = ?,
                    quantity = ?,
                    required_date = ?,
                    urgency = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [description, quantity, required_date, urgency, reqId], function(err) {
                if (err) {
                    return next(new AppError('Database error updating requisition', 500));
                }

                // Update the first item (simplified requisition has one item)
                db.run(`
                    UPDATE requisition_items
                    SET item_name = ?,
                        quantity = ?,
                        specifications = ?
                    WHERE requisition_id = ?
                `, [description, quantity, justification, reqId], function(err) {
                    if (err) {
                        console.error('Error updating item:', err);
                    }

                    // Log action
                    db.run(`
                        INSERT INTO audit_log (requisition_id, user_id, action, details)
                        VALUES (?, ?, 'draft_updated', 'Draft requisition updated')
                    `, [reqId, user_id]);

                    res.json({ success: true, message: 'Draft updated successfully' });
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// Submit requisition for approval
app.put('/api/requisitions/:id/submit', authenticate, authorize('initiator', 'procurement', 'admin'), validateUpdateRequisition, (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { user_id, selected_hod_id } = req.body;

    // If procurement is submitting and has selected an HOD, store it
    let updateQuery = `UPDATE requisitions SET status = 'pending_hod', updated_at = CURRENT_TIMESTAMP`;
    let updateParams = [];

    if (selected_hod_id) {
        updateQuery += `, assigned_hod_id = ?`;
        updateParams.push(selected_hod_id);
    }

    updateQuery += ` WHERE id = ?`;
    updateParams.push(reqId);

    db.run(updateQuery, updateParams, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        db.run(`
            INSERT INTO audit_log (requisition_id, user_id, action, details)
            VALUES (?, ?, 'submitted', 'Submitted for HOD approval')
        `, [reqId, user_id]);

            res.json({ success: true });
        });
    } catch (error) {
        next(error);
    }
});

// HOD Approval/Rejection
// Allow HOD, Finance, MD, and Admin to approve at HOD stage
// Finance and MD can act as HOD for pre-adjudication requisitions
app.put('/api/requisitions/:id/hod-approve', authenticate, authorize('hod', 'finance', 'md', 'admin'), validateUpdateRequisition, (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { user_id, approved, comments } = req.body;

        // Validation: comments required for rejection
        if (!approved && !comments) {
            return res.status(400).json({ error: 'Comments required when rejecting a requisition' });
        }

        const newStatus = approved ? 'pending_procurement' : 'rejected';
        const approvalStatus = approved ? 'approved' : 'rejected';

        // Build update query based on approval/rejection
        let updateQuery, updateParams;
        if (approved) {
            updateQuery = `
                UPDATE requisitions
                SET status = ?,
                    hod_approval_status = ?,
                    hod_approved_by = ?,
                    hod_approved_at = CURRENT_TIMESTAMP,
                    hod_comments = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            updateParams = [newStatus, approvalStatus, user_id, comments, reqId];
        } else {
            updateQuery = `
                UPDATE requisitions
                SET status = ?,
                    hod_approval_status = ?,
                    rejected_by = ?,
                    rejected_at = CURRENT_TIMESTAMP,
                    rejection_reason = ?,
                    hod_comments = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            updateParams = [newStatus, approvalStatus, user_id, comments, comments, reqId];
        }

        db.run(updateQuery, updateParams, function(err) {
            if (err) {
                logError(err, { context: 'hod_approve', requisition_id: reqId });
                return next(new AppError('Database error', 500));
            }

            db.run(`
                INSERT INTO audit_log (requisition_id, user_id, action, details)
                VALUES (?, ?, ?, ?)
            `, [reqId, user_id, 'hod_' + approvalStatus, 'HOD ' + approvalStatus + (comments ? ': ' + comments : '')]);

            logSecurity(approved ? 'requisition_approved' : 'requisition_rejected', {
                requisition_id: reqId,
                user_id,
                reason: comments
            });

            res.json({
                success: true,
                message: approved ? 'Requisition approved successfully' : 'Requisition rejected',
                status: newStatus
            });
        });
    } catch (error) {
        next(error);
    }
});

// Finance Approval/Rejection
app.put('/api/requisitions/:id/finance-approve', authenticate, authorize('finance', 'admin'), validateUpdateRequisition, (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { user_id, approved, comments } = req.body;

        // Validation: comments required for rejection
        if (!approved && !comments) {
            return res.status(400).json({ error: 'Comments required when rejecting a requisition' });
        }

        const newStatus = approved ? 'pending_md' : 'rejected';
        const approvalStatus = approved ? 'approved' : 'rejected';

        // Build update query based on approval/rejection
        let updateQuery, updateParams;
        if (approved) {
            updateQuery = `
                UPDATE requisitions
                SET status = ?,
                    finance_approval_status = ?,
                    finance_approved_by = ?,
                    finance_approved_at = CURRENT_TIMESTAMP,
                    finance_comments = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            updateParams = [newStatus, approvalStatus, user_id, comments, reqId];
        } else {
            updateQuery = `
                UPDATE requisitions
                SET status = ?,
                    finance_approval_status = ?,
                    rejected_by = ?,
                    rejected_at = CURRENT_TIMESTAMP,
                    rejection_reason = ?,
                    finance_comments = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            updateParams = [newStatus, approvalStatus, user_id, comments, comments, reqId];
        }

        db.run(updateQuery, updateParams, function(err) {
            if (err) {
                logError(err, { context: 'finance_approve', requisition_id: reqId });
                return next(new AppError('Database error', 500));
            }

            db.run(`
                INSERT INTO audit_log (requisition_id, user_id, action, details)
                VALUES (?, ?, ?, ?)
            `, [reqId, user_id, 'finance_' + approvalStatus, 'Finance ' + approvalStatus + (comments ? ': ' + comments : '')]);

            logSecurity(approved ? 'finance_approved' : 'finance_rejected', {
                requisition_id: reqId,
                user_id,
                reason: comments
            });

            res.json({
                success: true,
                message: approved ? 'Requisition approved by Finance successfully' : 'Requisition rejected by Finance',
                status: newStatus
            });
        });
    } catch (error) {
        next(error);
    }
});

// MD Approval/Rejection
app.put('/api/requisitions/:id/md-approve', authenticate, authorize('md', 'admin'), validateUpdateRequisition, (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { user_id, approved, comments } = req.body;

        // Validation: comments required ONLY for rejection, optional for approval
        if (!approved && !comments) {
            return res.status(400).json({ error: 'Comments required when rejecting a requisition' });
        }

        const newStatus = approved ? 'completed' : 'rejected';
        const approvalStatus = approved ? 'approved' : 'rejected';

        // Build update query based on approval/rejection
        let updateQuery, updateParams;
        if (approved) {
            updateQuery = `
                UPDATE requisitions
                SET status = ?,
                    md_approval_status = ?,
                    md_approved_by = ?,
                    md_approved_at = CURRENT_TIMESTAMP,
                    md_comments = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            updateParams = [newStatus, approvalStatus, user_id, comments || null, reqId];
        } else {
            updateQuery = `
                UPDATE requisitions
                SET status = ?,
                    md_approval_status = ?,
                    rejected_by = ?,
                    rejected_at = CURRENT_TIMESTAMP,
                    rejection_reason = ?,
                    md_comments = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            updateParams = [newStatus, approvalStatus, user_id, comments, comments, reqId];
        }

        db.run(updateQuery, updateParams, function(err) {
            if (err) {
                logError(err, { context: 'md_approve', requisition_id: reqId });
                return next(new AppError('Database error', 500));
            }

            db.run(`
                INSERT INTO audit_log (requisition_id, user_id, action, details)
                VALUES (?, ?, ?, ?)
            `, [reqId, user_id, 'md_' + approvalStatus, 'MD ' + approvalStatus + (comments ? ': ' + comments : '')]);

            logSecurity(approved ? 'md_approved' : 'md_rejected', {
                requisition_id: reqId,
                user_id,
                reason: comments || 'No comments provided'
            });

            // If approved, generate Purchase Order
            if (approved) {
                // Get requisition details to generate PO number with all pricing fields
                db.get(`
                    SELECT req_number, total_amount, created_at, unit_price, quantity,
                           vendor_currency, selected_vendor, total_cost
                    FROM requisitions
                    WHERE id = ?
                `, [reqId], (err, req) => {
                    if (err || !req) {
                        console.error('Error fetching requisition for PO:', err);
                        // Still return success for approval
                        return res.json({
                            success: true,
                            message: 'Requisition approved by MD successfully',
                            status: newStatus,
                            warning: 'PO generation failed'
                        });
                    }

                    // Generate PO number from requisition's created_at timestamp
                    // Format: PO-YYYYMMDDHHmmss
                    const createdDate = new Date(req.created_at);
                    const year = createdDate.getFullYear();
                    const month = String(createdDate.getMonth() + 1).padStart(2, '0');
                    const day = String(createdDate.getDate()).padStart(2, '0');
                    const hours = String(createdDate.getHours()).padStart(2, '0');
                    const minutes = String(createdDate.getMinutes()).padStart(2, '0');
                    const seconds = String(createdDate.getSeconds()).padStart(2, '0');
                    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
                    const poNumber = `PO-${timestamp}`;

                    // Update requisition with PO number
                    db.run(`
                        UPDATE requisitions
                        SET po_number = ?,
                            po_generated_at = CURRENT_TIMESTAMP,
                            po_generated_by = ?
                        WHERE id = ?
                    `, [poNumber, user_id, reqId], (err) => {
                        if (err) {
                            console.error('Error updating requisition with PO:', err);
                        }
                    });

                    // Calculate pricing breakdown for PO
                    const unitPrice = req.unit_price || 0;
                    const quantity = req.quantity || 1;
                    const subtotal = unitPrice * quantity;
                    const vatRate = 16.0; // 16% VAT
                    const vatAmount = subtotal * (vatRate / 100);
                    const grandTotal = subtotal + vatAmount;
                    const currency = req.vendor_currency || 'ZMW';

                    // Get vendor name from selected_vendor ID
                    let selectedVendor = null;
                    if (req.selected_vendor) {
                        db.get('SELECT name FROM vendors WHERE id = ?', [req.selected_vendor], (err, vendor) => {
                            if (vendor) {
                                selectedVendor = vendor.name;
                            }
                            insertPurchaseOrder();
                        });
                    } else {
                        insertPurchaseOrder();
                    }

                    function insertPurchaseOrder() {
                        // Create PO record with comprehensive pricing breakdown
                        db.run(`
                            INSERT INTO purchase_orders (
                                po_number, requisition_id, total_amount, status, generated_by,
                                unit_price, quantity, subtotal, vat_rate, vat_amount, grand_total, currency, selected_vendor
                            )
                            VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            poNumber, reqId, grandTotal, user_id,
                            unitPrice, quantity, subtotal, vatRate, vatAmount, grandTotal, currency, selectedVendor
                        ], function(err) {
                            if (err) {
                                console.error('Error creating PO record:', err);
                                return res.json({
                                    success: true,
                                    message: 'Requisition approved by MD successfully',
                                    status: newStatus,
                                    warning: 'PO record creation failed'
                                });
                            }

                            // Log PO generation
                            db.run(`
                                INSERT INTO audit_log (requisition_id, user_id, action, details)
                                VALUES (?, ?, 'po_generated', ?)
                            `, [reqId, user_id, `Purchase Order ${poNumber} generated automatically`]);

                            res.json({
                                success: true,
                                message: 'Requisition approved by MD successfully and Purchase Order generated',
                                status: newStatus,
                                po_number: poNumber
                            });
                        });
                    }
                });
            } else {
                // Rejection - no PO generation
                res.json({
                    success: true,
                    message: 'Requisition rejected by MD',
                    status: newStatus
                });
            }
        });
    } catch (error) {
        next(error);
    }
});

// Admin Override - Skip stage or reassign department
app.put('/api/requisitions/:id/admin-override', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { action, new_status, new_department, comment } = req.body;

        if (!action || !['skip_stage', 'reassign_department'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Must be skip_stage or reassign_department' });
        }

        if (action === 'skip_stage') {
            // Skip current approval stage
            if (!new_status || !comment) {
                return res.status(400).json({ error: 'new_status and comment are required for skip_stage' });
            }

            db.run(`
                UPDATE requisitions
                SET status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [new_status, reqId], function(err) {
                if (err) {
                    logError(err, { context: 'admin_skip_stage', requisition_id: reqId });
                    return next(new AppError('Database error', 500));
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Requisition not found' });
                }

                // Log the admin override
                db.run(`
                    INSERT INTO audit_log (requisition_id, user_id, action, details)
                    VALUES (?, ?, ?, ?)
                `, [reqId, req.user.id, 'admin_skip_stage', `Admin skipped stage to ${new_status}: ${comment}`]);

                logSecurity('admin_override_skip_stage', {
                    requisition_id: reqId,
                    user_id: req.user.id,
                    new_status,
                    reason: comment
                });

                res.json({
                    success: true,
                    message: `Successfully moved to ${new_status}`,
                    status: new_status
                });
            });

        } else if (action === 'reassign_department') {
            // Reassign to different department
            if (!new_department) {
                return res.status(400).json({ error: 'new_department is required for reassign_department' });
            }

            db.run(`
                UPDATE requisitions
                SET department = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [new_department, reqId], function(err) {
                if (err) {
                    logError(err, { context: 'admin_reassign_department', requisition_id: reqId });
                    return next(new AppError('Database error', 500));
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Requisition not found' });
                }

                // Log the admin override
                db.run(`
                    INSERT INTO audit_log (requisition_id, user_id, action, details)
                    VALUES (?, ?, ?, ?)
                `, [reqId, req.user.id, 'admin_reassign_dept', `Admin reassigned to department: ${new_department}`]);

                logSecurity('admin_override_reassign', {
                    requisition_id: reqId,
                    user_id: req.user.id,
                    new_department
                });

                res.json({
                    success: true,
                    message: `Successfully reassigned to ${new_department}`,
                    department: new_department
                });
            });
        }
    } catch (error) {
        next(error);
    }
});

// Get Purchase Order by Requisition ID
app.get('/api/purchase-orders/by-requisition/:requisitionId', authenticate, (req, res, next) => {
    try {
        const requisitionId = req.params.requisitionId;

        // First check if requisition exists and get its status
        db.get(`
            SELECT id, req_number, status FROM requisitions WHERE id = ?
        `, [requisitionId], (err, requisition) => {
            if (err) {
                logError(err, { context: 'get_requisition_for_po', requisition_id: requisitionId });
                return next(new AppError('Database error', 500));
            }

            if (!requisition) {
                return next(new AppError('Requisition not found', 404));
            }

            // Check if requisition is rejected
            if (requisition.status === 'rejected') {
                return next(new AppError('Cannot generate purchase order for rejected requisition', 400));
            }

            // Now get the purchase order
            db.get(`
                SELECT * FROM purchase_orders
                WHERE requisition_id = ?
            `, [requisitionId], (err, po) => {
                if (err) {
                    logError(err, { context: 'get_po_by_requisition', requisition_id: requisitionId });
                    return next(new AppError('Database error', 500));
                }

                if (!po) {
                    return next(new AppError('Purchase order not found. The requisition may not be fully approved yet.', 404));
                }

                res.json(po);
            });
        });
    } catch (error) {
        next(error);
    }
});

// Get Purchase Order details
app.get('/api/purchase-orders/:id', authenticate, (req, res, next) => {
    try {
        const poId = req.params.id;

        db.get(`
            SELECT po.*,
                   r.req_number, r.description, r.delivery_location, r.urgency, r.required_date,
                   u.full_name as created_by_name, u.department,
                   md.full_name as approved_by_name
            FROM purchase_orders po
            JOIN requisitions r ON po.requisition_id = r.id
            JOIN users u ON r.created_by = u.id
            LEFT JOIN users md ON r.md_approved_by = md.id
            WHERE po.id = ?
        `, [poId], (err, po) => {
            if (err) {
                logError(err, { context: 'get_purchase_order', po_id: poId });
                return next(new AppError('Database error', 500));
            }
            if (!po) {
                return res.status(404).json({ error: 'Approved Purchase Requisition not found' });
            }

            // Get items for the PO
            db.all(`
                SELECT ri.*, v.name as vendor_name
                FROM requisition_items ri
                LEFT JOIN vendors v ON ri.vendor_id = v.id
                WHERE ri.requisition_id = ?
                ORDER BY ri.id
            `, [po.requisition_id], (err, items) => {
                if (err) {
                    logError(err, { context: 'get_po_items', po_id: poId });
                    return next(new AppError('Database error', 500));
                }

                po.items = items;
                res.json(po);
            });
        });
    } catch (error) {
        next(error);
    }
});

// Get Purchase Order by requisition ID
app.get('/api/requisitions/:id/purchase-order', authenticate, (req, res, next) => {
    try {
        const reqId = req.params.id;

        db.get(`
            SELECT po.*,
                   r.req_number, r.description, r.delivery_location, r.urgency, r.required_date,
                   u.full_name as created_by_name, u.department,
                   md.full_name as approved_by_name
            FROM purchase_orders po
            JOIN requisitions r ON po.requisition_id = r.id
            JOIN users u ON r.created_by = u.id
            LEFT JOIN users md ON r.md_approved_by = md.id
            WHERE po.requisition_id = ?
        `, [reqId], (err, po) => {
            if (err) {
                logError(err, { context: 'get_po_by_req', requisition_id: reqId });
                return next(new AppError('Database error', 500));
            }
            if (!po) {
                return res.status(404).json({ error: 'No Approved Purchase Requisition found for this requisition' });
            }

            // Get items for the PO
            db.all(`
                SELECT ri.*, v.name as vendor_name
                FROM requisition_items ri
                LEFT JOIN vendors v ON ri.vendor_id = v.id
                WHERE ri.requisition_id = ?
                ORDER BY ri.id
            `, [reqId], (err, items) => {
                if (err) {
                    logError(err, { context: 'get_po_items_by_req', requisition_id: reqId });
                    return next(new AppError('Database error', 500));
                }

                po.items = items;
                res.json(po);
            });
        });
    } catch (error) {
        next(error);
    }
});

// Get all Purchase Orders with role-based filtering
app.get('/api/purchase-orders', authenticate, (req, res, next) => {
    try {
        const user = req.user;

        let query = `
            SELECT po.*,
                   r.req_number, r.description, r.delivery_location, r.created_by,
                   u.full_name as created_by_name, u.department as created_by_department,
                   md.full_name as approved_by_name,
                   r.hod_approved_by
            FROM purchase_orders po
            JOIN requisitions r ON po.requisition_id = r.id
            JOIN users u ON r.created_by = u.id
            LEFT JOIN users md ON r.md_approved_by = md.id
            WHERE 1=1
        `;
        const params = [];

        // Role-based filtering
        if (user.role === 'initiator') {
            // Initiators see only their own POs
            query += ' AND r.created_by = ?';
            params.push(user.id);
        } else if (user.role === 'hod') {
            // HODs see POs they approved from their department
            query += ' AND r.hod_approved_by = ?';
            params.push(user.id);
        } else if (user.role === 'procurement') {
            // Procurement sees all POs
            // No additional filter needed
        } else if (user.role === 'finance') {
            // Finance sees all POs
            // No additional filter needed
        } else if (user.role === 'md') {
            // MD sees all POs
            // No additional filter needed
        } else if (user.role === 'admin') {
            // Admin sees all POs
            // No additional filter needed
        }

        query += ' ORDER BY po.created_at DESC';

        db.all(query, params, (err, pos) => {
            if (err) {
                logError(err, { context: 'get_all_pos', user_id: user.id });
                return next(new AppError('Database error', 500));
            }
            res.json(pos);
        });
    } catch (error) {
        next(error);
    }
});

// Generate PO PDF
app.get('/api/purchase-orders/:id/pdf', authenticate, (req, res, next) => {
    try {
        const poId = req.params.id;
        const user = req.user;

        // Get PO with full details including pricing breakdown
        // Also fetch requisition data as fallback for old PO records (backward compatibility)
        db.get(`
            SELECT po.id, po.po_number, po.requisition_id, po.total_amount, po.status,
                   po.issued_to_vendor, po.delivery_date, po.terms_conditions, po.notes,
                   po.generated_by, po.created_at, po.updated_at,
                   po.unit_price, po.quantity, po.subtotal, po.vat_rate, po.vat_amount,
                   po.grand_total, po.currency, po.selected_vendor,
                   r.req_number, r.description, r.delivery_location, r.urgency, r.required_date,
                   r.account_code, r.created_by, r.selected_vendor as req_selected_vendor,
                   r.unit_price as req_unit_price, r.quantity as req_quantity,
                   r.vendor_currency as req_vendor_currency,
                   r.total_cost as req_total_cost,
                   r.created_at as req_created_at,
                   u.full_name as created_by_name, u.email as created_by_email, u.department as created_by_department,
                   md.full_name as md_name,
                   fin.full_name as finance_name,
                   hod.full_name as hod_name,
                   proc.full_name as procurement_name,
                   v.name as vendor_name, v.email as vendor_email, v.phone as vendor_phone
            FROM purchase_orders po
            JOIN requisitions r ON po.requisition_id = r.id
            JOIN users u ON r.created_by = u.id
            LEFT JOIN users md ON r.md_approved_by = md.id
            LEFT JOIN users fin ON r.finance_approved_by = fin.id
            LEFT JOIN users hod ON r.hod_approved_by = hod.id
            LEFT JOIN users proc ON r.procurement_assigned_to = proc.id
            LEFT JOIN vendors v ON r.selected_vendor = v.name
            WHERE po.id = ?
        `, [poId], (err, po) => {
            if (err) {
                logError(err, { context: 'get_po_for_pdf', po_id: poId });
                return next(new AppError('Database error', 500));
            }
            if (!po) {
                return res.status(404).json({ error: 'Approved Purchase Requisition not found' });
            }

            // Check access permissions
            // All roles can access approved/rejected requisitions based on their visibility scope
            const hasAccess =
                user.role === 'admin' ||
                user.role === 'md' ||
                user.role === 'finance' ||
                user.role === 'procurement' ||
                (user.role === 'initiator' && po.created_by === user.id) ||
                (user.role === 'hod' && po.created_by_department === user.department);

            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this Approved Purchase Requisition' });
            }

            // Generate PDF using preferred format (matching pdfGenerator.js style)
            try {
                    const PDFDocument = require('pdfkit');
                    const fs = require('fs');
                    const path = require('path');
                    const doc = new PDFDocument({ margin: 40, size: 'A4' });

                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="APR_${po.req_number}.pdf"`);

                    doc.pipe(res);

                    // ===== HEADER SECTION =====
                    // Add company logo - CENTERED at top
                    try {
                        const logoPath = path.join(__dirname, 'assets', 'logo.jpeg');
                        if (fs.existsSync(logoPath)) {
                            // Center the logo (A4 width = 595, logo width = 80, so x = (595 - 80) / 2 = 257.5)
                            doc.image(logoPath, 257.5, 40, { width: 80, height: 80 });
                        } else {
                            // Fallback to text if logo not found - centered
                            doc.fontSize(28)
                               .font('Helvetica-Bold')
                               .fillColor('#0066cc')
                               .text('KSB', 50, 60, { align: 'center', width: 495 });
                        }
                    } catch (err) {
                        // Fallback to text on error - centered
                        doc.fontSize(28)
                           .font('Helvetica-Bold')
                           .fillColor('#0066cc')
                           .text('KSB', 50, 60, { align: 'center', width: 495 });
                    }

                    // ===== TITLE - Below logo =====
                    doc.fontSize(18)
                       .font('Helvetica-Bold')
                       .fillColor('#0066cc')
                       .text('APPROVED PURCHASE REQUISITION', 50, 135, { align: 'center', width: 495 });

                    // Document Number section
                    let currentY = 160;
                    doc.fontSize(10)
                       .font('Helvetica-Bold')
                       .fillColor('#000000')
                       .text('Document Number:', 50, currentY, { align: 'center', width: 495 });

                    currentY += 15;
                    doc.fontSize(14)
                       .font('Helvetica-Bold')
                       .fillColor('#0066cc')
                       .text(po.req_number, 50, currentY, { align: 'center', width: 495 });

                    currentY += 18;
                    doc.fontSize(9)
                       .font('Helvetica')
                       .fillColor('#666666')
                       .text(`Issue Date: ${new Date(po.created_at).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'})}`, 50, currentY, { align: 'center', width: 495 });

                    // ===== TWO-COLUMN LAYOUT WITH BOXES =====
                    currentY += 25; // Add spacing after Issue Date

                    // Left Box - REQUISITIONING OFFICE
                    const leftBoxX = 50;
                    const rightBoxX = 305;
                    const boxWidth = 245;
                    const boxHeight = 110;

                    doc.rect(leftBoxX, currentY, boxWidth, boxHeight)
                       .strokeColor('#0066cc')
                       .lineWidth(1.5)
                       .stroke();

                    doc.fontSize(9)
                       .font('Helvetica-Bold')
                       .fillColor('#0066cc')
                       .text('REQUISITIONING OFFICE:', leftBoxX + 10, currentY + 8);

                    let leftY = currentY + 26;
                    doc.fontSize(9)
                       .font('Helvetica-Bold')
                       .fillColor('#000000')
                       .text('KSB Zambia', leftBoxX + 10, leftY);

                    leftY += 14;
                    doc.fontSize(8)
                       .font('Helvetica')
                       .fillColor('#333333')
                       .text('Musapas Business Park, Kamfinsa Junction', leftBoxX + 10, leftY, { width: boxWidth - 20 });

                    leftY += 11;
                    doc.text('Ndola/Kitwe Dual Carriageway, Kitwe', leftBoxX + 10, leftY, { width: boxWidth - 20 });

                    leftY += 11;
                    doc.text('Tel.: +260 968 670 002', leftBoxX + 10, leftY, { width: boxWidth - 20 });

                    leftY += 11;
                    doc.text('Mobile: +260 966 780 419', leftBoxX + 10, leftY, { width: boxWidth - 20 });

                    // Right Box - APPROVED VENDOR
                    doc.rect(rightBoxX, currentY, boxWidth, boxHeight)
                       .strokeColor('#0066cc')
                       .lineWidth(1.5)
                       .stroke();

                    doc.fontSize(9)
                       .font('Helvetica-Bold')
                       .fillColor('#0066cc')
                       .text('APPROVED VENDOR:', rightBoxX + 10, currentY + 8);

                    let rightY = currentY + 26;
                    const vendorName = po.selected_vendor || po.vendor_name || po.req_selected_vendor || 'To Be Determined';
                    doc.fontSize(9)
                       .font('Helvetica-Bold')
                       .fillColor('#000000')
                       .text(vendorName, rightBoxX + 10, rightY, { width: boxWidth - 20 });

                    // Move currentY down after boxes
                    currentY = currentY + boxHeight + 20;

                    // ===== REQUISITION DETAILS SECTION =====
                    doc.fontSize(11)
                       .font('Helvetica-Bold')
                       .fillColor('#0066cc')
                       .text('REQUISITION DETAILS', 50, currentY);

                    currentY += 18;

                    // Details in two columns
                    const col1X = 50;
                    const col2X = 180;
                    const col3X = 310;
                    const col4X = 420;

                    doc.fontSize(9)
                       .font('Helvetica-Bold')
                       .fillColor('#000000')
                       .text('Requisition #:', col1X, currentY)
                       .font('Helvetica')
                       .text(po.req_number, col2X, currentY);

                    doc.font('Helvetica-Bold')
                       .text('Delivery Location:', col3X, currentY)
                       .font('Helvetica')
                       .text(po.delivery_location || 'Office', col4X, currentY);

                    currentY += 15;
                    doc.font('Helvetica-Bold')
                       .text('Department:', col1X, currentY)
                       .font('Helvetica')
                       .text(po.created_by_department || 'Operations', col2X, currentY);

                    doc.font('Helvetica-Bold')
                       .text('Account Code:', col3X, currentY)
                       .font('Helvetica')
                       .text(po.account_code || 'N/A', col4X, currentY);

                    currentY += 15;
                    doc.font('Helvetica-Bold')
                       .text('Required Date:', col1X, currentY)
                       .font('Helvetica')
                       .text(new Date(po.required_date || po.created_at).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'}), col2X, currentY);

                    doc.font('Helvetica-Bold')
                       .text('Requested By:', col3X, currentY)
                       .font('Helvetica')
                       .text(po.created_by_name || 'N/A', col4X, currentY);

                    currentY += 15;
                    doc.font('Helvetica-Bold')
                       .text('Urgency:', col1X, currentY)
                       .font('Helvetica')
                       .text((po.urgency || 'STANDARD').toLowerCase(), col2X, currentY);

                    // Item Description
                    currentY += 20;
                    doc.fontSize(9)
                       .font('Helvetica-Bold')
                       .fillColor('#000000')
                       .text('Item Description:', 50, currentY);

                    currentY += 12;
                    doc.fontSize(9)
                       .font('Helvetica')
                       .text(po.description || 'N/A', 50, currentY, { width: 495 });

                    //===== APPROVED LINE ITEMS SECTION =====
                    currentY += 25; // Add spacing before line items section
                    doc.fontSize(11)
                       .font('Helvetica-Bold')
                       .fillColor('#0066cc')
                       .text('APPROVED LINE ITEMS', 50, currentY);

                    // Get items from requisition_items table for accurate pricing
                    db.all(`
                        SELECT ri.*, v.name as vendor_name
                        FROM requisition_items ri
                        LEFT JOIN vendors v ON ri.vendor_id = v.id
                        WHERE ri.requisition_id = ?
                        ORDER BY ri.id
                    `, [po.requisition_id], (err, items) => {
                        if (err) {
                            logError(err, { context: 'get_items_for_po_pdf', po_id: poId });
                            // Fallback to old method if items query fails
                            items = [];
                        }

                        const currency = po.currency || po.req_vendor_currency || 'ZMW';

                        // Table header - simple with borders
                        currentY += 18; // Add spacing before table

                        doc.rect(50, currentY, 495, 22)
                           .strokeColor('#0066cc')
                           .fillColor('#f0f7ff')
                           .fillAndStroke();

                        doc.fillColor('#000000')
                           .fontSize(8)
                           .font('Helvetica-Bold')
                           .text('Item Description', 58, currentY + 7, { width: 240 })
                           .text('Qty', 310, currentY + 7, { width: 35, align: 'center' })
                           .text(`Unit Price (${currency})`, 355, currentY + 7, { width: 85, align: 'right' })
                           .text(`Amount (${currency})`, 455, currentY + 7, { width: 80, align: 'right' });

                        currentY += 22;

                        // Calculate subtotal from all items
                        let subtotal = 0;

                        if (items.length > 0) {
                            // Display each item from requisition_items table
                            items.forEach((item, index) => {
                                const rowHeight = 24;

                                // Draw row border
                                doc.rect(50, currentY, 495, rowHeight)
                                   .strokeColor('#cccccc')
                                   .lineWidth(0.5)
                                   .stroke();

                                const itemUnitPrice = item.unit_price || 0;
                                const itemTotal = item.total_price || 0;
                                subtotal += itemTotal;

                                doc.fillColor('#000000')
                                   .fontSize(8)
                                   .font('Helvetica')
                                   .text(item.item_name || 'Item Description', 58, currentY + 8, { width: 240 })
                                   .text((item.quantity || 0).toString(), 310, currentY + 8, { width: 35, align: 'center' })
                                   .text(itemUnitPrice.toFixed(2), 355, currentY + 8, { width: 85, align: 'right' })
                                   .text(itemTotal.toFixed(2), 455, currentY + 8, { width: 80, align: 'right' });

                                currentY += rowHeight;
                            });
                        } else {
                            // Fallback to old method if no items found (for backward compatibility)
                            const rowHeight = 24;
                            const quantity = po.quantity || po.req_quantity || 1;
                            const unitPrice = po.unit_price || po.req_unit_price || 0;
                            subtotal = po.subtotal || (quantity * unitPrice);

                            doc.rect(50, currentY, 495, rowHeight)
                               .strokeColor('#cccccc')
                               .lineWidth(0.5)
                               .stroke();

                            doc.fillColor('#000000')
                               .fontSize(8)
                               .font('Helvetica')
                               .text(po.description || 'Item Description', 58, currentY + 8, { width: 240 })
                               .text(quantity.toString(), 310, currentY + 8, { width: 35, align: 'center' })
                               .text(unitPrice.toFixed(2), 355, currentY + 8, { width: 85, align: 'right' })
                               .text(subtotal.toFixed(2), 455, currentY + 8, { width: 80, align: 'right' });

                            currentY += rowHeight;
                        }

                        // Totals section - aligned right
                        currentY += 15;

                        // Calculate VAT and grand total
                        const vatRate = 16.0;
                        const vatAmount = subtotal * (vatRate / 100);
                        const grandTotal = subtotal + vatAmount;

                        // Subtotal
                        doc.fontSize(9)
                           .font('Helvetica')
                           .fillColor('#000000')
                           .text('Subtotal:', 380, currentY, { align: 'left' })
                           .text(`${currency} ${subtotal.toFixed(2)}`, 455, currentY, { align: 'right', width: 90 });

                        currentY += 14;

                        // VAT
                        doc.text('VAT (16%):', 380, currentY, { align: 'left' })
                           .text(`${currency} ${vatAmount.toFixed(2)}`, 455, currentY, { align: 'right', width: 90 });

                        currentY += 18;

                        // Grand Total - Bold and Blue
                        doc.fontSize(10)
                           .font('Helvetica-Bold')
                           .fillColor('#0066cc')
                           .text('GRAND TOTAL:', 380, currentY, { align: 'left' })
                           .text(`${currency} ${grandTotal.toFixed(2)}`, 455, currentY, { align: 'right', width: 90 });

                        doc.fillColor('#000000'); // Reset color

                        currentY += 25;

                        // ===== AUTHORIZATION & APPROVAL TRAIL SECTION =====
                        doc.fontSize(11)
                           .font('Helvetica-Bold')
                           .fillColor('#0066cc')
                           .text('AUTHORIZATION & APPROVAL TRAIL', 50, currentY);

                        currentY += 20;

                        // Approval trail details
                        doc.fontSize(8)
                           .font('Helvetica-Bold')
                           .fillColor('#000000')
                           .text('Initiated by:', 55, currentY)
                           .font('Helvetica')
                           .text(po.created_by_name || 'N/A', 140, currentY);

                        currentY += 13;
                        doc.font('Helvetica-Bold')
                           .text('HOD Approval:', 55, currentY)
                           .font('Helvetica')
                           .text(po.hod_name || 'N/A', 140, currentY);

                        currentY += 13;
                        doc.font('Helvetica-Bold')
                           .text('Finance Approval:', 55, currentY)
                           .font('Helvetica')
                           .text(po.finance_name || 'N/A', 140, currentY);

                        currentY += 13;
                        doc.font('Helvetica-Bold')
                           .text('MD Approval:', 55, currentY)
                           .font('Helvetica')
                           .text(po.md_name || 'N/A', 140, currentY);

                        currentY += 20;

                        // Footer message
                        doc.fontSize(8)
                           .font('Helvetica-Oblique')
                           .fillColor('#666666')
                           .text('This document represents an officially approved purchase requisition.', 60, currentY, { align: 'center', width: 485 })
                           .text('All authorizations have been verified through the system approval workflow.', 60, currentY + 10, { align: 'center', width: 485 });

                        currentY += 25;
                        doc.text(`Document generated on: ${new Date().toLocaleDateString('en-US', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})} at ${new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}`, 60, currentY, { align: 'center', width: 485 })
                           .text('KSB Zambia - Purchase Requisition Approval System (PRAS)', 60, currentY + 10, { align: 'center', width: 485 });

                        doc.end();

                        // Log PDF generation
                        db.run(`
                            INSERT INTO audit_log (requisition_id, user_id, action, details)
                            VALUES (?, ?, 'approved_requisition_pdf_downloaded', ?)
                        `, [po.requisition_id, user.id, `Approved Purchase Requisition PDF downloaded: ${po.req_number}`]);
                    }); // Close db.all callback for requisition_items

            } catch (pdfError) {
                logError(pdfError, { context: 'generate_po_pdf', po_id: poId });
                return next(new AppError('Failed to generate PDF', 500));
            }
        });
    } catch (error) {
        next(error);
    }
});


// COMMENTED OUT: Generate DEPARTMENTAL REQUEST PDF (Report 2) - Not needed
// This endpoint generates PDF after HOD approval (initiator -> HOD flow)
/* app.get('/api/requisitions/:id/pdf', authenticate, (req, res, next) => {
    try {
        const reqId = parseInt(req.params.id);
        const user = req.user;

        // Get requisition with full details
        db.get(`
            SELECT r.*,
                   u.full_name as created_by_name, u.email as created_by_email, u.department as created_by_department,
                   hod.full_name as hod_name, hod.email as hod_email,
                   proc.full_name as procurement_name,
                   fin.full_name as finance_name,
                   md.full_name as md_name,
                   v.name as vendor_name, v.email as vendor_email, v.phone as vendor_phone
            FROM requisitions r
            JOIN users u ON r.created_by = u.id
            LEFT JOIN users hod ON r.hod_approved_by = hod.id
            LEFT JOIN users proc ON r.procurement_assigned_to = proc.id
            LEFT JOIN users fin ON r.finance_approved_by = fin.id
            LEFT JOIN users md ON r.md_approved_by = md.id
            LEFT JOIN vendors v ON r.selected_vendor = v.name
            WHERE r.id = ?
        `, [reqId], (err, req) => {
            if (err) {
                logError(err, { context: 'get_requisition_for_pdf', req_id: reqId });
                return next(new AppError('Database error', 500));
            }

            if (!req) {
                return next(new AppError('Requisition not found', 404));
            }

            // Role-based access control
            const hasAccess =
                user.role === 'admin' ||
                user.role === 'md' ||
                user.role === 'finance' ||
                user.role === 'procurement' ||
                (req.created_by === user.id) || // Initiator can see their own
                (req.hod_approved_by === user.id); // HOD can see what they approved

            if (!hasAccess) {
                return next(new AppError('Access denied: You do not have permission to download this requisition', 403));
            }

            try {
                const PDFDocument = require('pdfkit');
                const fs = require('fs');
                const doc = new PDFDocument({ margin: 50, size: 'A4' });

                // Set response headers
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="Requisition_${req.req_number}.pdf"`);

                // Pipe PDF to response
                doc.pipe(res);

                // Check for logo
                const logoPath = path.join(__dirname, 'assets', 'logo.png');
                const hasLogo = fs.existsSync(logoPath);

                // HEADER: Company branding with logo
                if (hasLogo) {
                    doc.image(logoPath, 50, 50, { width: 120 });
                    doc.fontSize(16).font('Helvetica-Bold').text('KSB Zambia', 200, 50, { align: 'right' });
                    doc.fontSize(9).font('Helvetica').fillColor('gray').text('Musapas Business Park, Kamfinsa Junction', 200, 68, { align: 'right' });
                    doc.fontSize(9).text('Ndola/Kitwe Dual Carriageway, Kitwe', 200, 80, { align: 'right' });
                    doc.fontSize(9).text('Tel.: +260 968 670 002 | Mobil: +260 966 780 419', 200, 92, { align: 'right' });
                    doc.fillColor('black');
                    doc.moveDown(3);
                } else {
                    doc.fontSize(14).font('Helvetica-Bold').text('KSB Zambia', { align: 'center' });
                    doc.fontSize(9).font('Helvetica').fillColor('gray').text('Musapas Business Park, Kamfinsa Junction', { align: 'center' });
                    doc.fontSize(9).text('Ndola/Kitwe Dual Carriageway, Kitwe', { align: 'center' });
                    doc.fontSize(9).text('Tel.: +260 968 670 002 | Mobil: +260 966 780 419', { align: 'center' });
                    doc.fillColor('black');
                    doc.moveDown(2);
                }

                // Document title
                doc.fontSize(18).font('Helvetica-Bold').fillColor('#0070AF').text('DEPARTMENTAL REQUEST', { align: 'center' });
                doc.fillColor('black');
                doc.moveDown(1);

                // Requisition Number Box (prominent)
                doc.fontSize(10).font('Helvetica-Bold').text('Requisition Number:', 50, doc.y);
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#0070AF').text(req.req_number, 180, doc.y - 12);
                doc.fillColor('black');
                doc.moveDown(2);

                // Status Badge
                const statusColors = {
                    'pending': '#F59E0B',
                    'hod_approved': '#3B82F6',
                    'procurement_complete': '#8B5CF6',
                    'finance_approved': '#10B981',
                    'md_approved': '#059669',
                    'po_generated': '#059669',
                    'rejected': '#EF4444'
                };
                doc.fontSize(10).font('Helvetica-Bold').text('Status:', 50, doc.y);
                doc.fillColor(statusColors[req.status] || '#6B7280');
                doc.fontSize(11).font('Helvetica-Bold').text(req.status.replace(/_/g, ' ').toUpperCase(), 100, doc.y - 12);
                doc.fillColor('black');
                doc.moveDown(2);

                // Horizontal divider
                doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
                doc.moveDown(1);

                // Requisition Information Section (2-column layout)
                doc.fontSize(11).font('Helvetica-Bold').text('Requisition Details', 50, doc.y);
                doc.moveDown(0.7);

                const infoStartY = doc.y;
                doc.fontSize(9).font('Helvetica-Bold');

                // Left column labels
                doc.text('Department:', 50, infoStartY);
                doc.text('Requested By:', 50, infoStartY + 14);
                doc.text('Email:', 50, infoStartY + 28);
                doc.text('Created Date:', 50, infoStartY + 42);
                doc.text('Required Date:', 50, infoStartY + 56);

                // Left column values
                doc.font('Helvetica');
                doc.text(req.created_by_department || 'N/A', 140, infoStartY);
                doc.text(req.created_by_name, 140, infoStartY + 14);
                doc.text(req.created_by_email, 140, infoStartY + 28);
                doc.text(new Date(req.created_at).toLocaleDateString(), 140, infoStartY + 42);
                doc.text(new Date(req.required_date).toLocaleDateString(), 140, infoStartY + 56);

                // Right column labels
                doc.font('Helvetica-Bold');
                doc.text('Delivery Location:', 320, infoStartY);
                doc.text('Account Code:', 320, infoStartY + 14);
                doc.text('Urgency:', 320, infoStartY + 28);
                doc.text('Quantity:', 320, infoStartY + 42);

                // Right column values
                doc.font('Helvetica');
                doc.text(req.delivery_location || 'Office', 420, infoStartY);
                doc.text(req.account_code || 'N/A', 420, infoStartY + 14);
                doc.text(req.urgency ? req.urgency.toUpperCase() : 'NORMAL', 420, infoStartY + 28);
                doc.text((req.quantity || 1).toString(), 420, infoStartY + 42);

                doc.moveDown(5);

                // Item Description Section
                doc.fontSize(11).font('Helvetica-Bold').text('Item Description', 50, doc.y);
                doc.moveDown(0.5);

                // Description box with border
                const descY = doc.y;
                doc.fontSize(9).font('Helvetica');
                const descHeight = Math.max(40, Math.ceil(req.description.length / 90) * 12);
                doc.rect(50, descY, 495, descHeight).stroke();
                doc.text(req.description, 60, descY + 10, { width: 475, align: 'left' });
                doc.moveDown(descHeight / 12 + 1);

                // Pricing Information (if available)
                if (req.selected_vendor && req.unit_price) {
                    doc.fontSize(11).font('Helvetica-Bold').text('Pricing Information', 50, doc.y);
                    doc.moveDown(0.7);

                    const pricingY = doc.y;
                    doc.fontSize(9).font('Helvetica-Bold');

                    // Vendor info
                    doc.text('Selected Vendor:', 50, pricingY);
                    doc.font('Helvetica').text(req.vendor_name || req.selected_vendor, 150, pricingY);

                    // Unit price
                    doc.font('Helvetica-Bold').text('Unit Price:', 50, pricingY + 14);
                    doc.font('Helvetica').text(`ZMW ${(req.unit_price || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 150, pricingY + 14);

                    // Total cost
                    doc.font('Helvetica-Bold').text('Total Cost:', 50, pricingY + 28);
                    doc.font('Helvetica').text(`ZMW ${(req.total_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 150, pricingY + 28);

                    // Currency
                    if (req.vendor_currency && req.vendor_currency !== 'ZMW') {
                        doc.font('Helvetica-Bold').text('Vendor Currency:', 320, pricingY);
                        doc.font('Helvetica').text(req.vendor_currency, 420, pricingY);
                    }

                    doc.moveDown(3);
                }

                // Approval Chain Section
                doc.fontSize(11).font('Helvetica-Bold').text('Approval Chain', 50, doc.y);
                doc.moveDown(0.5);

                const approvalStartY = doc.y;
                doc.fontSize(9).font('Helvetica');

                let approvalRow = 0;
                const lineHeight = 14;

                // Requested by
                doc.font('Helvetica-Bold').text('Requested by:', 50, approvalStartY + (approvalRow * lineHeight));
                doc.font('Helvetica').text(req.created_by_name, 150, approvalStartY + (approvalRow * lineHeight));
                doc.text(new Date(req.created_at).toLocaleDateString(), 320, approvalStartY + (approvalRow * lineHeight));
                approvalRow++;

                // HOD Approved
                if (req.hod_name) {
                    doc.font('Helvetica-Bold').text('HOD Approved:', 50, approvalStartY + (approvalRow * lineHeight));
                    doc.font('Helvetica').text(req.hod_name, 150, approvalStartY + (approvalRow * lineHeight));
                    if (req.hod_approved_at) {
                        doc.text(new Date(req.hod_approved_at).toLocaleDateString(), 320, approvalStartY + (approvalRow * lineHeight));
                    }
                    approvalRow++;
                }

                // Procurement Complete
                if (req.procurement_name) {
                    doc.font('Helvetica-Bold').text('Procurement:', 50, approvalStartY + (approvalRow * lineHeight));
                    doc.font('Helvetica').text(req.procurement_name, 150, approvalStartY + (approvalRow * lineHeight));
                    if (req.procurement_complete_at) {
                        doc.text(new Date(req.procurement_complete_at).toLocaleDateString(), 320, approvalStartY + (approvalRow * lineHeight));
                    }
                    approvalRow++;
                }

                // Finance Approved
                if (req.finance_name) {
                    doc.font('Helvetica-Bold').text('Finance Approved:', 50, approvalStartY + (approvalRow * lineHeight));
                    doc.font('Helvetica').text(req.finance_name, 150, approvalStartY + (approvalRow * lineHeight));
                    if (req.finance_approved_at) {
                        doc.text(new Date(req.finance_approved_at).toLocaleDateString(), 320, approvalStartY + (approvalRow * lineHeight));
                    }
                    approvalRow++;
                }

                // MD Approved
                if (req.md_name) {
                    doc.font('Helvetica-Bold').text('MD Approved:', 50, approvalStartY + (approvalRow * lineHeight));
                    doc.font('Helvetica').text(req.md_name, 150, approvalStartY + (approvalRow * lineHeight));
                    if (req.md_approved_at) {
                        doc.text(new Date(req.md_approved_at).toLocaleDateString(), 320, approvalStartY + (approvalRow * lineHeight));
                    }
                    approvalRow++;
                }

                // Rejection info (if rejected)
                if (req.status === 'rejected' && req.rejection_reason) {
                    doc.moveDown(2);
                    doc.fontSize(10).font('Helvetica-Bold').fillColor('#EF4444').text('REJECTION REASON:', 50, doc.y);
                    doc.fillColor('black');
                    doc.moveDown(0.3);
                    doc.fontSize(9).font('Helvetica');
                    const rejY = doc.y;
                    doc.rect(50, rejY, 495, 30).stroke();
                    doc.text(req.rejection_reason, 60, rejY + 8, { width: 475 });
                    doc.moveDown(3);
                }

                // Footer
                doc.moveDown(3);
                doc.fontSize(8).font('Helvetica').fillColor('gray');
                doc.text('This is a computer-generated document and does not require a signature.', { align: 'center' });
                doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

                doc.end();

                // Log PDF generation
                db.run(`
                    INSERT INTO audit_log (requisition_id, user_id, action, details)
                    VALUES (?, ?, 'requisition_pdf_downloaded', ?)
                `, [reqId, user.id, `Requisition PDF downloaded: ${req.req_number}`]);

            } catch (pdfError) {
                logError(pdfError, { context: 'generate_requisition_pdf', req_id: reqId });
                return next(new AppError('Failed to generate PDF', 500));
            }
        });
    } catch (error) {
        next(error);
    }
}); */


// Get vendors
app.get('/api/vendors', authenticate, (req, res, next) => {
    try {
        db.all("SELECT * FROM vendors ORDER BY name", (err, rows) => {
            if (err) {
                return next(new AppError('Database error', 500));
            }
            res.json(rows);
        });
    } catch (error) {
        next(error);
    }
});
// Procurement: Update requisition with vendor and pricing details
app.put('/api/requisitions/:id/procurement-update', authenticate, authorize('procurement', 'admin'), (req, res, next) => {
    try {
        const reqId = req.params.id;
        const updateData = req.body;

        // Build update query dynamically
        const fields = [];
        const values = [];

        if (updateData.description !== undefined) { fields.push('description = ?'); values.push(updateData.description); }
        if (updateData.quantity !== undefined) { fields.push('quantity = ?'); values.push(updateData.quantity); }
        if (updateData.selected_vendor !== undefined) { fields.push('selected_vendor = ?'); values.push(updateData.selected_vendor); }
        if (updateData.vendor_currency !== undefined) { fields.push('vendor_currency = ?'); values.push(updateData.vendor_currency); }
        if (updateData.unit_price !== undefined) { fields.push('unit_price = ?'); values.push(updateData.unit_price); }
        if (updateData.total_cost !== undefined) { fields.push('total_cost = ?'); values.push(updateData.total_cost); }
        if (updateData.status !== undefined) { fields.push('status = ?'); values.push(updateData.status); }
        if (updateData.justification !== undefined) { fields.push('justification = ?'); values.push(updateData.justification); }
        if (updateData.urgency !== undefined) { fields.push('urgency = ?'); values.push(updateData.urgency); }
        if (updateData.tax_type !== undefined) { fields.push('tax_type = ?'); values.push(updateData.tax_type); }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(reqId);

        // Update requisition in the main database
        db.run(`UPDATE requisitions SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
            if (err) {
                logError(err, { context: 'procurement_update', requisition_id: reqId });
                return next(new AppError('Database error updating requisition', 500));
            }

            // Add approval record if status is being updated
            if (updateData.status && updateData.approval) {
                db.run(`
                    INSERT INTO audit_log (requisition_id, user_id, action, details)
                    VALUES (?, ?, ?, ?)
                `, [reqId, req.user.id, 'procurement_completed', updateData.approval.comment || 'Procurement processing completed']);
            }

            res.json({ success: true, message: 'Requisition updated and sent to Finance' });
        });
    } catch (error) {
        next(error);
    }
});

// Simple requisition creation endpoint
app.post('/api/requisitions/simple', authenticate, authorize('initiator', 'admin'), (req, res, next) => {
    try {
        // Support both field naming conventions
        const {
            description,
            delivery_location = 'Office',  // Default value if not provided
            urgency = 'standard',  // Default value if not provided
            required_date,
            account_code,
            created_by,
            initiatorId,  // Frontend sends this
            items = [],  // Default to empty array
            tax_type = null  // Default to null - will be set by procurement
        } = req.body;

        // Determine the user ID from either field
        const userId = created_by || initiatorId || req.user.id;

        // Validate required fields
        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }

        // Get user details to generate proper req number
        db.get('SELECT full_name, department FROM users WHERE id = ?', [userId], (err, user) => {
            if (err || !user) {
                return next(new AppError('User not found', 404));
            }

            // Generate requisition number: KSB-DeptCode-InitiatorInitials-FullTimeStamp
            const deptCode = user.department ? user.department.substring(0, 3).toUpperCase() : 'GEN';
            const initials = user.full_name
                .split(' ')
                .map(name => name.charAt(0))
                .join('')
                .toUpperCase();
            const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14); // YYYYMMDDHHmmss
            const reqNumber = `KSB-${deptCode}-${initials}-${timestamp}`;

            // Use req_number as title for simplified flow
            const title = reqNumber;

            db.run(`
                INSERT INTO requisitions (req_number, title, description, delivery_location, urgency, required_date, account_code, created_by, status, tax_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
            `, [reqNumber, title, description, delivery_location, urgency, required_date, account_code, userId, tax_type], function(err) {
                if (err) {
                    console.error('Database error creating requisition:', err.message);
                    return next(new AppError(`Database error: ${err.message}`, 500));
                }

                const requisitionId = this.lastID;

                // Insert items
                if (items && items.length > 0) {
                    const stmt = db.prepare(`
                        INSERT INTO requisition_items (requisition_id, item_name, quantity, specifications)
                        VALUES (?, ?, ?, ?)
                    `);

                    items.forEach(item => {
                        stmt.run([requisitionId, item.item_name, item.quantity, item.specifications]);
                    });

                    stmt.finalize();
                }

                // Log action
                db.run(`
                    INSERT INTO audit_log (requisition_id, user_id, action, details)
                    VALUES (?, ?, 'created', 'Requisition created')
                `, [requisitionId, userId]);

                res.json({
                    success: true,
                    requisition_id: requisitionId,
                    req_number: reqNumber
                });
            });
        });
    } catch (error) {
        console.error('Error creating requisition:', error);
        next(error);
    }
});

// Admin: Redirect requisition to another approver
app.post('/api/requisitions/:id/redirect', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { from_user_id, to_user_id, reason, stage } = req.body;
        const admin_id = req.user.id;

        // Validation
        if (!to_user_id || !reason || !stage) {
            return res.status(400).json({ error: 'Missing required fields: to_user_id, reason, stage' });
        }

        // Check if target user exists and has appropriate role
        db.get('SELECT id, full_name, role FROM users WHERE id = ?', [to_user_id], (err, targetUser) => {
            if (err || !targetUser) {
                return res.status(404).json({ error: 'Target user not found' });
            }

            // Record the redirection
            db.run(`
                INSERT INTO requisition_redirections (requisition_id, from_user_id, to_user_id, redirected_by, reason, stage)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [reqId, from_user_id, to_user_id, admin_id, reason, stage], function(err) {
                if (err) {
                    logError(err, { context: 'requisition_redirect', requisition_id: reqId });
                    return next(new AppError('Failed to record redirection', 500));
                }

                // Update requisition with current approver
                db.run(`
                    UPDATE requisitions
                    SET current_approver_id = ?,
                        is_redirected = 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [to_user_id, reqId], function(err) {
                    if (err) {
                        logError(err, { context: 'update_current_approver', requisition_id: reqId });
                        return next(new AppError('Failed to update requisition', 500));
                    }

                    // Log the action
                    db.run(`
                        INSERT INTO audit_log (requisition_id, user_id, action, details)
                        VALUES (?, ?, 'redirected', ?)
                    `, [reqId, admin_id, `Redirected from user ${from_user_id} to ${targetUser.full_name} (${targetUser.role}). Reason: ${reason}`]);

                    logSecurity('requisition_redirected', {
                        requisition_id: reqId,
                        from_user_id,
                        to_user_id,
                        admin_id,
                        reason,
                        stage
                    });

                    res.json({
                        success: true,
                        message: `Requisition redirected to ${targetUser.full_name}`,
                        redirection_id: this.lastID
                    });
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// Add item to requisition
app.post('/api/requisitions/:id/items', authenticate, authorize('initiator', 'admin', 'procurement'), (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { item_name, quantity, specifications, unit_price, vendor_id, currency } = req.body;

        // Validation
        if (!item_name || !quantity) {
            return res.status(400).json({ error: 'Item name and quantity are required' });
        }

        // Validate currency
        const itemCurrency = currency || 'ZMW';
        const validCurrencies = ['ZMW', 'USD', 'EUR'];
        if (!validCurrencies.includes(itemCurrency)) {
            return res.status(400).json({ error: 'Invalid currency. Must be ZMW, USD, or EUR' });
        }

        // Calculate total price in the selected currency
        const total_price = unit_price ? parseFloat(unit_price) * parseInt(quantity) : 0;

        // Get FX rate to convert to ZMW
        db.get(`
            SELECT rate_to_zmw FROM fx_rates
            WHERE currency_code = ? AND is_active = 1
        `, [itemCurrency], (fxErr, fxRate) => {
            if (fxErr) {
                logError(fxErr, { context: 'get_fx_rate_for_item', currency: itemCurrency });
                return next(new AppError('Failed to get exchange rate', 500));
            }

            const rateToZMW = fxRate ? fxRate.rate_to_zmw : 1;
            const amount_in_zmw = total_price * rateToZMW;

            db.run(`
                INSERT INTO requisition_items (requisition_id, item_name, quantity, unit_price, total_price, specifications, vendor_id, currency, fx_rate_used, amount_in_zmw)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [reqId, item_name, quantity, unit_price || 0, total_price, specifications, vendor_id, itemCurrency, rateToZMW, amount_in_zmw], function(err) {
                if (err) {
                    logError(err, { context: 'add_item', requisition_id: reqId });
                    return next(new AppError('Failed to add item', 500));
                }

                const itemId = this.lastID;

                // Update total amount in requisition (sum of all amounts in ZMW)
                db.get(`
                    SELECT SUM(amount_in_zmw) as total_zmw, SUM(total_price) as total
                    FROM requisition_items
                    WHERE requisition_id = ?
                `, [reqId], (err, result) => {
                    if (!err && result) {
                        db.run(`
                            UPDATE requisitions
                            SET total_amount = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [result.total_zmw || result.total || 0, reqId]);
                    }
                });

                res.json({
                    success: true,
                    message: 'Item added successfully',
                    item_id: itemId,
                    amount_in_zmw,
                    fx_rate_used: rateToZMW
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// Update item in requisition
app.put('/api/requisitions/:id/items/:item_id', authenticate, authorize('initiator', 'admin', 'procurement', 'hod'), (req, res, next) => {
    try {
        const { id: reqId, item_id } = req.params;
        const { item_name, quantity, specifications, unit_price, vendor_id, currency } = req.body;

        // Default currency to ZMW if not provided
        const itemCurrency = currency || 'ZMW';

        // Calculate total price in the selected currency
        const total_price = unit_price ? parseFloat(unit_price) * parseInt(quantity) : 0;

        // Get FX rate to convert to ZMW
        db.get(`
            SELECT rate_to_zmw FROM fx_rates
            WHERE currency_code = ? AND is_active = 1
        `, [itemCurrency], (fxErr, fxRate) => {
            if (fxErr) {
                logError(fxErr, { context: 'get_fx_rate_for_item', currency: itemCurrency });
                return next(new AppError('Failed to get exchange rate', 500));
            }

            const rateToZMW = fxRate ? fxRate.rate_to_zmw : 1;
            const amount_in_zmw = total_price * rateToZMW;

            db.run(`
                UPDATE requisition_items
                SET item_name = COALESCE(?, item_name),
                    quantity = COALESCE(?, quantity),
                    unit_price = COALESCE(?, unit_price),
                    total_price = ?,
                    specifications = COALESCE(?, specifications),
                    vendor_id = COALESCE(?, vendor_id),
                    currency = ?,
                    fx_rate_used = ?,
                    amount_in_zmw = ?
                WHERE id = ? AND requisition_id = ?
            `, [item_name, quantity, unit_price, total_price, specifications, vendor_id, itemCurrency, rateToZMW, amount_in_zmw, item_id, reqId], function(err) {
                if (err) {
                    logError(err, { context: 'update_item', item_id });
                    return next(new AppError('Failed to update item', 500));
                }

                // Update total amount in requisition (sum of all amounts in ZMW)
                db.get(`
                    SELECT SUM(amount_in_zmw) as total_zmw, SUM(total_price) as total
                    FROM requisition_items
                    WHERE requisition_id = ?
                `, [reqId], (err, result) => {
                    if (!err && result) {
                        db.run(`
                            UPDATE requisitions
                            SET total_amount = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [result.total_zmw || result.total || 0, reqId]);
                    }
                });

                res.json({
                    success: true,
                    message: 'Item updated successfully',
                    amount_in_zmw,
                    fx_rate_used: rateToZMW
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// Update requisition form fields (for procurement)
app.put('/api/requisitions/:id/update-fields', authenticate, authorize('procurement', 'admin'), (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { urgency, required_date, delivery_location } = req.body;

        db.run(`
            UPDATE requisitions
            SET urgency = COALESCE(?, urgency),
                required_date = COALESCE(?, required_date),
                delivery_location = COALESCE(?, delivery_location),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [urgency, required_date, delivery_location, reqId], function(err) {
            if (err) {
                logError(err, { context: 'update_requisition_fields', requisition_id: reqId });
                return next(new AppError('Failed to update requisition fields', 500));
            }

            res.json({
                success: true,
                message: 'Requisition fields updated successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// Generic PUT endpoint for updating requisitions (used for editing rejected requisitions)
app.put('/api/requisitions/:id', authenticate, authorize('procurement', 'admin'), (req, res, next) => {
    try {
        const reqId = req.params.id;
        const updateData = req.body;

        // Build update query dynamically
        const fields = [];
        const values = [];

        // Allow updating all requisition fields
        if (updateData.description !== undefined) { fields.push('description = ?'); values.push(updateData.description); }
        if (updateData.delivery_location !== undefined) { fields.push('delivery_location = ?'); values.push(updateData.delivery_location); }
        if (updateData.urgency !== undefined) { fields.push('urgency = ?'); values.push(updateData.urgency); }
        if (updateData.required_date !== undefined) { fields.push('required_date = ?'); values.push(updateData.required_date); }
        if (updateData.account_code !== undefined) { fields.push('account_code = ?'); values.push(updateData.account_code); }
        if (updateData.quantity !== undefined) { fields.push('quantity = ?'); values.push(updateData.quantity); }
        if (updateData.unit_price !== undefined) { fields.push('unit_price = ?'); values.push(updateData.unit_price); }
        if (updateData.total_cost !== undefined) { fields.push('total_cost = ?'); values.push(updateData.total_cost); }
        if (updateData.selected_vendor !== undefined) { fields.push('selected_vendor = ?'); values.push(updateData.selected_vendor); }
        if (updateData.vendor_currency !== undefined) { fields.push('vendor_currency = ?'); values.push(updateData.vendor_currency); }
        if (updateData.status !== undefined) { fields.push('status = ?'); values.push(updateData.status); }
        if (updateData.rejection_reason !== undefined) { fields.push('rejection_reason = ?'); values.push(updateData.rejection_reason); }
        if (updateData.rejected_by !== undefined) { fields.push('rejected_by = ?'); values.push(updateData.rejected_by); }
        if (updateData.rejected_at !== undefined) { fields.push('rejected_at = ?'); values.push(updateData.rejected_at); }

        if (fields.length === 0) {
            return res.json({ success: true, message: 'No fields to update' });
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(reqId);

        db.run(`UPDATE requisitions SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
            if (err) {
                logError(err, { context: 'update_requisition', requisition_id: reqId });
                return next(new AppError('Failed to update requisition', 500));
            }

            if (this.changes === 0) {
                return next(new AppError('Requisition not found', 404));
            }

            // Log the update in audit log
            db.run(`
                INSERT INTO audit_log (requisition_id, user_id, action, details)
                VALUES (?, ?, 'requisition_updated', ?)
            `, [reqId, req.user.id, `Requisition fields updated: ${fields.slice(0, -1).join(', ')}`]);

            res.json({
                success: true,
                message: 'Requisition updated successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// Delete item from requisition
app.delete('/api/requisitions/:id/items/:item_id', authenticate, authorize('procurement', 'admin'), (req, res, next) => {
    try {
        const { id: reqId, item_id } = req.params;

        db.run(`
            DELETE FROM requisition_items
            WHERE id = ? AND requisition_id = ?
        `, [item_id, reqId], function(err) {
            if (err) {
                logError(err, { context: 'delete_item', item_id, requisition_id: reqId });
                return next(new AppError('Failed to delete item', 500));
            }

            // Update total amount in requisition
            db.get(`
                SELECT SUM(total_price) as total FROM requisition_items WHERE requisition_id = ?
            `, [reqId], (err, result) => {
                if (!err && result) {
                    db.run(`
                        UPDATE requisitions SET total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
                    `, [result.total || 0, reqId]);
                }
            });

            res.json({
                success: true,
                message: 'Item deleted successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// Procurement: Complete pricing and vendor selection
const completeProcurementHandler = (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { user_id, comments } = req.body;

        // Get user_id from request if not provided
        const procurementUserId = user_id || req.user.id;

        // Update requisition status - move to Finance approval after procurement completes
        db.run(`
            UPDATE requisitions
            SET procurement_status = 'completed',
                procurement_assigned_to = ?,
                procurement_completed_at = CURRENT_TIMESTAMP,
                procurement_comments = ?,
                status = 'pending_finance',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [procurementUserId, comments, reqId], function(err) {
            if (err) {
                logError(err, { context: 'procurement_complete', requisition_id: reqId });
                return next(new AppError('Failed to complete procurement', 500));
            }

            // Log action
            db.run(`
                INSERT INTO audit_log (requisition_id, user_id, action, details)
                VALUES (?, ?, 'procurement_completed', ?)
            `, [reqId, procurementUserId, 'Procurement completed' + (comments ? ': ' + comments : '')]);

            logSecurity('procurement_completed', {
                requisition_id: reqId,
                user_id: procurementUserId,
                comments
            });

            res.json({
                success: true,
                message: 'Procurement completed successfully'
            });
        });
    } catch (error) {
        next(error);
    }
};

// Two routes for the same handler (for backwards compatibility)
app.put('/api/requisitions/:id/procurement', authenticate, authorize('procurement', 'admin'), completeProcurementHandler);
app.put('/api/requisitions/:id/complete-procurement', authenticate, authorize('procurement', 'admin'), completeProcurementHandler);

// Generate PDF for requisition
app.get('/api/requisitions/:id/pdf', authenticate, (req, res, next) => {
    try {
        // Clear require cache for pdfGenerator to ensure latest version is used
        const pdfGenPath = require.resolve('./utils/pdfGenerator');
        delete require.cache[pdfGenPath];
        const { generateRequisitionPDF } = require('./utils/pdfGenerator');
        console.log('📄 PDF Generator module reloaded from disk');

        const reqId = req.params.id;

        // Get requisition with full details from consolidated view (TIER 2 optimization)
        // The view handles all JOINs and COALESCE logic for cleaner, faster queries
        db.get(`
            SELECT * FROM vw_requisition_pdf_data
            WHERE id = ?
        `, [reqId], (err, requisition) => {
            if (err) {
                logError(err, { context: 'pdf_generation_get_req', requisition_id: reqId });
                return next(new AppError('Database error', 500));
            }
            if (!requisition) {
                return res.status(404).json({ error: 'Requisition not found' });
            }

            // Check if requisition has been approved by HOD (minimum requirement for PDF)
            const allowedStatuses = ['hod_approved', 'procurement_completed', 'pending_md', 'completed'];
            if (!allowedStatuses.includes(requisition.status)) {
                return res.status(400).json({
                    error: 'PDF can only be generated after HOD approval',
                    current_status: requisition.status
                });
            }

            // Get items for the requisition
            // Pricing now comes directly from items table (populated by triggers)
            db.all(`
                SELECT ri.*,
                       v.name as vendor_name
                FROM requisition_items ri
                LEFT JOIN vendors v ON ri.vendor_id = v.id
                WHERE ri.requisition_id = ?
                ORDER BY ri.id
            `, [reqId], (err, items) => {
                if (err) {
                    logError(err, { context: 'pdf_generation_get_items', requisition_id: reqId });
                    return next(new AppError('Database error', 500));
                }

                // Generate PDF
                generateRequisitionPDF(requisition, items, (err, pdfBuffer) => {
                    if (err) {
                        logError(err, { context: 'pdf_generation_create', requisition_id: reqId });
                        return next(new AppError('Failed to generate PDF', 500));
                    }

                    // Log PDF generation
                    db.run(`
                        INSERT INTO audit_log (requisition_id, user_id, action, details)
                        VALUES (?, ?, 'pdf_generated', 'PDF document generated')
                    `, [reqId, req.user.id]);

                    logSecurity('pdf_generated', {
                        requisition_id: reqId,
                        user_id: req.user.id,
                        req_number: requisition.req_number
                    });

                    // Send PDF
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="Requisition_${requisition.req_number}.pdf"`);
                    res.send(pdfBuffer);
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// Get statistics
app.get('/api/stats', authenticate, (req, res, next) => {
    try {
        const { user_id, role } = req.query;

        // FIXED: SQL Injection vulnerability - using parameterized queries
        let queries = {
            total: {
                sql: "SELECT COUNT(*) as count FROM requisitions",
                params: []
            },
            pending: {
                sql: "SELECT COUNT(*) as count FROM requisitions WHERE status LIKE ?",
                params: ['pending%']
            },
            approved: {
                sql: "SELECT COUNT(*) as count FROM requisitions WHERE status = ?",
                params: ['approved']
            },
            rejected: {
                sql: "SELECT COUNT(*) as count FROM requisitions WHERE status = ?",
                params: ['rejected']
            }
        };

        if (role === 'initiator' && user_id) {
            queries.total.sql += " WHERE created_by = ?";
            queries.total.params.push(user_id);

            queries.pending.sql += " AND created_by = ?";
            queries.pending.params.push(user_id);

            queries.approved.sql += " AND created_by = ?";
            queries.approved.params.push(user_id);

            queries.rejected.sql += " AND created_by = ?";
            queries.rejected.params.push(user_id);
        }

        const stats = {};
        let completed = 0;
        const totalQueries = Object.keys(queries).length;

        Object.keys(queries).forEach(key => {
            const { sql, params } = queries[key];
            db.get(sql, params, (err, row) => {
                if (err) {
                    return next(new AppError('Database error', 500));
                }
                stats[key] = row ? row.count : 0;
                completed++;

                if (completed === totalQueries) {
                    res.json(stats);
                }
            });
        });
    } catch (error) {
        next(error);
    }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

// Get executive overview analytics
app.get('/api/analytics/overview', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
    try {
        const { dateFrom, dateTo, department } = req.query;
        let whereConditions = [];
        let params = [];

        if (dateFrom) {
            whereConditions.push("r.created_at >= ?");
            params.push(dateFrom);
        }
        if (dateTo) {
            whereConditions.push("r.created_at <= ?");
            params.push(dateTo);
        }
        if (department) {
            whereConditions.push("u.department = ?");
            params.push(department);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        const queries = {
            totalSpend: `
                SELECT COALESCE(SUM(r.total_amount), 0) as value
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                ${whereClause}
            `,
            totalRequisitions: `
                SELECT COUNT(*) as value
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                ${whereClause}
            `,
            completedRequisitions: `
                SELECT COUNT(*) as value
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} r.status = 'completed'
            `,
            pendingRequisitions: `
                SELECT COUNT(*) as value
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} r.status LIKE 'pending%'
            `,
            rejectedRequisitions: `
                SELECT COUNT(*) as value
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} r.status = 'rejected'
            `,
            avgProcessingTime: `
                SELECT AVG(JULIANDAY(r.updated_at) - JULIANDAY(r.created_at)) as value
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} r.status = 'completed'
            `,
            posGenerated: `
                SELECT COUNT(*) as value
                FROM purchase_orders po
                JOIN requisitions r ON po.requisition_id = r.id
                JOIN users u ON r.created_by = u.id
                ${whereClause}
            `
        };

        const results = {};
        let completed = 0;
        const queryKeys = Object.keys(queries);

        queryKeys.forEach(key => {
            db.get(queries[key], params, (err, row) => {
                if (err) {
                    logError(err, { context: 'analytics_overview', query: key });
                    return next(new AppError('Database error', 500));
                }
                results[key] = row ? (row.value || 0) : 0;
                completed++;

                if (completed === queryKeys.length) {
                    res.json(results);
                }
            });
        });
    } catch (error) {
        next(error);
    }
});

// Get spending trend data
app.get('/api/analytics/spending-trend', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
    try {
        const { period = 'monthly', dateFrom, dateTo, department } = req.query;

        let groupByFormat, dateLabel;
        switch(period) {
            case 'daily':
                groupByFormat = "DATE(r.created_at)";
                dateLabel = "date";
                break;
            case 'weekly':
                groupByFormat = "strftime('%Y-W%W', r.created_at)";
                dateLabel = "week";
                break;
            case 'monthly':
            default:
                groupByFormat = "strftime('%Y-%m', r.created_at)";
                dateLabel = "month";
                break;
        }

        let whereConditions = [];
        let params = [];

        if (dateFrom) {
            whereConditions.push("r.created_at >= ?");
            params.push(dateFrom);
        }
        if (dateTo) {
            whereConditions.push("r.created_at <= ?");
            params.push(dateTo);
        }
        if (department) {
            whereConditions.push("u.department = ?");
            params.push(department);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        const query = `
            SELECT
                ${groupByFormat} as period,
                SUM(CASE WHEN r.status = 'completed' THEN r.total_amount ELSE 0 END) as approved,
                SUM(CASE WHEN r.status LIKE 'pending%' THEN r.total_amount ELSE 0 END) as pending,
                SUM(CASE WHEN r.status = 'rejected' THEN r.total_amount ELSE 0 END) as rejected,
                COUNT(*) as count
            FROM requisitions r
            JOIN users u ON r.created_by = u.id
            ${whereClause}
            GROUP BY ${groupByFormat}
            ORDER BY period ASC
        `;

        db.all(query, params, (err, rows) => {
            if (err) {
                logError(err, { context: 'analytics_spending_trend' });
                return next(new AppError('Database error', 500));
            }
            res.json({ period: dateLabel, data: rows || [] });
        });
    } catch (error) {
        next(error);
    }
});

// Get department breakdown
app.get('/api/analytics/department-breakdown', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
    try {
        const { dateFrom, dateTo } = req.query;
        let whereConditions = ["r.status = 'completed'"];
        let params = [];

        if (dateFrom) {
            whereConditions.push("r.created_at >= ?");
            params.push(dateFrom);
        }
        if (dateTo) {
            whereConditions.push("r.created_at <= ?");
            params.push(dateTo);
        }

        const whereClause = 'WHERE ' + whereConditions.join(' AND ');

        const query = `
            SELECT
                u.department,
                COUNT(r.id) as count,
                SUM(r.total_amount) as total_amount
            FROM requisitions r
            JOIN users u ON r.created_by = u.id
            ${whereClause}
            GROUP BY u.department
            ORDER BY total_amount DESC
        `;

        db.all(query, params, (err, rows) => {
            if (err) {
                logError(err, { context: 'analytics_department_breakdown' });
                return next(new AppError('Database error', 500));
            }
            res.json(rows || []);
        });
    } catch (error) {
        next(error);
    }
});

// Get approval flow analytics
app.get('/api/analytics/approval-flow', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
    try {
        const { dateFrom, dateTo } = req.query;
        let whereConditions = [];
        let params = [];

        if (dateFrom) {
            whereConditions.push("created_at >= ?");
            params.push(dateFrom);
        }
        if (dateTo) {
            whereConditions.push("created_at <= ?");
            params.push(dateTo);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        const queries = {
            created: `SELECT COUNT(*) as count FROM requisitions ${whereClause}`,
            hod_approved: `SELECT COUNT(*) as count FROM requisitions ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} hod_approval_status = 'approved'`,
            procurement_complete: `SELECT COUNT(*) as count FROM requisitions ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} procurement_status = 'completed'`,
            finance_approved: `SELECT COUNT(*) as count FROM requisitions ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} finance_approval_status = 'approved'`,
            md_approved: `SELECT COUNT(*) as count FROM requisitions ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} md_approval_status = 'approved'`,
            po_generated: `SELECT COUNT(*) as count FROM requisitions ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} status = 'completed' AND po_number IS NOT NULL`
        };

        const results = {};
        let completed = 0;
        const queryKeys = Object.keys(queries);

        queryKeys.forEach(key => {
            db.get(queries[key], params, (err, row) => {
                if (err) {
                    logError(err, { context: 'analytics_approval_flow', stage: key });
                    return next(new AppError('Database error', 500));
                }
                results[key] = row ? row.count : 0;
                completed++;

                if (completed === queryKeys.length) {
                    res.json(results);
                }
            });
        });
    } catch (error) {
        next(error);
    }
});

// Get duration analytics
app.get('/api/analytics/duration', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
    try {
        const { dateFrom, dateTo } = req.query;
        let whereConditions = ["status = 'completed'"];
        let params = [];

        if (dateFrom) {
            whereConditions.push("created_at >= ?");
            params.push(dateFrom);
        }
        if (dateTo) {
            whereConditions.push("created_at <= ?");
            params.push(dateTo);
        }

        const whereClause = 'WHERE ' + whereConditions.join(' AND ');

        const query = `
            SELECT
                AVG(JULIANDAY(hod_approved_at) - JULIANDAY(created_at)) as hod_stage,
                AVG(JULIANDAY(procurement_completed_at) - JULIANDAY(hod_approved_at)) as procurement_stage,
                AVG(JULIANDAY(finance_approved_at) - JULIANDAY(procurement_completed_at)) as finance_stage,
                AVG(JULIANDAY(md_approved_at) - JULIANDAY(finance_approved_at)) as md_stage,
                AVG(JULIANDAY(updated_at) - JULIANDAY(created_at)) as total_duration,
                MIN(JULIANDAY(updated_at) - JULIANDAY(created_at)) as min_duration,
                MAX(JULIANDAY(updated_at) - JULIANDAY(created_at)) as max_duration
            FROM requisitions
            ${whereClause}
        `;

        db.get(query, params, (err, row) => {
            if (err) {
                logError(err, { context: 'analytics_duration' });
                return next(new AppError('Database error', 500));
            }
            res.json(row || {});
        });
    } catch (error) {
        next(error);
    }
});

// Get status distribution
app.get('/api/analytics/status-distribution', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
    try {
        const { dateFrom, dateTo, department } = req.query;
        let whereConditions = [];
        let params = [];

        if (dateFrom) {
            whereConditions.push("r.created_at >= ?");
            params.push(dateFrom);
        }
        if (dateTo) {
            whereConditions.push("r.created_at <= ?");
            params.push(dateTo);
        }
        if (department) {
            whereConditions.push("u.department = ?");
            params.push(department);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        const query = `
            SELECT
                r.status,
                COUNT(*) as count,
                SUM(r.total_amount) as total_amount
            FROM requisitions r
            JOIN users u ON r.created_by = u.id
            ${whereClause}
            GROUP BY r.status
            ORDER BY count DESC
        `;

        db.all(query, params, (err, rows) => {
            if (err) {
                logError(err, { context: 'analytics_status_distribution' });
                return next(new AppError('Database error', 500));
            }
            res.json(rows || []);
        });
    } catch (error) {
        next(error);
    }
});

// Get top vendors
app.get('/api/analytics/top-vendors', authenticate, authorize('finance', 'md', 'admin', 'procurement'), (req, res, next) => {
    try {
        const { dateFrom, dateTo, limit = 10 } = req.query;
        let whereConditions = [];
        let params = [];

        if (dateFrom) {
            whereConditions.push("r.created_at >= ?");
            params.push(dateFrom);
        }
        if (dateTo) {
            whereConditions.push("r.created_at <= ?");
            params.push(dateTo);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        const query = `
            SELECT
                v.id,
                v.name,
                COUNT(DISTINCT po.id) as po_count,
                SUM(po.total_amount) as total_spend
            FROM vendors v
            JOIN requisition_items ri ON v.id = ri.vendor_id
            JOIN requisitions r ON ri.requisition_id = r.id
            LEFT JOIN purchase_orders po ON r.id = po.requisition_id
            ${whereClause}
            GROUP BY v.id, v.name
            ORDER BY total_spend DESC
            LIMIT ?
        `;

        params.push(parseInt(limit));

        db.all(query, params, (err, rows) => {
            if (err) {
                logError(err, { context: 'analytics_top_vendors' });
                return next(new AppError('Database error', 500));
            }
            res.json(rows || []);
        });
    } catch (error) {
        next(error);
    }
});

// ============================================
// ANALYTICS EXPORT ENDPOINTS
// ============================================

// Export analytics as CSV
app.get('/api/analytics/export/csv', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
    try {
        const { dateFrom, dateTo, department } = req.query;
        const filterParams = {};
        if (dateFrom) filterParams.dateFrom = dateFrom;
        if (dateTo) filterParams.dateTo = dateTo;
        if (department) filterParams.department = department;

        // Build WHERE clause
        let whereConditions = [];
        let params = [];

        if (dateFrom) {
            whereConditions.push("r.created_at >= ?");
            params.push(dateFrom);
        }
        if (dateTo) {
            whereConditions.push("r.created_at <= ?");
            params.push(dateTo);
        }
        if (department) {
            whereConditions.push("u.department = ?");
            params.push(department);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        const query = `
            SELECT
                r.req_number,
                r.description,
                r.total_amount,
                r.status,
                r.created_at,
                r.updated_at,
                u.full_name as created_by_name,
                u.department,
                CAST((JULIANDAY(r.updated_at) - JULIANDAY(r.created_at)) AS INTEGER) as processing_days
            FROM requisitions r
            JOIN users u ON r.created_by = u.id
            ${whereClause}
            ORDER BY r.created_at DESC
        `;

        db.all(query, params, (err, rows) => {
            if (err) {
                logError(err, { context: 'analytics_export_csv' });
                return next(new AppError('Database error', 500));
            }

            // Build CSV
            const headers = ['Req Number', 'Description', 'Amount (ZMW)', 'Status', 'Department', 'Created By', 'Created Date', 'Processing Days'];
            const csv = [headers.join(',')];

            rows.forEach(row => {
                const line = [
                    row.req_number,
                    `"${(row.description || '').replace(/"/g, '""')}"`,
                    row.total_amount || 0,
                    row.status,
                    row.department,
                    row.created_by_name,
                    new Date(row.created_at).toLocaleDateString(),
                    row.processing_days || 0
                ];
                csv.push(line.join(','));
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.csv"`);
            res.send(csv.join('\n'));
        });
    } catch (error) {
        next(error);
    }
});

// Export analytics as JSON (for Excel conversion on frontend)
app.get('/api/analytics/export/json', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
    try {
        const { dateFrom, dateTo, department, period = 'monthly' } = req.query;

        // Fetch all analytics data
        const filterParams = {};
        if (dateFrom) filterParams.dateFrom = dateFrom;
        if (dateTo) filterParams.dateTo = dateTo;
        if (department) filterParams.department = department;

        let whereConditions = [];
        let params = [];

        if (dateFrom) {
            whereConditions.push("r.created_at >= ?");
            params.push(dateFrom);
        }
        if (dateTo) {
            whereConditions.push("r.created_at <= ?");
            params.push(dateTo);
        }
        if (department) {
            whereConditions.push("u.department = ?");
            params.push(department);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Get overview data
        const overviewQuery = `
            SELECT
                COALESCE(SUM(r.total_amount), 0) as totalSpend,
                COUNT(*) as totalRequisitions,
                COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completedRequisitions,
                COUNT(CASE WHEN r.status LIKE 'pending%' THEN 1 END) as pendingRequisitions,
                COUNT(CASE WHEN r.status = 'rejected' THEN 1 END) as rejectedRequisitions,
                AVG(CASE WHEN r.status = 'completed' THEN JULIANDAY(r.updated_at) - JULIANDAY(r.created_at) END) as avgProcessingTime
            FROM requisitions r
            JOIN users u ON r.created_by = u.id
            ${whereClause}
        `;

        // Get department breakdown
        const deptQuery = `
            SELECT
                u.department,
                COUNT(*) as count,
                SUM(r.total_amount) as total_amount
            FROM requisitions r
            JOIN users u ON r.created_by = u.id
            ${whereClause}
            GROUP BY u.department
            ORDER BY total_amount DESC
        `;

        // Get status distribution
        const statusQuery = `
            SELECT
                r.status,
                COUNT(*) as count,
                SUM(r.total_amount) as total_amount
            FROM requisitions r
            JOIN users u ON r.created_by = u.id
            ${whereClause}
            GROUP BY r.status
        `;

        db.get(overviewQuery, params, (err, overview) => {
            if (err) return next(new AppError('Database error', 500));

            db.all(deptQuery, params, (err2, departments) => {
                if (err2) return next(new AppError('Database error', 500));

                db.all(statusQuery, params, (err3, statuses) => {
                    if (err3) return next(new AppError('Database error', 500));

                    res.json({
                        overview,
                        departments,
                        statuses,
                        filters: { dateFrom, dateTo, department },
                        exportDate: new Date().toISOString()
                    });
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// Get admin statistics
app.get('/api/admin/stats', authenticate, authorize('admin'), (req, res, next) => {
    try {
        db.get(`SELECT COUNT(*) as total FROM users`, (err, userCount) => {
            db.get(`SELECT COUNT(*) as total FROM requisitions`, (err2, reqCount) => {
                db.get(`SELECT COUNT(*) as total FROM vendors`, (err3, vendorCount) => {
                    db.get(`SELECT COUNT(DISTINCT department) as total FROM users WHERE department IS NOT NULL`, (err4, deptCount) => {
                        res.json({
                            totalUsers: userCount?.total || 0,
                            totalRequisitions: reqCount?.total || 0,
                            totalVendors: vendorCount?.total || 0,
                            activeDepartments: deptCount?.total || 0
                        });
                    });
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// ====== USER MANAGEMENT ======

// Get all users
app.get('/api/admin/users', authenticate, authorize('admin'), (req, res, next) => {
    try {
        db.all(`
            SELECT id, username, full_name, email, role, department, assigned_hod, can_access_stores, created_at
            FROM users
            ORDER BY created_at DESC
        `, (err, users) => {
            if (err) {
                logError(err, { context: 'get_all_users' });
                return next(new AppError('Database error', 500));
            }
            res.json(users);
        });
    } catch (error) {
        next(error);
    }
});

// Create new user
app.post('/api/admin/users', authenticate, authorize('admin'), (req, res, next) => {
    try {
        console.log('=== CREATE USER REQUEST ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        const { username, full_name, email, password, role, department, assigned_hod, can_access_stores } = req.body;

        console.log('Extracted fields:', { username, full_name, email, role, department, assigned_hod: assigned_hod ? 'present' : 'missing', can_access_stores });

        // Validation
        if (!username || !full_name || !password || !role) {
            console.log('Validation failed: Required fields missing');
            return res.status(400).json({ error: 'Required fields missing' });
        }

        if (!department) {
            return res.status(400).json({ error: 'Department is required' });
        }

        // assigned_hod is optional for hod, md, admin, finance roles
        const rolesWithoutHod = ['hod', 'md', 'admin', 'finance'];
        if (!assigned_hod && !rolesWithoutHod.includes(role)) {
            return res.status(400).json({ error: 'Assigned HOD is required' });
        }

        // Check if username exists
        db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, existing) => {
            if (existing) {
                return res.status(400).json({ error: 'Username already exists' });
            }

            // Hash password
            const bcrypt = require('bcryptjs');
            const hashedPassword = bcrypt.hashSync(password, 10);

            // Parse assigned_hod as integer (null if not provided)
            const assignedHodId = assigned_hod ? parseInt(assigned_hod, 10) : null;

            db.run(`
                INSERT INTO users (username, full_name, email, password, role, department, assigned_hod, can_access_stores)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [username, full_name, email, hashedPassword, role, department, assignedHodId, can_access_stores ? 1 : 0], function(err) {
                if (err) {
                    console.error('Error creating user:', err);
                    logError(err, { context: 'create_user', username, role, department });
                    return res.status(500).json({ error: 'Failed to create user: ' + err.message });
                }

                logSecurity('user_created', {
                    admin_id: req.user.id,
                    new_user_id: this.lastID,
                    username,
                    role
                });

                res.json({
                    success: true,
                    message: 'User created successfully',
                    userId: this.lastID
                });
            });
        });
    } catch (error) {
        console.error('Exception in create user:', error);
        next(error);
    }
});

// Update user
app.put('/api/admin/users/:id', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const userId = req.params.id;
        console.log('=== UPDATE USER REQUEST ===');
        console.log('User ID:', userId);
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        const { full_name, email, role, department, assigned_hod, password, can_access_stores } = req.body;

        console.log('Extracted fields:', { full_name, email, role, department, assigned_hod: assigned_hod ? 'present' : 'missing', password: password ? 'present' : 'not provided', can_access_stores });

        // Validation
        if (!department) {
            console.log('Validation failed: Department is required');
            return res.status(400).json({ error: 'Department is required' });
        }

        // assigned_hod is optional for hod, md, admin, finance roles
        const rolesWithoutHod = ['hod', 'md', 'admin', 'finance'];
        if (!assigned_hod && !rolesWithoutHod.includes(role)) {
            console.log('Validation failed: Assigned HOD is required');
            return res.status(400).json({ error: 'Assigned HOD is required' });
        }

        // Parse assigned_hod as integer (null if not provided)
        const assignedHodId = assigned_hod ? parseInt(assigned_hod, 10) : null;

        let query = `
            UPDATE users
            SET full_name = ?, email = ?, role = ?, department = ?, assigned_hod = ?, can_access_stores = ?
        `;
        let params = [full_name, email, role, department, assignedHodId, can_access_stores ? 1 : 0];

        // If password is provided, update it
        if (password) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = bcrypt.hashSync(password, 10);
            query = `
                UPDATE users
                SET full_name = ?, email = ?, role = ?, department = ?, assigned_hod = ?, can_access_stores = ?, password = ?
            `;
            params = [full_name, email, role, department, assignedHodId, can_access_stores ? 1 : 0, hashedPassword];
        }

        query += ` WHERE id = ?`;
        params.push(userId);

        db.run(query, params, function(err) {
            if (err) {
                console.error('Error updating user:', err);
                logError(err, { context: 'update_user', user_id: userId });
                return res.status(500).json({ error: 'Failed to update user: ' + err.message });
            }

            logSecurity('user_updated', {
                admin_id: req.user.id,
                updated_user_id: userId,
                role
            });

            res.json({
                success: true,
                message: 'User updated successfully'
            });
        });
    } catch (error) {
        console.error('Exception in update user:', error);
        next(error);
    }
});

// Delete user
app.delete('/api/admin/users/:id', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const userId = req.params.id;

        // Prevent deleting the admin user
        if (userId == req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        db.run(`DELETE FROM users WHERE id = ?`, [userId], function(err) {
            if (err) {
                logError(err, { context: 'delete_user', user_id: userId });
                return next(new AppError('Failed to delete user', 500));
            }

            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// ====== VENDOR MANAGEMENT ======

// Create vendor
app.post('/api/admin/vendors', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { name, contact_person, email, phone, address } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Vendor name is required' });
        }

        db.run(`
            INSERT INTO vendors (name, contact_person, email, phone, address)
            VALUES (?, ?, ?, ?, ?)
        `, [name, contact_person, email, phone, address], function(err) {
            if (err) {
                logError(err, { context: 'create_vendor' });
                return next(new AppError('Failed to create vendor', 500));
            }

            res.json({
                success: true,
                message: 'Vendor created successfully',
                vendorId: this.lastID
            });
        });
    } catch (error) {
        next(error);
    }
});

// Update vendor
app.put('/api/admin/vendors/:id', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const vendorId = req.params.id;
        const { name, contact_person, email, phone, address } = req.body;

        db.run(`
            UPDATE vendors
            SET name = ?, contact_person = ?, email = ?, phone = ?, address = ?
            WHERE id = ?
        `, [name, contact_person, email, phone, address, vendorId], function(err) {
            if (err) {
                logError(err, { context: 'update_vendor', vendor_id: vendorId });
                return next(new AppError('Failed to update vendor', 500));
            }

            res.json({
                success: true,
                message: 'Vendor updated successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// Delete vendor
app.delete('/api/admin/vendors/:id', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const vendorId = req.params.id;

        db.run(`DELETE FROM vendors WHERE id = ?`, [vendorId], function(err) {
            if (err) {
                logError(err, { context: 'delete_vendor', vendor_id: vendorId });
                return next(new AppError('Failed to delete vendor', 500));
            }

            res.json({
                success: true,
                message: 'Vendor deleted successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// Bulk upload vendors
app.post('/api/admin/vendors/bulk-upload', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { vendors } = req.body;

        if (!vendors || !Array.isArray(vendors) || vendors.length === 0) {
            return res.status(400).json({ error: 'No vendors provided' });
        }

        const stmt = db.prepare(`
            INSERT INTO vendors (name, contact_person, email, phone, address)
            VALUES (?, ?, ?, ?, ?)
        `);

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        vendors.forEach((vendor, index) => {
            if (!vendor.name || vendor.name.trim() === '') {
                errorCount++;
                errors.push(`Row ${index + 1}: Vendor name is required`);
                return;
            }

            try {
                stmt.run(
                    vendor.name.trim(),
                    vendor.contact_person || '',
                    vendor.email || '',
                    vendor.phone || '',
                    vendor.address || ''
                );
                successCount++;
            } catch (err) {
                errorCount++;
                errors.push(`Row ${index + 1}: ${err.message}`);
            }
        });

        res.json({
            success: true,
            message: `Uploaded ${successCount} vendors successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
            successCount,
            errorCount,
            errors: errors.slice(0, 10) // Return first 10 errors only
        });
    } catch (error) {
        next(error);
    }
});

// ====== REQUISITION REASSIGNMENT ======

// Get requisitions pending approval
app.get('/api/admin/pending-requisitions', authenticate, authorize('admin'), (req, res, next) => {
    try {
        db.all(`
            SELECT r.*, u.full_name as created_by_name, u.department
            FROM requisitions r
            JOIN users u ON r.created_by = u.id
            WHERE r.status IN ('pending_hod', 'pending_md', 'procurement_completed')
            ORDER BY r.created_at DESC
        `, (err, requisitions) => {
            if (err) {
                logError(err, { context: 'get_pending_requisitions' });
                return next(new AppError('Database error', 500));
            }
            res.json(requisitions || []);
        });
    } catch (error) {
        next(error);
    }
});

// Reassign requisition
app.put('/api/admin/reassign/:id', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { new_approver_id, comments } = req.body;

        if (!new_approver_id || !comments) {
            return res.status(400).json({ error: 'New approver and comments are required' });
        }

        // Log the reassignment
        db.run(`
            INSERT INTO audit_log (requisition_id, user_id, action, details)
            VALUES (?, ?, 'reassigned', ?)
        `, [reqId, req.user.id, `Reassigned by admin. ${comments}`], function(err) {
            if (err) {
                logError(err, { context: 'reassign_log', requisition_id: reqId });
            }
        });

        res.json({
            success: true,
            message: 'Requisition reassigned successfully'
        });
    } catch (error) {
        next(error);
    }
});

// ====== REPORTS ======

// Generate summary report
app.get('/api/admin/reports/summary', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { start_date, end_date, department } = req.query;

        let query = `
            SELECT
                COUNT(*) as total_requisitions,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status LIKE '%pending%' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as total_spent
            FROM requisitions r
            JOIN users u ON r.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ` AND r.created_at >= ?`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND r.created_at <= ?`;
            params.push(end_date);
        }
        if (department) {
            query += ` AND u.department = ?`;
            params.push(department);
        }

        db.get(query, params, (err, report) => {
            if (err) {
                logError(err, { context: 'generate_report' });
                return next(new AppError('Failed to generate report', 500));
            }

            res.json(report || {});
        });
    } catch (error) {
        next(error);
    }
});

// ====== BUDGET MANAGEMENT ======

// Get all budgets
app.get('/api/admin/budgets', authenticate, authorize('admin'), (req, res, next) => {
    try {
        db.all(`
            SELECT b.*,
                   (SELECT SUM(total_amount) FROM requisitions r
                    JOIN users u ON r.created_by = u.id
                    WHERE u.department = b.department AND r.status = 'completed') as spent
            FROM budgets b
            ORDER BY b.department
        `, (err, budgets) => {
            if (err) {
                logError(err, { context: 'get_budgets' });
                return next(new AppError('Database error', 500));
            }
            res.json(budgets || []);
        });
    } catch (error) {
        next(error);
    }
});

// Create or update budget
app.post('/api/admin/budgets', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { department, allocated_amount, fiscal_year } = req.body;

        if (!department || !allocated_amount || !fiscal_year) {
            return res.status(400).json({ error: 'Department, allocated amount, and fiscal year are required' });
        }

        db.run(`
            INSERT INTO budgets (department, allocated_amount, fiscal_year)
            VALUES (?, ?, ?)
            ON CONFLICT(department)
            DO UPDATE SET allocated_amount = ?, fiscal_year = ?, updated_at = CURRENT_TIMESTAMP
        `, [department, allocated_amount, fiscal_year, allocated_amount, fiscal_year], function(err) {
            if (err) {
                logError(err, { context: 'create_update_budget' });
                return next(new AppError('Failed to save budget', 500));
            }

            res.json({
                success: true,
                message: 'Budget saved successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// Delete budget
app.delete('/api/admin/budgets/:department', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const department = req.params.department;

        db.run(`DELETE FROM budgets WHERE department = ?`, [department], function(err) {
            if (err) {
                logError(err, { context: 'delete_budget', department });
                return next(new AppError('Failed to delete budget', 500));
            }

            res.json({
                success: true,
                message: 'Budget deleted successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// ====== DEPARTMENT MANAGEMENT ======

// Get all departments
app.get('/api/admin/departments', authenticate, authorize('admin'), (req, res, next) => {
    try {
        db.all(`SELECT * FROM departments ORDER BY name`, (err, departments) => {
            if (err) {
                logError(err, { context: 'get_departments' });
                return next(new AppError('Database error', 500));
            }
            res.json(departments || []);
        });
    } catch (error) {
        next(error);
    }
});

// Create department
app.post('/api/admin/departments', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { name, code, description } = req.body;

        if (!name || !code) {
            return res.status(400).json({ error: 'Name and code are required' });
        }

        db.run(`
            INSERT INTO departments (name, code, description, is_active)
            VALUES (?, ?, ?, 1)
        `, [name, code, description], function(err) {
            if (err) {
                logError(err, { context: 'create_department' });
                return next(new AppError('Failed to create department', 500));
            }

            res.json({
                success: true,
                message: 'Department created successfully',
                departmentId: this.lastID
            });
        });
    } catch (error) {
        next(error);
    }
});

// Update department
app.put('/api/admin/departments/:id', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const departmentId = req.params.id;
        const { name, code, description, is_active } = req.body;

        db.run(`
            UPDATE departments
            SET name = ?, code = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [name, code, description, is_active, departmentId], function(err) {
            if (err) {
                logError(err, { context: 'update_department', department_id: departmentId });
                return next(new AppError('Failed to update department', 500));
            }

            res.json({
                success: true,
                message: 'Department updated successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// Delete department
app.delete('/api/admin/departments/:id', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const departmentId = req.params.id;

        db.run(`DELETE FROM departments WHERE id = ?`, [departmentId], function(err) {
            if (err) {
                logError(err, { context: 'delete_department', department_id: departmentId });
                return next(new AppError('Failed to delete department', 500));
            }

            res.json({
                success: true,
                message: 'Department deleted successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// ====== DEPARTMENT CODES MANAGEMENT ======

// Get all department codes
app.get('/api/admin/department-codes', authenticate, authorize('admin'), (req, res, next) => {
    try {
        db.all(`
            SELECT dc.*, d.name as department_name
            FROM department_codes dc
            LEFT JOIN departments d ON dc.department_id = d.id
            ORDER BY dc.code
        `, (err, codes) => {
            if (err) {
                logError(err, { context: 'get_department_codes' });
                return next(new AppError('Database error', 500));
            }
            res.json(codes || []);
        });
    } catch (error) {
        next(error);
    }
});

// Create department code
app.post('/api/admin/department-codes', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { department_id, code, description } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Code is required' });
        }

        db.run(`
            INSERT INTO department_codes (department_id, code, description, is_active)
            VALUES (?, ?, ?, 1)
        `, [department_id, code, description], function(err) {
            if (err) {
                logError(err, { context: 'create_department_code' });
                return next(new AppError('Failed to create department code', 500));
            }

            res.json({
                success: true,
                message: 'Department code created successfully',
                codeId: this.lastID
            });
        });
    } catch (error) {
        next(error);
    }
});

// Update department code
app.put('/api/admin/department-codes/:id', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const codeId = req.params.id;
        const { department_id, code, description, is_active } = req.body;

        db.run(`
            UPDATE department_codes
            SET department_id = ?, code = ?, description = ?, is_active = ?
            WHERE id = ?
        `, [department_id, code, description, is_active, codeId], function(err) {
            if (err) {
                logError(err, { context: 'update_department_code', code_id: codeId });
                return next(new AppError('Failed to update department code', 500));
            }

            res.json({
                success: true,
                message: 'Department code updated successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// Delete department code
app.delete('/api/admin/department-codes/:id', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const codeId = req.params.id;

        db.run(`DELETE FROM department_codes WHERE id = ?`, [codeId], function(err) {
            if (err) {
                logError(err, { context: 'delete_department_code', code_id: codeId });
                return next(new AppError('Failed to delete department code', 500));
            }

            res.json({
                success: true,
                message: 'Department code deleted successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// ====== PASSWORD RESET ======

// Reset user password (admin only)
app.put('/api/admin/users/:id/reset-password', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const userId = req.params.id;
        const { new_password } = req.body;

        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        // Hash the new password
        const bcrypt = require('bcryptjs');
        const hashedPassword = bcrypt.hashSync(new_password, 10);

        db.run(`
            UPDATE users
            SET password = ?
            WHERE id = ?
        `, [hashedPassword, userId], function(err) {
            if (err) {
                logError(err, { context: 'reset_password', user_id: userId });
                return next(new AppError('Failed to reset password', 500));
            }

            logSecurity('password_reset', {
                admin_id: req.user.id,
                target_user_id: userId
            });

            res.json({
                success: true,
                message: 'Password reset successfully'
            });
        });
    } catch (error) {
        next(error);
    }
});

// ====== REQUISITION REROUTING ======

// Get all users for rerouting (dropdown options)
app.get('/api/admin/reroute-users', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { role } = req.query;

        let query = 'SELECT id, full_name, role, department FROM users WHERE 1=1';
        const params = [];

        if (role) {
            query += ' AND role = ?';
            params.push(role);
        }

        query += ' ORDER BY full_name';

        db.all(query, params, (err, users) => {
            if (err) {
                logError(err, { context: 'get_reroute_users' });
                return next(new AppError('Database error', 500));
            }
            res.json(users || []);
        });
    } catch (error) {
        next(error);
    }
});

// Reroute requisition to another approver
app.post('/api/admin/reroute/:id', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const reqId = req.params.id;
        const { to_user_id, reason, new_status } = req.body;

        if (!to_user_id || !reason) {
            return res.status(400).json({ error: 'Target user and reason are required' });
        }

        // Get target user info
        db.get('SELECT id, full_name, role, department FROM users WHERE id = ?', [to_user_id], (err, targetUser) => {
            if (err || !targetUser) {
                return res.status(404).json({ error: 'Target user not found' });
            }

            // Update requisition status and universal assignment
            let updateQuery = 'UPDATE requisitions SET updated_at = CURRENT_TIMESTAMP';
            const updateParams = [];

            if (new_status) {
                updateQuery += ', status = ?';
                updateParams.push(new_status);
            }

            // Set universal assignment fields for ALL roles
            updateQuery += ', assigned_to = ?, assigned_role = ?';
            updateParams.push(to_user_id);
            updateParams.push(targetUser.role);

            // Also set assigned_hod_id for backward compatibility
            if (targetUser.role === 'hod') {
                updateQuery += ', assigned_hod_id = ?';
                updateParams.push(to_user_id);
            }

            updateQuery += ' WHERE id = ?';
            updateParams.push(reqId);

            db.run(updateQuery, updateParams, function(err) {
                if (err) {
                    logError(err, { context: 'reroute_requisition', requisition_id: reqId });
                    return next(new AppError('Failed to reroute requisition', 500));
                }

                // Log the reroute action
                db.run(`
                    INSERT INTO audit_log (requisition_id, user_id, action, details)
                    VALUES (?, ?, 'rerouted', ?)
                `, [reqId, req.user.id, `Rerouted to ${targetUser.full_name} (${targetUser.role}). Reason: ${reason}`]);

                logSecurity('requisition_rerouted', {
                    requisition_id: reqId,
                    admin_id: req.user.id,
                    to_user_id,
                    to_user_name: targetUser.full_name,
                    reason,
                    new_status
                });

                res.json({
                    success: true,
                    message: `Requisition rerouted to ${targetUser.full_name}`,
                    target_user: targetUser
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// ============================================
// FX RATES, BUDGET MANAGEMENT & REPORTING
// ============================================

// Load FX rates, budget management, and reporting routes
const setupFXAndBudgetRoutes = require('./routes/fxRatesAndBudgets');
setupFXAndBudgetRoutes(app, db, authenticate, authorize);

const setupQuotesAndAdjudications = require('./routes/quotesAndAdjudications');
setupQuotesAndAdjudications(app, db, authenticate, authorize);

// ============================================
// FORMS ROUTES (Expense Claims & EFT)
// ============================================
const formsRouter = require('./routes/forms');
app.use('/api/forms', formsRouter);

// ============================================
// STORES ROUTES (Issue Slips & Picking Slips)
// ============================================
const storesRouter = require('./routes/stores');
app.use('/api/stores', storesRouter);

// ============================================
// SEARCH ROUTES (Global Search) - Disabled (route file not available)
// ============================================
// const searchRouter = require('./routes/search');
// app.use('/api', searchRouter);

// 404 handler - must be after all routes
app.use(notFound);

// Error handler - must be last
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    const hostname = os.hostname();

    console.log(`\n🚀 Server running successfully!`);
    console.log(`\n📍 Access the application:`);
    console.log(`   Local:           http://localhost:${PORT}`);
    console.log(`   Network (Name):  http://${hostname}:${PORT}`);

    // Show IP addresses
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`   Network (IP):    http://${iface.address}:${PORT}`);
            }
        }
    }

    console.log(`\n📊 API endpoints: http://localhost:${PORT}/api`);
    console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
    // console.log(`\nDefault login credentials:`);
    // console.log(`  Initiator: john.banda / password123`);
    // console.log(`  HOD: mary.mwanza / password123`);
    // console.log(`  Procurement: james.phiri / password123`);
    // console.log(`  Finance: sarah.banda / password123`);
    // console.log(`  MD: david.mulenga / password123`);
    // console.log(`  Admin: admin / admin123`);
    // console.log(`\n⚠️  IMPORTANT: Run 'node scripts/hashPasswords.js' to hash existing passwords!\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});