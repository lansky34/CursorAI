const winston = require('winston');

// Configure timeout logger
const timeoutLogger = winston.createLogger({
    level: 'warn',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'timeout-monitor' },
    transports: [
        new winston.transports.File({ 
            filename: 'logs/timeouts.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Timeout configuration
const timeoutConfig = {
    // API timeouts (in milliseconds)
    api: {
        default: 30000,      // 30 seconds
        database: 5000,      // 5 seconds
        openai: 60000,       // 60 seconds for AI operations
        upload: 120000,      // 2 minutes for file uploads
        longPolling: 300000  // 5 minutes for long-polling operations
    },
    // Batch operation timeouts
    batch: {
        maxDuration: 300000, // 5 minutes
        itemTimeout: 1000    // 1 second per item
    }
};

// Request timeout middleware
const timeoutMiddleware = (timeout = timeoutConfig.api.default) => {
    return (req, res, next) => {
        // Set timeout for the request
        req.setTimeout(timeout, () => {
            const timeoutError = new Error('Request timeout');
            timeoutError.status = 408;
            
            // Log timeout
            timeoutLogger.warn('Request timeout', {
                path: req.path,
                method: req.method,
                timeout,
                query: req.query,
                ip: req.ip
            });

            next(timeoutError);
        });

        // Track request start time
        req.startTime = Date.now();

        // Monitor response time
        res.on('finish', () => {
            const duration = Date.now() - req.startTime;
            
            // Log slow requests (over 2 seconds)
            if (duration > 2000) {
                timeoutLogger.warn('Slow request detected', {
                    path: req.path,
                    method: req.method,
                    duration,
                    query: req.query,
                    ip: req.ip
                });
            }
        });

        next();
    };
};

// Database query timeout wrapper
const withQueryTimeout = async (query, timeout = timeoutConfig.api.database) => {
    try {
        return await Promise.race([
            query,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Database query timeout')), timeout)
            )
        ]);
    } catch (error) {
        if (error.message === 'Database query timeout') {
            timeoutLogger.warn('Database query timeout', {
                query: query.text,
                params: query.values,
                timeout
            });
        }
        throw error;
    }
};

// Batch operation timeout handler
const batchTimeoutHandler = (items, operation, options = {}) => {
    const timeout = Math.min(
        options.timeout || timeoutConfig.batch.maxDuration,
        items.length * timeoutConfig.batch.itemTimeout
    );

    return Promise.race([
        Promise.all(items.map(operation)),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Batch operation timeout')), timeout)
        )
    ]).catch(error => {
        if (error.message === 'Batch operation timeout') {
            timeoutLogger.warn('Batch operation timeout', {
                itemCount: items.length,
                timeout,
                operation: operation.name
            });
        }
        throw error;
    });
};

// Long-running operation monitor
class OperationMonitor {
    constructor(name, timeout = timeoutConfig.api.default) {
        this.name = name;
        this.timeout = timeout;
        this.startTime = Date.now();
        this.timer = setTimeout(() => this.handleTimeout(), timeout);
    }

    handleTimeout() {
        timeoutLogger.warn('Long-running operation detected', {
            operation: this.name,
            duration: Date.now() - this.startTime,
            timeout: this.timeout
        });
    }

    end() {
        clearTimeout(this.timer);
        const duration = Date.now() - this.startTime;
        
        if (duration > this.timeout) {
            timeoutLogger.warn('Operation exceeded expected duration', {
                operation: this.name,
                duration,
                timeout: this.timeout
            });
        }
    }
}

module.exports = {
    timeoutConfig,
    timeoutMiddleware,
    withQueryTimeout,
    batchTimeoutHandler,
    OperationMonitor
}; 