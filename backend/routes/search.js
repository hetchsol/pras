const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const {
  getRequisitions,
  getEFTRequisitions,
  getExpenseClaims,
  getAllUsers
} = require('../database');

// Global search endpoint
router.get('/search', authenticate, (req, res, next) => {
  try {
    const query = req.query.q;

    if (!query || query.length < 3) {
      return res.json({
        requisitions: [],
        efts: [],
        expense_claims: [],
        users: []
      });
    }

    const searchTerm = query.toLowerCase();

    // Search requisitions
    const allRequisitions = getRequisitions();
    const requisitions = allRequisitions.filter(r =>
      (r.id && String(r.id).toLowerCase().includes(searchTerm)) ||
      (r.description && r.description.toLowerCase().includes(searchTerm)) ||
      (r.initiator_name && r.initiator_name.toLowerCase().includes(searchTerm)) ||
      (r.department && r.department.toLowerCase().includes(searchTerm))
    ).slice(0, 10); // Limit to 10 results

    // Search EFT requisitions
    const allEFTs = getEFTRequisitions();
    const efts = allEFTs.filter(e =>
      (e.id && String(e.id).toLowerCase().includes(searchTerm)) ||
      (e.payee_name && e.payee_name.toLowerCase().includes(searchTerm)) ||
      (e.initiator_name && e.initiator_name.toLowerCase().includes(searchTerm)) ||
      (e.department && e.department.toLowerCase().includes(searchTerm))
    ).slice(0, 10);

    // Search expense claims
    const allClaims = getExpenseClaims();
    const expense_claims = allClaims.filter(c =>
      (c.id && String(c.id).toLowerCase().includes(searchTerm)) ||
      (c.employee_name && c.employee_name.toLowerCase().includes(searchTerm)) ||
      (c.department && c.department.toLowerCase().includes(searchTerm)) ||
      (c.reason_for_trip && c.reason_for_trip.toLowerCase().includes(searchTerm))
    ).slice(0, 10);

    // Search users (admin only)
    let users = [];
    if (req.user.role === 'admin') {
      const allUsers = getAllUsers();
      users = allUsers.filter(u =>
        (u.full_name && u.full_name.toLowerCase().includes(searchTerm)) ||
        (u.username && u.username.toLowerCase().includes(searchTerm)) ||
        (u.department && u.department.toLowerCase().includes(searchTerm)) ||
        (u.name && u.name.toLowerCase().includes(searchTerm))
      ).slice(0, 10);
    }

    logger.info(`Global search executed: query="${query}", results=${requisitions.length + efts.length + expense_claims.length + users.length}`);

    res.json({
      requisitions,
      efts,
      expense_claims,
      users
    });

  } catch (error) {
    logger.error('Error in global search:', error);
    next(error);
  }
});

module.exports = router;
