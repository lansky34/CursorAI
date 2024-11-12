// Production environment configuration
module.exports = {
    env: 'production',
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || '0.0.0.0',
        corsOrigin: process.env.CORS_ORIGIN || 'https://yourdomain.com',
        trustProxy: true // For Heroku/proxy environments
    },
    database: {
        url: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Required for Heroku PostgreSQL
        },
        pool: {
            min: 2,
            max: 20,
            idle: 30000,
            acquire: 60000
        }
    },
    security: {
        rateLimitWindow: 15 * 60 * 1000, // 15 minutes
        rateLimitMax: 100,
        bcryptRounds: 12,
        jwtExpiresIn: '1d',
        cookieSecure: true,
        cookieSameSite: 'strict'
    },
    logging: {
        level: 'info',
        format: 'json',
        maxFiles: '14d',
        maxSize: '20m'
    },
    monitoring: {
        enabled: true,
        metricsInterval: 60000 // 1 minute
    }
}; 