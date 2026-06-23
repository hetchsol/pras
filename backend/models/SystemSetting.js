const mongoose = require('mongoose');

const SystemSettingSchema = new mongoose.Schema({
  key:          { type: String, required: true, unique: true },
  value:        { type: mongoose.Schema.Types.Mixed, required: true },
  bypass_until: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', SystemSettingSchema);
