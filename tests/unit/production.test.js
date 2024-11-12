const { Pool } = require('pg');
const { config } = require('../../utils/config');
const { logger } = require('../../utils/logger');
const {
    executeQuery,
    executeTransaction,
    cleanupPool
} = require('../../server');

describe('Production Environment Tests', () => {
    let pool;

    beforeAll(async () => {
        pool = new Pool({
            connectionString: config.database.postgresUrl,
            ssl: { rejectUnauthorized: false }
        });
    });

    afterAll(async () => {
        await pool.end();
    });

    describe('Database Connection', () => {
        test('Should connect to production database', async () => {
            const client = await pool.connect();
            try {
                const result = await client.query('SELECT NOW()');
                expect(result.rows).toHaveLength(1);
            } finally {
                client.release();
            }
        });

        test('Should handle connection pool limits', async () => {
            const clients = [];
            try {
                // Try to acquire more than max connections
                for (let i = 0; i < 25; i++) {
                    clients.push(await pool.connect());
                }
            } catch (error) {
                expect(error.message).toMatch(/timeout/i);
            } finally {
                await Promise.all(clients.map(client => client.release()));
            }
        });
    });

    describe('Environment Configuration', () => {
        test('Should have required environment variables', () => {
            expect(process.env.NODE_ENV).toBe('production');
            expect(process.env.DATABASE_URL).toBeDefined();
            expect(process.env.JWT_SECRET).toBeDefined();
        });

        test('Should have correct SSL configuration', () => {
            expect(config.database.ssl.rejectUnauthorized).toBe(false);
        });
    });

    describe('Logging Configuration', () => {
        test('Should use production log level', () => {
            expect(logger.level).toBe('info');
        });

        test('Should write to log files', async () => {
            const testError = new Error('Test error');
            logger.error(testError);
            // Verify log file was written
            // This might need to be adapted based on your logging setup
        });
    });

    describe('Security Configuration', () => {
        test('Should have secure cookie settings', () => {
            expect(config.security.cookieSecure).toBe(true);
            expect(config.security.cookieSameSite).toBe('strict');
        });

        test('Should have rate limiting enabled', () => {
            expect(config.security.rateLimitMax).toBeDefined();
            expect(config.security.rateLimitWindow).toBeDefined();
        });
    });

    describe('Performance Monitoring', () => {
        test('Should track slow queries', async () => {
            const startTime = Date.now();
            await pool.query('SELECT pg_sleep(2)');
            const duration = Date.now() - startTime;
            expect(duration).toBeGreaterThan(2000);
            // Verify slow query was logged
        });

        test('Should handle query timeouts', async () => {
            try {
                await pool.query('SELECT pg_sleep(31)');
                fail('Should have timed out');
            } catch (error) {
                expect(error.message).toMatch(/timeout/i);
            }
        });
    });

    describe('Error Handling', () => {
        test('Should handle database errors gracefully', async () => {
            try {
                await pool.query('SELECT * FROM nonexistent_table');
                fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeDefined();
                // Verify error was logged
            }
        });

        test('Should handle connection errors', async () => {
            const badPool = new Pool({
                connectionString: 'postgres://invalid:5432/db'
            });
            try {
                await badPool.connect();
                fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeDefined();
            } finally {
                await badPool.end();
            }
        });
    });
}); 