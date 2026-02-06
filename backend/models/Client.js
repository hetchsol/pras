const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true, sparse: true },
  contact_person: { type: String },
  email: { type: String },
  phone: { type: String },
  address: { type: String },
  country: { type: String },
  tax_id: { type: String },
  status: { type: String, default: 'active' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Client', clientSchema);
