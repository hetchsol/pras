const mongoose = require('mongoose');

const expenseClaimItemSchema = new mongoose.Schema({
  report_no: { type: Number, required: true },
  date: { type: String, required: true },
  details: { type: String, required: true },
  km: { type: Number, default: 0 },
  breakfast: { type: Number, default: 0 },
  lunch: { type: Number, default: 0 },
  dinner: { type: Number, default: 0 },
  meals: { type: Number, default: 0 },
  accommodation: { type: Number, default: 0 },
  sundries_phone: { type: Number, default: 0 },
  total_zmw: { type: Number, default: 0 }
});

const expenseClaimSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  employee_name: { type: String, required: true },
  employee_number: { type: String, required: true },
  department: { type: String, required: true },
  reason_for_trip: { type: String, required: true },
  total_kilometers: { type: Number, default: 0 },
  km_rate: { type: Number, default: 0 },
  sub_total: { type: Number, default: 0 },
  total_travel: { type: Number, default: 0 },
  total_claim: { type: Number, default: 0 },
  amount_advanced: { type: Number, default: 0 },
  amount_due: { type: Number, default: 0 },
  initiator_id: { type: mongoose.Schema.Types.Mixed, required: true },
  initiator_name: { type: String, required: true },
  status: { type: String, required: true },
  items: [expenseClaimItemSchema],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExpenseClaim', expenseClaimSchema);
