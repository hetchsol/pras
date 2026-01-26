const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  budget: { type: Number, required: true },
  spent: { type: Number, default: 0 }
});

module.exports = mongoose.model('Department', departmentSchema);
