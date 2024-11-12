const { execSync } = require('child_process');
const logger = require('../utils/logger');

async function setupDatabase() {
    try {
        logger.info('Starting database setup...');

        // Run migrations
        logger.info('Running migrations...');
        execSync('npx knex migrate:latest', { stdio: 'inherit' });
        logger.info('Migrations completed successfully');

        // Run seeds if specified
        if (process.env.SEED_DATABASE === 'true') {
            logger.info('Running seeds...');
            execSync('npx knex seed:run', { stdio: 'inherit' });
            logger.info('Seeds completed successfully');
        }

        logger.info('Database setup completed successfully');
    } catch (error) {
        logger.error('Error during database setup:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    setupDatabase().catch((error) => {
        logger.error('Database setup failed:', error);
        process.exit(1);
    });
}

module.exports = setupDatabase; 