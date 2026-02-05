const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate JWT access token (short-lived)
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      department: user.department
    },
    process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } // Shorter expiry for access tokens
  );
};

// Generate refresh token (long-lived, random string)
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
  } catch (error) {
    return null;
  }
};

// Calculate refresh token expiry (default 7 days)
const getRefreshTokenExpiry = () => {
  const days = parseInt(process.env.REFRESH_TOKEN_DAYS || '7');
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate.toISOString();
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  verifyToken,
  getRefreshTokenExpiry
};
