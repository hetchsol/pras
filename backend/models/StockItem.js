const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema({
  item_number: { type: String, unique: true, sparse: true },
  item_description: { type: String, default: '' },
  material: { type: String, default: '' },
  pump_model: { type: String, default: '' },
  accessories: { type: String, default: '' },
  unit: { type: String, default: '' },
  packaging_uom: { type: String, default: '' },
  preferred_vendor: { type: String, default: '' },
  status: { type: String, default: 'active' },
  created_at: { type: Date, default: Date.now }
});

stockItemSchema.index({ item_description: 1 });
stockItemSchema.index({ pump_model: 1 });
stockItemSchema.index({ status: 1 });

stockItemSchema.pre('save', function(next) {
  if (this.item_number) {
    this.item_number = this.item_number.trim().toUpperCase();
  }
  next();
});

module.exports = mongoose.model('StockItem', stockItemSchema);
