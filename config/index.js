const development = require('./development');
const staging = require('./staging');
const production = require('./production');
const test = require('./test');

const configs = {
    development,
    staging,
    production,
    test
};

// Validate environment variables
function validateConfig(config) {
    const required = [
        'DATABASE_URL',
        'JWT_SECRET',
        'OPENAI_API_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return config;
}

// Get configuration for current environment
function getConfig() {
    const env = process.env.NODE_ENV || 'development';
    const config = configs[env];
    
    if (!config) {
        throw new Error(`Invalid environment: ${env}`);
    }

    return validateConfig(config);
}

module.exports = getConfig(); 