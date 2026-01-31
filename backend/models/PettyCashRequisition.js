const mongoose = require('mongoose');

const pettyCashItemSchema = new mongoose.Schema({
  item_no: { type: Number, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true }
});

const pettyCashRequisitionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  payee_name: { type: String, required: true },
  department: { type: String, required: true },
  purpose: { type: String, required: true },
  description: { type: String },
  amount: { type: Number, required: true },
  amount_in_words: { type: String, required: true },
  items: [pettyCashItemSchema],
  initiator_id: { type: mongoose.Schema.Types.Mixed, required: true },
  initiator_name: { type: String, required: true },
  status: { type: String, required: true, default: 'pending_hod' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PettyCashRequisition', pettyCashRequisitionSchema);
