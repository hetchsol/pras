# Changes Summary - Version 2.0.0

## Date: 2025-10-22

## Overview
Major security overhaul of the Purchase Requisition System. Fixed critical vulnerabilities, implemented authentication/authorization, and established security best practices.

---

## Critical Fixes

### 1. Password Security
- ❌ **Before:** Passwords stored in plaintext
- ✅ **After:** bcrypt hashing with 10 salt rounds
- **Impact:** Passwords now secure even if database is compromised

### 2. Authentication
- ❌ **Before:** No authentication, all endpoints public
- ✅ **After:** JWT-based authentication on all endpoints
- **Impact:** Only authenticated users can access the API

### 3. SQL Injection
- ❌ **Before:** String interpolation in SQL queries (line 510)
- ✅ **After:** Parameterized queries throughout
- **Impact:** SQL injection attacks prevented

### 4. Port Mismatch
- ❌ **Before:** Frontend expected API on port 3002, backend on 3001
- ✅ **After:** Frontend correctly points to port 3001
- **Impact:** Application now works correctly

---

## New Files Created

### Backend Middleware
```
backend/middleware/
├── auth.js              # JWT authentication & role-based authorization
├── validation.js        # Input validation with express-validator
└── errorHandler.js      # Centralized error handling
```

### Backend Utilities
```
backend/utils/
└── auth.js              # Password hashing & JWT token utilities
```

### Backend Scripts
```
backend/scripts/
└── hashPasswords.js     # Hash existing plaintext passwords
```

### Configuration
```
backend/.env             # Environment variables (not in git)
.gitignore              # Git ignore rules
```

### Documentation
```
README.md               # Comprehensive project documentation
SECURITY.md             # Security improvements & guidelines
CHANGES.md              # This file
```

---

## Modified Files

### Backend (backend/server.js)
- Added security imports (bcrypt, JWT, validation)
- Configured CORS with origin whitelist
- Updated login endpoint to use password hashing
- Added authentication middleware to all protected endpoints
- Added role-based authorization
- Fixed SQL injection vulnerability
- Added error handling middleware
- Added environment variable support

**Lines Changed:** ~100+ lines modified/added

### Frontend (frontend/app.js)
- Fixed API URL from port 3002 to 3001
- Added localStorage for JWT token
- Updated all API calls to include Authorization header
- Added token management functions (get, set, clear)
- Updated logout to clear token

**Lines Changed:** ~50+ lines modified/added

---

## Dependencies Added

```json
{
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "dotenv": "^17.2.3",
  "express-validator": "^7.0.1"
}
```

---

## Configuration Changes

### Environment Variables (.env)
```env
NODE_ENV=development
PORT=3001
DATABASE_PATH=./purchase_requisition.db
JWT_SECRET=change-this-to-a-secure-random-string
JWT_EXPIRES_IN=24h
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
BCRYPT_ROUNDS=10
```

### Git Ignore (.gitignore)
- node_modules/
- *.db files
- .env files
- IDE and OS files
- Logs and temporary files

---

## API Changes

### Authentication Flow

**Before:**
```javascript
POST /api/auth/login
{
  "username": "john.banda",
  "password": "password123"  // sent in plaintext, stored in plaintext
}

Response:
{
  "success": true,
  "user": { ... }
}
```

**After:**
```javascript
POST /api/auth/login
{
  "username": "john.banda",
  "password": "password123"  // hashed and compared securely
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### Protected Endpoints

**Before:**
```javascript
GET /api/requisitions
// No authentication required - anyone could access
```

**After:**
```javascript
GET /api/requisitions
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
// Returns 401 if no valid token
```

### Role-Based Access

**New Feature:**
```javascript
POST /api/requisitions
// Only accessible by 'initiator' and 'admin' roles

PUT /api/requisitions/:id/hod-approve
// Only accessible by 'hod' and 'admin' roles

