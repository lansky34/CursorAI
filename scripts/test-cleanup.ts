import { Pool } from 'pg';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

async function cleanupTestEnvironment() {
    const pool = new Pool({
        connectionString: config.database.postgresUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        logger.info('Cleaning up test environment...');

        // Drop test database
        await pool.query(`
            DROP DATABASE IF EXISTS test_db_${process.env.JEST_WORKER_ID || 'main'}
        `);

        logger.info('Test environment cleanup completed');
    } catch (error) {
        logger.error('Error cleaning up test environment:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    cleanupTestEnvironment().catch((error) => {
        console.error('Test cleanup failed:', error);
        process.exit(1);
    });
}

export { cleanupTestEnvironment }; 