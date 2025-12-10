const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getExpenseClaims,
  getExpenseClaimById,
  createExpenseClaim,
  updateExpenseClaimStatus,
  updateExpenseClaimTotals,
  getExpenseClaimItems,
  createExpenseClaimItem,
  updateExpenseClaimItem,
  deleteExpenseClaimItem,
  getEFTRequisitions,
  getEFTRequisitionById,
  createEFTRequisition,
  updateEFTRequisitionStatus,
  updateEFTRequisitionNumber,
  getPettyCashRequisitions,
  getPettyCashRequisitionById,
  createPettyCashRequisition,
  updatePettyCashRequisitionStatus,
  getPettyCashItems,
  createPettyCashItem,
  updatePettyCashItem,
  deletePettyCashItem,
  getFormApprovals,
  createFormApproval,
  getUserByUsername,
  getUserById,
  getRegionalExpenseApprovers,
  getRegionalApproverForDepartment,
  isRegionalExpenseApprover
} = require('../database');
const { logger } = require('../utils/logger');
const { generateExpenseClaimPDF, generateEFTRequisitionPDF, generatePettyCashRequisitionPDF } = require('../utils/formsPDFGenerator');

// Initialize database connection for checking HODs
const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

// Helper function to generate unique IDs
const generateFormId = (prefix) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `KSB-${prefix}-${year}${month}${day}${hours}${minutes}${seconds}`;
};

// ========================================
// EXPENSE CLAIM ROUTES
// ========================================

// Get all expense claims
router.get('/expense-claims', authenticate, (req, res, next) => {
  try {
    const claims = getExpenseClaims();
    const userRole = req.user.role;
    let filteredClaims = claims;

    if (userRole === 'initiator') {
      // Initiators see only their own claims
      filteredClaims = claims.filter(c => c.initiator_id === req.user.id);
    } else if (userRole === 'hod') {
      // HODs see claims from their department pending their approval + their own claims
      const userDepartment = req.user.department;
      filteredClaims = claims.filter(c =>
        c.initiator_id === req.user.id ||
        (c.department === userDepartment && c.status === 'pending_hod')
      );
    } else if (userRole === 'finance') {
      // Finance sees claims pending finance approval or all claims
      filteredClaims = claims;
    } else if (userRole === 'md') {
      // MD sees claims pending MD approval
      filteredClaims = claims.filter(c =>
        c.status === 'pending_md' || c.status === 'approved' || c.status === 'rejected'
      );
    } else if (userRole === 'admin') {
      // Admin sees all claims
      filteredClaims = claims;
    }

    res.json(filteredClaims);
  } catch (error) {
    logger.error('Error fetching expense claims:', error);
    next(error);
  }
});

// Get single expense claim by ID
router.get('/expense-claims/:id', authenticate, (req, res, next) => {
  try {
    const claim = getExpenseClaimById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    // Check permissions
    const userRole = req.user.role;
    if (userRole === 'initiator' && claim.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get line items
    const items = getExpenseClaimItems(req.params.id);

    // Get approvals
    const approvals = getFormApprovals('expense_claim', req.params.id);

    res.json({ ...claim, items, approvals });
  } catch (error) {
    logger.error('Error fetching expense claim:', error);
    next(error);
  }
});

// Create new expense claim
router.post('/expense-claims', authenticate, authorize('initiator', 'hod', 'finance', 'admin'), (req, res, next) => {
  try {
    const {
      employee_name,
      employee_number,
      department,
      reason_for_trip,
      amount_advanced,
      km_rate,
      items
    } = req.body;

    // Validate required fields
    if (!employee_name || !employee_number || !department || !reason_for_trip) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const claimId = generateFormId('EC');

    // Create the expense claim
    const claim = {
      id: claimId,
      employee_name,
      employee_number,
      department,
      reason_for_trip,
      amount_advanced: amount_advanced || 0,
      km_rate: km_rate || 0,
      total_kilometers: 0,
      sub_total: 0,
      total_travel: 0,
      total_claim: 0,
      amount_due: 0,
      initiator_id: req.user.id,
      initiator_name: req.user.name,
      status: 'draft'
    };

    createExpenseClaim(claim);

    // Create line items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      items.forEach((item, index) => {
        createExpenseClaimItem({
          claim_id: claimId,
          report_no: index + 1,
          date: item.date,
          details: item.details,
          km: item.km || 0,
          breakfast: item.breakfast || 0,
          lunch: item.lunch || 0,
          dinner: item.dinner || 0,
          meals: item.meals || 0,
          accommodation: item.accommodation || 0,
          sundries_phone: item.sundries_phone || 0,
          total_zmw: item.total_zmw || 0
        });
      });
    }

    logger.info(`Expense claim created: ${claimId} by ${req.user.name}`);
    res.status(201).json({ id: claimId, message: 'Expense claim created successfully' });
  } catch (error) {
    logger.error('Error creating expense claim:', error);
    next(error);
  }
});

