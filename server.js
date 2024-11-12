const express = require('express');
const { Pool } = require('pg');
const winston = require('winston');
const path = require('path');
require('dotenv').config();
const { config, validateEnv } = require('./utils/config');
const { 
    timeoutMiddleware, 
    timeoutConfig 
} = require('./utils/timeoutHandler');
const { applySecurityMiddleware } = require('./utils/security');
const { validateEnv, checkSecurityIssues } = require('./utils/envValidator');
const resourceMonitor = require('./utils/resourceMonitor');
const https = require('https');
const sslConfig = require('./utils/sslConfig');
const helmet = require('helmet');
const Sentry = require('@sentry/node');
const feedbackCollector = require('./utils/feedbackCollector');
const feedbackRoutes = require('./routes/feedback');

// Initialize logger
const logger = winston.createLogger({
    level: config.logging.level,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log' 
        })
    ]
});

// Add console logging in development
if (config.logging.format === 'dev') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Track active connections and shutdown state
let isShuttingDown = false;
const activeConnections = new Set();

// Validate environment before starting server
try {
    // Load environment variables
    require('dotenv').config({
        path: path.join(__dirname, process.env.NODE_ENV === 'test' ? '.env.test' : '.env')
    });

    // Validate environment variables
    validateEnv();

    // Check for security issues
    checkSecurityIssues();

} catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
}

// Use configuration throughout the application
const poolConfig = {
    connectionString: config.database.postgresUrl,
    ssl: config.isProduction ? {
        rejectUnauthorized: false
    } : false,
    max: config.isProduction ? 20 : 5,
    min: 2, // Minimum pool size
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 5000, // Connection timeout after 5 seconds
    maxUses: 7500, // Maximum number of times a connection can be used before being recycled
    application_name: 'review-aggregator', // For monitoring
    statement_timeout: 30000, // Statement timeout after 30 seconds
    query_timeout: 30000, // Query timeout after 30 seconds
    keepAlive: true, // Enable TCP keepalive
    keepAliveInitialDelayMillis: 10000 // Initial delay for keepalive
};

// Create connection pool
const pool = new Pool(poolConfig);

// Monitor pool events
pool.on('connect', (client) => {
    logger.debug('New client connected to pool', {
        processID: client.processID,
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
    });
});

pool.on('error', (err, client) => {
    logger.error('Unexpected error on idle client', {
        error: err.message,
        stack: err.stack,
        processID: client?.processID
    });
});

pool.on('acquire', (client) => {
    logger.debug('Client acquired from pool', {
        processID: client.processID,
        idleCount: pool.idleCount
    });
});

pool.on('remove', (client) => {
    logger.debug('Client removed from pool', {
        processID: client.processID,
        totalCount: pool.totalCount
    });
});

// Enhanced query execution with parameterized queries
const executeQuery = async (text, params = []) => {
    const client = await pool.connect();
    try {
        return await client.query(text, params);
    } finally {
        client.release();
    }
};

// Transaction helper
const executeTransaction = async (callback) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Example of parameterized query usage
const findBusinessById = async (id) => {
    const query = {
        text: 'SELECT * FROM businesses WHERE id = $1',
        values: [id]
    };
    
    return executeQuery(query.text, query.values);
};

// Example of transaction usage
const createBusinessWithReviews = async (businessData, reviews) => {
    return executeTransaction(async (client) => {
        // Insert business
        const businessQuery = {
            text: 'INSERT INTO businesses(name, location) VALUES($1, $2) RETURNING id',
            values: [businessData.name, businessData.location]
        };
        
        const business = await executeQuery(businessQuery.text, businessQuery.values, client);
        
        // Insert reviews
        const reviewQuery = {
            text: 'INSERT INTO reviews(business_id, content, rating) VALUES($1, $2, $3)',
            values: [business.id, reviews.content, reviews.rating]
        };
        
        await executeQuery(reviewQuery.text, reviewQuery.values, client);
        
        return business;
    });
};

// Health check query
const checkDatabaseHealth = async () => {
    try {
        const result = await executeQuery('SELECT 1');
        return result.rows.length === 1;
    } catch (error) {
        logger.error('Database health check failed', {
            error: error.message,
            stack: error.stack
        });
        return false;
    }
};

