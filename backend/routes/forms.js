const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authenticate } = require('../middleware/auth');
const authenticateToken = authenticate;

// ============================================
// EXPENSE CLAIMS ROUTES
// ============================================

// Get all expense claims (filtered by user role)
router.get('/expense-claims', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    let query;
    let params = [];

    if (userRole === 'admin' || userRole === 'finance_manager' || userRole === 'md') {
      // Admins, Finance Managers, and MD can see all claims
      query = `
        SELECT ec.*,
               u.full_name as initiator_full_name,
               u.department as initiator_department
        FROM expense_claims ec
        LEFT JOIN users u ON ec.initiator_id = u.id
        ORDER BY ec.created_at DESC
      `;
    } else {
      // Regular users can only see their own claims
      query = `
        SELECT ec.*,
               u.full_name as initiator_full_name,
               u.department as initiator_department
        FROM expense_claims ec
        LEFT JOIN users u ON ec.initiator_id = u.id
        WHERE ec.initiator_id = $1
        ORDER BY ec.created_at DESC
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expense claims:', error);
    res.status(500).json({ error: 'Failed to fetch expense claims' });
  }
});

// Get single expense claim with items
router.get('/expense-claims/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get claim details
    const claimResult = await pool.query(
      `SELECT ec.*,
              u.full_name as initiator_full_name,
              u.department as initiator_department
       FROM expense_claims ec
       LEFT JOIN users u ON ec.initiator_id = u.id
       WHERE ec.id = $1`,
      [id]
    );

    if (claimResult.rows.length === 0) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    const claim = claimResult.rows[0];

    // Get claim items
    const itemsResult = await pool.query(
      `SELECT * FROM expense_claim_items
       WHERE claim_id = $1
       ORDER BY report_no`,
      [id]
    );

    claim.items = itemsResult.rows;

    // Get approval history
    const approvalsResult = await pool.query(
      `SELECT * FROM form_approvals
       WHERE form_id = $1 AND form_type = 'expense_claim'
       ORDER BY created_at DESC`,
      [id]
    );

    claim.approvals = approvalsResult.rows;

    res.json(claim);
  } catch (error) {
    console.error('Error fetching expense claim:', error);
    res.status(500).json({ error: 'Failed to fetch expense claim' });
  }
});

// Create new expense claim
router.post('/expense-claims', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      employee_name,
      employee_number,
      department,
      reason_for_trip,
      total_kilometers,
      km_rate,
      sub_total,
      total_travel,
      total_claim,
      amount_advanced,
      amount_due,
      items
    } = req.body;

    const userId = req.user.id;
    const userName = req.user.full_name;

    // Generate unique ID (format: KSB-EXP-YYYYMMDDHHMMSS)
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const claimId = `KSB-EXP-${timestamp}`;

    // Insert expense claim
    const claimResult = await client.query(
      `INSERT INTO expense_claims (
        id, employee_name, employee_number, department,
        reason_for_trip, total_kilometers, km_rate,
        sub_total, total_travel, total_claim,
        amount_advanced, amount_due,
        initiator_id, initiator_name, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        claimId, employee_name, employee_number, department,
        reason_for_trip, total_kilometers || 0, km_rate || 0,
        sub_total || 0, total_travel || 0, total_claim || 0,
        amount_advanced || 0, amount_due || 0,
        userId, userName, 'pending_finance'
      ]
    );

    // Insert claim items
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO expense_claim_items (
            claim_id, report_no, date, details,
            km, breakfast, lunch, dinner,
            meals, accommodation, sundries_phone, total_zmw
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            claimId,
            item.report_no,
            item.date,
            item.details,
            item.km || 0,
            item.breakfast || 0,
            item.lunch || 0,
            item.dinner || 0,
            item.meals || 0,
            item.accommodation || 0,
            item.sundries_phone || 0,
            item.total_zmw || 0
          ]
        );
      }
    }

    // Create initial approval record
    await client.query(
      `INSERT INTO form_approvals (
        form_id, form_type, approver_role, created_at
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [claimId, 'expense_claim', 'finance_manager']
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Expense claim created successfully',
      claim: claimResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating expense claim:', error);
    res.status(500).json({ error: 'Failed to create expense claim' });
  } finally {
    client.release();
  }
});

// Finance Manager action on expense claim
router.put('/expense-claims/:id/finance-action', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userId = req.user.id;
    const userName = req.user.full_name;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await client.query('BEGIN');

    // Update claim status
    const newStatus = action === 'approved' ? 'pending_md' : 'rejected';
    await client.query(
      `UPDATE expense_claims
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newStatus, id]
    );

    // Record approval action
    await client.query(
      `UPDATE form_approvals
       SET approver_id = $1, approver_name = $2, action = $3, comments = $4, created_at = CURRENT_TIMESTAMP
       WHERE form_id = $5 AND form_type = 'expense_claim' AND approver_role = 'finance_manager'`,
      [userId, userName, action, comments, id]
    );

    // If approved, create MD approval record
    if (action === 'approved') {
      await client.query(
        `INSERT INTO form_approvals (
          form_id, form_type, approver_role, created_at
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [id, 'expense_claim', 'md']
      );
    }

    await client.query('COMMIT');

    res.json({ message: `Expense claim ${action} successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing finance action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  } finally {
    client.release();
  }
});

