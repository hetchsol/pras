const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const authenticateToken = authenticate;

// Use the same database as the main app
const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

// Ensure tables exist
const createStoresTables = () => {
  // Issue Slips table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS issue_slips (
      id TEXT PRIMARY KEY,
      slip_number TEXT UNIQUE,
      issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      issued_to TEXT NOT NULL,
      department TEXT,
      delivery_location TEXT,
      delivery_date DATETIME,
      delivered_by TEXT,
      reference_number TEXT,
      customer TEXT,
      remarks TEXT,
      initiator_id INTEGER NOT NULL,
      initiator_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_hod',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (initiator_id) REFERENCES users(id)
    )
  `).run();

  // Issue Slip Items table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS issue_slip_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slip_id TEXT NOT NULL,
      item_code TEXT,
      item_name TEXT NOT NULL,
      description TEXT,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'pcs',
      FOREIGN KEY (slip_id) REFERENCES issue_slips(id) ON DELETE CASCADE
    )
  `).run();

  // Picking Slips table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS picking_slips (
      id TEXT PRIMARY KEY,
      slip_number TEXT UNIQUE,
      pick_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      picked_by TEXT NOT NULL,
      destination TEXT NOT NULL,
      department TEXT,
      reference_number TEXT,
      customer TEXT,
      remarks TEXT,
      initiator_id INTEGER NOT NULL,
      initiator_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (initiator_id) REFERENCES users(id)
    )
  `).run();

  // Picking Slip Items table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS picking_slip_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slip_id TEXT NOT NULL,
      item_code TEXT,
      item_name TEXT NOT NULL,
      description TEXT,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'pcs',
      FOREIGN KEY (slip_id) REFERENCES picking_slips(id) ON DELETE CASCADE
    )
  `).run();
};

// Initialize tables
createStoresTables();

// Add customer column to existing tables if not present
try {
  db.prepare(`ALTER TABLE issue_slips ADD COLUMN customer TEXT`).run();
} catch (e) { /* column already exists */ }
try {
  db.prepare(`ALTER TABLE picking_slips ADD COLUMN customer TEXT`).run();
} catch (e) { /* column already exists */ }

// ============================================
// ISSUE SLIPS ROUTES
// ============================================

// Get all issue slips (filtered by user role)
router.get('/issue-slips', authenticateToken, (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    const userDepartment = req.user.department;
    const isHod = req.user.is_hod;

    let query;
    let params = [];

    if (userRole === 'admin' || userRole === 'finance' || userRole === 'finance_manager' || userRole === 'md') {
      // Admin, Finance, MD can see all issue slips
      query = `
        SELECT iss.*,
               u.full_name as initiator_full_name,
               u.department as initiator_department
        FROM issue_slips iss
        LEFT JOIN users u ON iss.initiator_id = u.id
        ORDER BY iss.created_at DESC
      `;
    } else if (isHod || userRole === 'hod') {
      // HODs can see issue slips from their department or pending their approval
      query = `
        SELECT iss.*,
               u.full_name as initiator_full_name,
               u.department as initiator_department
        FROM issue_slips iss
        LEFT JOIN users u ON iss.initiator_id = u.id
        WHERE iss.department = ? OR iss.status = 'pending_hod'
        ORDER BY iss.created_at DESC
      `;
      params = [userDepartment];
    } else {
      // Regular users can only see their own issue slips
      query = `
        SELECT iss.*,
               u.full_name as initiator_full_name,
               u.department as initiator_department
        FROM issue_slips iss
        LEFT JOIN users u ON iss.initiator_id = u.id
        WHERE iss.initiator_id = ?
        ORDER BY iss.created_at DESC
      `;
      params = [userId];
    }

    const result = db.prepare(query).all(...params);
    res.json(result);
  } catch (error) {
    console.error('Error fetching issue slips:', error);
    res.status(500).json({ error: 'Failed to fetch issue slips' });
  }
});

// Get single issue slip with items and approvals
router.get('/issue-slips/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Get slip details
    const slip = db.prepare(`
      SELECT iss.*,
             u.full_name as initiator_full_name,
             u.department as initiator_department
      FROM issue_slips iss
      LEFT JOIN users u ON iss.initiator_id = u.id
      WHERE iss.id = ?
    `).get(id);

    if (!slip) {
      return res.status(404).json({ error: 'Issue slip not found' });
    }

    // Get slip items
    const items = db.prepare(`
      SELECT * FROM issue_slip_items
      WHERE slip_id = ?
      ORDER BY id
    `).all(id);

    slip.items = items;

    // Get approval history
    const approvals = db.prepare(`
      SELECT * FROM form_approvals
      WHERE form_id = ? AND form_type = 'issue_slip'
      ORDER BY timestamp DESC
    `).all(id);

    slip.approvals = approvals;

    res.json(slip);
  } catch (error) {
    console.error('Error fetching issue slip:', error);
    res.status(500).json({ error: 'Failed to fetch issue slip' });
  }
});

