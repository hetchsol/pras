const mongoose = require('mongoose');
const BudgetPlanSchema = new mongoose.Schema({
  fiscal_year:       { type: String, required: true },
  status:            { type: String, enum: ['draft','pending_md','approved','rejected'], default: 'draft' },
  allocations:       [{ department: { type: String, required: true }, amount: { type: Number, required: true, min: 0 } }],
  notes:             { type: String, default: '' },
  prepared_by:       String,
  prepared_by_name:  String,
  submitted_at:      Date,
  md_reviewed_by:    String,
  md_reviewed_by_name: String,
  md_reviewed_at:    Date,
  md_comments:       String
}, { timestamps: true });
module.exports = mongoose.model('BudgetPlan', BudgetPlanSchema);
