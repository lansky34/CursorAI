const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

// Define custom log levels and colors
const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        debug: 4
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        http: 'magenta',
        debug: 'blue'
    }
};

// Create log directory if it doesn't exist
const logDir = path.join(__dirname, '..', 'logs');
require('fs').mkdirSync(logDir, { recursive: true });

// Configure log formats
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    winston.format.json()
);

// Configure console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(metadata).length > 0) {
            msg += `\n${JSON.stringify(metadata, null, 2)}`;
        }
        return msg;
    })
);

// Add log rotation configuration
const rotationConfig = {
    filename: '%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    compress: true
};

// Enhance logger with separate streams for different log levels
const logger = winston.createLogger({
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        debug: 4
    },
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.metadata(),
        winston.format.json()
    ),
    transports: [
        // Error logs with rotation
        new winston.transports.DailyRotateFile({
            ...rotationConfig,
            level: 'error',
            filename: 'logs/error-%DATE%.log'
        }),
        // Application logs with rotation
        new winston.transports.DailyRotateFile({
            ...rotationConfig,
            filename: 'logs/app-%DATE%.log'
        }),
        // HTTP request logs with rotation
        new winston.transports.DailyRotateFile({
            ...rotationConfig,
            level: 'http',
            filename: 'logs/http-%DATE%.log'
        })
    ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
    }));
}

// Add log monitoring
logger.on('error', (error) => {
    console.error('Logger error:', error);
});

// Add monitoring metrics
const metrics = {
    requestCount: 0,
    errorCount: 0,
    slowRequestCount: 0,
    lastError: null,
    startTime: Date.now(),

    reset() {
        this.requestCount = 0;
        this.errorCount = 0;
        this.slowRequestCount = 0;
    },

    getStats() {
        return {
            uptime: Date.now() - this.startTime,
            requestCount: this.requestCount,
            errorCount: this.errorCount,
            slowRequestCount: this.slowRequestCount,
            lastError: this.lastError
        };
    }
};

// Create logging middleware
const requestLogger = (req, res, next) => {
    const start = process.hrtime();

    // Log request
    logger.http('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });

    // Log response
    res.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds * 1000 + nanoseconds / 1000000;

        const logData = {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            contentLength: res.get('Content-Length'),
            ip: req.ip
        };

        // Log slow requests (over 2 seconds)
        if (duration > 2000) {
            logger.warn('Slow request detected', {
                ...logData,
                query: req.query,
                body: req.body
            });
            metrics.slowRequestCount++;
        }

        // Log normal requests
        logger.http('Request completed', logData);
    });

    next();
};

// Create query logger
const queryLogger = (query, params, duration) => {
    const logData = {
        query,
        params,
        duration
    };

    // Log slow queries (over 1 second)
    if (duration > 1000) {
        logger.warn('Slow query detected', logData);
        metrics.slowRequestCount++;
    } else {
        logger.debug('Query executed', logData);
    }
};

// Create error logger
const errorLogger = (error, req) => {
    const logData = {
        error: error.message,
        stack: error.stack,
        path: req?.path,
        method: req?.method,
        query: req?.query,
        body: req?.body,
        ip: req?.ip
    };

    logger.error('Error occurred', logData);
    metrics.errorCount++;
};

// Export logging utilities
module.exports = {
    logger,
    requestLogger,
    queryLogger,
    errorLogger,
    metrics
}; 