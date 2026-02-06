const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true, sparse: true },
  tier: { type: Number, default: 1 },
  rating: { type: Number, default: 0 },
  category: { type: String, default: 'General' },
  status: { type: String, default: 'active' },
  type: { type: String },
  currency: { type: String },
  country: { type: String },
  tax_id: { type: String },
  email: { type: String },
  phone: { type: String },
  address: { type: String },
  contact_person: { type: String },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vendor', vendorSchema);
