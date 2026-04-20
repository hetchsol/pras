const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema({
  item_number: { type: String, unique: true, sparse: true },
  item_description: { type: String, default: '' },
  unit: { type: String, default: '' },
  packaging_uom: { type: String, default: '' },
  preferred_vendor: { type: String, default: '' },
  status: { type: String, default: 'active' },
  created_at: { type: Date, default: Date.now }
});

stockItemSchema.index({ item_description: 1 });
stockItemSchema.index({ status: 1 });

module.exports = mongoose.model('StockItem', stockItemSchema);
