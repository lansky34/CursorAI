export const testConfig = {
    database: {
        postgresUrl: `postgres://localhost:5432/test_db_${process.env.JEST_WORKER_ID || 'main'}`,
        ssl: false,
        pool: {
            min: 1,
            max: 5,
            idleTimeoutMillis: 1000,
            connectionTimeoutMillis: 1000
        }
    },
    server: {
        port: 3001,
        host: 'localhost'
    },
    logging: {
        level: 'error',
        silent: true
    },
    security: {
        jwtSecret: 'test-secret',
        saltRounds: 4
    }
}; 