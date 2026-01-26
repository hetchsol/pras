const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  requisition_id: { type: String, required: true },
  role: { type: String, required: true },
  user_name: { type: String, required: true },
  action: { type: String, required: true },
  comment: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Approval', approvalSchema);
