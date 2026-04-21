module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  globalSetup: '<rootDir>/__tests__/globalSetup.js',
  globalTeardown: '<rootDir>/__tests__/globalTeardown.js',
  testTimeout: 60000,
  // Run test files serially so two concurrent suites don't both try to
  // seed the default admin user into the shared in-memory Mongo
  // (the second seed would log a duplicate-key error).
  maxWorkers: 1,
  // mongodb-memory-server can emit open handles from its child process
  // shutdown path; forceExit keeps CI green without masking real leaks.
  forceExit: true,
  verbose: true
};
