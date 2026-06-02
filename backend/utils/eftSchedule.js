/**
 * EFT module access window — Africa/Lusaka time.
 *
 * Rules (locked in 2026-06-02):
 *   - Weekdays only (Mon–Fri). Sat/Sun = closed for everyone except Admin.
 *   - Window opens at 05:00 local.
 *   - Create cutoff: 11:00 (with 60s soft grace for in-flight submissions).
 *   - Approve cutoff: 12:30 (with 60s soft grace).
 *   - Admin bypass: can approve / override at any time including weekends,
 *     but CANNOT create new EFTs outside the window. Same as a regular user
 *     for creation.
 *
 * Keep the constants in sync with the frontend's mirror in app.js
 * (search "EFT_SCHEDULE — keep in sync"). Server is authoritative; the
 * frontend duplicate is just so the UI can grey out buttons without a
 * round-trip per click.
 */

const TIMEZONE = 'Africa/Lusaka';
const OPEN_HOUR = 5;             // 05:00 local
const CREATE_CUTOFF_H = 11;      // 11:00 local
const CREATE_CUTOFF_M = 0;
const APPROVE_CUTOFF_H = 12;     // 12:30 local
const APPROVE_CUTOFF_M = 30;
const GRACE_SECONDS = 60;

// Lusaka is UTC+2 year-round (no DST).
const LUSAKA_OFFSET_HOURS = 2;

const WEEKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

function getLusakaTimeParts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) {
    map[p.type] = p.value;
  }
  return {
    weekday: map.weekday,
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    // Some browsers/runtimes emit '24' instead of '00' for midnight.
    hour: parseInt(map.hour, 10) % 24,
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10)
  };
}

function secondsOfDay(h, m, s) { return h * 3600 + m * 60 + s; }

function isWeekday(weekday) { return WEEKDAYS.has(weekday); }

const OPEN_SEC = OPEN_HOUR * 3600;
const CREATE_CUTOFF_SEC = CREATE_CUTOFF_H * 3600 + CREATE_CUTOFF_M * 60 + GRACE_SECONDS;
const APPROVE_CUTOFF_SEC = APPROVE_CUTOFF_H * 3600 + APPROVE_CUTOFF_M * 60 + GRACE_SECONDS;

function utcDateForLusakaWallTime(year, month, day, hour, minute) {
  // Convert a Lusaka wall-clock moment (UTC+2) into a UTC Date.
  return new Date(Date.UTC(year, month - 1, day, hour - LUSAKA_OFFSET_HOURS, minute, 0));
}

function addLusakaDays(parts, days) {
  // Build a Date in Lusaka time, advance by N days, return new parts.
  const base = utcDateForLusakaWallTime(parts.year, parts.month, parts.day, 12, 0); // noon to avoid DST edge (none in Lusaka but safe)
  const advanced = new Date(base.getTime() + days * 24 * 3600 * 1000);
  return getLusakaTimeParts(advanced);
}

/**
 * Compute the next moment the given action becomes available, as a UTC Date.
 * Returns null if action is currently allowed.
 */
function nextOpening(now, action) {
  const cutoffSec = action === 'create' ? CREATE_CUTOFF_SEC : APPROVE_CUTOFF_SEC;
  const parts = getLusakaTimeParts(now);
  const sec = secondsOfDay(parts.hour, parts.minute, parts.second);
  const weekend = !isWeekday(parts.weekday);

  // Currently open?
  if (!weekend && sec >= OPEN_SEC && sec < cutoffSec) return null;

  // Today is a weekday and we're before today's 05:00 → today at 05:00 Lusaka.
  if (!weekend && sec < OPEN_SEC) {
    return utcDateForLusakaWallTime(parts.year, parts.month, parts.day, OPEN_HOUR, 0);
  }

  // Otherwise: advance day-by-day until we hit a weekday.
  let probe = parts;
  for (let i = 1; i <= 7; i++) {
    probe = addLusakaDays(parts, i);
    if (isWeekday(probe.weekday)) {
      return utcDateForLusakaWallTime(probe.year, probe.month, probe.day, OPEN_HOUR, 0);
    }
  }
  return null;
}

/**
 * Main entry point. Returns the access state for a given role at a given time.
 *
 *   {
 *     canCreate: boolean,
 *     canApprove: boolean,
 *     reason: 'open' | 'before_hours' | 'after_create_cutoff' |
 *             'after_approve_cutoff' | 'weekend',
 *     nextCreateOpen: Date|null,   // null if currently open or N/A
 *     nextApproveOpen: Date|null,
 *     isAdmin: boolean
 *   }
 */
function getEFTAccess(role, now = new Date()) {
  const isAdmin = String(role || '').toLowerCase() === 'admin';
  const parts = getLusakaTimeParts(now);
  const sec = secondsOfDay(parts.hour, parts.minute, parts.second);
  const weekend = !isWeekday(parts.weekday);

  // Regular create rules (admin follows the same rule per spec 3C).
  const canCreate = !weekend && sec >= OPEN_SEC && sec < CREATE_CUTOFF_SEC;

  // Approve rules: admin always; regular user follows the window.
  const canApprove = isAdmin
    ? true
    : (!weekend && sec >= OPEN_SEC && sec < APPROVE_CUTOFF_SEC);

  let reason = 'open';
  if (weekend) reason = 'weekend';
  else if (sec < OPEN_SEC) reason = 'before_hours';
  else if (sec >= APPROVE_CUTOFF_SEC) reason = 'after_approve_cutoff';
  else if (sec >= CREATE_CUTOFF_SEC) reason = 'after_create_cutoff';

  return {
    canCreate,
    canApprove,
    reason,
    nextCreateOpen: canCreate ? null : nextOpening(now, 'create'),
    nextApproveOpen: canApprove ? null : nextOpening(now, 'approve'),
    isAdmin,
    timezone: TIMEZONE,
    windows: {
      createLocal: '05:00–11:00',
      approveLocal: '05:00–12:30',
      days: 'Mon–Fri'
    }
  };
}

function formatNextOpen(date) {
  if (!date) return '';
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return fmt.format(date) + ' (CAT)';
}

function lockoutMessage(action, access) {
  const window = action === 'create'
    ? '05:00–11:00 (CAT, Mon–Fri)'
    : '05:00–12:30 (CAT, Mon–Fri)';
  const nextOpen = action === 'create' ? access.nextCreateOpen : access.nextApproveOpen;
  const nextText = nextOpen ? ` Next available: ${formatNextOpen(nextOpen)}.` : '';
  const verb = action === 'create' ? 'creating new EFT requisitions' : 'approving EFT requisitions';
  return `The EFT module is currently closed for ${verb}. Window: ${window}.${nextText}`;
}

module.exports = {
  getEFTAccess,
  nextOpening,
  formatNextOpen,
  lockoutMessage,
  // exposed for tests
  _internals: { getLusakaTimeParts, TIMEZONE, OPEN_HOUR, CREATE_CUTOFF_H, APPROVE_CUTOFF_H, GRACE_SECONDS }
};