// Create new issue slip
router.post('/issue-slips', authenticateToken, (req, res) => {
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

    // Generate unique ID (format: KSB-ISS-YYYYMMDDHHMMSS)
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const slipId = `KSB-ISS-${timestamp}`;

    // Insert issue slip
    const insertSlip = db.prepare(`
      INSERT INTO issue_slips (
        id, issued_to, department, delivery_location,
        delivery_date, delivered_by, reference_number, customer, remarks,
        initiator_id, initiator_name, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    insertSlip.run(
      slipId, issued_to, department || req.user.department, delivery_location,
      delivery_date || null, delivered_by, reference_number, customer || null, remarks,
      userId, userName, 'pending_hod'
    );

    // Insert slip items
    const insertItem = db.prepare(`
      INSERT INTO issue_slip_items (
        slip_id, item_code, item_name, description, quantity, unit
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    if (items && items.length > 0) {
      for (const item of items) {
        insertItem.run(slipId, item.item_code || '', item.item_name, item.description || '', item.quantity, item.unit || 'pcs');
      }
    }

    // Create initial approval record for HOD
    db.prepare(`
      INSERT INTO form_approvals (
        form_id, form_type, role, user_name, action, timestamp
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(slipId, 'issue_slip', 'hod', '', 'pending');

    // Return the created slip
    const createdSlip = db.prepare('SELECT * FROM issue_slips WHERE id = ?').get(slipId);

    res.status(201).json({
      message: 'Issue slip created successfully',
      slip: createdSlip
    });
  } catch (error) {
    console.error('Error creating issue slip:', error);
    res.status(500).json({ error: 'Failed to create issue slip' });
  }
});

// HOD action on issue slip
router.put('/issue-slips/:id/hod-action', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userName = req.user.full_name || req.user.name;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Update slip status
    const newStatus = action === 'approved' ? 'pending_finance' : 'rejected';
    db.prepare(`
      UPDATE issue_slips SET status = ? WHERE id = ?
    `).run(newStatus, id);

    // Update approval record
    db.prepare(`
      UPDATE form_approvals
      SET user_name = ?, action = ?, comment = ?, timestamp = datetime('now')
      WHERE form_id = ? AND form_type = 'issue_slip' AND role = 'hod'
    `).run(userName, action, comments || '', id);

    // If approved, create Finance approval record
    if (action === 'approved') {
      db.prepare(`
        INSERT INTO form_approvals (
          form_id, form_type, role, user_name, action, timestamp
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(id, 'issue_slip', 'finance', '', 'pending');
    }

    res.json({ message: `Issue slip ${action} by HOD successfully` });
  } catch (error) {
    console.error('Error processing HOD action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  }
});

// Finance action on issue slip
router.put('/issue-slips/:id/finance-action', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userName = req.user.full_name || req.user.name;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Update slip status
    const newStatus = action === 'approved' ? 'approved' : 'rejected';
    db.prepare(`
      UPDATE issue_slips SET status = ? WHERE id = ?
    `).run(newStatus, id);

    // Update approval record
    db.prepare(`
      UPDATE form_approvals
      SET user_name = ?, action = ?, comment = ?, timestamp = datetime('now')
      WHERE form_id = ? AND form_type = 'issue_slip' AND role = 'finance'
    `).run(userName, action, comments || '', id);

    res.json({ message: `Issue slip ${action} by Finance successfully` });
  } catch (error) {
    console.error('Error processing Finance action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  }
});

// Generate Issue Slip PDF
router.get('/issue-slips/:id/pdf', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Get slip details
    const slip = db.prepare(`
      SELECT iss.*,
             u.full_name as initiator_full_name,
             u.department as initiator_department
      FROM issue_slips iss
      LEFT JOIN users u ON iss.initiator_id = u.id
      WHERE iss.id = ?
    `).get(id);

    if (!slip) {
      return res.status(404).json({ error: 'Issue slip not found' });
    }

    // Get slip items
    const items = db.prepare(`
      SELECT * FROM issue_slip_items
      WHERE slip_id = ?
      ORDER BY id
    `).all(id);

    // Get approval history
    const approvals = db.prepare(`
      SELECT * FROM form_approvals
      WHERE form_id = ? AND form_type = 'issue_slip'
      ORDER BY timestamp ASC
    `).all(id);

    // Generate PDF
    const { generateIssueSlipPDF } = require('../utils/storesPDFGenerator');
    const outputPath = path.join(__dirname, '..', `${id}.pdf`);

    generateIssueSlipPDF(slip, items, approvals, outputPath)
      .then(() => {
        res.download(outputPath, `${id}.pdf`, (err) => {
          if (err) {
            console.error('Error sending PDF:', err);
          }
          // Clean up file after sending
          const fs = require('fs');
          try { fs.unlinkSync(outputPath); } catch(e) {}
        });
      })
      .catch(error => {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
      });
  } catch (error) {
    console.error('Error generating issue slip PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ============================================
// PICKING SLIPS ROUTES
// ============================================

// Get all picking slips (filtered by user role)
router.get('/picking-slips', authenticateToken, (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    let query;
    let params = [];

    if (userRole === 'admin' || userRole === 'finance' || userRole === 'finance_manager' || userRole === 'md' || userRole === 'hod') {
      // Admin, Finance, MD, HOD can see all picking slips
      query = `
        SELECT ps.*,
               u.full_name as initiator_full_name,
               u.department as initiator_department
        FROM picking_slips ps
        LEFT JOIN users u ON ps.initiator_id = u.id
        ORDER BY ps.created_at DESC
      `;
    } else {
      // Regular users can only see their own picking slips
      query = `
        SELECT ps.*,
               u.full_name as initiator_full_name,
               u.department as initiator_department
        FROM picking_slips ps
        LEFT JOIN users u ON ps.initiator_id = u.id
        WHERE ps.initiator_id = ?
        ORDER BY ps.created_at DESC
      `;
      params = [userId];
    }

    const result = db.prepare(query).all(...params);
    res.json(result);
  } catch (error) {
    console.error('Error fetching picking slips:', error);
    res.status(500).json({ error: 'Failed to fetch picking slips' });
  }
});

// Get single picking slip with items
router.get('/picking-slips/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Get slip details
    const slip = db.prepare(`
      SELECT ps.*,
             u.full_name as initiator_full_name,
             u.department as initiator_department
      FROM picking_slips ps
      LEFT JOIN users u ON ps.initiator_id = u.id
      WHERE ps.id = ?
    `).get(id);

    if (!slip) {
      return res.status(404).json({ error: 'Picking slip not found' });
    }

    // Get slip items
    const items = db.prepare(`
      SELECT * FROM picking_slip_items
      WHERE slip_id = ?
      ORDER BY id
    `).all(id);

    slip.items = items;

    res.json(slip);
  } catch (error) {
    console.error('Error fetching picking slip:', error);
    res.status(500).json({ error: 'Failed to fetch picking slip' });
  }
});

// Create new picking slip
router.post('/picking-slips', authenticateToken, (req, res) => {
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

    // Generate unique ID (format: KSB-PKS-YYYYMMDDHHMMSS)
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const slipId = `KSB-PKS-${timestamp}`;

    // Insert picking slip
    db.prepare(`
      INSERT INTO picking_slips (
        id, picked_by, destination, department,
        reference_number, customer, remarks,
        initiator_id, initiator_name, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      slipId, picked_by, destination, department || req.user.department,
      reference_number, customer || null, remarks,
      userId, userName, 'completed'
    );

    // Insert slip items
    const insertItem = db.prepare(`
      INSERT INTO picking_slip_items (
        slip_id, item_code, item_name, description, quantity, unit
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    if (items && items.length > 0) {
      for (const item of items) {
        insertItem.run(slipId, item.item_code || '', item.item_name, item.description || '', item.quantity, item.unit || 'pcs');
      }
    }

    // Return the created slip
    const createdSlip = db.prepare('SELECT * FROM picking_slips WHERE id = ?').get(slipId);

    res.status(201).json({
      message: 'Picking slip created successfully',
      slip: createdSlip
    });
  } catch (error) {
    console.error('Error creating picking slip:', error);
    res.status(500).json({ error: 'Failed to create picking slip' });
  }
});

// Generate Picking Slip PDF
router.get('/picking-slips/:id/pdf', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Get slip details
    const slip = db.prepare(`
      SELECT ps.*,
             u.full_name as initiator_full_name,
             u.department as initiator_department
      FROM picking_slips ps
      LEFT JOIN users u ON ps.initiator_id = u.id
      WHERE ps.id = ?
    `).get(id);

    if (!slip) {
      return res.status(404).json({ error: 'Picking slip not found' });
    }

    // Get slip items
    const items = db.prepare(`
      SELECT * FROM picking_slip_items
      WHERE slip_id = ?
      ORDER BY id
    `).all(id);

    // Generate PDF
    const { generatePickingSlipPDF } = require('../utils/storesPDFGenerator');
    const outputPath = path.join(__dirname, '..', `${id}.pdf`);

    generatePickingSlipPDF(slip, items, outputPath)
      .then(() => {
        res.download(outputPath, `${id}.pdf`, (err) => {
          if (err) {
            console.error('Error sending PDF:', err);
          }
          // Clean up file after sending
          const fs = require('fs');
          try { fs.unlinkSync(outputPath); } catch(e) {}
        });
      })
      .catch(error => {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
      });
  } catch (error) {
    console.error('Error generating picking slip PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
