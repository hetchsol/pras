const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema({
  item_number: { type: String, unique: true, sparse: true },
  item_description: { type: String, required: true },
  unit: { type: String, required: true },
  packaging_uom: { type: String, default: '' },
  preferred_vendor: { type: String, default: '' },
  status: { type: String, default: 'active' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StockItem', stockItemSchema);
