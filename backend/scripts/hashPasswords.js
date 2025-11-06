require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

const hashExistingPasswords = async () => {
  console.log('🔄 Starting password hashing process...\n');

  db.all('SELECT id, username, password FROM users', async (err, users) => {
    if (err) {
      console.error('❌ Error fetching users:', err);
      db.close();
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️ No users found in database');
      db.close();
      return;
    }

    console.log(`Found ${users.length} users to process\n`);

    for (const user of users) {
      try {
        // Check if password is already hashed (bcrypt hashes start with $2a$ or $2b$)
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
          console.log(`⏭️  Skipping ${user.username} - password already hashed`);
          continue;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(user.password, 10);

        // Update the database
        db.run(
          'UPDATE users SET password = ? WHERE id = ?',
          [hashedPassword, user.id],
          (err) => {
            if (err) {
              console.error(`❌ Error updating ${user.username}:`, err);
            } else {
              console.log(`✅ Hashed password for ${user.username}`);
            }
          }
        );
      } catch (error) {
        console.error(`❌ Error processing ${user.username}:`, error);
      }
    }

    // Wait a bit for all updates to complete
    setTimeout(() => {
      console.log('\n✅ Password hashing completed!');
      db.close();
    }, 2000);
  });
};

hashExistingPasswords();
