const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

async function backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../backups');
    const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

    try {
        // Create backups directory if it doesn't exist
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Create backup
        logger.info('Starting database backup...');
        execSync(`pg_dump ${process.env.DATABASE_URL} > ${backupFile}`);
        logger.info(`Backup created successfully: ${backupFile}`);

        // Clean up old backups (keep last 5)
        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('backup-'))
            .sort()
            .reverse();

        if (files.length > 5) {
            files.slice(5).forEach(file => {
                fs.unlinkSync(path.join(backupDir, file));
                logger.info(`Deleted old backup: ${file}`);
            });
        }

    } catch (error) {
        logger.error('Backup failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    backupDatabase().catch((error) => {
        logger.error('Database backup failed:', error);
        process.exit(1);
    });
}

module.exports = backupDatabase; 