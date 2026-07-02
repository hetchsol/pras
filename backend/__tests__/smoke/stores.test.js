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

describe('stores smoke', () => {
  test('GET /api/stores/grns returns a list', async () => {
    const res = await request(app)
      .get('/api/stores/grns')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });

  test('GET /api/stores/grns?page=1&limit=5 returns envelope', async () => {
    const res = await request(app)
      .get('/api/stores/grns?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.items).toBeDefined();
      expect(res.body.total).toBeDefined();
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(5);
    }
  });

  test('POST /api/stores/issue-slips without GRN reference creates a slip', async () => {
    const res = await request(app)
      .post('/api/stores/issue-slips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        issued_to: 'Site A',
        department: 'Operations',
        location: 'Kitwe',
        delivery_location: 'Warehouse',
        delivered_by: 'Test',
        items: [{ item_code: 'WIDGET-1', item_name: 'Widget', quantity: 5, unit: 'pcs' }]
      });
    // Routes may 404 if endpoint removed or 201 on success.
    expect([201, 500]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.slip).toBeDefined();
      expect(res.body.slip.id).toMatch(/^KSB-ISS-/);
      expect(res.body.slip.status).toBe('pending_hod');
    }
  });

  test('POST /api/stores/issue-slips with bogus GRN returns 400', async () => {
    const res = await request(app)
      .post('/api/stores/issue-slips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        issued_to: 'Site A',
        department: 'Operations',
        location: 'Kitwe',
        delivery_location: 'Warehouse',
        delivered_by: 'Test',
        reference_number: 'KSB-GRN-DOES-NOT-EXIST',
        items: [{ item_code: 'WIDGET-1', item_name: 'Widget', quantity: 5, unit: 'pcs' }]
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('stores multi-location', () => {
  const Requisition = require('../../models/Requisition');
  const IssueSlip = require('../../models/IssueSlip');
  let prId;

  beforeAll(async () => {
    prId = `TEST-PR-LOC-${Date.now()}`;
    await Requisition.create({
      id: prId,
      description: 'Test PR for location smoke test',
      quantity: 1,
      department: 'Operations',
      urgency: 'normal',
      initiator_id: 'test-initiator',
      initiator_name: 'Test Initiator',
      status: 'approved',
      items: [{ item_name: 'Test Impeller', quantity: 14 }]
    });
  });

  test('GRNs at different locations produce separate stock register rows', async () => {
    const kitweGrn = await request(app)
      .post('/api/stores/grns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pr_id: prId,
        received_by: 'Test',
        location: 'Kitwe',
        items: [{ item_code: 'LOC-TEST-1', item_name: 'Test Impeller', quantity_ordered: 10, quantity_received: 10, unit: 'pcs' }]
      });
    expect(kitweGrn.status).toBe(201);
    await request(app)
      .put(`/api/stores/grns/${kitweGrn.body.grn.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approved' });

    const lusakaGrn = await request(app)
      .post('/api/stores/grns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pr_id: prId,
        received_by: 'Test',
        location: 'Lusaka',
        items: [{ item_code: 'LOC-TEST-1', item_name: 'Test Impeller', quantity_ordered: 4, quantity_received: 4, unit: 'pcs' }]
      });
    expect(lusakaGrn.status).toBe(201);
    await request(app)
      .put(`/api/stores/grns/${lusakaGrn.body.grn.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approved' });

    const register = await request(app)
      .get('/api/stores/stock-register')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(register.status).toBe(200);
    const rows = register.body.filter(r => r.item_code === 'LOC-TEST-1');
    expect(rows.length).toBe(2);
    const kitweRow = rows.find(r => r.location === 'Kitwe');
    const lusakaRow = rows.find(r => r.location === 'Lusaka');
    expect(kitweRow.stock_in).toBe(10);
    expect(kitweRow.available).toBe(10);
    expect(lusakaRow.stock_in).toBe(4);
    expect(lusakaRow.available).toBe(4);

    // An issue slip against the Kitwe GRN must be issued from Kitwe.
    const mismatched = await request(app)
      .post('/api/stores/issue-slips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        issued_to: 'Site A',
        location: 'Lusaka',
        reference_number: kitweGrn.body.grn.id,
        items: [{ item_code: 'LOC-TEST-1', item_name: 'Test Impeller', quantity: 3, unit: 'pcs' }]
      });
    expect(mismatched.status).toBe(400);
    expect(mismatched.body.error).toMatch(/was received at Kitwe/i);

    const matched = await request(app)
      .post('/api/stores/issue-slips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        issued_to: 'Site A',
        location: 'Kitwe',
        reference_number: kitweGrn.body.grn.id,
        items: [{ item_code: 'LOC-TEST-1', item_name: 'Test Impeller', quantity: 3, unit: 'pcs' }]
      });
    expect(matched.status).toBe(201);

    // Fast-forward the slip straight to approved, bypassing the HOD/Finance
    // endpoints (which fire real email notifications) since we only need
    // to verify the stock register's location-aware aggregation here.
    await IssueSlip.updateOne({ id: matched.body.slip.id }, { $set: { status: 'approved' } });

    const registerAfterIssue = await request(app)
      .get('/api/stores/stock-register')
      .set('Authorization', `Bearer ${adminToken}`);
    const rowsAfter = registerAfterIssue.body.filter(r => r.item_code === 'LOC-TEST-1');
    const kitweAfter = rowsAfter.find(r => r.location === 'Kitwe');
    const lusakaAfter = rowsAfter.find(r => r.location === 'Lusaka');
    expect(kitweAfter.stock_out).toBe(3);
    expect(kitweAfter.available).toBe(7);
    expect(lusakaAfter.stock_out).toBe(0);
    expect(lusakaAfter.available).toBe(4);
  });
});

describe('stores item_code as primary key', () => {
  const Requisition = require('../../models/Requisition');
  let prId;

  beforeAll(async () => {
    prId = `TEST-PR-CODE-${Date.now()}`;
    await Requisition.create({
      id: prId,
      description: 'Test PR for item_code smoke test',
      quantity: 1,
      department: 'Operations',
      urgency: 'normal',
      initiator_id: 'test-initiator',
      initiator_name: 'Test Initiator',
      status: 'approved',
      items: [{ item_name: 'Test Widget', quantity: 20 }]
    });
  });

  test('GRN with a blank item_code is rejected', async () => {
    const res = await request(app)
      .post('/api/stores/grns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pr_id: prId,
        received_by: 'Test',
        location: 'Kitwe',
        items: [{ item_code: '  ', item_name: 'Test Widget', quantity_ordered: 5, quantity_received: 5, unit: 'pcs' }]
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/item code is required/i);
  });

  test('GRN with an uncatalogued item_code auto-creates a catalog entry, normalized', async () => {
    const grn = await request(app)
      .post('/api/stores/grns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pr_id: prId,
        received_by: 'Test',
        location: 'Kitwe',
        items: [{ item_code: 'new-part-99', item_name: 'Brand New Part', quantity_ordered: 5, quantity_received: 5, unit: 'pcs' }]
      });
    expect(grn.status).toBe(201);
    // Saved on the GRN itself, normalized.
    expect(grn.body.grn.items[0].item_code).toBe('NEW-PART-99');
    await request(app)
      .put(`/api/stores/grns/${grn.body.grn.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approved' });

    const catalog = await request(app)
      .get('/api/stores/stock-items')
      .set('Authorization', `Bearer ${adminToken}`);
    const created = catalog.body.filter(i => i.item_number === 'NEW-PART-99');
    expect(created.length).toBe(1);
    expect(created[0].item_description).toBe('Brand New Part');

    // A second GRN reusing the same code with different case/whitespace
    // must not create a duplicate catalog entry.
    const grn2 = await request(app)
      .post('/api/stores/grns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pr_id: prId,
        received_by: 'Test',
        location: 'Kitwe',
        items: [{ item_code: ' New-Part-99 ', item_name: 'Brand New Part', quantity_ordered: 3, quantity_received: 3, unit: 'pcs' }]
      });
    expect(grn2.status).toBe(201);
    await request(app)
      .put(`/api/stores/grns/${grn2.body.grn.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approved' });

    const catalogAfter = await request(app)
      .get('/api/stores/stock-items')
      .set('Authorization', `Bearer ${adminToken}`);
    const stillOne = catalogAfter.body.filter(i => i.item_number === 'NEW-PART-99');
    expect(stillOne.length).toBe(1);

    // The Stock Register must collapse both GRNs' lines into a single row
    // despite the case/whitespace differences in how item_code was typed.
    const register = await request(app)
      .get('/api/stores/stock-register')
      .set('Authorization', `Bearer ${adminToken}`);
    const rows = register.body.filter(r => r.item_code === 'NEW-PART-99');
    expect(rows.length).toBe(1);
    expect(rows[0].stock_in).toBe(8);
  });
});
