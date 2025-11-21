/**
 * Test Setup File
 * Runs before all tests to initialize test environment
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || '8285fd41d8d8f9cb606770410fc823a95e1d472bad33dd3285d1056e97c1d90377fe83a25fbef0fe611a73ce281ac4aa2f92c24f6366d4f9f5cd556ab729b388';

// Increase timeout for integration tests that hit the database
jest.setTimeout(10000);

// Global test setup
beforeAll(() => {
  console.log('🧪 Test suite starting...');
});

// Global test teardown
afterAll(() => {
  console.log('✅ Test suite completed');
});
