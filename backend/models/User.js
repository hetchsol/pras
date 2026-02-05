const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  full_name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  department: { type: String, required: true },
  employee_number: { type: String },
  is_hod: { type: Number, default: 0 },
  assigned_hod: { type: mongoose.Schema.Types.Mixed },  // Can be ID or name
  supervisor_name: { type: String },  // Supervisor's full name for lookup
  can_access_stores: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

// Virtual for 'name' compatibility
userSchema.virtual('name').get(function() {
  return this.full_name;
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
