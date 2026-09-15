const mongoose = require('mongoose');

const itEquipmentRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  requester_name: { type: String, required: true },
  department: { type: String, required: true },
  equipment_description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  justification: { type: String, required: true },
  initiator_id: { type: mongoose.Schema.Types.Mixed, required: true },
  initiator_name: { type: String, required: true },
  status: { type: String, required: true, default: 'pending_hr' },
  approvals: [{
    role: String,
    name: String,
    action: String,
    comments: String,
    date: { type: Date, default: Date.now }
  }],
  // Filled in by IT at the issuance step, once the equipment is actually handed over.
  issuance_details: {
    make: String,
    model: String,
    serial_number: String,
    asset_tag: String,
    issued_by: String,
    issued_at: Date
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

itEquipmentRequestSchema.index({ initiator_id: 1 });
itEquipmentRequestSchema.index({ status: 1 });
itEquipmentRequestSchema.index({ created_at: -1 });

module.exports = mongoose.model('ITEquipmentRequest', itEquipmentRequestSchema);
