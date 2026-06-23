const mongoose = require('mongoose');
const BudgetChangeLogSchema = new mongoose.Schema({
  department:    { type: String, required: true },
  fiscal_year:   { type: String, required: true },
  change_type:   { type: String, enum: ['initial_allocation','plan_approved','amendment_approved','supplement_approved','direct_edit'], required: true },
  old_amount:    { type: Number, default: 0 },
  new_amount:    { type: Number, required: true },
  reason:        { type: String, default: '' },
  reference_id:  String,
  changed_by:    String,
  changed_by_name: String
}, { timestamps: true });
module.exports = mongoose.model('BudgetChangeLog', BudgetChangeLogSchema);
