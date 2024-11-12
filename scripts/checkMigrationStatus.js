const { Pool } = require('pg');
const logger = require('../utils/logger');
const knex = require('knex');
const config = require('../knexfile');

async function checkMigrationStatus() {
    const env = process.env.NODE_ENV || 'development';
    const knexInstance = knex(config[env]);
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: env === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        logger.info('Checking migration status...');

        // Check if migrations table exists
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'knex_migrations'
            );
        `);

        if (!tableExists.rows[0].exists) {
            throw new Error('Migrations table does not exist. Run migrations first.');
        }

        // Get migration status
        const migrations = await knexInstance.migrate.list();
        const [completed, pending] = migrations;

        // Check table structure
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE';
        `);

        // Verify required tables
        const requiredTables = ['businesses', 'reviews', 'photos'];
        const missingTables = requiredTables.filter(table => 
            !tables.rows.find(row => row.table_name === table)
        );

        // Check table constraints
        const constraintChecks = await Promise.all(requiredTables.map(async table => {
            if (missingTables.includes(table)) return null;
            
            const constraints = await pool.query(`
                SELECT constraint_name, constraint_type
                FROM information_schema.table_constraints
                WHERE table_name = $1;
            `, [table]);
            
            return {
                table,
                constraints: constraints.rows
            };
        }));

        // Generate status report
        const report = {
            migrationStatus: {
                completedMigrations: completed.length,
                pendingMigrations: pending.length,
                completed: completed.map(m => m.name),
                pending: pending.map(m => m.name)
            },
            tableStatus: {
                existingTables: tables.rows.map(row => row.table_name),
                missingTables,
                constraints: constraintChecks.filter(Boolean)
            },
            issues: []
        };

        // Check for issues
        if (pending.length > 0) {
            report.issues.push(`${pending.length} pending migrations need to be run`);
        }
        if (missingTables.length > 0) {
            report.issues.push(`Missing required tables: ${missingTables.join(', ')}`);
        }

        // Check foreign key constraints
        const missingForeignKeys = constraintChecks
            .filter(Boolean)
            .filter(check => 
                check.table !== 'businesses' && 
                !check.constraints.some(c => c.constraint_type === 'FOREIGN KEY')
            );
        
        if (missingForeignKeys.length > 0) {
            report.issues.push(
                `Missing foreign key constraints in tables: ${
                    missingForeignKeys.map(c => c.table).join(', ')
                }`
            );
        }

        // Log report
        if (report.issues.length > 0) {
            logger.error('Migration check found issues:', {
                issues: report.issues,
                details: report
            });
        } else {
            logger.info('Migration check passed successfully:', report);
        }

        return report;

    } catch (error) {
        logger.error('Error checking migration status:', error);
        throw error;
    } finally {
        await pool.end();
        await knexInstance.destroy();
    }
}

// Run if called directly
if (require.main === module) {
    checkMigrationStatus()
        .then(report => {
            if (report.issues.length > 0) {
                console.error('Migration issues found:');
                report.issues.forEach(issue => console.error(`- ${issue}`));
                process.exit(1);
            } else {
                console.log('Migrations are up to date');
                process.exit(0);
            }
        })
        .catch(error => {
            console.error('Migration check failed:', error);
            process.exit(1);
        });
}

module.exports = checkMigrationStatus; 