// MD action on expense claim
router.put('/expense-claims/:id/md-action', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userId = req.user.id;
    const userName = req.user.full_name;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await client.query('BEGIN');

    // Update claim status
    const newStatus = action === 'approved' ? 'approved' : 'rejected';
    await client.query(
      `UPDATE expense_claims
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newStatus, id]
    );

    // Record MD approval action
    await client.query(
      `UPDATE form_approvals
       SET approver_id = $1, approver_name = $2, action = $3, comments = $4, created_at = CURRENT_TIMESTAMP
       WHERE form_id = $5 AND form_type = 'expense_claim' AND approver_role = 'md'`,
      [userId, userName, action, comments, id]
    );

    await client.query('COMMIT');

    res.json({ message: `Expense claim ${action} successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing MD action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  } finally {
    client.release();
  }
});

// ============================================
// EFT REQUISITIONS ROUTES
// ============================================

// Get all EFT requisitions (filtered by user role)
router.get('/eft-requisitions', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    let query;
    let params = [];

    if (userRole === 'admin' || userRole === 'finance_manager' || userRole === 'md') {
      query = `
        SELECT eft.*,
               u.full_name as initiator_full_name,
               u.department as initiator_department
        FROM eft_requisitions eft
        LEFT JOIN users u ON eft.initiator_id = u.id
        ORDER BY eft.created_at DESC
      `;
    } else {
      query = `
        SELECT eft.*,
               u.full_name as initiator_full_name,
               u.department as initiator_department
        FROM eft_requisitions eft
        LEFT JOIN users u ON eft.initiator_id = u.id
        WHERE eft.initiator_id = $1
        ORDER BY eft.created_at DESC
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching EFT requisitions:', error);
    res.status(500).json({ error: 'Failed to fetch EFT requisitions' });
  }
});

// Get single EFT requisition
router.get('/eft-requisitions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const eftResult = await pool.query(
      `SELECT eft.*,
              u.full_name as initiator_full_name,
              u.department as initiator_department
       FROM eft_requisitions eft
       LEFT JOIN users u ON eft.initiator_id = u.id
       WHERE eft.id = $1`,
      [id]
    );

    if (eftResult.rows.length === 0) {
      return res.status(404).json({ error: 'EFT requisition not found' });
    }

    const eft = eftResult.rows[0];

    // Get approval history
    const approvalsResult = await pool.query(
      `SELECT * FROM form_approvals
       WHERE form_id = $1 AND form_type = 'eft'
       ORDER BY created_at DESC`,
      [id]
    );

    eft.approvals = approvalsResult.rows;

    res.json(eft);
  } catch (error) {
    console.error('Error fetching EFT requisition:', error);
    res.status(500).json({ error: 'Failed to fetch EFT requisition' });
  }
});

// Create new EFT requisition
router.post('/eft-requisitions', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      eft_chq_number,
      amount,
      amount_in_words,
      in_favour_of,
      bank_account_number,
      bank_name,
      branch,
      purpose,
      account_code,
      description
    } = req.body;

    const userId = req.user.id;
    const userName = req.user.full_name;

    // Generate unique ID (format: KSB-EFT-YYYYMMDDHHMMSS)
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const eftId = `KSB-EFT-${timestamp}`;

    // Insert EFT requisition
    const eftResult = await client.query(
      `INSERT INTO eft_requisitions (
        id, eft_chq_number, amount, amount_in_words,
        in_favour_of, bank_account_number, bank_name, branch,
        purpose, account_code, description,
        initiator_id, initiator_name, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        eftId, eft_chq_number, amount, amount_in_words,
        in_favour_of, bank_account_number, bank_name, branch,
        purpose, account_code, description,
        userId, userName, 'pending_finance'
      ]
    );

    // Create initial approval record
    await client.query(
      `INSERT INTO form_approvals (
        form_id, form_type, approver_role, created_at
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [eftId, 'eft', 'finance_manager']
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'EFT requisition created successfully',
      eft: eftResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating EFT requisition:', error);
    res.status(500).json({ error: 'Failed to create EFT requisition' });
  } finally {
    client.release();
  }
});

// Finance Manager action on EFT requisition
router.put('/eft-requisitions/:id/finance-action', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userId = req.user.id;
    const userName = req.user.full_name;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await client.query('BEGIN');

    const newStatus = action === 'approved' ? 'pending_md' : 'rejected';
    await client.query(
      `UPDATE eft_requisitions
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newStatus, id]
    );

    await client.query(
      `UPDATE form_approvals
       SET approver_id = $1, approver_name = $2, action = $3, comments = $4, created_at = CURRENT_TIMESTAMP
       WHERE form_id = $5 AND form_type = 'eft' AND approver_role = 'finance_manager'`,
      [userId, userName, action, comments, id]
    );

    if (action === 'approved') {
      await client.query(
        `INSERT INTO form_approvals (
          form_id, form_type, approver_role, created_at
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [id, 'eft', 'md']
      );
    }

    await client.query('COMMIT');

    res.json({ message: `EFT requisition ${action} successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing finance action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  } finally {
    client.release();
  }
});

