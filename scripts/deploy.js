const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Deployment configuration
const config = {
    production: {
        host: 'production.server.com',
        path: '/var/www/production',
        branch: 'main'
    },
    staging: {
        host: 'staging.server.com',
        path: '/var/www/staging',
        branch: 'develop'
    }
};

// Add after database migrations
const checkMigrationStatus = require('./checkMigrationStatus');

// Deployment steps
async function deploy(environment) {
    const env = config[environment];
    if (!env) {
        throw new Error(`Invalid environment: ${environment}`);
    }

    console.log(`Starting deployment to ${environment}...`);

    try {
        // Run tests
        console.log('Running tests...');
        execSync('npm test');

        // Build application
        console.log('Building application...');
        execSync('npm run build');

        // Deploy to server
        console.log(`Deploying to ${env.host}...`);
        execSync(`rsync -avz --delete dist/ ${env.host}:${env.path}`);

        // Run and verify migrations
        console.log('Running database migrations...');
        execSync(`heroku run npm run migrate:latest --app ${appName}`);
        
        console.log('Verifying migrations...');
        await verifyMigrations();

        // Restart application
        console.log('Restarting application...');
        execSync(`ssh ${env.host} "pm2 restart ${environment}"`);

        console.log('Deployment completed successfully!');
    } catch (error) {
        console.error('Deployment failed:', error.message);
        process.exit(1);
    }
}

async function verifyMigrations() {
    try {
        const report = await checkMigrationStatus();
        if (report.issues.length > 0) {
            throw new Error(`Migration issues found:\n${report.issues.join('\n')}`);
        }
        console.log('Migration verification passed');
    } catch (error) {
        console.error('Migration verification failed:', error);
        throw error;
    }
}

// Run deployment
const environment = process.argv[2];
if (!environment) {
    console.error('Please specify environment (production/staging)');
    process.exit(1);
}

deploy(environment); 