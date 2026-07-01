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
  location: { type: String, required: true },  // Kitwe / Lusaka - where stock physically landed
  department: { type: String },
  reservation_type: { type: String, enum: ['none', 'internal', 'external', 'stores'], default: 'none' },
  customer: { type: String },  // Name of employee/client/vendor the GRN is reserved for
  remarks: { type: String },
  initiator_id: { type: mongoose.Schema.Types.Mixed, required: true },
  initiator_name: { type: String, required: true },
  assigned_approver: { type: String },
  approvals: [{
    role: { type: String },
    name: { type: String },
    action: { type: String },
    comments: { type: String },
    date: { type: Date }
  }],
  status: { type: String, default: 'pending_approval' },
  items: [grnItemSchema],
  created_at: { type: Date, default: Date.now }
});

goodsReceiptNoteSchema.index({ status: 1 });
goodsReceiptNoteSchema.index({ pr_id: 1 });
goodsReceiptNoteSchema.index({ initiator_name: 1 });
goodsReceiptNoteSchema.index({ created_at: -1 });

module.exports = mongoose.model('GoodsReceiptNote', goodsReceiptNoteSchema);