// Add line item to expense claim
router.post('/expense-claims/:id/items', authenticate, authorize('initiator', 'hod', 'finance', 'admin'), (req, res, next) => {
  try {
    const claim = getExpenseClaimById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    // Check ownership
    if (req.user.role === 'initiator' && claim.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow editing draft claims
    if (claim.status !== 'draft') {
      return res.status(400).json({ error: 'Can only add items to draft claims' });
    }

    const items = getExpenseClaimItems(req.params.id);
    const newReportNo = items.length + 1;

    const result = createExpenseClaimItem({
      claim_id: req.params.id,
      report_no: newReportNo,
      ...req.body
    });

    res.status(201).json({ id: result.lastInsertRowid, message: 'Line item added successfully' });
  } catch (error) {
    logger.error('Error adding line item:', error);
    next(error);
  }
});

// Update line item
router.put('/expense-claims/:id/items/:itemId', authenticate, authorize('initiator', 'hod', 'finance', 'admin'), (req, res, next) => {
  try {
    const claim = getExpenseClaimById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    // Check ownership
    if (req.user.role === 'initiator' && claim.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow editing draft claims
    if (claim.status !== 'draft') {
      return res.status(400).json({ error: 'Can only edit items in draft claims' });
    }

    updateExpenseClaimItem(req.params.itemId, req.body);
    res.json({ message: 'Line item updated successfully' });
  } catch (error) {
    logger.error('Error updating line item:', error);
    next(error);
  }
});

// Delete line item
router.delete('/expense-claims/:id/items/:itemId', authenticate, authorize('initiator', 'hod', 'finance', 'admin'), (req, res, next) => {
  try {
    const claim = getExpenseClaimById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    // Check ownership
    if (req.user.role === 'initiator' && claim.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow editing draft claims
    if (claim.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete items from draft claims' });
    }

    deleteExpenseClaimItem(req.params.itemId);
    res.json({ message: 'Line item deleted successfully' });
  } catch (error) {
    logger.error('Error deleting line item:', error);
    next(error);
  }
});

// Submit expense claim (from draft to pending)
router.put('/expense-claims/:id/submit', authenticate, authorize('initiator', 'hod', 'finance', 'admin'), (req, res, next) => {
  try {
    const claim = getExpenseClaimById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    // Check ownership
    if ((req.user.role === 'initiator' || req.user.role === 'hod' || req.user.role === 'finance') && claim.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (claim.status !== 'draft') {
      return res.status(400).json({ error: 'Can only submit draft claims' });
    }

    // Calculate totals
    const items = getExpenseClaimItems(req.params.id);
    const totals = {
      total_kilometers: items.reduce((sum, item) => sum + (item.km || 0), 0),
      sub_total: items.reduce((sum, item) => sum + (item.total_zmw || 0), 0),
      total_travel: (items.reduce((sum, item) => sum + (item.km || 0), 0)) * (claim.km_rate || 0),
      total_claim: 0,
      amount_due: 0
    };

    totals.total_claim = totals.sub_total + totals.total_travel;
    totals.amount_due = totals.total_claim - (claim.amount_advanced || 0);

    // Update totals
    updateExpenseClaimTotals(req.params.id, totals);

    // Check if department has a HOD
    const departmentHOD = db.prepare('SELECT id FROM users WHERE role = ? AND department = ?').get('hod', claim.department);

    let newStatus;
    if (departmentHOD) {
      // Route to HOD if department has one
      newStatus = 'pending_hod';
      logger.info(`Expense claim submitted to HOD: ${req.params.id} by ${req.user.name} from ${claim.department}`);
    } else {
      // Skip HOD and route directly to Finance if no HOD
      newStatus = 'pending_finance';
      logger.info(`Expense claim submitted directly to Finance (no HOD): ${req.params.id} by ${req.user.name} from ${claim.department}`);
    }

    updateExpenseClaimStatus(req.params.id, newStatus);
    res.json({ message: 'Expense claim submitted successfully' });
  } catch (error) {
    logger.error('Error submitting expense claim:', error);
    next(error);
  }
});

// HOD approve/reject expense claim
router.put('/expense-claims/:id/hod-action', authenticate, authorize('hod', 'admin'), (req, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const claim = getExpenseClaimById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    if (claim.status !== 'pending_hod') {
      return res.status(400).json({ error: 'Claim is not pending HOD approval' });
    }

    //  Verify HOD is from the same department as the claim
    if (req.user.role === 'hod' && req.user.department !== claim.department) {
      return res.status(403).json({ error: 'You can only approve claims from your own department' });
    }

    const newStatus = action === 'approve' ? 'pending_finance' : 'rejected';
    updateExpenseClaimStatus(req.params.id, newStatus);

    // Record approval
    createFormApproval({
      form_type: 'expense_claim',
      form_id: req.params.id,
      approver_role: 'hod',
      approver_id: req.user.id,
      approver_name: req.user.name,
      action,
      comments: comment
    });

    logger.info(`Expense claim ${action}d by HOD: ${req.params.id} by ${req.user.name}`);
    res.json({ message: `Expense claim ${action}d successfully` });
  } catch (error) {
    logger.error('Error processing HOD action:', error);
    next(error);
  }
});

// Finance approve/reject expense claim
router.put('/expense-claims/:id/finance-action', authenticate, authorize('finance', 'admin'), (req, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const claim = getExpenseClaimById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    if (claim.status !== 'pending_finance') {
      return res.status(400).json({ error: 'Claim is not pending finance approval' });
    }

    const newStatus = action === 'approve' ? 'pending_md' : 'rejected';
    updateExpenseClaimStatus(req.params.id, newStatus);

    // Record approval
    createFormApproval({
      form_type: 'expense_claim',
      form_id: req.params.id,
      approver_role: 'finance',
      approver_id: req.user.id,
      approver_name: req.user.name,
      action,
      comments: comment
    });

    logger.info(`Expense claim ${action}d by Finance: ${req.params.id} by ${req.user.name}`);
    res.json({ message: `Expense claim ${action}d successfully` });
  } catch (error) {
    logger.error('Error processing finance action:', error);
    next(error);
  }
});

// MD approve/reject expense claim
router.put('/expense-claims/:id/md-action', authenticate, authorize('md', 'admin'), (req, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const claim = getExpenseClaimById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    // MD can approve claims that are regional_approved OR pending_md (for Finance Manager route)
    if (claim.status !== 'regional_approved' && claim.status !== 'pending_md') {
      return res.status(400).json({ error: 'Claim is not ready for MD approval' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    updateExpenseClaimStatus(req.params.id, newStatus);

    // Record approval
    createFormApproval({
      form_type: 'expense_claim',
      form_id: req.params.id,
      approver_role: 'md',
      approver_id: req.user.id,
      approver_name: req.user.name,
      action,
      comments: comment
    });

    logger.info(`Expense claim ${action}d by MD: ${req.params.id} by ${req.user.name}`);
    res.json({ message: `Expense claim ${action}d successfully` });
  } catch (error) {
    logger.error('Error processing MD action:', error);
    next(error);
  }
});

// Admin Override - Skip stage or reassign department for Expense Claims
router.put('/expense-claims/:id/admin-override', authenticate, authorize('admin'), (req, res, next) => {
  try {
    const reqId = req.params.id;
    const { action, new_status, new_department, comment } = req.body;

    if (!action || !['skip_stage', 'reassign_department'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be skip_stage or reassign_department' });
    }

    const claim = getExpenseClaimById(reqId);
    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    if (action === 'skip_stage') {
      if (!new_status || !comment) {
        return res.status(400).json({ error: 'new_status and comment are required for skip_stage' });
      }

      // Validate new_status is valid
      const validStatuses = ['pending_hod', 'pending_regional', 'regional_approved', 'pending_md', 'approved'];
      if (!validStatuses.includes(new_status)) {
        return res.status(400).json({ error: 'Invalid new_status' });
      }

      updateExpenseClaimStatus(reqId, new_status);

      // Log the admin override
      createFormApproval({
        form_type: 'expense_claim',
        form_id: reqId,
        approver_role: 'admin',
        approver_id: req.user.id,
        approver_name: req.user.name,
        action: 'skip_stage',
        comments: `Admin skipped stage to ${new_status}: ${comment}`
      });

      logger.info(`Admin override (skip_stage) on Expense Claim ${reqId} to ${new_status} by ${req.user.name}`);

      res.json({
        success: true,
        message: `Successfully moved to ${new_status}`,
        status: new_status
      });

    } else if (action === 'reassign_department') {
      if (!new_department) {
        return res.status(400).json({ error: 'new_department is required for reassign_department' });
      }

      // Update the department in expense_claims table
      const db = require('../database');
      db.run(`
        UPDATE expense_claims
        SET department = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [new_department, reqId], function(err) {
        if (err) {
          logger.error('Error reassigning Expense Claim department:', err);
          return res.status(500).json({ error: 'Failed to reassign department' });
        }

        // Log the admin override
        createFormApproval({
          form_type: 'expense_claim',
          form_id: reqId,
          approver_role: 'admin',
          approver_id: req.user.id,
          approver_name: req.user.name,
          action: 'reassign_department',
          comments: `Admin reassigned to department: ${new_department}`
        });

        logger.info(`Admin override (reassign_department) on Expense Claim ${reqId} to ${new_department} by ${req.user.name}`);

        res.json({
          success: true,
          message: `Successfully reassigned to ${new_department}`,
          department: new_department
        });
      });
    }
  } catch (error) {
    logger.error('Error in admin override for Expense Claim:', error);
    next(error);
  }
});

// ========================================
// EFT/CHEQUE REQUISITION ROUTES
// ========================================

// Get all EFT requisitions
router.get('/eft-requisitions', authenticate, (req, res, next) => {
  try {
    const requisitions = getEFTRequisitions();

    // Filter based on user role
    const userRole = req.user.role;
    let filteredRequisitions = requisitions;

    if (userRole === 'initiator') {
      // Initiators see only their own requisitions
      filteredRequisitions = requisitions.filter(r => r.initiator_id === req.user.id);
    } else if (userRole === 'hod') {
      // HODs see their own requisitions + requisitions from their department pending approval
      const userDepartment = req.user.department;
      filteredRequisitions = requisitions.filter(r =>
        r.initiator_id === req.user.id ||
        (r.department === userDepartment && r.status === 'pending_hod')
      );
    } else if (userRole === 'finance') {
      // Finance sees all requisitions
      filteredRequisitions = requisitions;
    } else if (userRole === 'md') {
      // MD sees only requisitions approved by finance
      filteredRequisitions = requisitions.filter(r =>
        r.status === 'finance_approved' || r.status === 'approved' || r.status === 'rejected'
      );
    } else if (userRole === 'admin') {
      // Admin sees all requisitions
      filteredRequisitions = requisitions;
    }

    res.json(filteredRequisitions);
  } catch (error) {
    logger.error('Error fetching EFT requisitions:', error);
    next(error);
  }
});

// Get single EFT requisition by ID
router.get('/eft-requisitions/:id', authenticate, (req, res, next) => {
  try {
    const requisition = getEFTRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'EFT requisition not found' });
    }

    // Check permissions
    const userRole = req.user.role;
    if (userRole === 'initiator' && requisition.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get approvals
    const approvals = getFormApprovals('eft_requisition', req.params.id);

    res.json({ ...requisition, approvals });
  } catch (error) {
    logger.error('Error fetching EFT requisition:', error);
    next(error);
  }
});

// Create new EFT requisition
router.post('/eft-requisitions', authenticate, authorize('initiator', 'admin'), (req, res, next) => {
  try {
    const {
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

    // Validate required fields
    if (!amount || !amount_in_words || !in_favour_of || !purpose) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user details from database to ensure we have the name
    const user = getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const eftId = generateFormId('EFT');

    // Check if department has a HOD (same logic as Petty Cash)
    const departmentHOD = db.prepare('SELECT id FROM users WHERE role = ? AND department = ?').get('hod', user.department);

    let status;
    if (departmentHOD) {
      // Route to HOD if department has one
      status = 'pending_hod';
    } else {
      // Skip HOD and route directly to Finance if no HOD
      status = 'pending_finance';
    }

    const requisition = {
      id: eftId,
      amount,
      amount_in_words,
      in_favour_of,
      bank_account_number: bank_account_number || null,
      bank_name: bank_name || null,
      branch: branch || null,
      purpose,
      account_code: account_code || null,
      description: description || null,
      initiator_id: user.id,
      initiator_name: user.name,
      status
    };

    createEFTRequisition(requisition);

    logger.info(`EFT requisition created: ${eftId} by ${user.name}`);
    res.status(201).json({ id: eftId, message: 'EFT requisition created successfully' });
  } catch (error) {
    logger.error('Error creating EFT requisition:', error);
    next(error);
  }
});

// HOD approve/reject EFT requisition
router.put('/eft-requisitions/:id/hod-action', authenticate, authorize('hod', 'admin'), (req, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const requisition = getEFTRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'EFT requisition not found' });
    }

    if (requisition.status !== 'pending_hod') {
      return res.status(400).json({ error: 'Requisition is not pending HOD approval' });
    }

    const newStatus = action === 'approve' ? 'pending_finance' : 'rejected';
    updateEFTRequisitionStatus(req.params.id, newStatus);

    // Record approval
    createFormApproval({
      form_type: 'eft',
      form_id: req.params.id,
      approver_role: 'hod',
      approver_id: req.user.id,
      approver_name: req.user.name,
      action,
      comments: comment
    });

    logger.info(`EFT requisition ${action}d by HOD: ${req.params.id} by ${req.user.name}`);
    res.json({ message: `EFT requisition ${action}d successfully` });
  } catch (error) {
    logger.error('Error processing HOD action:', error);
    next(error);
  }
});

// Finance approve/reject EFT requisition
router.put('/eft-requisitions/:id/finance-action', authenticate, authorize('finance', 'admin'), (req, res, next) => {
  try {
    const { action, comment, eft_chq_number } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const requisition = getEFTRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'EFT requisition not found' });
    }

    if (requisition.status !== 'pending_finance') {
      return res.status(400).json({ error: 'Requisition is not pending finance approval' });
    }

    const newStatus = action === 'approve' ? 'finance_approved' : 'rejected';
    updateEFTRequisitionStatus(req.params.id, newStatus);

    // Update EFT/CHQ number if provided
    if (action === 'approve' && eft_chq_number) {
      updateEFTRequisitionNumber(req.params.id, eft_chq_number);
    }

    // Record approval
    createFormApproval({
      form_type: 'eft',
      form_id: req.params.id,
      approver_role: 'finance',
      approver_id: req.user.id,
      approver_name: req.user.name,
      action,
      comments: comment
    });

    logger.info(`EFT requisition ${action}d by Finance: ${req.params.id} by ${req.user.name}`);
    res.json({ message: `EFT requisition ${action}d successfully` });
  } catch (error) {
    logger.error('Error processing finance action:', error);
    next(error);
  }
});

// MD approve/reject EFT requisition
router.put('/eft-requisitions/:id/md-action', authenticate, authorize('md', 'admin'), (req, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const requisition = getEFTRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'EFT requisition not found' });
    }

    if (requisition.status !== 'finance_approved') {
      return res.status(400).json({ error: 'Requisition is not approved by Finance yet' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    updateEFTRequisitionStatus(req.params.id, newStatus);

    // Record approval
    createFormApproval({
      form_type: 'eft',
      form_id: req.params.id,
      approver_role: 'md',
      approver_id: req.user.id,
      approver_name: req.user.name,
      action,
      comments: comment
    });

    logger.info(`EFT requisition ${action}d by MD: ${req.params.id} by ${req.user.name}`);
    res.json({ message: `EFT requisition ${action}d successfully` });
  } catch (error) {
    logger.error('Error processing MD action:', error);
    next(error);
  }
});

// Admin Override - Skip stage or reassign department for EFT Requisitions
router.put('/eft-requisitions/:id/admin-override', authenticate, authorize('admin'), (req, res, next) => {
  try {
    const reqId = req.params.id;
    const { action, new_status, new_department, comment } = req.body;

    if (!action || !['skip_stage', 'reassign_department'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be skip_stage or reassign_department' });
    }

    const requisition = getEFTRequisitionById(reqId);
    if (!requisition) {
      return res.status(404).json({ error: 'EFT requisition not found' });
    }

    if (action === 'skip_stage') {
      if (!new_status || !comment) {
        return res.status(400).json({ error: 'new_status and comment are required for skip_stage' });
      }

      // Validate new_status is valid
      const validStatuses = ['pending_hod', 'pending_finance', 'pending_md', 'approved'];
      if (!validStatuses.includes(new_status)) {
        return res.status(400).json({ error: 'Invalid new_status' });
      }

      updateEFTRequisitionStatus(reqId, new_status);

      // Log the admin override
      createFormApproval({
        form_type: 'eft',
        form_id: reqId,
        approver_role: 'admin',
        approver_id: req.user.id,
        approver_name: req.user.name,
        action: 'skip_stage',
        comments: `Admin skipped stage to ${new_status}: ${comment}`
      });

      logger.info(`Admin override (skip_stage) on EFT ${reqId} to ${new_status} by ${req.user.name}`);

      res.json({
        success: true,
        message: `Successfully moved to ${new_status}`,
        status: new_status
      });

    } else if (action === 'reassign_department') {
      if (!new_department) {
        return res.status(400).json({ error: 'new_department is required for reassign_department' });
      }

      // Update the department in eft_requisitions table
      const db = require('../database');
      db.run(`
        UPDATE eft_requisitions
        SET department = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [new_department, reqId], function(err) {
        if (err) {
          logger.error('Error reassigning EFT department:', err);
          return res.status(500).json({ error: 'Failed to reassign department' });
        }

        // Log the admin override
        createFormApproval({
          form_type: 'eft',
          form_id: reqId,
          approver_role: 'admin',
          approver_id: req.user.id,
          approver_name: req.user.name,
          action: 'reassign_department',
          comments: `Admin reassigned to department: ${new_department}`
        });

        logger.info(`Admin override (reassign_department) on EFT ${reqId} to ${new_department} by ${req.user.name}`);

        res.json({
          success: true,
          message: `Successfully reassigned to ${new_department}`,
          department: new_department
        });
      });
    }
  } catch (error) {
    logger.error('Error in admin override for EFT:', error);
    next(error);
  }
});

// ========================================
// PETTY CASH REQUISITION ROUTES
// ========================================

// Get all petty cash requisitions
router.get('/petty-cash-requisitions', authenticate, (req, res, next) => {
  try {
    const requisitions = getPettyCashRequisitions();
    const userRole = req.user.role;
    let filteredRequisitions = requisitions;

    console.log('🔍 PETTY CASH FILTER DEBUG:');
    console.log('   User:', req.user.username, '| ID:', req.user.id, '| Role:', userRole, '| Dept:', req.user.department);
    console.log('   Total requisitions:', requisitions.length);

    if (userRole === 'initiator') {
      // Initiators see only their own requisitions
      filteredRequisitions = requisitions.filter(r => r.initiator_id === req.user.id);
    } else if (userRole === 'hod') {
      // HODs see requisitions from their department pending HOD approval + their own
      const userDepartment = req.user.department;
      console.log('   Filtering for HOD | Dept:', userDepartment);
      requisitions.forEach(r => {
        console.log(`     Req ${r.id}: dept="${r.department}" status="${r.status}" initiator=${r.initiator_id}`);
        console.log(`       Match: ${r.initiator_id === req.user.id || (r.department === userDepartment && r.status === 'pending_hod')}`);
      });
      filteredRequisitions = requisitions.filter(r =>
        r.initiator_id === req.user.id ||
        (r.department === userDepartment && r.status === 'pending_hod')
      );
    } else if (userRole === 'finance') {
      // Finance sees all requisitions (for approval and management)
      filteredRequisitions = requisitions;
    } else if (userRole === 'md') {
      // MD sees requisitions pending MD approval
      filteredRequisitions = requisitions.filter(r =>
        r.status === 'pending_md' || r.status === 'approved' || r.status === 'rejected'
      );
    } else if (userRole === 'admin') {
      // Admin sees all requisitions
      filteredRequisitions = requisitions;
    }

    console.log('   Filtered count:', filteredRequisitions.length);
    console.log('');

    res.json(filteredRequisitions);
  } catch (error) {
    logger.error('Error fetching petty cash requisitions:', error);
    next(error);
  }
});

// Get single petty cash requisition by ID
router.get('/petty-cash-requisitions/:id', authenticate, (req, res, next) => {
  try {
    const requisition = getPettyCashRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    // Check permissions
    const userRole = req.user.role;
    if (userRole === 'initiator' && requisition.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get line items
    const items = getPettyCashItems(req.params.id);

    // Get approvals
    const approvals = getFormApprovals('petty_cash', req.params.id);

    res.json({ ...requisition, items, approvals });
  } catch (error) {
    logger.error('Error fetching petty cash requisition:', error);
    next(error);
  }
});

// Create new petty cash requisition
router.post('/petty-cash-requisitions', authenticate, authorize('initiator', 'hod', 'finance', 'admin'), (req, res, next) => {
  try {
    const {
      amount,
      amount_in_words,
      payee_name,
      purpose,
      description,
      items
    } = req.body;

    // Validate required fields
    if (!amount || !amount_in_words || !payee_name || !purpose) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user details
    const user = getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const requisitionId = generateFormId('PC');

    // Check if department has a HOD
    const departmentHOD = db.prepare('SELECT id FROM users WHERE role = ? AND department = ?').get('hod', user.department);

    let status;
    if (departmentHOD) {
      // Route to HOD if department has one
      status = 'pending_hod';
    } else {
      // Skip HOD and route directly to Finance if no HOD
      status = 'pending_finance';
    }

    const requisition = {
      id: requisitionId,
      amount,
      amount_in_words,
      payee_name,
      purpose,
      description: description || null,
      department: user.department,
      initiator_id: user.id,
      initiator_name: user.name,
      status
    };

    createPettyCashRequisition(requisition);

    // Create line items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      items.forEach((item, index) => {
        createPettyCashItem({
          requisition_id: requisitionId,
          item_no: index + 1,
          description: item.description,
          amount: item.amount
        });
      });
    }

    logger.info(`Petty cash requisition created: ${requisitionId} by ${user.name}`);
    res.status(201).json({ id: requisitionId, message: 'Petty cash requisition created successfully' });
  } catch (error) {
    logger.error('Error creating petty cash requisition:', error);
    next(error);
  }
});

// Add line item to petty cash requisition
router.post('/petty-cash-requisitions/:id/items', authenticate, authorize('initiator', 'hod', 'finance', 'admin'), (req, res, next) => {
  try {
    const requisition = getPettyCashRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    // Check ownership
    if (req.user.role === 'initiator' && requisition.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow editing pending requisitions
    if (!requisition.status.startsWith('pending')) {
      return res.status(400).json({ error: 'Can only add items to pending requisitions' });
    }

    const items = getPettyCashItems(req.params.id);
    const newItemNo = items.length + 1;

    const result = createPettyCashItem({
      requisition_id: req.params.id,
      item_no: newItemNo,
      ...req.body
    });

    res.status(201).json({ id: result.lastInsertRowid, message: 'Line item added successfully' });
  } catch (error) {
    logger.error('Error adding line item:', error);
    next(error);
  }
});

// Update line item
router.put('/petty-cash-requisitions/:id/items/:itemId', authenticate, authorize('initiator', 'hod', 'finance', 'admin'), (req, res, next) => {
  try {
    const requisition = getPettyCashRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    // Check ownership
    if (req.user.role === 'initiator' && requisition.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow editing pending requisitions
    if (!requisition.status.startsWith('pending')) {
      return res.status(400).json({ error: 'Can only edit items in pending requisitions' });
    }

    updatePettyCashItem(req.params.itemId, req.body);
    res.json({ message: 'Line item updated successfully' });
  } catch (error) {
    logger.error('Error updating line item:', error);
    next(error);
  }
});

// Delete line item
router.delete('/petty-cash-requisitions/:id/items/:itemId', authenticate, authorize('initiator', 'hod', 'finance', 'admin'), (req, res, next) => {
  try {
    const requisition = getPettyCashRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    // Check ownership
    if (req.user.role === 'initiator' && requisition.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow editing pending requisitions
    if (!requisition.status.startsWith('pending')) {
      return res.status(400).json({ error: 'Can only delete items from pending requisitions' });
    }

    deletePettyCashItem(req.params.itemId);
    res.json({ message: 'Line item deleted successfully' });
  } catch (error) {
    logger.error('Error deleting line item:', error);
    next(error);
  }
});

// HOD approve/reject petty cash requisition
router.put('/petty-cash-requisitions/:id/hod-action', authenticate, authorize('hod', 'admin'), (req, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const requisition = getPettyCashRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    if (requisition.status !== 'pending_hod') {
      return res.status(400).json({ error: 'Requisition is not pending HOD approval' });
    }

    // Verify HOD is from the same department
    if (req.user.role === 'hod' && req.user.department !== requisition.department) {
      return res.status(403).json({ error: 'You can only approve requisitions from your own department' });
    }

    const newStatus = action === 'approve' ? 'pending_finance' : 'rejected';
    updatePettyCashRequisitionStatus(req.params.id, newStatus);

    // Record approval
    createFormApproval({
      form_type: 'petty_cash',
      form_id: req.params.id,
      approver_role: 'hod',
      approver_id: req.user.id,
      approver_name: req.user.name,
      action,
      comments: comment
    });

    logger.info(`Petty cash requisition ${action}d by HOD: ${req.params.id} by ${req.user.name}`);
    res.json({ message: `Petty cash requisition ${action}d successfully` });
  } catch (error) {
    logger.error('Error processing HOD action:', error);
    next(error);
  }
});

// Finance approve/reject petty cash requisition
router.put('/petty-cash-requisitions/:id/finance-action', authenticate, authorize('finance', 'admin'), (req, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const requisition = getPettyCashRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    if (requisition.status !== 'pending_finance') {
      return res.status(400).json({ error: 'Requisition is not pending finance approval' });
    }

    const newStatus = action === 'approve' ? 'pending_md' : 'rejected';
    updatePettyCashRequisitionStatus(req.params.id, newStatus);

    // Record approval
    createFormApproval({
      form_type: 'petty_cash',
      form_id: req.params.id,
      approver_role: 'finance',
      approver_id: req.user.id,
      approver_name: req.user.name,
      action,
      comments: comment
    });

    logger.info(`Petty cash requisition ${action}d by Finance: ${req.params.id} by ${req.user.name}`);
    res.json({ message: `Petty cash requisition ${action}d successfully` });
  } catch (error) {
    logger.error('Error processing finance action:', error);
    next(error);
  }
});

// MD approve/reject petty cash requisition
router.put('/petty-cash-requisitions/:id/md-action', authenticate, authorize('md', 'admin'), (req, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const requisition = getPettyCashRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    if (requisition.status !== 'pending_md') {
      return res.status(400).json({ error: 'Requisition is not pending MD approval' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    updatePettyCashRequisitionStatus(req.params.id, newStatus);

    // Record approval
    createFormApproval({
      form_type: 'petty_cash',
      form_id: req.params.id,
      approver_role: 'md',
      approver_id: req.user.id,
      approver_name: req.user.name,
      action,
      comments: comment
    });

    logger.info(`Petty cash requisition ${action}d by MD: ${req.params.id} by ${req.user.name}`);
    res.json({ message: `Petty cash requisition ${action}d successfully` });
  } catch (error) {
    logger.error('Error processing MD action:', error);
    next(error);
  }
});

// Admin Override - Skip stage or reassign department for Petty Cash Requisitions
router.put('/petty-cash-requisitions/:id/admin-override', authenticate, authorize('admin'), (req, res, next) => {
  try {
    const reqId = req.params.id;
    const { action, new_status, new_department, comment } = req.body;

    if (!action || !['skip_stage', 'reassign_department'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be skip_stage or reassign_department' });
    }

    const requisition = getPettyCashRequisitionById(reqId);
    if (!requisition) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    if (action === 'skip_stage') {
      if (!new_status || !comment) {
        return res.status(400).json({ error: 'new_status and comment are required for skip_stage' });
      }

      // Validate new_status is valid
      const validStatuses = ['pending_hod', 'pending_finance', 'pending_md', 'approved'];
      if (!validStatuses.includes(new_status)) {
        return res.status(400).json({ error: 'Invalid new_status' });
      }

      updatePettyCashRequisitionStatus(reqId, new_status);

      // Log the admin override
      createFormApproval({
        form_type: 'petty_cash',
        form_id: reqId,
        approver_role: 'admin',
        approver_id: req.user.id,
        approver_name: req.user.name,
        action: 'skip_stage',
        comments: `Admin skipped stage to ${new_status}: ${comment}`
      });

      logger.info(`Admin override (skip_stage) on Petty Cash ${reqId} to ${new_status} by ${req.user.name}`);

      res.json({
        success: true,
        message: `Successfully moved to ${new_status}`,
        status: new_status
      });

    } else if (action === 'reassign_department') {
      if (!new_department) {
        return res.status(400).json({ error: 'new_department is required for reassign_department' });
      }

      // Update the department in petty_cash_requisitions table
      const db = require('../database');
      db.run(`
        UPDATE petty_cash_requisitions
        SET department = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [new_department, reqId], function(err) {
        if (err) {
          logger.error('Error reassigning Petty Cash department:', err);
          return res.status(500).json({ error: 'Failed to reassign department' });
        }

        // Log the admin override
        createFormApproval({
          form_type: 'petty_cash',
          form_id: reqId,
          approver_role: 'admin',
          approver_id: req.user.id,
          approver_name: req.user.name,
          action: 'reassign_department',
          comments: `Admin reassigned to department: ${new_department}`
        });

        logger.info(`Admin override (reassign_department) on Petty Cash ${reqId} to ${new_department} by ${req.user.name}`);

        res.json({
          success: true,
          message: `Successfully reassigned to ${new_department}`,
          department: new_department
        });
      });
    }
  } catch (error) {
    logger.error('Error in admin override for Petty Cash:', error);
    next(error);
  }
});

// ========================================
// PDF GENERATION ROUTES
// ========================================

// Generate PDF for expense claim
router.get('/expense-claims/:id/pdf', authenticate, (req, res, next) => {
  try {
    const claim = getExpenseClaimById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    // Check permissions
    const userRole = req.user.role;
    if (userRole === 'initiator' && claim.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get line items and approvals
    const items = getExpenseClaimItems(req.params.id);
    const approvals = getFormApprovals('expense_claim', req.params.id);

    // Generate PDF
    generateExpenseClaimPDF(claim, items, approvals, (error, pdfBuffer) => {
      if (error) {
        logger.error('Error generating expense claim PDF:', error);
        return next(error);
      }

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Expense_Claim_${claim.id}.pdf"`);
      res.send(pdfBuffer);
    });
  } catch (error) {
    logger.error('Error in expense claim PDF route:', error);
    next(error);
  }
});

// Generate PDF for EFT requisition
router.get('/eft-requisitions/:id/pdf', authenticate, (req, res, next) => {
  try {
    const requisition = getEFTRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'EFT requisition not found' });
    }

    // Check permissions
    const userRole = req.user.role;
    if (userRole === 'initiator' && requisition.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get approvals
    const approvals = getFormApprovals('eft_requisition', req.params.id);

    // Generate PDF
    generateEFTRequisitionPDF(requisition, approvals, (error, pdfBuffer) => {
      if (error) {
        logger.error('Error generating EFT requisition PDF:', error);
        return next(error);
      }

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="EFT_Requisition_${requisition.id}.pdf"`);
      res.send(pdfBuffer);
    });
  } catch (error) {
    logger.error('Error in EFT requisition PDF route:', error);
    next(error);
  }
});

// Generate PDF for petty cash requisition
router.get('/petty-cash-requisitions/:id/pdf', authenticate, (req, res, next) => {
  try {
    const requisition = getPettyCashRequisitionById(req.params.id);

    if (!requisition) {
      return res.status(404).json({ error: 'Petty cash requisition not found' });
    }

    // Check permissions
    const userRole = req.user.role;
    if (userRole === 'initiator' && requisition.initiator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get line items and approvals
    const items = getPettyCashItems(req.params.id);
    const approvals = getFormApprovals('petty_cash', req.params.id);

    // Generate PDF
    generatePettyCashRequisitionPDF(requisition, items, approvals, (error, pdfBuffer) => {
      if (error) {
        logger.error('Error generating petty cash requisition PDF:', error);
        return next(error);
      }

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Petty_Cash_${requisition.id}.pdf"`);
      res.send(pdfBuffer);
    });
  } catch (error) {
    logger.error('Error in petty cash requisition PDF route:', error);
    next(error);
  }
});

module.exports = router;
