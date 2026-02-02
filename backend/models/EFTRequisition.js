const mongoose = require('mongoose');

const eftRequisitionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  eft_chq_number: { type: String },
  amount: { type: Number, required: true },
  amount_in_words: { type: String, required: true },
  in_favour_of: { type: String, required: true },
  bank_account_number: { type: String },
  bank_name: { type: String },
  branch: { type: String },
  purpose: { type: String, required: true },
  account_code: { type: String },
  description: { type: String },
  initiator_id: { type: mongoose.Schema.Types.Mixed, required: true },
  initiator_name: { type: String, required: true },
  department: { type: String },
  status: { type: String, required: true, default: 'pending_hod' },
  approvals: [{
    role: String,
    name: String,
    action: String,
    comments: String,
    date: { type: Date, default: Date.now }
  }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EFTRequisition', eftRequisitionSchema);
