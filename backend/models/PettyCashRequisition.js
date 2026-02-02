const mongoose = require('mongoose');

const pettyCashItemSchema = new mongoose.Schema({
  item_no: { type: Number, required: true },
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
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

module.exports = mongoose.model('PettyCashRequisition', pettyCashRequisitionSchema);
