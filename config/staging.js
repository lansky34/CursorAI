// Staging environment configuration
module.exports = {
    env: 'staging',
    server: {
        port: process.env.PORT || 3000,
        host: '0.0.0.0',
        corsOrigin: process.env.CORS_ORIGIN || 'https://staging.yourdomain.com',
        trustProxy: true
    },
    database: {
        url: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        },
        pool: {
            min: 1,
            max: 10,
            idle: 30000,
            acquire: 60000
        }
    },
    security: {
        rateLimitWindow: 15 * 60 * 1000,
        rateLimitMax: 200,
        bcryptRounds: 12,
        jwtExpiresIn: '1d',
        cookieSecure: true,
        cookieSameSite: 'strict'
    },
    logging: {
        level: 'debug',
        format: 'json',
        maxFiles: '7d',
        maxSize: '20m'
    },
    monitoring: {
        enabled: true,
        metricsInterval: 300000 // 5 minutes
    }
}; 