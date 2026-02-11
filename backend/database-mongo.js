const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const {
  User,
  Requisition,
  Approval,
  Vendor,
  Department,
  FXRate,
  EFTRequisition,
  ExpenseClaim,
  FormApproval,
  PettyCashRequisition,
  Client,
  StockItem
} = require('./models');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/purchase_requisition_db');
    console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Initialize database with default data
const initializeDatabase = async () => {
  try {
    // Check if admin user exists
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      console.log('🔧 Seeding default data...');

      const adminPassword = await bcrypt.hash('password123', 10);
      const userPassword = await bcrypt.hash('password123', 10);

      // Create default users
      const defaultUsers = [
        { username: 'admin', password: adminPassword, full_name: 'System Admin', email: 'admin@company.zm', role: 'admin', department: 'IT', is_hod: 0 },
        { username: 'procurement', password: userPassword, full_name: 'Procurement Officer', email: 'procurement@company.zm', role: 'procurement', department: 'Procurement', is_hod: 0 },
        { username: 'finance', password: userPassword, full_name: 'Finance Officer', email: 'finance@company.zm', role: 'finance', department: 'Finance', is_hod: 1 },
        { username: 'hod', password: userPassword, full_name: 'Head of Department', email: 'hod@company.zm', role: 'hod', department: 'Operations', is_hod: 1 },
        { username: 'initiator', password: userPassword, full_name: 'Test Initiator', email: 'initiator@company.zm', role: 'initiator', department: 'Operations', is_hod: 0 }
      ];

      await User.insertMany(defaultUsers);
      console.log('✅ Default users created');

      // Create default departments
      const defaultDepartments = [
        { name: 'IT', budget: 500000, spent: 0 },
        { name: 'Operations', budget: 1000000, spent: 0 },
        { name: 'Finance', budget: 750000, spent: 0 },
        { name: 'Procurement', budget: 300000, spent: 0 },
        { name: 'HR', budget: 400000, spent: 0 }
      ];

      await Department.insertMany(defaultDepartments);
      console.log('✅ Default departments created');

      // Create default FX rates
      const defaultFXRates = [
        { currency_code: 'ZMW', currency_name: 'Zambian Kwacha', rate_to_zmw: 1, is_active: 1 },
        { currency_code: 'USD', currency_name: 'US Dollar', rate_to_zmw: 27.5, is_active: 1 },
        { currency_code: 'EUR', currency_name: 'Euro', rate_to_zmw: 29.5, is_active: 1 },
        { currency_code: 'GBP', currency_name: 'British Pound', rate_to_zmw: 34.5, is_active: 1 },
        { currency_code: 'ZAR', currency_name: 'South African Rand', rate_to_zmw: 1.5, is_active: 1 }
      ];

      await FXRate.insertMany(defaultFXRates);
      console.log('✅ Default FX rates created');

      // Create default vendors
      const defaultVendors = [
        { name: 'Tech Solutions Ltd', code: 'TSL001', tier: 1, rating: 4.5, category: 'IT Equipment', status: 'active' },
        { name: 'Office Supplies Co', code: 'OSC001', tier: 2, rating: 4.0, category: 'Office Supplies', status: 'active' },
        { name: 'Furniture World', code: 'FW001', tier: 2, rating: 3.8, category: 'Furniture', status: 'active' }
      ];

      await Vendor.insertMany(defaultVendors);
      console.log('✅ Default vendors created');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

// User operations
const getUsers = async () => {
  const users = await User.find().lean();
  return users.map(u => ({ ...u, id: u._id }));
};

const getUserByUsername = async (username) => {
  const user = await User.findOne({ username }).lean();
  if (user) user.id = user._id;
  return user;
};

const getUserById = async (id) => {
  let user;
  if (mongoose.Types.ObjectId.isValid(id)) {
    user = await User.findById(id).lean();
  } else {
    user = await User.findOne({ _id: id }).lean();
  }
  if (user) user.id = user._id;
  return user;
};

const createUser = async (userData) => {
  const user = new User(userData);
  const saved = await user.save();
  return { lastInsertRowid: saved._id, changes: 1 };
};

const updateUser = async (id, userData) => {
  const result = await User.findByIdAndUpdate(id, userData, { new: true });
  return { changes: result ? 1 : 0 };
};

const deleteUser = async (id) => {
  const result = await User.findByIdAndDelete(id);
  return { changes: result ? 1 : 0 };
};

// Requisition operations
const getRequisitions = async () => {
  return await Requisition.find().sort({ created_at: -1 }).lean();
};

const getRequisitionById = async (id) => {
  return await Requisition.findOne({ id }).lean();
};

const createRequisition = async (req) => {
  const requisition = new Requisition({
    id: req.id,
    description: req.description,
    quantity: req.quantity,
    estimated_cost: req.estimatedCost || req.estimated_cost || 0,
    amount: req.amount || 0,
    justification: req.justification || '',
    department: req.department,
    urgency: req.urgency,
    initiator_id: req.initiatorId || req.initiator_id,
    initiator_name: req.initiatorName || req.initiator_name,
    status: req.status,
    items: req.items || [],
    tax_type: req.tax_type || null,
    delivery_location: req.delivery_location || 'Office',
    required_date: req.required_date || null
  });
  const saved = await requisition.save();
  return { lastInsertRowid: saved._id, changes: 1 };
};

const updateRequisitionStatus = async (id, status, selectedVendor = null) => {
  const update = { status };
  if (selectedVendor) update.selected_vendor = selectedVendor;
  const result = await Requisition.findOneAndUpdate({ id }, update);
  return { changes: result ? 1 : 0 };
};

const updateRequisitionByProcurement = async (id, data) => {
  const result = await Requisition.findOneAndUpdate({ id }, data);
  return { changes: result ? 1 : 0 };
};

// Approval operations
const getApprovalsByRequisitionId = async (reqId) => {
  return await Approval.find({ requisition_id: reqId }).sort({ timestamp: 1 }).lean();
};

const createApproval = async (approval) => {
  const newApproval = new Approval({
    requisition_id: approval.requisition_id,
    role: approval.role,
    user_name: approval.userName || approval.user_name,
    action: approval.action,
    comment: approval.comment
  });
  const saved = await newApproval.save();
  return { lastInsertRowid: saved._id, changes: 1 };
};

// Vendor operations
const getVendors = async () => {
  return await Vendor.find().sort({ name: 1 }).lean();
};

const createVendor = async (vendor) => {
  const newVendor = new Vendor(vendor);
  const saved = await newVendor.save();
  return { lastInsertRowid: saved._id, changes: 1 };
};

const deleteVendor = async (id) => {
  const result = await Vendor.findByIdAndDelete(id);
  return { changes: result ? 1 : 0 };
};

// Department operations
const getDepartments = async () => {
  return await Department.find().lean();
};

// FX Rate operations
const getFXRates = async () => {
  return await FXRate.find({ is_active: 1 }).lean();
};

const getAllFXRates = async () => {
  return await FXRate.find().lean();
};

const createFXRate = async (fxRate) => {
  const rate = new FXRate({ ...fxRate, is_active: 1 });
  const saved = await rate.save();
  return { lastInsertRowid: saved._id, changes: 1 };
};

const updateFXRate = async (id, rate_to_zmw) => {
  const result = await FXRate.findByIdAndUpdate(id, { rate_to_zmw });
  return { changes: result ? 1 : 0 };
};

// EFT Requisition operations
const getEFTRequisitions = async () => {
  return await EFTRequisition.find().sort({ created_at: -1 }).lean();
};

const getEFTRequisitionById = async (id) => {
  return await EFTRequisition.findOne({ id }).lean();
};

const createEFTRequisition = async (eft) => {
  const newEFT = new EFTRequisition(eft);
  const saved = await newEFT.save();
  return { lastInsertRowid: saved._id, changes: 1 };
};

const updateEFTRequisitionStatus = async (id, status) => {
  const result = await EFTRequisition.findOneAndUpdate({ id }, { status });
  return { changes: result ? 1 : 0 };
};

// Expense Claim operations
const getExpenseClaims = async () => {
  return await ExpenseClaim.find().sort({ created_at: -1 }).lean();
};

const getExpenseClaimById = async (id) => {
  return await ExpenseClaim.findOne({ id }).lean();
};

const createExpenseClaim = async (claim) => {
  const newClaim = new ExpenseClaim(claim);
  const saved = await newClaim.save();
  return { lastInsertRowid: saved._id, changes: 1 };
};

const updateExpenseClaimStatus = async (id, status) => {
  const result = await ExpenseClaim.findOneAndUpdate({ id }, { status });
  return { changes: result ? 1 : 0 };
};

// Form Approval operations
const getFormApprovals = async (formType, formId) => {
  return await FormApproval.find({ form_type: formType, form_id: formId }).sort({ timestamp: 1 }).lean();
};

const createFormApproval = async (approval) => {
  const newApproval = new FormApproval(approval);
  const saved = await newApproval.save();
  return { lastInsertRowid: saved._id, changes: 1 };
};

module.exports = {
  connectDB,
  initializeDatabase,
  // Users
  getUsers,
  getUserByUsername,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  // Requisitions
  getRequisitions,
  getRequisitionById,
  createRequisition,
  updateRequisitionStatus,
  updateRequisitionByProcurement,
  // Approvals
  getApprovalsByRequisitionId,
  createApproval,
  // Vendors
  getVendors,
  createVendor,
  deleteVendor,
  // Departments
  getDepartments,
  // FX Rates
  getFXRates,
  getAllFXRates,
  createFXRate,
  updateFXRate,
  // EFT Requisitions
  getEFTRequisitions,
  getEFTRequisitionById,
  createEFTRequisition,
  updateEFTRequisitionStatus,
  // Expense Claims
  getExpenseClaims,
  getExpenseClaimById,
  createExpenseClaim,
  updateExpenseClaimStatus,
  // Form Approvals
  getFormApprovals,
  createFormApproval,
  // Models for direct access
  User,
  Requisition,
  Approval,
  Vendor,
  Department,
  FXRate,
  EFTRequisition,
  ExpenseClaim,
  FormApproval,
  PettyCashRequisition,
  Client,
  StockItem
};
