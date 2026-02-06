const mongoose = require('mongoose');

const grnApproverAssignmentSchema = new mongoose.Schema({
  initiator_name: { type: String, required: true, unique: true },
  approver_name: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GRNApproverAssignment', grnApproverAssignmentSchema);
