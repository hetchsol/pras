const { body, param, query, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Login validation
const validateLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

// Create requisition validation
const validateCreateRequisition = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Title must not exceed 200 characters'),
  body('description')
    .optional()
    .trim(),
  body('delivery_location')
    .trim()
    .notEmpty().withMessage('Delivery location is required'),
  body('created_by')
    .isInt({ min: 1 }).withMessage('Valid user ID is required'),
  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.item_name')
    .trim()
    .notEmpty().withMessage('Item name is required'),
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  handleValidationErrors
];

// Update requisition validation
const validateUpdateRequisition = [
  param('id')
    .isInt({ min: 1 }).withMessage('Valid requisition ID is required'),
  body('user_id')
    .isInt({ min: 1 }).withMessage('Valid user ID is required'),
  handleValidationErrors
];

// ID parameter validation
const validateId = [
  param('id')
    .isInt({ min: 1 }).withMessage('Valid ID is required'),
  handleValidationErrors
];

// User creation validation
const validateCreateUser = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Username can only contain letters, numbers, dots, underscores, and hyphens'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ max: 100 }).withMessage('Full name must not exceed 100 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('role')
    .isIn(['initiator', 'hod', 'procurement', 'finance', 'md', 'admin'])
    .withMessage('Valid role is required'),
  body('department')
    .trim()
    .notEmpty().withMessage('Department is required'),
  handleValidationErrors
];

// Vendor creation validation
const validateCreateVendor = [
  body('name')
    .trim()
    .notEmpty().withMessage('Vendor name is required')
    .isLength({ max: 100 }).withMessage('Vendor name must not exceed 100 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('phone')
    .optional()
    .trim()
    .matches(/^[+\d\s()-]+$/).withMessage('Invalid phone number format'),
  handleValidationErrors
];

module.exports = {
  validateLogin,
  validateCreateRequisition,
  validateUpdateRequisition,
  validateId,
  validateCreateUser,
  validateCreateVendor,
  handleValidationErrors
};
