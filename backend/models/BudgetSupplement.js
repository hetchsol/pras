const mongoose = require('mongoose');

const budgetSupplementSchema = new mongoose.Schema({
  department:           { type: String, required: true },
  requested_amount:     { type: Number, required: true },
  justification:        { type: String, required: true },
  status: {
    type: String,
    enum: ['pending_finance', 'pending_md', 'approved', 'rejected'],
    default: 'pending_finance'
  },
  requested_by:         String,
  requested_by_name:    String,
  finance_reviewed_by:      String,
  finance_reviewed_by_name: String,
  finance_reviewed_at:  Date,
  finance_comments:     String,
  md_reviewed_by:       String,
  md_reviewed_by_name:  String,
  md_reviewed_at:       Date,
  md_comments:          String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('BudgetSupplement', budgetSupplementSchema);
