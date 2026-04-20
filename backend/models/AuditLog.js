const mongoose = require('mongoose');

// Append-only log of state-changing actions (approvals, rejections,
// status flips). The existing approvals array on each entity remains
// the source of truth for workflow display; this table exists so that
// after-the-fact forensic questions ("who approved what, when, from
// which IP") can be answered even if a document is later modified or
// deleted. Never updated, only inserted.
const auditLogSchema = new mongoose.Schema({
  entity_type: { type: String, required: true },
  entity_id: { type: String, required: true },
  actor_id: { type: mongoose.Schema.Types.Mixed },
  actor_name: { type: String },
  actor_role: { type: String },
  action: { type: String, required: true },
  from_status: { type: String },
  to_status: { type: String },
  comments: { type: String },
  ip: { type: String },
  user_agent: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  at: { type: Date, default: Date.now }
});

auditLogSchema.index({ entity_type: 1, entity_id: 1, at: -1 });
auditLogSchema.index({ actor_id: 1, at: -1 });
auditLogSchema.index({ at: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
