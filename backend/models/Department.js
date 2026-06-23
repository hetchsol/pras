const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name:                 { type: String, required: true, unique: true },
  code:                 { type: String, default: '' },
  description:          { type: String, default: '' },
  is_active:            { type: Number, default: 1 },
  budget:               { type: Number, default: 0 },
  spent:                { type: Number, default: 0 },
  committed:            { type: Number, default: 0 },
  budget_locked:        { type: Boolean, default: false },
  budget_locked_reason: { type: String, default: '' },
  finance_notes:        { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);
