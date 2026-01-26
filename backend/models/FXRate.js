const mongoose = require('mongoose');

const fxRateSchema = new mongoose.Schema({
  currency_code: { type: String, required: true },
  currency_name: { type: String, required: true },
  rate_to_zmw: { type: Number, required: true },
  is_active: { type: Number, default: 1 },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FXRate', fxRateSchema);
