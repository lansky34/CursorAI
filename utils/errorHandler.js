const winston = require('winston');
const path = require('path');

// Configure error logger
const errorLogger = winston.createLogger({
    level: 'error',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'review-aggregator' },
    transports: [
        // Error log file
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // Separate file for uncaught exceptions
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/uncaught-exceptions.log'),
            handleExceptions: true,
            maxsize: 5242880,
            maxFiles: 5
        })
    ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    errorLogger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
        handleExceptions: true
    }));
}

// Custom error class for operational errors
class AppError extends Error {
    constructor(statusCode, message, errorType = 'operational', isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.errorType = errorType;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Add specific error types
const ErrorTypes = {
    VALIDATION: 'validation_error',
    DATABASE: 'database_error',
    AUTHENTICATION: 'auth_error',
    TIMEOUT: 'timeout_error',
    RATE_LIMIT: 'rate_limit_error'
};

// Enhanced error handler
const errorHandler = (err, req, res, next) => {
    // Log error with context
    errorLogger.error('Error occurred:', {
        error: err.message,
        type: err.errorType,
        stack: err.stack,
        path: req.path,
        method: req.method,
        query: req.query,
        body: req.body,
        user: req.user?.id,
        ip: req.ip
    });

    // Handle specific error types
    switch(err.errorType) {
        case ErrorTypes.VALIDATION:
            return res.status(400).json({
                status: 'error',
                type: 'validation_error',
                message: err.message
            });
        case ErrorTypes.DATABASE:
            return res.status(503).json({
                status: 'error',
                type: 'database_error',
                message: 'Database operation failed'
            });
        // Add other error type handlers
    }

    // Default error response
    res.status(err.statusCode || 500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production' 
            ? 'An unexpected error occurred' 
            : err.message
    });
};

// Handle specific error types
const handleDatabaseError = (err) => {
    if (err.code === '23505') { // Unique violation
        return new AppError(400, 'Duplicate entry found');
    }
    if (err.code === '23503') { // Foreign key violation
        return new AppError(400, 'Referenced record not found');
    }
    return new AppError(500, 'Database error occurred');
};

const handleValidationError = (err) => {
    const errors = Object.values(err.errors).map(error => error.message);
    return new AppError(400, `Invalid input: ${errors.join(', ')}`);
};

const handleJWTError = () => new AppError(401, 'Invalid token. Please log in again.');

const handleJWTExpiredError = () => new AppError(401, 'Your token has expired. Please log in again.');

// Process uncaught exceptions and unhandled rejections
const setupErrorHandlers = (server) => {
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
        errorLogger.error('Uncaught Exception:', {
            error: err.message,
            stack: err.stack
        });
        
        // Give the logger time to write
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
        errorLogger.error('Unhandled Rejection:', {
            error: err.message,
            stack: err.stack
        });
        
        // Close server gracefully
        server.close(() => {
            errorLogger.error('Server closed due to unhandled promise rejection');
            process.exit(1);
        });
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
        errorLogger.info('SIGTERM received. Shutting down gracefully...');
        server.close(() => {
            errorLogger.info('Process terminated');
            process.exit(0);
        });
    });
};

// Async error wrapper
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Rate limiting error handler
const handleTooManyRequests = () => new AppError(429, 'Too many requests from this IP, please try again later');

module.exports = {
    AppError,
    errorHandler,
    errorLogger,
    setupErrorHandlers,
    catchAsync,
    handleDatabaseError,
    handleValidationError,
    handleJWTError,
    handleJWTExpiredError,
    handleTooManyRequests
}; 