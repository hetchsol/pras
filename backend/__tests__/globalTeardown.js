module.exports = async function globalTeardown() {
  if (global.__MONGO_REPLSET__) {
    await global.__MONGO_REPLSET__.stop();
  }
  const fs = require('fs');
  const path = require('path');
  const uriFile = path.join(__dirname, '.mongo-uri');
  if (fs.existsSync(uriFile)) fs.unlinkSync(uriFile);
};
