const path = require('path');

// Load environment variables from .env file
require('dotenv').config({
    path: path.join(__dirname, '..', process.env.NODE_ENV === 'test' ? '.env.test' : '.env')
});

// Required environment variables
const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'JWT_SECRET'
];

// Optional environment variables with defaults
const defaultConfig = {
    PORT: 3000,
    LOG_LEVEL: 'info',
    API_RATE_LIMIT: 100,
    CACHE_TTL: 3600,
    ENABLE_AI_INSIGHTS: true,
    ENABLE_SENTIMENT_ANALYSIS: true,
    CORS_ORIGIN: '*'
};

// Add environment-specific configurations
const config = {
    development: {
        logLevel: 'debug',
        dbPoolSize: 5,
        cacheEnabled: false,
        apiRateLimit: 1000
    },
    production: {
        logLevel: 'info',
        dbPoolSize: 20,
        cacheEnabled: true,
        apiRateLimit: 100
    },
    test: {
        logLevel: 'error',
        dbPoolSize: 2,
        cacheEnabled: false,
        apiRateLimit: 0
    }
};

// Add configuration validation
function validateConfig() {
    const requiredVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'OPENAI_API_KEY'
    ];

    const missing = requiredVars.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

// Validate environment variables
function validateEnv() {
    const missing = requiredEnvVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables:\n${missing.join('\n')}\n` +
            'Please check your .env file and ensure all required variables are set.'
        );
    }
}

// Create configuration object
const config = {
    env: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    isTest: process.env.NODE_ENV === 'test',

    server: {
        port: parseInt(process.env.PORT || defaultConfig.PORT),
        corsOrigin: process.env.CORS_ORIGIN || defaultConfig.CORS_ORIGIN,
        apiRateLimit: parseInt(process.env.API_RATE_LIMIT || defaultConfig.API_RATE_LIMIT)
    },

    database: {
        mongoUri: process.env.MONGODB_URI,
        postgresUrl: process.env.DATABASE_URL,
        redisUrl: process.env.REDIS_URL
    },

    auth: {
        jwtSecret: process.env.JWT_SECRET,
        sessionSecret: process.env.SESSION_SECRET,
        jwtExpiresIn: '1d'
    },

    apis: {
        openai: {
            apiKey: process.env.OPENAI_API_KEY,
            organization: process.env.OPENAI_ORG_ID
        },
        mapbox: {
            accessToken: process.env.MAPBOX_ACCESS_TOKEN
        }
    },

    features: {
        aiInsights: process.env.ENABLE_AI_INSIGHTS === 'true',
        sentimentAnalysis: process.env.ENABLE_SENTIMENT_ANALYSIS === 'true'
    },

    cache: {
        ttl: parseInt(process.env.CACHE_TTL || defaultConfig.CACHE_TTL)
    },

    logging: {
        level: process.env.LOG_LEVEL || defaultConfig.LOG_LEVEL,
        format: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'development' ? 'dev' : 'combined')
    },

    email: {
        smtp: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    },

    aws: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
        s3Bucket: process.env.S3_BUCKET
    } : null
};

// Freeze configuration to prevent modifications
Object.freeze(config);

module.exports = {
    config,
    validateEnv,
    validateConfig
}; 