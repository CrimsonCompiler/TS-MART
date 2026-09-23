/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  testTimeout: 30000,
  // Each integration test file manages its own MongoMemoryServer lifecycle
  // (see __tests__/helpers.js). Slower than a shared global setup, but
  // robust: every worker starts fresh and there's no cross-process state
  // to leak. Unit tests in __tests__/utils/ don't touch Mongo at all.
  maxWorkers: 1,
  verbose: true,

  // Coverage thresholds — keep us honest about regressions on the parts of
  // the codebase that matter most. Low bars on purpose; raise as test
  // coverage grows.
  collectCoverageFrom: [
    'app.js',
    'server.js',
    'routes/**/*.js',
    'utils/**/*.js',
    'models/**/*.js',
    '!utils/__mocks__/**',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    // Don't fail the build if a single file drops — too noisy in a small
    // codebase. Per-directory thresholds grow alongside the test suite.
    global: {
      statements: 25,
      branches: 20,
      functions: 25,
      lines: 25,
    },
  },
};
