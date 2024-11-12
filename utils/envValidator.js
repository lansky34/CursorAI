const { logger } = require('./logger');

// Define required environment variables by category
const requiredEnvVars = {
    server: {
        NODE_ENV: {
            required: true,
            allowedValues: ['development', 'production', 'test', 'staging']
        },
        PORT: {
            required: false,
            default: 3000,
            type: 'number'
        }
    },
    database: {
        DATABASE_URL: {
            required: true,
            pattern: /^postgres:\/\/.+/,
            sensitive: true
        },
        MONGODB_URI: {
            required: true,
            pattern: /^mongodb(\+srv)?:\/\/.+/,
            sensitive: true
        }
    },
    security: {
        JWT_SECRET: {
            required: true,
            minLength: 32,
            sensitive: true
        },
        SESSION_SECRET: {
            required: true,
            minLength: 32,
            sensitive: true
        },
        API_RATE_LIMIT: {
            required: false,
            default: 100,
            type: 'number'
        }
    },
    api: {
        OPENAI_API_KEY: {
            required: true,
            pattern: /^sk-[A-Za-z0-9]{32,}$/,
            sensitive: true
        },
        MAPBOX_ACCESS_TOKEN: {
            required: true,
            sensitive: true
        }
    },
    aws: {
        AWS_ACCESS_KEY_ID: {
            required: false,
            sensitive: true
        },
        AWS_SECRET_ACCESS_KEY: {
            required: false,
            sensitive: true
        },
        AWS_REGION: {
            required: false,
            allowedValues: ['us-east-1', 'us-west-2', 'eu-west-1']
        }
    },
    monitoring: {
        NEW_RELIC_LICENSE_KEY: {
            required: false,
            sensitive: true
        },
        SENTRY_DSN: {
            required: false,
            sensitive: true
        }
    }
};

// Validate environment variables
function validateEnv() {
    const errors = [];
    const warnings = [];
    const sensitiveVars = new Set();

    // Check each category
    Object.entries(requiredEnvVars).forEach(([category, vars]) => {
        Object.entries(vars).forEach(([varName, rules]) => {
            const value = process.env[varName];

            // Track sensitive variables
            if (rules.sensitive) {
                sensitiveVars.add(varName);
            }

            // Check if required variable is missing
            if (rules.required && !value) {
                errors.push(`Missing required environment variable: ${varName}`);
                return;
            }

            // Skip further validation if value is not present and not required
            if (!value && !rules.required) {
                if (rules.default !== undefined) {
                    process.env[varName] = String(rules.default);
                }
                return;
            }

            // Validate value if present
            if (value) {
                // Type validation
                if (rules.type === 'number' && isNaN(Number(value))) {
                    errors.push(`${varName} must be a number`);
                }

                // Pattern validation
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${varName} does not match required format`);
                }

                // Allowed values validation
                if (rules.allowedValues && !rules.allowedValues.includes(value)) {
                    errors.push(`${varName} must be one of: ${rules.allowedValues.join(', ')}`);
                }

                // Minimum length validation
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${varName} must be at least ${rules.minLength} characters long`);
                }

                // Security checks for sensitive variables
                if (rules.sensitive) {
                    // Check if sensitive data is being logged
                    if (value.toLowerCase().includes('debug') || value.toLowerCase().includes('test')) {
                        warnings.push(`${varName} appears to contain a non-production value`);
                    }
                }
            }
        });
    });

    // Log validation results
    if (errors.length > 0) {
        logger.error('Environment validation failed:', {
            errors,
            environment: process.env.NODE_ENV
        });
        throw new Error('Environment validation failed:\n' + errors.join('\n'));
    }

    if (warnings.length > 0) {
        logger.warn('Environment validation warnings:', {
            warnings,
            environment: process.env.NODE_ENV
        });
    }

    // Log success
    logger.info('Environment validation successful', {
        environment: process.env.NODE_ENV,
        sensitiveVarsConfigured: Array.from(sensitiveVars)
    });

    return true;
}

// Get sanitized environment variables (for logging/debugging)
function getSanitizedEnv() {
    const sanitized = {};
    Object.entries(requiredEnvVars).forEach(([category, vars]) => {
        sanitized[category] = {};
        Object.entries(vars).forEach(([varName, rules]) => {
            const value = process.env[varName];
            if (value) {
                sanitized[category][varName] = rules.sensitive ? '[REDACTED]' : value;
            }
        });
    });
    return sanitized;
}

// Check for common security issues
function checkSecurityIssues() {
    const issues = [];

    // Check for development environment in production
    if (process.env.NODE_ENV === 'production') {
        // Check for development URLs
        if (process.env.DATABASE_URL?.includes('localhost')) {
            issues.push('Production environment using localhost database URL');
        }
        
        // Check for test API keys
        if (process.env.OPENAI_API_KEY?.includes('test')) {
            issues.push('Production environment using test API key');
        }

        // Check for weak secrets
        if (process.env.JWT_SECRET?.length < 32) {
            issues.push('JWT_SECRET is too short for production');
        }

        // Check for missing SSL configuration
        if (!process.env.SSL_KEY_PATH || !process.env.SSL_CERT_PATH) {
            issues.push('SSL configuration missing in production');
        }
    }

    // Log security issues
    if (issues.length > 0) {
        logger.error('Security issues detected:', {
            issues,
            environment: process.env.NODE_ENV
        });
        
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Critical security issues detected in production environment');
        }
    }

    return issues;
}

module.exports = {
    validateEnv,
    getSanitizedEnv,
    checkSecurityIssues
}; 