// Pool cleanup on shutdown
const cleanupPool = async () => {
    try {
        logger.info('Closing database pool...');
        await pool.end();
        logger.info('Database pool closed');
    } catch (error) {
        logger.error('Error closing pool', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

// Export database utilities
module.exports = {
    pool,
    executeQuery,
    executeTransaction,
    findBusinessById,
    createBusinessWithReviews,
    checkDatabaseHealth,
    cleanupPool
};

// Connection tracking middleware
const connectionTracker = (req, res, next) => {
    // Reject new requests during shutdown
    if (isShuttingDown) {
        res.status(503).json({ error: 'Server is shutting down' });
        return;
    }

    // Track the connection
    activeConnections.add(res);
    
    // Remove from tracking once the response is completed
    res.on('finish', () => {
        activeConnections.delete(res);
    });

    next();
};

const app = express();
app.use(connectionTracker);

// Apply default timeout middleware
app.use(timeoutMiddleware());

// Route-specific timeouts
app.use('/api/ai/*', timeoutMiddleware(timeoutConfig.api.openai));
app.use('/api/upload/*', timeoutMiddleware(timeoutConfig.api.upload));
app.use('/api/long-polling/*', timeoutMiddleware(timeoutConfig.api.longPolling));

// Apply security middleware before routes
applySecurityMiddleware(app);

// Enhanced security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
            imgSrc: ["'self'", 'data:', 'cdn.jsdelivr.net'],
            connectSrc: ["'self'", 'api.openai.com'],
            fontSrc: ["'self'", 'cdn.jsdelivr.net'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    originAgentCluster: true,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    xssFilter: true
}));

// Force HTTPS
app.use((req, res, next) => {
    if (!req.secure && process.env.NODE_ENV === 'production') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
});

// Create HTTPS server
const httpsServer = https.createServer(sslConfig.getSSLConfig(), app);

// Start server with SSL
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

if (process.env.NODE_ENV === 'production') {
    // Production: HTTPS only
    httpsServer.listen(HTTPS_PORT, () => {
        logger.info(`HTTPS Server running on port ${HTTPS_PORT}`);
        
        // Check certificate expiration
        const certStatus = sslConfig.checkCertificateExpiration();
        logger.info('Certificate status:', certStatus);
    });
} else {
    // Development: Allow HTTP
    app.listen(PORT, () => {
        logger.info(`HTTP Server running on port ${PORT}`);
    });
}

// Monitor server events
httpsServer.on('close', () => {
    logger.info('HTTPS Server closed');
});

// Export for testing
module.exports = {
    app,
    httpsServer,
    pool,
    gracefulShutdown
}; 

// Start resource monitoring after server starts
httpsServer.on('listening', () => {
    resourceMonitor.start();
    logger.info('Server started with resource monitoring enabled');
});

// Stop resource monitoring on server shutdown
httpsServer.on('close', () => {
    resourceMonitor.stop();
    logger.info('Server stopped, resource monitoring disabled');
});

// Add health check endpoint with resource metrics
app.get('/health/resources', (req, res) => {
    const metrics = resourceMonitor.getMetrics();
    res.json({
        status: 'healthy',
        metrics: {
            cpu: {
                usage: `${metrics.cpu.usage.toFixed(2)}%`,
                loadAverage: metrics.cpu.loadAverage
            },
            memory: {
                used: `${(metrics.memory.used / 1024 / 1024).toFixed(2)}MB`,
                total: `${(metrics.memory.total / 1024 / 1024).toFixed(2)}MB`,
                percentage: `${metrics.memory.usedPercent.toFixed(2)}%`
            },
            process: {
                uptime: `${(metrics.process.uptime / 60).toFixed(2)} minutes`,
                memory: {
                    heapUsed: `${(metrics.process.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                    rss: `${(metrics.process.memory.rss / 1024 / 1024).toFixed(2)}MB`
                }
            }
        }
    });
});

app.use('/api/feedback', feedbackRoutes);

// Error reporting middleware
app.use((err, req, res, next) => {
    // Log error
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    // Report to Sentry
    Sentry.captureException(err);

    // Collect error feedback
    feedbackCollector.collectFeedback({
        type: 'error',
        severity: err.status >= 500 ? 'critical' : 'high',
        description: err.message,
        metadata: {
            path: req.path,
            method: req.method,
            statusCode: err.status
        }
    }).catch(error => {
        logger.error('Error collecting error feedback:', error);
    });

    // Send response
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'An unexpected error occurred' 
            : err.message
    });
}); 