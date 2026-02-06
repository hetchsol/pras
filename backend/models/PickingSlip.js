const mongoose = require('mongoose');

const pickingSlipItemSchema = new mongoose.Schema({
  item_code: { type: String },
  item_name: { type: String, required: true },
  description: { type: String },
  quantity: { type: Number, required: true },
  unit: { type: String, default: 'pcs' }
});

const pickingSlipSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },  // KSB-PKS-timestamp
  slip_number: { type: String, unique: true, sparse: true },
  pick_date: { type: Date, default: Date.now },
  picked_by: { type: String, required: true },
  destination: { type: String, required: true },
  delivery_location: { type: String },
  department: { type: String },
  reference_number: { type: String },
  customer: { type: String },
  remarks: { type: String },
  initiator_id: { type: mongoose.Schema.Types.Mixed, required: true },
  initiator_name: { type: String, required: true },
  status: { type: String, default: 'completed' },
  items: [pickingSlipItemSchema],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PickingSlip', pickingSlipSchema);
