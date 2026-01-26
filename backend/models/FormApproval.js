const mongoose = require('mongoose');

const formApprovalSchema = new mongoose.Schema({
  form_type: { type: String, required: true },
  form_id: { type: String, required: true },
  role: { type: String, required: true },
  user_name: { type: String, required: true },
  action: { type: String, required: true },
  comment: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FormApproval', formApprovalSchema);
