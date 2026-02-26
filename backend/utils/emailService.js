const nodemailer = require('nodemailer');
const { logger } = require('./logger');
const User = require('../models/User');

let transporter = null;

/**
 * Lazy-initialize the nodemailer SMTP transport from env vars.
 */
function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return transporter;
}

/**
 * Determine recipient email addresses based on the new status.
 */
async function getRecipientsForStatus(newStatus, department, initiatorId) {
  const emails = [];

  switch (newStatus) {
    case 'pending_hod': {
      // Find HOD(s) for the department
      const hods = await User.find({ is_hod: 1, department }).select('email full_name').lean();
      if (hods.length > 0) {
        hods.forEach(h => { if (h.email) emails.push(h.email); });
      } else if (initiatorId) {
        // Fallback: look up the initiator's supervisor
        const initiator = await User.findById(initiatorId).select('supervisor_name').lean();
        if (initiator?.supervisor_name) {
          const supervisor = await User.findOne({ full_name: initiator.supervisor_name }).select('email').lean();
          if (supervisor?.email) emails.push(supervisor.email);
        }
      }
      break;
    }
    case 'pending_finance': {
      const financeUsers = await User.find({ role: 'finance' }).select('email').lean();
      financeUsers.forEach(u => { if (u.email) emails.push(u.email); });
      break;
    }
    case 'pending_md': {
      const mdUsers = await User.find({ role: 'md' }).select('email').lean();
      mdUsers.forEach(u => { if (u.email) emails.push(u.email); });
      break;
    }
    case 'approved':
    case 'rejected': {
      if (initiatorId) {
        const initiator = await User.findById(initiatorId).select('email').lean();
        if (initiator?.email) emails.push(initiator.email);
      }
      break;
    }
  }

  return [...new Set(emails)];
}

const STATUS_LABELS = {
  pending_hod: 'Pending HOD Approval',
  pending_finance: 'Pending Finance Approval',
  pending_md: 'Pending MD Approval',
  approved: 'Approved',
  rejected: 'Rejected'
};

const FORM_TYPE_LABELS = {
  'purchase-requisition': 'Purchase Requisition',
  'expense-claim': 'Expense Claim',
  'eft-requisition': 'EFT Requisition',
  'petty-cash': 'Petty Cash Requisition',
  'issue-slip': 'Issue Slip'
};

const STATUS_COLORS = {
  pending_hod: '#f59e0b',
  pending_finance: '#3b82f6',
  pending_md: '#8b5cf6',
  approved: '#10b981',
  rejected: '#ef4444'
};

/**
 * Build styled HTML email body.
 */
function buildEmailHtml({ formType, formId, newStatus, amount, department, initiatorName, approverName, comments, isProgressNotification }) {
  const appUrl = process.env.APP_URL || 'https://pras-frontend.onrender.com';
  const statusLabel = STATUS_LABELS[newStatus] || newStatus;
  const formLabel = FORM_TYPE_LABELS[formType] || formType;
  const statusColor = STATUS_COLORS[newStatus] || '#6b7280';

  const heading = isProgressNotification
    ? `Your ${formLabel} is progressing`
    : newStatus === 'approved' || newStatus === 'rejected'
      ? `Your ${formLabel} has been ${newStatus}`
      : `${formLabel} awaiting your approval`;

  let amountHtml = '';
  if (amount && amount > 0) {
    amountHtml = `
      <tr>
        <td style="padding:8px 12px;color:#6b7280;font-size:14px;">Amount</td>
        <td style="padding:8px 12px;font-size:14px;font-weight:600;">R ${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
      </tr>`;
  }

  let commentsHtml = '';
  if (comments) {
    commentsHtml = `
      <tr>
        <td style="padding:8px 12px;color:#6b7280;font-size:14px;">Comments</td>
        <td style="padding:8px 12px;font-size:14px;">${escapeHtml(comments)}</td>
      </tr>`;
  }

  let approverHtml = '';
  if (approverName) {
    approverHtml = `
      <tr>
        <td style="padding:8px 12px;color:#6b7280;font-size:14px;">Actioned By</td>
        <td style="padding:8px 12px;font-size:14px;">${escapeHtml(approverName)}</td>
      </tr>`;
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#1e3a5f;padding:24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:20px;">KSB Procurement System</h1>
    </div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 16px;font-size:18px;color:#1f2937;">${heading}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:8px 12px;color:#6b7280;font-size:14px;width:140px;">Form Type</td>
          <td style="padding:8px 12px;font-size:14px;font-weight:600;">${formLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;color:#6b7280;font-size:14px;">Reference</td>
          <td style="padding:8px 12px;font-size:14px;font-weight:600;">${escapeHtml(formId)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;color:#6b7280;font-size:14px;">Status</td>
          <td style="padding:8px 12px;">
            <span style="display:inline-block;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600;color:#fff;background:${statusColor};">${statusLabel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;color:#6b7280;font-size:14px;">Department</td>
          <td style="padding:8px 12px;font-size:14px;">${escapeHtml(department || '')}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;color:#6b7280;font-size:14px;">Initiator</td>
          <td style="padding:8px 12px;font-size:14px;">${escapeHtml(initiatorName || '')}</td>
        </tr>
        ${amountHtml}
        ${approverHtml}
        ${commentsHtml}
      </table>
      <div style="text-align:center;margin:24px 0;">
        <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">View in Application</a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated notification from the KSB Procurement System. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Send email notification after a status change.
 * Fire-and-forget — never throws.
 */
async function sendStatusNotification({ formType, formId, newStatus, department, initiatorId, initiatorName, description, amount, approverName, comments }) {
  try {
    const transport = getTransporter();
    if (!transport) return; // SMTP not configured

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    // Send to the next approvers / initiator for final statuses
    const recipients = await getRecipientsForStatus(newStatus, department, initiatorId);

    if (recipients.length > 0) {
      const statusLabel = STATUS_LABELS[newStatus] || newStatus;
      const formLabel = FORM_TYPE_LABELS[formType] || formType;
      const subject = `${formLabel} ${formId} — ${statusLabel}`;

      const html = buildEmailHtml({ formType, formId, newStatus, amount, department, initiatorName, approverName, comments, isProgressNotification: false });

      await transport.sendMail({
        from,
        to: recipients.join(', '),
        subject,
        html
      });

      logger.info({ type: 'EMAIL', event: 'notification_sent', formId, newStatus, recipients });
    }

    // On intermediate approvals, also notify the initiator about progress
    if (['pending_finance', 'pending_md'].includes(newStatus) && initiatorId) {
      const initiator = await User.findById(initiatorId).select('email').lean();
      if (initiator?.email && !recipients.includes(initiator.email)) {
        const formLabel = FORM_TYPE_LABELS[formType] || formType;
        const statusLabel = STATUS_LABELS[newStatus] || newStatus;
        const subject = `Your ${formLabel} ${formId} — ${statusLabel}`;

        const html = buildEmailHtml({ formType, formId, newStatus, amount, department, initiatorName, approverName, comments, isProgressNotification: true });

        await transport.sendMail({
          from,
          to: initiator.email,
          subject,
          html
        });

        logger.info({ type: 'EMAIL', event: 'progress_notification_sent', formId, newStatus, recipient: initiator.email });
      }
    }
  } catch (error) {
    logger.error({ type: 'EMAIL', event: 'notification_failed', formId, newStatus, error: error.message });
  }
}

module.exports = { sendStatusNotification };
