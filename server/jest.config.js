module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.test.js'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    // Source JS uses ES module syntax and is compiled by tsc (allowJs) in production
    '^.+[\\\\/]src[\\\\/].+\\.js$': ['ts-jest', { diagnostics: false }],
    '^.+\\.js$': 'babel-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!**/node_modules/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
};