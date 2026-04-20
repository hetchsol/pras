const AuditLog = require('../models/AuditLog');
const { logError } = require('./logger');

// Non-blocking append to the audit log. Errors are logged but never
// propagated — an audit-log write failure must not fail the underlying
// business operation (e.g. an approval). Call after the main write
// has committed so the log accurately reflects reality.
function logAudit(req, event) {
  const doc = {
    entity_type: event.entity_type,
    entity_id: String(event.entity_id),
    actor_id: req.user && req.user.id,
    actor_name: req.user && (req.user.full_name || req.user.name || req.user.username),
    actor_role: req.user && req.user.role,
    action: event.action,
    from_status: event.from_status,
    to_status: event.to_status,
    comments: event.comments,
    ip: req.ip,
    user_agent: req.get && req.get('user-agent'),
    metadata: event.metadata
  };

  // Fire and forget. The write is fast but we don't await it.
  AuditLog.create(doc).catch(err => {
    logError(err, { type: 'AUDIT_WRITE_FAILED', event: doc });
  });
}

module.exports = { logAudit };
