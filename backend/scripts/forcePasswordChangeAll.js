/**
 * Backfill: force every existing user to change their password at next login
 * and (optionally) reset all passwords to a shared default.
 *
 * Usage:
 *   node backend/scripts/forcePasswordChangeAll.js              # flag-only, do not touch passwords
 *   node backend/scripts/forcePasswordChangeAll.js --reset      # also reset passwords to default
 *   node backend/scripts/forcePasswordChangeAll.js --reset --password=Welcome2026
 *   node backend/scripts/forcePasswordChangeAll.js --exclude=admin
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

function parseArgs() {
  const out = { reset: false, password: 'Password123', exclude: [] };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--reset') out.reset = true;
    else if (arg.startsWith('--password=')) out.password = arg.slice('--password='.length);
    else if (arg.startsWith('--exclude=')) out.exclude = arg.slice('--exclude='.length).split(',').map(s => s.trim()).filter(Boolean);
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/purchase_requisition_db';

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  const filter = args.exclude.length ? { username: { $nin: args.exclude } } : {};
  const update = { $set: { must_change_password: true } };

  if (args.reset) {
    const hash = await bcrypt.hash(args.password, 10);
    update.$set.password = hash;
    update.$set.password_changed_at = new Date();
    console.log(`Resetting all passwords to: ${args.password}`);
  } else {
    console.log('Flagging users for forced password change (passwords untouched).');
  }

  if (args.exclude.length) {
    console.log(`Excluding usernames: ${args.exclude.join(', ')}`);
  }

  const result = await User.updateMany(filter, update);
  console.log(`Matched: ${result.matchedCount ?? result.n}, Modified: ${result.modifiedCount ?? result.nModified}`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
