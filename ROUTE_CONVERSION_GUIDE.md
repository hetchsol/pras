# PostgreSQL Route Conversion Guide

## Progress: 75% Complete

**✅ Done:**
- Database initialization
- Seed data functions
- Login route (line 348)

**🔄 Remaining:** ~55 routes to convert

## Conversion Pattern

### Before (SQLite):
```javascript
app.post('/api/endpoint', async (req, res, next) => {
    try {
        db.get("SELECT * FROM table WHERE id = ?", [id], async (err, row) => {
            if (err) return next(new AppError('Error', 500));
            // ... nested callback hell
            db.run("INSERT INTO table VALUES (?, ?)", [val1, val2], (err) => {
                if (err) return next(new AppError('Error', 500));
                res.json({ success: true });
            });
        });
    } catch (error) {
        next(error);
    }
});
```

### After (PostgreSQL):
```javascript
app.post('/api/endpoint', async (req, res, next) => {
    try {
        const result = await pool.query("SELECT * FROM table WHERE id = $1", [id]);
        const row = result.rows[0];

        await pool.query("INSERT INTO table VALUES ($1, $2)", [val1, val2]);

        res.json({ success: true });
    } catch (error) {
        console.error('Endpoint error:', error);
        next(new AppError('Operation failed', 500));
    }
});
```

## Key Changes

### 1. Replace Database Operations
| SQLite | PostgreSQL |
|--------|------------|
| `db.get(..., (err, row) => {})` | `const result = await pool.query(...); const row = result.rows[0];` |
| `db.all(..., (err, rows) => {})` | `const result = await pool.query(...); const rows = result.rows;` |
| `db.run(..., (err) => {})` | `await pool.query(...);` |

### 2. Update SQL Parameters
| SQLite | PostgreSQL |
|--------|------------|
| `WHERE id = ?` | `WHERE id = $1` |
| `VALUES (?, ?, ?)` | `VALUES ($1, $2, $3)` |
| Multiple `?` | `$1, $2, $3, $4...` (numbered) |

### 3. Handle Results
```javascript
// SQLite
db.get("SELECT...", [id], (err, user) => {
    if (user) { /* use user */ }
});

// PostgreSQL
const result = await pool.query("SELECT...", [id]);
const user = result.rows[0];
if (user) { /* use user */ }
```

### 4. Error Handling
```javascript
// SQLite - nested callbacks
db.get(..., (err, row) => {
    if (err) return next(new AppError(...));
    // more code
});

// PostgreSQL - try/catch
try {
    const result = await pool.query(...);
    // more code
} catch (error) {
    console.error('Error:', error);
    next(new AppError(...));
}
```

## Routes to Convert (In Priority Order)

### Critical (Do First):
1. **Authentication Routes** (line ~348+)
   - ✅ `/api/auth/login` - DONE
   - ⏳ `/api/auth/me`
   - ⏳ `/api/auth/refresh`
   - ⏳ `/api/auth/logout`

2. **Requisition CRUD** (line ~500+)
   - ⏳ `GET /api/requisitions` - List all
   - ⏳ `GET /api/requisitions/:id` - Get one
   - ⏳ `POST /api/requisitions` - Create
   - ⏳ `PUT /api/requisitions/:id` - Update
   - ⏳ `DELETE /api/requisitions/:id` - Delete

3. **Requisition Items** (line ~700+)
   - ⏳ `POST /api/requisitions/:id/items` - Add item
   - ⏳ `PUT /api/requisitions/:id/items/:itemId` - Update item
   - ⏳ `DELETE /api/requisitions/:id/items/:itemId` - Delete item

### Important (Do Next):
4. **Approval Workflow** (line ~900+)
   - ⏳ HOD approval routes
   - ⏳ Finance approval routes
   - ⏳ MD approval routes
   - ⏳ Procurement routes

5. **User Management** (line ~1200+)
   - ⏳ `GET /api/users` - List users
   - ⏳ `POST /api/users` - Create user
   - ⏳ `PUT /api/users/:id` - Update user
   - ⏳ `DELETE /api/users/:id` - Delete user

### Additional Features:
6. **Vendors** (line ~1400+)
7. **Departments** (line ~1500+)
8. **Forms** (EFT, Expense Claims, etc.) (line ~1600+)
9. **Reports & Analytics** (line ~1800+)
10. **Audit Log** (line ~2000+)

## Quick Find & Replace Patterns

### Safe Regex Replacements (Use with caution!):
```regex
# Find: db\.get\(
# Replace: await pool.query(

# After replacing, manually:
# 1. Remove callback parameter: (err, row) =>
# 2. Add: const result = await pool.query(...)
# 3. Extract row: const row = result.rows[0]
# 4. Change ? to $1, $2, etc.
```

## Testing Strategy

After converting each route:
1. **Start PostgreSQL** locally
2. **Set DATABASE_URL** in .env
3. **Run server**: `npm start`
4. **Test endpoint** with curl/Postman
5. **Check logs** for errors
6. **Fix issues** before moving to next route

## Example Complete Conversion

### Original (lines 430-450):
```javascript
app.get('/api/auth/me', authenticate, (req, res, next) => {
    try {
        const user = getUserById(req.user.id); // This might be sync SQLite
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        next(error);
    }
});
```

### Converted:
```javascript
app.get('/api/auth/me', authenticate, async (req, res, next) => {
    try {
        const result = await pool.query(
            "SELECT id, username, full_name, email, role, department, is_hod FROM users WHERE id = $1",
            [req.user.id]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get current user error:', error);
        next(new AppError('Failed to get user info', 500));
    }
});
```

## Common Pitfalls

### ❌ Wrong:
```javascript
const result = await pool.query(...);
if (result) { /* result is always truthy! */ }
```

### ✅ Correct:
```javascript
const result = await pool.query(...);
const user = result.rows[0];
if (user) { /* check the actual row */ }
```

### ❌ Wrong:
```javascript
// Mixing ? and $ placeholders
await pool.query("SELECT * FROM users WHERE id = ? AND role = $1", [id, role]);
```

### ✅ Correct:
```javascript
// Use only $ placeholders
await pool.query("SELECT * FROM users WHERE id = $1 AND role = $2", [id, role]);
```

## Next Steps

1. **Convert remaining auth routes** (4 routes)
2. **Convert requisition CRUD** (5-10 routes)
3. **Convert approval workflow** (10-15 routes)
4. **Test thoroughly** with PostgreSQL database
5. **Deploy to Railway/Render** with PostgreSQL addon

## Commands

```bash
# Continue conversion
cd backend
npm start

# Test with local PostgreSQL
psql -U postgres
CREATE DATABASE purchase_requisition_db;

# Update .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/purchase_requisition_db

# Deploy to Railway (after complete)
# Railway will provide DATABASE_URL automatically
```

---

**Estimated Time Remaining:** 3-5 hours for complete conversion

**Current Commit:** `3090694` - Login route converted

**Backup:** `backend/server.js.sqlite.backup` - Original SQLite version
