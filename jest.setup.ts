import { Pool } from 'pg';
import { testConfig } from './src/config/test.config';

beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Create test database connection
    const pool = new Pool({
        connectionString: testConfig.database.postgresUrl
    });

    // Make pool available globally for tests
    global.__TEST_POOL__ = pool;
});

afterAll(async () => {
    // Close database connection
    if (global.__TEST_POOL__) {
        await global.__TEST_POOL__.end();
    }
});

// Add retry logic for flaky tests
jest.retryTimes(3, { logErrorsBeforeRetry: true }); 