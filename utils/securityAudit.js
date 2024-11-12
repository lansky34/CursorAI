const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { logger } = require('./logger');

class SecurityAudit {
    constructor() {
        this.issues = [];
        this.recommendations = [];
    }

    async runAudit() {
        try {
            // Check npm dependencies
            this.auditDependencies();

            // Check environment variables
            this.auditEnvironmentVariables();

            // Check SSL configuration
            this.auditSSLConfiguration();

            // Check security headers
            this.auditSecurityHeaders();

            // Check database security
            this.auditDatabaseSecurity();

            // Check file permissions
            this.auditFilePermissions();

            // Check authentication
            this.auditAuthentication();

            // Generate report
            return this.generateReport();

        } catch (error) {
            logger.error('Security audit failed:', error);
            throw error;
        }
    }

    auditDependencies() {
        try {
            execSync('npm audit --production');
        } catch (error) {
            const vulnerabilities = JSON.parse(error.stdout);
            this.issues.push({
                category: 'Dependencies',
                severity: 'High',
                details: `Found ${vulnerabilities.metadata.vulnerabilities.high} high severity vulnerabilities`,
                recommendation: 'Run npm audit fix and update vulnerable dependencies'
            });
        }
    }

    auditEnvironmentVariables() {
        const requiredSecureVars = [
            'JWT_SECRET',
            'SESSION_SECRET',
            'MONGODB_URI',
            'DATABASE_URL',
            'OPENAI_API_KEY'
        ];

        requiredSecureVars.forEach(varName => {
            if (!process.env[varName]) {
                this.issues.push({
                    category: 'Environment',
                    severity: 'Critical',
                    details: `Missing required environment variable: ${varName}`,
                    recommendation: 'Set all required environment variables in production'
                });
            }
        });

        // Check for secure values
        if (process.env.NODE_ENV === 'production') {
            if (process.env.JWT_SECRET?.length < 32) {
                this.issues.push({
                    category: 'Environment',
                    severity: 'High',
                    details: 'JWT_SECRET is too short',
                    recommendation: 'Use a strong secret of at least 32 characters'
                });
            }
        }
    }

    auditSSLConfiguration() {
        if (process.env.NODE_ENV === 'production') {
            // Check SSL certificate
            const sslConfig = require('./sslConfig');
            const certStatus = sslConfig.checkCertificateExpiration();

            if (certStatus.daysUntilExpiration < 30) {
                this.issues.push({
                    category: 'SSL',
                    severity: 'High',
                    details: `SSL certificate expires in ${certStatus.daysUntilExpiration} days`,
                    recommendation: 'Renew SSL certificate before expiration'
                });
            }

            // Check SSL protocols and ciphers
            const sslOptions = sslConfig.getSSLConfig();
            if (!sslOptions.secureProtocol || sslOptions.secureProtocol !== 'TLSv1_2_method') {
                this.issues.push({
                    category: 'SSL',
                    severity: 'High',
                    details: 'Insecure SSL protocol configuration',
                    recommendation: 'Use TLS 1.2 or higher'
                });
            }
        }
    }

    auditSecurityHeaders() {
        const requiredHeaders = {
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Content-Security-Policy': "default-src 'self'"
        };

        // Check helmet configuration
        const helmetConfig = require('./security').securityMiddleware.helmetConfig;
        
        Object.entries(requiredHeaders).forEach(([header, value]) => {
            if (!helmetConfig[header.toLowerCase()]) {
                this.issues.push({
                    category: 'Headers',
                    severity: 'Medium',
                    details: `Missing security header: ${header}`,
                    recommendation: `Add ${header} header with appropriate value`
                });
            }
        });
    }

    auditDatabaseSecurity() {
        // Check database connection security
        const dbConfig = require('../config/database');
        
        if (!dbConfig.production.ssl) {
            this.issues.push({
                category: 'Database',
                severity: 'Critical',
                details: 'Database connection not using SSL',
                recommendation: 'Enable SSL for database connections'
            });
        }

        // Check connection pool settings
        if (dbConfig.production.pool.max > 20) {
            this.issues.push({
                category: 'Database',
                severity: 'Medium',
                details: 'Database pool size might be too large',
                recommendation: 'Adjust pool size based on server capacity'
            });
        }
    }

    auditFilePermissions() {
        const sensitiveFiles = [
            '.env',
            'private.key',
            'certificate.crt'
        ];

        sensitiveFiles.forEach(file => {
            try {
                const stats = fs.statSync(file);
                const permissions = stats.mode & 0o777;
                
                if (permissions > 0o600) {
                    this.issues.push({
                        category: 'Permissions',
                        severity: 'High',
                        details: `Insecure file permissions on ${file}: ${permissions.toString(8)}`,
                        recommendation: 'Set file permissions to 600'
                    });
                }
            } catch (error) {
                // File doesn't exist, skip
            }
        });
    }

    auditAuthentication() {
        // Check rate limiting
        const rateLimitConfig = require('./security').securityMiddleware.rateLimitConfig;
        
        if (!rateLimitConfig || rateLimitConfig.max > 100) {
            this.issues.push({
                category: 'Authentication',
                severity: 'Medium',
                details: 'Rate limiting configuration might be too permissive',
                recommendation: 'Implement stricter rate limiting'
            });
        }

        // Check session configuration
        const sessionConfig = require('./security').securityMiddleware.sessionConfig;
        
        if (!sessionConfig.cookie.secure || !sessionConfig.cookie.httpOnly) {
            this.issues.push({
                category: 'Authentication',
                severity: 'High',
                details: 'Insecure session cookie configuration',
                recommendation: 'Enable secure and httpOnly flags for cookies'
            });
        }
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            issues: this.issues,
            summary: {
                critical: this.issues.filter(i => i.severity === 'Critical').length,
                high: this.issues.filter(i => i.severity === 'High').length,
                medium: this.issues.filter(i => i.severity === 'Medium').length,
                low: this.issues.filter(i => i.severity === 'Low').length
            },
            recommendations: this.generateRecommendations()
        };

        // Save report
        const reportPath = path.join(__dirname, '../logs/security-audit.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        return report;
    }

    generateRecommendations() {
        return [
            {
                category: 'General',
                items: [
                    'Regularly update dependencies and run security audits',
                    'Implement automated security scanning in CI/CD pipeline',
                    'Set up security monitoring and alerting',
                    'Regular backup and disaster recovery testing'
                ]
            },
            {
                category: 'Authentication',
                items: [
                    'Implement MFA for admin access',
                    'Regular password rotation policy',
                    'Implement account lockout after failed attempts',
                    'Use secure session management'
                ]
            },
            {
                category: 'Data Protection',
                items: [
                    'Encrypt sensitive data at rest',
                    'Implement proper data backup procedures',
                    'Regular security training for team members',
                    'Implement data access logging'
                ]
            },
            {
                category: 'Infrastructure',
                items: [
                    'Regular security patches and updates',
                    'Network security monitoring',
                    'Implement WAF (Web Application Firewall)',
                    'Regular penetration testing'
                ]
            }
        ];
    }
}

module.exports = new SecurityAudit(); 