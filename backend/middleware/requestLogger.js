const { logApiRequest } = require('../utils/logger');

/**
 * Request Logging Middleware
 *
 * Logs all API requests with timing, user info, and response status
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Store the original res.json to intercept it
  const originalJson = res.json;

  res.json = function (body) {
    const duration = Date.now() - startTime;
    logApiRequest(req, res, duration);
    return originalJson.call(this, body);
  };

  // Handle cases where res.send is used instead of res.json
  const originalSend = res.send;

  res.send = function (body) {
    const duration = Date.now() - startTime;
    logApiRequest(req, res, duration);
    return originalSend.call(this, body);
  };

  next();
};

module.exports = requestLogger;
