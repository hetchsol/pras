# 🔑 Actual Login Credentials

## Current Users in Database

Based on your database, here are the **ACTUAL** users you should use to login:

### 1. Admin Account
```
Username: admin
Password: admin123
Role: Admin
```

### 2. Other Users (All use password: `password123`)

| Username | Password | Role |
|----------|----------|------|
| clarence.simwanza | password123 | (Unknown - check in app) |
| kanyembo.ndhlovu | password123 | (Unknown - check in app) |
| joe.munthali | password123 | (Unknown - check in app) |
| justine.kaluya | password123 | (Unknown - check in app) |
| anne.banda | password123 | (Unknown - check in app) |
| sarah.banda | password123 | Finance Manager |

---

## ⚠️ Important Notes

1. **These are the REAL users in your database**
   - The users shown in the server startup message (john.banda, mary.mwanza, etc.) do NOT exist in your current database

2. **All passwords are hashed and working** ✅
   - The hashPasswords script has been run
   - Login should work now

3. **Try logging in with these credentials:**
   ```
   admin / admin123
   ```
   OR
   ```
   sarah.banda / password123
   ```

---

## 🔍 To Check User Roles

After logging in as `admin`, go to the Admin Console to see all users and their roles.

---

## 📝 If You Need Different Users

If you want to add the default demo users (john.banda, mary.mwanza, etc.), you would need to:

1. Login as admin
2. Go to Admin Console → User Management
3. Add new users manually

OR run the database initialization script to reset the database with default users.

---

**Try logging in now with:**
- Username: `admin`
- Password: `admin123`

This should work from any computer on your network at:
- `http://ZMKTCMW002:3001`
- `http://192.168.5.249:3001`

---

**Last Updated:** October 31, 2025
