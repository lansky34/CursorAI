const winston = require('winston');
const { createLogger, format, transports } = winston;
const Sentry = require('@sentry/node');
const StatsD = require('hot-shots');
const newrelic = require('newrelic');

// Initialize Sentry for error tracking
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app })
    ]
});

// Initialize StatsD client for metrics
const statsd = new StatsD({
    host: process.env.STATSD_HOST,
    port: process.env.STATSD_PORT,
    prefix: 'review_aggregator.',
    errorHandler: (error) => {
        console.error('StatsD error:', error);
    }
});

// Configure Winston for Heroku logging
const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp(),
        format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
        format.json()
    ),
    defaultMeta: {
        service: 'review-aggregator',
        environment: process.env.NODE_ENV,
        dyno: process.env.DYNO
    },
    transports: [
        // Console transport (Heroku log drain)
        new transports.Console(),
        
        // Papertrail transport
        new winston.transports.Papertrail({
            host: process.env.PAPERTRAIL_HOST,
            port: process.env.PAPERTRAIL_PORT,
            program: 'review-aggregator',
            flushOnClose: true,
            logFormat: function(level, message) {
                return `[${level}] ${message}`;
            }
        })
    ]
});

// Performance monitoring middleware
const performanceMonitoring = (req, res, next) => {
    const start = process.hrtime();

    // Track request
    statsd.increment('http.request');
    statsd.increment(`http.method.${req.method.toLowerCase()}`);

    // Add response tracking
    res.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds * 1000 + nanoseconds / 1000000;

        // Track response time
        statsd.timing('http.response_time', duration);
        statsd.increment(`http.status_code.${res.statusCode}`);

        // Log slow requests
        if (duration > 1000) {
            logger.warn('Slow request detected', {
                path: req.path,
                method: req.method,
                duration,
                statusCode: res.statusCode
            });
        }

        // Track in New Relic
        newrelic.recordMetric('Custom/responseTime', duration);
    });

    next();
};

// Database monitoring
const monitorDatabase = (pool) => {
    setInterval(() => {
        const metrics = {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount
        };

        // Track pool metrics
        statsd.gauge('db.connections.total', metrics.totalCount);
        statsd.gauge('db.connections.idle', metrics.idleCount);
        statsd.gauge('db.connections.waiting', metrics.waitingCount);

        // Log pool status
        logger.debug('Database pool status', metrics);
    }, 60000); // Every minute
};

// Memory monitoring
const monitorMemory = () => {
    setInterval(() => {
        const used = process.memoryUsage();
        
        // Track memory metrics
        statsd.gauge('memory.heapUsed', used.heapUsed);
        statsd.gauge('memory.heapTotal', used.heapTotal);
        statsd.gauge('memory.rss', used.rss);

        // Log memory usage if high
        const heapUsedMB = used.heapUsed / 1024 / 1024;
        if (heapUsedMB > 500) { // Alert if heap usage > 500MB
            logger.warn('High memory usage detected', {
                heapUsed: heapUsedMB.toFixed(2) + 'MB',
                heapTotal: (used.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
                rss: (used.rss / 1024 / 1024).toFixed(2) + 'MB'
            });
        }
    }, 30000); // Every 30 seconds
};

// Custom metrics tracking
const metrics = {
    trackAPICall: (endpoint) => {
        statsd.increment(`api.calls.${endpoint}`);
    },

    trackQueryTime: (query, duration) => {
        statsd.timing('db.query.duration', duration);
        if (duration > 1000) {
            logger.warn('Slow query detected', { query, duration });
        }
    },

    trackError: (error, context = {}) => {
        statsd.increment('errors.count');
        Sentry.captureException(error, { extra: context });
        logger.error('Error occurred', {
            error: error.message,
            stack: error.stack,
            ...context
        });
    }
};

module.exports = {
    logger,
    metrics,
    performanceMonitoring,
    monitorDatabase,
    monitorMemory
}; 