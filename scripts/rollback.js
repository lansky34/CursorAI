const { execSync } = require('child_process');
const { logger } = require('../utils/logger');
const path = require('path');
const fs = require('fs');

class RollbackManager {
    constructor() {
        this.rollbackPoints = [];
        this.backupDir = path.join(__dirname, '../backups');
        this.logFile = path.join(__dirname, '../logs/rollback.log');
    }

    async createRollbackPoint() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        logger.info(`Creating rollback point: ${timestamp}`);

        try {
            // Create backup directory if it doesn't exist
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }

            // Create rollback point
        const rollbackPoint = {
            timestamp,
                version: process.env.npm_package_version,
                git: {
                    commit: execSync('git rev-parse HEAD').toString().trim(),
                    branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
                },
                database: await this.createDatabaseBackup(timestamp),
                config: await this.backupConfig(timestamp),
                logs: await this.backupLogs(timestamp)
            };

            // Save rollback point metadata
            fs.writeFileSync(
                path.join(this.backupDir, `rollback-${timestamp}.json`),
                JSON.stringify(rollbackPoint, null, 2)
            );

        this.rollbackPoints.push(rollbackPoint);
            logger.info('Rollback point created successfully', rollbackPoint);

        return rollbackPoint;
        } catch (error) {
            logger.error('Failed to create rollback point:', error);
            throw error;
        }
    }

    async rollback(pointId) {
        logger.info(`Starting rollback to point: ${pointId}`);

        try {
            // Enable maintenance mode
            execSync('heroku maintenance:on');
            logger.info('Maintenance mode enabled');

            // Load rollback point
            const rollbackPoint = this.loadRollbackPoint(pointId);
        if (!rollbackPoint) {
            throw new Error(`Rollback point ${pointId} not found`);
        }

            // Stop application
            await this.stopApplication();

            // Restore database
            await this.restoreDatabase(rollbackPoint.database);

            // Restore code
            await this.restoreCode(rollbackPoint.git);

            // Restore configuration
            await this.restoreConfig(rollbackPoint.config);

            // Start application
            await this.startApplication();

            // Verify rollback
            await this.verifyRollback();

            // Disable maintenance mode
            execSync('heroku maintenance:off');
            logger.info('Rollback completed successfully');

        } catch (error) {
            logger.error('Rollback failed:', error);
            await this.handleRollbackFailure(error);
            throw error;
        }
    }

    async createDatabaseBackup(timestamp) {
        logger.info('Creating database backup...');
        const backupFile = path.join(this.backupDir, `db-${timestamp}.sql`);
        
        try {
            execSync(`heroku pg:backups:capture`);
            execSync(`heroku pg:backups:download --output=${backupFile}`);
            return backupFile;
        } catch (error) {
            logger.error('Database backup failed:', error);
            throw error;
        }
    }

    async backupConfig(timestamp) {
        const configFile = path.join(this.backupDir, `config-${timestamp}.json`);
        const config = execSync('heroku config --json').toString();
        fs.writeFileSync(configFile, config);
        return configFile;
    }

    async backupLogs(timestamp) {
        const logsFile = path.join(this.backupDir, `logs-${timestamp}.txt`);
        execSync(`heroku logs --num 1500 > ${logsFile}`);
        return logsFile;
    }

    async restoreDatabase(backupFile) {
        logger.info('Restoring database...');
        try {
            execSync(`heroku pg:reset --confirm ${process.env.HEROKU_APP_NAME}`);
            execSync(`heroku pg:backups:restore '${backupFile}' --confirm ${process.env.HEROKU_APP_NAME}`);
            logger.info('Database restored successfully');
        } catch (error) {
            logger.error('Database restore failed:', error);
            throw error;
        }
    }

    async restoreCode(gitInfo) {
        logger.info('Restoring code...');
        try {
            execSync(`git checkout ${gitInfo.commit}`);
            execSync('git push heroku HEAD:main -f');
            logger.info('Code restored successfully');
        } catch (error) {
            logger.error('Code restore failed:', error);
            throw error;
        }
    }

    async verifyRollback() {
        logger.info('Verifying rollback...');
        try {
            // Check application health
            const healthCheck = execSync('curl https://${process.env.HEROKU_APP_NAME}.herokuapp.com/health');
            if (!healthCheck.includes('healthy')) {
                throw new Error('Health check failed after rollback');
            }

            // Check database connectivity
            execSync('heroku run npm run db:verify');

            logger.info('Rollback verification successful');
        } catch (error) {
            logger.error('Rollback verification failed:', error);
            throw error;
        }
    }

    async handleRollbackFailure(error) {
        logger.error('Handling rollback failure:', error);
        
        // Send emergency notifications
        this.sendEmergencyNotifications(error);

        // Keep maintenance mode on
        execSync('heroku maintenance:on');

        // Log detailed diagnostics
        this.logDiagnostics(error);
    }

    sendEmergencyNotifications(error) {
        // Implement your notification logic here
        logger.error('Emergency: Rollback failed', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }

    logDiagnostics(error) {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                stack: error.stack
            },
            system: {
                herokuStatus: execSync('heroku status').toString(),
                databaseStatus: execSync('heroku pg:info').toString(),
                logs: execSync('heroku logs --num 50').toString()
            }
        };

        fs.writeFileSync(
            path.join(this.backupDir, `rollback-failure-${Date.now()}.json`),
            JSON.stringify(diagnostics, null, 2)
        );
    }
}

module.exports = new RollbackManager(); 