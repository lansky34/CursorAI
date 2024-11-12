const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const { config } = require('./config');

// Security middleware configuration
const securityMiddleware = {
    // Helmet configuration for secure headers
    helmetConfig: helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", 'unpkg.com', 'cdn.jsdelivr.net'],
                styleSrc: ["'self'", "'unsafe-inline'", 'unpkg.com', 'cdn.jsdelivr.net'],
                imgSrc: ["'self'", 'data:', 'unpkg.com'],
                connectSrc: ["'self'", 'api.openai.com'],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        dnsPrefetchControl: true,
        frameguard: { action: 'deny' },
        hidePoweredBy: true,
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        },
        ieNoOpen: true,
        noSniff: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        xssFilter: true
    }),

    // Rate limiting configuration
    rateLimitConfig: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: config.server.apiRateLimit, // limit each IP
        message: 'Too many requests from this IP, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path === '/health', // Skip health check endpoint
        keyGenerator: (req) => {
            return req.headers['x-forwarded-for'] || req.ip;
        },
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path
            });
            res.status(429).json({
                error: 'Too many requests'
            });
        }
    }),

    // CORS configuration
    corsConfig: cors({
        origin: config.server.corsOrigin,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['Content-Range', 'X-Content-Range'],
        credentials: true,
        maxAge: 600 // 10 minutes
    }),

    // Cookie security configuration
    cookieConfig: {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },

    // Session security configuration
    sessionConfig: {
        secret: config.auth.sessionSecret,
        name: 'sessionId',
        cookie: {
            httpOnly: true,
            secure: config.isProduction,
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        },
        resave: false,
        saveUninitialized: false
    }
};

// SQL injection prevention middleware
const sqlInjectionPrevention = (req, res, next) => {
    // Check query parameters
    const sanitizeValue = (value) => {
        if (typeof value === 'string') {
            // Remove SQL injection patterns
            return value.replace(/['";\\]/g, '');
        }
        return value;
    };

    if (req.query) {
        Object.keys(req.query).forEach(key => {
            req.query[key] = sanitizeValue(req.query[key]);
        });
    }

    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeValue(req.body[key]);
            }
        });
    }

    next();
};

// XSS prevention middleware (in addition to helmet)
const xssPreventionMiddleware = (req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = xss(req.body[key]);
            }
        });
    }
    next();
};

// Parameter pollution prevention
const parameterPollutionConfig = hpp({
    whitelist: [
        'sort', 'page', 'limit', 'fields', // Add allowed duplicate parameters
        'latitude', 'longitude', 'radius'
    ]
});

// Security headers check middleware
const securityHeadersCheck = (req, res, next) => {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
};

// Request sanitization middleware
const sanitizeRequest = (req, res, next) => {
    // Sanitize URL parameters
    if (req.params) {
        Object.keys(req.params).forEach(key => {
            req.params[key] = req.params[key].replace(/[^a-zA-Z0-9-_]/g, '');
        });
    }

    // Sanitize request body
    if (req.body) {
        const sanitizeObject = (obj) => {
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] === 'string') {
                    obj[key] = obj[key]
                        .replace(/[<>]/g, '') // Remove < and >
                        .trim();
                } else if (typeof obj[key] === 'object') {
                    sanitizeObject(obj[key]);
                }
            });
        };
        sanitizeObject(req.body);
    }

    next();
};

// Apply all security middleware
const applySecurityMiddleware = (app) => {
    // Apply Helmet
    app.use(securityMiddleware.helmetConfig);

    // Apply CORS
    app.use(securityMiddleware.corsConfig);

    // Apply rate limiting
    app.use('/api/', securityMiddleware.rateLimitConfig);

    // Apply XSS prevention
    app.use(xssPreventionMiddleware);

    // Apply parameter pollution prevention
    app.use(parameterPollutionConfig);

    // Apply SQL injection prevention
    app.use(sqlInjectionPrevention);

    // Apply request sanitization
    app.use(sanitizeRequest);

    // Apply security headers check
    app.use(securityHeadersCheck);

    // Force HTTPS in production
    if (config.isProduction) {
        app.use((req, res, next) => {
            if (req.header('x-forwarded-proto') !== 'https') {
                res.redirect(`https://${req.header('host')}${req.url}`);
            } else {
                next();
            }
        });
    }

    // Add security logging
    app.use((req, res, next) => {
        const securityLog = {
            timestamp: new Date().toISOString(),
            ip: req.ip,
            method: req.method,
            path: req.path,
            userAgent: req.get('user-agent'),
            referrer: req.get('referrer')
        };

        if (req.headers['x-forwarded-for']) {
            securityLog.forwardedFor = req.headers['x-forwarded-for'];
        }

        logger.debug('Security log:', securityLog);
        next();
    });
};

module.exports = {
    securityMiddleware,
    applySecurityMiddleware
}; 