/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
    testTimeout: 30000,
    // These integration tests spin up a single in-memory MongoDB and share it
    // across files; running them in parallel workers would race on data.
    maxWorkers: 1,
};
