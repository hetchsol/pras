const mongoose = require('mongoose');

const grnItemSchema = new mongoose.Schema({
  item_code: { type: String },
  item_name: { type: String, required: true },
  description: { type: String },
  quantity_ordered: { type: Number, required: true },
  quantity_received: { type: Number, required: true },
  unit: { type: String, default: 'pcs' },
  condition_notes: { type: String }
});

const goodsReceiptNoteSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },  // KSB-GRN-timestamp
  grn_number: { type: String, unique: true, sparse: true },
  receipt_date: { type: Date, default: Date.now },
  pr_id: { type: String, required: true },  // Links to Requisition.id
  pr_description: { type: String },
  supplier: { type: String },
  delivery_note_number: { type: String },
  invoice_number: { type: String },
  received_by: { type: String, required: true },
  department: { type: String },
  customer: { type: String },  // "Reserved for" - items can only be issued to this customer
  remarks: { type: String },
  initiator_id: { type: mongoose.Schema.Types.Mixed, required: true },
  initiator_name: { type: String, required: true },
  status: { type: String, default: 'received' },
  items: [grnItemSchema],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GoodsReceiptNote', goodsReceiptNoteSchema);
