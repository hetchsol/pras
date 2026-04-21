// Per-file setup: ensures JWT_SECRET is set before server-mongo is
// required (boot guard in server-mongo exits otherwise).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-'.repeat(8);
process.env.NODE_ENV = 'test';
