const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  tier: { type: Number, required: true },
  rating: { type: Number, required: true },
  category: { type: String, required: true },
  status: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vendor', vendorSchema);
