const mongoose = require('mongoose');

const requisitionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Custom ID like KSB-OPE-JK-20251030
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  estimated_cost: { type: Number, required: true },
  amount: { type: Number, required: true },
  justification: { type: String, required: true },
  department: { type: String, required: true },
  urgency: { type: String, required: true },
  initiator_id: { type: Number, required: true },
  initiator_name: { type: String, required: true },
  status: { type: String, required: true },
  selected_vendor: { type: String },
  vendor_currency: { type: String, default: 'ZMW' },
  unit_price: { type: Number },
  total_cost: { type: Number },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Requisition', requisitionSchema);
