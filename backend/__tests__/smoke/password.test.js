require('../setup');
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../../server-mongo');
const db = require('../../database-mongo');

let adminToken;

beforeAll(async () => {
  await db.connectDB();
  await db.initializeDatabase();
  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'password123' });
  adminToken = login.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('password change/reset smoke', () => {
  test('GET /api/auth/security-questions returns the fixed list', async () => {
    const res = await request(app).get('/api/auth/security-questions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThanOrEqual(3);
    for (const q of res.body.questions) {
      expect(typeof q.id).toBe('string');
      expect(typeof q.text).toBe('string');
    }
  });

  test('login response includes must_change_password flag', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.user.must_change_password).toBe('boolean');
    expect(typeof res.body.user.has_security_questions).toBe('boolean');
  });

  test('forgot-password rejects unknown username with 404', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ username: '__definitely_not_a_user__' });
    expect(res.status).toBe(404);
  });

  test('change-password rejects wrong current password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currentPassword: 'wrong', newPassword: 'NewStrongPw123' });
    expect(res.status).toBe(401);
  });

  test('change-password rejects too-short new password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currentPassword: 'password123', newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  test('admin reset endpoint requires admin role', async () => {
    const res = await request(app)
      .post('/api/admin/users/000000000000000000000000/reset-password')
      .send({});
    expect(res.status).toBe(401);
  });

  test('admin reset returns 404 for unknown user id', async () => {
    const res = await request(app)
      .post('/api/admin/users/000000000000000000000000/reset-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(404);
  });

  test('admin reset of a real user returns a temp password and forces change', async () => {
    const target = await db.User.findOne({ username: { $ne: 'admin' } });
    expect(target).toBeTruthy();

    const res = await request(app)
      .post(`/api/admin/users/${target._id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.tempPassword).toBeDefined();
    expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(8);

    const refreshed = await db.User.findById(target._id);
    expect(refreshed.must_change_password).toBe(true);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: target.username, password: res.body.tempPassword });
    expect(login.status).toBe(200);
    expect(login.body.user.must_change_password).toBe(true);
  });
});