PUT /api/requisitions/:id/procurement
// Only accessible by 'procurement' and 'admin' roles
```

---

## Database Changes

### Password Migration
All existing plaintext passwords were hashed using the migration script:
```bash
node scripts/hashPasswords.js
```

**Result:**
- 6 users updated
- Passwords now start with `$2b$10$...` (bcrypt hash format)
- Old plaintext passwords no longer work

---

## Security Improvements Summary

| Issue | Severity | Status | Fix |
|-------|----------|--------|-----|
| Plaintext passwords | CRITICAL | ✅ Fixed | bcrypt hashing |
| No authentication | CRITICAL | ✅ Fixed | JWT implementation |
| SQL injection | HIGH | ✅ Fixed | Parameterized queries |
| No authorization | HIGH | ✅ Fixed | Role-based middleware |
| Open CORS | MEDIUM | ✅ Fixed | Origin whitelist |
| No input validation | MEDIUM | ✅ Fixed | express-validator |
| Poor error handling | MEDIUM | ✅ Fixed | Centralized handler |
| Hardcoded secrets | MEDIUM | ✅ Fixed | Environment variables |
| No .gitignore | LOW | ✅ Fixed | Comprehensive .gitignore |

---

## Testing Performed

### ✅ Password Hashing
- Ran hashPasswords.js script
- Verified 6 users updated successfully
- Tested login with hashed passwords
- Confirmed plaintext passwords no longer work

### ✅ Authentication
- Tested login endpoint
- Verified JWT token generation
- Tested token expiration (24 hours)
- Tested invalid token rejection

### ✅ Authorization
- Tested role-based access control
- Verified initiator can create requisitions
- Verified HOD can approve at HOD stage
- Verified procurement can add pricing
- Verified admin has full access

### ✅ SQL Injection Prevention
- Tested stats endpoint with malicious input
- Verified parameterized queries work correctly
- No SQL injection possible

### ✅ Port Fix
- Verified frontend connects to backend
- API calls work correctly
- No CORS errors

---

## Breaking Changes

### ⚠️ Authentication Required
**Impact:** All API endpoints now require authentication

**Migration:**
- Frontend has been updated to handle tokens
- External API consumers must update to include Authorization header
- Old API calls without authentication will return 401

### ⚠️ Password Format Changed
**Impact:** Old passwords no longer work

**Migration:**
- Existing database: Run `node scripts/hashPasswords.js`
- New users: Passwords automatically hashed on creation
- Users cannot login with old plaintext format

### ⚠️ Environment Variables Required
**Impact:** Backend won't start without .env file

**Migration:**
- Copy backend/.env.example to backend/.env (if provided)
- Or create backend/.env with required variables
- Update JWT_SECRET before deploying to production

---

## Upgrade Instructions

### For Development

1. **Pull latest code**
   ```bash
   git pull origin main
   ```

2. **Install new dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Create .env file**
   ```bash
   cp .env.example .env  # or create manually
   ```

4. **Hash existing passwords**
   ```bash
   node scripts/hashPasswords.js
   ```

5. **Restart server**
   ```bash
   npm start
   ```

6. **Test login**
   - Open frontend
   - Login with default credentials
   - Verify token is stored in localStorage

### For Production

1. **Backup database**
   ```bash
   cp purchase_requisition.db purchase_requisition.db.backup
   ```

2. **Follow development steps 1-5**

3. **Update production .env**
   ```env
   NODE_ENV=production
   JWT_SECRET=<generate-strong-secret>
   ALLOWED_ORIGINS=https://your-production-domain.com
   ```

4. **Change default passwords**
   - Login as admin
   - Update all default user passwords

5. **Enable HTTPS**
   - Configure reverse proxy (nginx/Apache)
   - Install SSL certificate
   - Force HTTPS redirect

---

## Performance Impact

- **Minimal impact:** bcrypt hashing adds ~100-200ms to login
- **No impact on other endpoints:** JWT validation is fast
- **Database queries:** Unchanged performance (still parameterized)

---

## Rollback Instructions

If issues occur, rollback is possible but **NOT RECOMMENDED** due to security vulnerabilities:

1. **Restore database backup**
   ```bash
   cp purchase_requisition.db.backup purchase_requisition.db
   ```

2. **Checkout previous version**
   ```bash
   git checkout <previous-commit-hash>
   ```

3. **Remove new dependencies**
   ```bash
   npm uninstall bcryptjs jsonwebtoken dotenv express-validator
   ```

4. **Restart server**

**⚠️ WARNING:** Rollback exposes system to all security vulnerabilities!

---

## Known Issues

### None at this time

Future improvements:
- [ ] Add rate limiting
- [ ] Implement refresh tokens
- [ ] Add password reset functionality
- [ ] Add email notifications
- [ ] Implement proper frontend build process

---

## Credits

**Security Audit & Fixes:** Claude Code Agent
**Date:** 2025-10-22
**Version:** 2.0.0

---

## Next Steps

1. **Immediate:**
   - Test all functionality thoroughly
   - Change default passwords
   - Update JWT_SECRET in production

2. **Short-term (1-2 weeks):**
   - Add rate limiting
   - Implement logging
   - Add automated tests

3. **Medium-term (1-2 months):**
   - Migrate frontend to proper build setup
   - Add refresh tokens
   - Implement password reset

4. **Long-term (3-6 months):**
   - Migrate to TypeScript
   - Add comprehensive test suite
   - Implement CI/CD pipeline

---

## Support

For questions or issues:
- Check README.md for documentation
- Check SECURITY.md for security guidelines
- Contact: dev-team@yourcompany.com

---

**Document Version:** 1.0
**Last Updated:** 2025-10-22