// MD action on EFT requisition
router.put('/eft-requisitions/:id/md-action', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userId = req.user.id;
    const userName = req.user.full_name;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await client.query('BEGIN');

    const newStatus = action === 'approved' ? 'approved' : 'rejected';
    await client.query(
      `UPDATE eft_requisitions
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newStatus, id]
    );

    await client.query(
      `UPDATE form_approvals
       SET approver_id = $1, approver_name = $2, action = $3, comments = $4, created_at = CURRENT_TIMESTAMP
       WHERE form_id = $5 AND form_type = 'eft' AND approver_role = 'md'`,
      [userId, userName, action, comments, id]
    );

    await client.query('COMMIT');

    res.json({ message: `EFT requisition ${action} successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing MD action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  } finally {
    client.release();
  }
});

// ============================================
// PETTY CASH REQUISITIONS ROUTES
// ============================================

// Get all petty cash requisitions (filtered by user role)
router.get('/petty-cash-requisitions', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    let query;
    let params = [];

    if (userRole === 'admin' || userRole === 'finance_manager' || userRole === 'md') {
      query = `
        SELECT pc.*,
               u.full_name as initiator_full_name,
               u.department as initiator_department
        FROM petty_cash_requisitions pc
        LEFT JOIN users u ON pc.initiator_id = u.id
        ORDER BY pc.created_at DESC
      `;
    } else {
      query = `
        SELECT pc.*,
               u.full_name as initiator_full_name,
               u.department as initiator_department
        FROM petty_cash_requisitions pc
        LEFT JOIN users u ON pc.initiator_id = u.id
        WHERE pc.initiator_id = $1
        ORDER BY pc.created_at DESC
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching petty cash requisitions:', error);
    res.status(500).json({ error: 'Failed to fetch petty cash requisitions' });
  }
});

// Get single petty cash requisition with items
router.get('/petty-cash-requisitions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const pcResult = await pool.query(
      `SELECT pc.*,
              u.full_name as initiator_full_name,
              u.department as initiator_department
       FROM petty_cash_requisitions pc
       LEFT JOIN users u ON pc.initiator_id = u.id
       WHERE pc.id = $1`,
      [id]
    );

    if (pcResult.rows.length === 0) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    const pc = pcResult.rows[0];

    // Get petty cash items
    const itemsResult = await pool.query(
      `SELECT * FROM petty_cash_items
       WHERE requisition_id = $1
       ORDER BY item_no`,
      [id]
    );

    pc.items = itemsResult.rows;

    // Get approval history
    const approvalsResult = await pool.query(
      `SELECT * FROM form_approvals
       WHERE form_id = $1 AND form_type = 'petty_cash'
       ORDER BY created_at DESC`,
      [id]
    );

    pc.approvals = approvalsResult.rows;

    res.json(pc);
  } catch (error) {
    console.error('Error fetching petty cash requisition:', error);
    res.status(500).json({ error: 'Failed to fetch petty cash requisition' });
  }
});

// Create new petty cash requisition
router.post('/petty-cash-requisitions', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      amount,
      amount_in_words,
      payee_name,
      purpose,
      description,
      department,
      items
    } = req.body;

    const userId = req.user.id;
    const userName = req.user.full_name;

    // Generate unique ID (format: KSB-PC-YYYYMMDDHHMMSS)
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const pcId = `KSB-PC-${timestamp}`;

    // Insert petty cash requisition
    const pcResult = await client.query(
      `INSERT INTO petty_cash_requisitions (
        id, amount, amount_in_words, payee_name,
        purpose, description, department,
        initiator_id, initiator_name, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        pcId, amount, amount_in_words, payee_name,
        purpose, description, department,
        userId, userName, 'pending_finance'
      ]
    );

    // Insert petty cash items
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO petty_cash_items (
            requisition_id, item_no, description, amount
          ) VALUES ($1, $2, $3, $4)`,
          [pcId, item.item_no, item.description, item.amount]
        );
      }
    }

    // Create initial approval record
    await client.query(
      `INSERT INTO form_approvals (
        form_id, form_type, approver_role, created_at
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [pcId, 'petty_cash', 'finance_manager']
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Petty cash requisition created successfully',
      requisition: pcResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating petty cash requisition:', error);
    res.status(500).json({ error: 'Failed to create petty cash requisition' });
  } finally {
    client.release();
  }
});

