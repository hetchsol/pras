require('../setup');

const { getEFTAccess } = require('../../utils/eftSchedule');

// Construct a UTC Date such that it represents a specific Lusaka wall-clock
// moment. Lusaka is UTC+2 year-round.
function lusakaWall(year, month, day, hour, minute = 0, second = 0) {
  // hour-2 converts Lusaka local to UTC
  return new Date(Date.UTC(year, month - 1, day, hour - 2, minute, second));
}

// 2026 calendar reference:
//   Mon 2026-06-01, Tue 2026-06-02, ..., Fri 2026-06-05, Sat 2026-06-06, Sun 2026-06-07
// We use these dates for the tests.

describe('EFT schedule — windows', () => {
  test('Tuesday 09:00 → both create and approve open', () => {
    const access = getEFTAccess('initiator', lusakaWall(2026, 6, 2, 9, 0));
    expect(access.canCreate).toBe(true);
    expect(access.canApprove).toBe(true);
    expect(access.reason).toBe('open');
  });

  test('Tuesday 04:30 → before hours, both closed', () => {
    const access = getEFTAccess('initiator', lusakaWall(2026, 6, 2, 4, 30));
    expect(access.canCreate).toBe(false);
    expect(access.canApprove).toBe(false);
    expect(access.reason).toBe('before_hours');
    expect(access.nextCreateOpen).toBeInstanceOf(Date);
  });

  test('Tuesday 11:30 → create closed, approve still open', () => {
    const access = getEFTAccess('hod', lusakaWall(2026, 6, 2, 11, 30));
    expect(access.canCreate).toBe(false);
    expect(access.canApprove).toBe(true);
    expect(access.reason).toBe('after_create_cutoff');
  });

  test('Tuesday 13:00 → both closed', () => {
    const access = getEFTAccess('hod', lusakaWall(2026, 6, 2, 13, 0));
    expect(access.canCreate).toBe(false);
    expect(access.canApprove).toBe(false);
    expect(access.reason).toBe('after_approve_cutoff');
  });
});

describe('EFT schedule — grace period (60s)', () => {
  test('Tuesday 11:00:30 → still allowed to create (in grace)', () => {
    const access = getEFTAccess('initiator', lusakaWall(2026, 6, 2, 11, 0, 30));
    expect(access.canCreate).toBe(true);
  });

  test('Tuesday 11:01:01 → past grace, create blocked', () => {
    const access = getEFTAccess('initiator', lusakaWall(2026, 6, 2, 11, 1, 1));
    expect(access.canCreate).toBe(false);
  });

  test('Tuesday 12:30:30 → approval still allowed (in grace)', () => {
    const access = getEFTAccess('finance', lusakaWall(2026, 6, 2, 12, 30, 30));
    expect(access.canApprove).toBe(true);
  });

  test('Tuesday 12:31:01 → past grace, approval blocked', () => {
    const access = getEFTAccess('finance', lusakaWall(2026, 6, 2, 12, 31, 1));
    expect(access.canApprove).toBe(false);
  });
});

describe('EFT schedule — weekend', () => {
  test('Saturday mid-morning → fully closed for non-admin', () => {
    const access = getEFTAccess('hod', lusakaWall(2026, 6, 6, 10, 0));
    expect(access.canCreate).toBe(false);
    expect(access.canApprove).toBe(false);
    expect(access.reason).toBe('weekend');
  });

  test('Saturday → next opening is Monday 05:00', () => {
    const access = getEFTAccess('hod', lusakaWall(2026, 6, 6, 10, 0));
    const next = access.nextCreateOpen;
    expect(next).toBeInstanceOf(Date);
    // Monday 2026-06-08 05:00 Lusaka = 03:00 UTC
    expect(next.toISOString()).toBe('2026-06-08T03:00:00.000Z');
  });

  test('Sunday afternoon → next opening is Monday 05:00', () => {
    const access = getEFTAccess('initiator', lusakaWall(2026, 6, 7, 15, 0));
    expect(access.nextCreateOpen.toISOString()).toBe('2026-06-08T03:00:00.000Z');
  });
});

describe('EFT schedule — admin bypass', () => {
  test('Admin can approve on a weekend', () => {
    const access = getEFTAccess('admin', lusakaWall(2026, 6, 6, 10, 0));
    expect(access.canApprove).toBe(true);
  });

  test('Admin can approve after hours on a weekday', () => {
    const access = getEFTAccess('admin', lusakaWall(2026, 6, 2, 20, 0));
    expect(access.canApprove).toBe(true);
  });

  test('Admin CANNOT create on a weekend (option 3C)', () => {
    const access = getEFTAccess('admin', lusakaWall(2026, 6, 6, 10, 0));
    expect(access.canCreate).toBe(false);
  });

  test('Admin CANNOT create after cutoff on weekday (option 3C)', () => {
    const access = getEFTAccess('admin', lusakaWall(2026, 6, 2, 14, 0));
    expect(access.canCreate).toBe(false);
  });

  test('Admin CAN create within the window like everyone else', () => {
    const access = getEFTAccess('admin', lusakaWall(2026, 6, 2, 9, 0));
    expect(access.canCreate).toBe(true);
  });
});

describe('EFT schedule — next opening logic', () => {
  test('Friday after cutoff → next is Monday 05:00 (skip weekend)', () => {
    const access = getEFTAccess('hod', lusakaWall(2026, 6, 5, 13, 0));
    expect(access.nextCreateOpen.toISOString()).toBe('2026-06-08T03:00:00.000Z');
    expect(access.nextApproveOpen.toISOString()).toBe('2026-06-08T03:00:00.000Z');
  });

  test('Tuesday before hours → next is same day 05:00', () => {
    const access = getEFTAccess('hod', lusakaWall(2026, 6, 2, 4, 0));
    expect(access.nextCreateOpen.toISOString()).toBe('2026-06-02T03:00:00.000Z');
  });

  test('Tuesday after create cutoff → next create is Wednesday 05:00', () => {
    const access = getEFTAccess('hod', lusakaWall(2026, 6, 2, 11, 30));
    expect(access.nextCreateOpen.toISOString()).toBe('2026-06-03T03:00:00.000Z');
  });
});
