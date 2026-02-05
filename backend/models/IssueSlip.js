const mongoose = require('mongoose');

const issueSlipItemSchema = new mongoose.Schema({
  item_code: { type: String },
  item_name: { type: String, required: true },
  description: { type: String },
  quantity: { type: Number, required: true },
  unit: { type: String, default: 'pcs' }
});

const issueSlipSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },  // KSB-ISS-timestamp
  slip_number: { type: String, unique: true },
  issue_date: { type: Date, default: Date.now },
  issued_to: { type: String, required: true },
  department: { type: String },
  delivery_location: { type: String },
  delivery_date: { type: Date },
  delivered_by: { type: String },
  reference_number: { type: String },
  remarks: { type: String },
  initiator_id: { type: mongoose.Schema.Types.Mixed, required: true },
  initiator_name: { type: String, required: true },
  status: { type: String, default: 'pending_hod' },
  items: [issueSlipItemSchema],
  approvals: [{
    role: String,
    name: String,
    action: String,
    comments: String,
    date: { type: Date, default: Date.now }
  }],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('IssueSlip', issueSlipSchema);
