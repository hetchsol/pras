const mongoose = require('mongoose');

const requisitionItemSchema = new mongoose.Schema({
  item_code: { type: String, default: '' },
  item_name: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unit_price: { type: Number, default: 0 },
  total_price: { type: Number, default: 0 },
  specifications: { type: String, default: '' },
  vendor_id: { type: String },
  vendor_name: { type: String },
  currency: { type: String, default: 'ZMW' },
  fx_rate_used: { type: Number, default: 1 },
  amount_in_zmw: { type: Number, default: 0 }
}, { _id: true });

const requisitionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Custom ID like KSB-OPE-JK-20251030
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  estimated_cost: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  justification: { type: String, default: '' },
  department: { type: String, required: true },
  urgency: { type: String, required: true },
  initiator_id: { type: mongoose.Schema.Types.Mixed, required: true },
  initiator_name: { type: String, required: true },
  status: { type: String, required: true },
  items: [requisitionItemSchema],
  selected_vendor: { type: String },
  vendor_currency: { type: String, default: 'ZMW' },
  unit_price: { type: Number },
  total_cost: { type: Number },
  tax_type: { type: String },
  delivery_location: { type: String, default: 'Office' },
  required_date: { type: String },
  assigned_to: { type: mongoose.Schema.Types.Mixed },
  assigned_role: { type: String },
  assigned_hod_id: { type: mongoose.Schema.Types.Mixed },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Requisition', requisitionSchema);
