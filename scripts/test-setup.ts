import { Pool } from 'pg';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

async function setupTestEnvironment() {
    const pool = new Pool({
        connectionString: config.database.postgresUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        logger.info('Setting up test environment...');

        // Create test database
        await pool.query(`
            CREATE DATABASE test_db_${process.env.JEST_WORKER_ID || 'main'}
        `);

        // Run migrations
        await pool.query(`
            CREATE TABLE IF NOT EXISTS businesses (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                latitude FLOAT NOT NULL,
                longitude FLOAT NOT NULL,
                sentiment_score FLOAT DEFAULT 0,
                visit_count INTEGER DEFAULT 0,
                badges JSONB DEFAULT '[]',
                aspect_sentiment JSONB DEFAULT '{}'
            )
        `);

        logger.info('Test environment setup completed');
    } catch (error) {
        logger.error('Error setting up test environment:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    setupTestEnvironment().catch((error) => {
        console.error('Test setup failed:', error);
        process.exit(1);
    });
}

export { setupTestEnvironment }; 