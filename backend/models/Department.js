const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  budget: { type: Number, required: true },
  spent: { type: Number, default: 0 },
  committed: { type: Number, default: 0 },
  budget_locked: { type: Boolean, default: false },
  budget_locked_reason: { type: String, default: '' },
  finance_notes: { type: String, default: '' }
});

module.exports = mongoose.model('Department', departmentSchema);
