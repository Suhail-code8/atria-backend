module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
};