// Finance Manager action on petty cash requisition
router.put('/petty-cash-requisitions/:id/finance-action', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userId = req.user.id;
    const userName = req.user.full_name;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await client.query('BEGIN');

    const newStatus = action === 'approved' ? 'pending_md' : 'rejected';
    await client.query(
      `UPDATE petty_cash_requisitions
       SET status = $1
       WHERE id = $2`,
      [newStatus, id]
    );

    await client.query(
      `UPDATE form_approvals
       SET approver_id = $1, approver_name = $2, action = $3, comments = $4, created_at = CURRENT_TIMESTAMP
       WHERE form_id = $5 AND form_type = 'petty_cash' AND approver_role = 'finance_manager'`,
      [userId, userName, action, comments, id]
    );

    if (action === 'approved') {
      await client.query(
        `INSERT INTO form_approvals (
          form_id, form_type, approver_role, created_at
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [id, 'petty_cash', 'md']
      );
    }

    await client.query('COMMIT');

    res.json({ message: `Petty cash requisition ${action} successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing finance action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  } finally {
    client.release();
  }
});

// MD action on petty cash requisition
router.put('/petty-cash-requisitions/:id/md-action', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userId = req.user.id;
    const userName = req.user.full_name;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await client.query('BEGIN');

    const newStatus = action === 'approved' ? 'approved' : 'rejected';
    await client.query(
      `UPDATE petty_cash_requisitions
       SET status = $1
       WHERE id = $2`,
      [newStatus, id]
    );

    await client.query(
      `UPDATE form_approvals
       SET approver_id = $1, approver_name = $2, action = $3, comments = $4, created_at = CURRENT_TIMESTAMP
       WHERE form_id = $5 AND form_type = 'petty_cash' AND approver_role = 'md'`,
      [userId, userName, action, comments, id]
    );

    await client.query('COMMIT');

    res.json({ message: `Petty cash requisition ${action} successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing MD action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  } finally {
    client.release();
  }
});

// ============================================
// PDF GENERATION ROUTES
// ============================================

const path = require('path');
const {
  generateExpenseClaimPDF,
  generateEFTPDF,
  generatePettyCashPDF
} = require('../utils/formsPDFGenerator');

// Generate Expense Claim PDF
router.get('/expense-claims/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get claim details
    const claimResult = await pool.query(
      `SELECT ec.*,
              u.full_name as initiator_full_name,
              u.department as initiator_department
       FROM expense_claims ec
       LEFT JOIN users u ON ec.initiator_id = u.id
       WHERE ec.id = $1`,
      [id]
    );

    if (claimResult.rows.length === 0) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    const claim = claimResult.rows[0];

    // Get claim items
    const itemsResult = await pool.query(
      `SELECT * FROM expense_claim_items
       WHERE claim_id = $1
       ORDER BY report_no`,
      [id]
    );

    // Get approval history
    const approvalsResult = await pool.query(
      `SELECT * FROM form_approvals
       WHERE form_id = $1 AND form_type = 'expense_claim'
       ORDER BY created_at DESC`,
      [id]
    );

    // Generate PDF
    const outputPath = path.join(__dirname, '..', `${id}.pdf`);
    await generateExpenseClaimPDF(claim, itemsResult.rows, approvalsResult.rows, outputPath);

    // Send PDF
    res.download(outputPath, `${id}.pdf`, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
      }
      // Clean up file after sending
      const fs = require('fs');
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error('Error generating expense claim PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Generate EFT PDF
router.get('/eft-requisitions/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const eftResult = await pool.query(
      `SELECT eft.*,
              u.full_name as initiator_full_name,
              u.department as initiator_department
       FROM eft_requisitions eft
       LEFT JOIN users u ON eft.initiator_id = u.id
       WHERE eft.id = $1`,
      [id]
    );

    if (eftResult.rows.length === 0) {
      return res.status(404).json({ error: 'EFT requisition not found' });
    }

    const eft = eftResult.rows[0];

    // Get approval history
    const approvalsResult = await pool.query(
      `SELECT * FROM form_approvals
       WHERE form_id = $1 AND form_type = 'eft'
       ORDER BY created_at DESC`,
      [id]
    );

    // Generate PDF
    const outputPath = path.join(__dirname, '..', `${id}.pdf`);
    await generateEFTPDF(eft, approvalsResult.rows, outputPath);

    // Send PDF
    res.download(outputPath, `${id}.pdf`, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
      }
      // Clean up file after sending
      const fs = require('fs');
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error('Error generating EFT PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Generate Petty Cash PDF
router.get('/petty-cash-requisitions/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const pcResult = await pool.query(
      `SELECT pc.*,
              u.full_name as initiator_full_name,
              u.department as initiator_department
       FROM petty_cash_requisitions pc
       LEFT JOIN users u ON pc.initiator_id = u.id
       WHERE pc.id = $1`,
      [id]
    );

    if (pcResult.rows.length === 0) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    const pc = pcResult.rows[0];

    // Get petty cash items
    const itemsResult = await pool.query(
      `SELECT * FROM petty_cash_items
       WHERE requisition_id = $1
       ORDER BY item_no`,
      [id]
    );

    // Get approval history
    const approvalsResult = await pool.query(
      `SELECT * FROM form_approvals
       WHERE form_id = $1 AND form_type = 'petty_cash'
       ORDER BY created_at DESC`,
      [id]
    );

    // Generate PDF
    const outputPath = path.join(__dirname, '..', `${id}.pdf`);
    await generatePettyCashPDF(pc, itemsResult.rows, approvalsResult.rows, outputPath);

    // Send PDF
    res.download(outputPath, `${id}.pdf`, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
      }
      // Clean up file after sending
      const fs = require('fs');
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error('Error generating petty cash PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
