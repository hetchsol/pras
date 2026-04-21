const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Boots a single-node replica set so Mongoose transactions (used in the
// stores write paths) work in tests the same way they do on Atlas.
module.exports = async function globalSetup() {
  const replset = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  const uri = replset.getUri();
  process.env.MONGODB_URI = uri;
  // Stash on global so teardown can stop it.
  global.__MONGO_REPLSET__ = replset;
  // Also write to a file so teardown (a separate process) can find it.
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.join(__dirname, '.mongo-uri'), uri);
};
