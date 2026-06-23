const mongoose = require('mongoose');
const BudgetAmendmentSchema = new mongoose.Schema({
  department:          { type: String, required: true },
  fiscal_year:         { type: String, required: true },
  current_amount:      { type: Number, required: true },
  requested_amount:    { type: Number, required: true },
  reason:              { type: String, required: true },
  status:              { type: String, enum: ['pending_md','approved','rejected'], default: 'pending_md' },
  requested_by:        String,
  requested_by_name:   String,
  md_reviewed_by:      String,
  md_reviewed_by_name: String,
  md_reviewed_at:      Date,
  md_comments:         String
}, { timestamps: true });
module.exports = mongoose.model('BudgetAmendment', BudgetAmendmentSchema);
