const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

class SSLConfig {
    constructor() {
        this.sslOptions = {
            production: {
                key: process.env.SSL_KEY_PATH,
                cert: process.env.SSL_CERT_PATH,
                ca: process.env.SSL_CA_PATH,
                secureProtocol: 'TLSv1_2_method',
                ciphers: [
                    'ECDHE-ECDSA-AES128-GCM-SHA256',
                    'ECDHE-RSA-AES128-GCM-SHA256',
                    'ECDHE-ECDSA-AES256-GCM-SHA384',
                    'ECDHE-RSA-AES256-GCM-SHA384'
                ].join(':'),
                honorCipherOrder: true,
                minVersion: 'TLSv1.2'
            },
            development: {
                key: path.join(__dirname, '../certs/localhost-key.pem'),
                cert: path.join(__dirname, '../certs/localhost-cert.pem')
            }
        };
    }

    validateSSLConfig() {
        const env = process.env.NODE_ENV;
        const config = this.sslOptions[env];

        if (!config) {
            throw new Error(`Invalid environment: ${env}`);
        }

        // Check SSL files exist
        try {
            if (!fs.existsSync(config.key)) {
                throw new Error(`SSL key file not found: ${config.key}`);
            }
            if (!fs.existsSync(config.cert)) {
                throw new Error(`SSL certificate file not found: ${config.cert}`);
            }
            if (env === 'production' && config.ca && !fs.existsSync(config.ca)) {
                throw new Error(`SSL CA file not found: ${config.ca}`);
            }

            // Verify file permissions (production only)
            if (env === 'production') {
                const keyStats = fs.statSync(config.key);
                const certStats = fs.statSync(config.cert);

                if ((keyStats.mode & 0o777) !== 0o600) {
                    throw new Error('SSL key file has incorrect permissions. Should be 600');
                }
                if ((certStats.mode & 0o777) !== 0o600) {
                    throw new Error('SSL cert file has incorrect permissions. Should be 600');
                }
            }

            logger.info('SSL configuration validated successfully');
            return true;
        } catch (error) {
            logger.error('SSL configuration validation failed:', error);
            throw error;
        }
    }

    getSSLConfig() {
        this.validateSSLConfig();
        return this.sslOptions[process.env.NODE_ENV];
    }

    // Check certificate expiration
    checkCertificateExpiration() {
        const config = this.sslOptions[process.env.NODE_ENV];
        try {
            const certData = fs.readFileSync(config.cert);
            const cert = new (require('crypto').X509Certificate)(certData);
            const expirationDate = new Date(cert.validTo);
            const daysUntilExpiration = Math.floor((expirationDate - new Date()) / (1000 * 60 * 60 * 24));

            if (daysUntilExpiration <= 30) {
                logger.warn('SSL Certificate expiring soon', {
                    daysUntilExpiration,
                    expirationDate: expirationDate.toISOString()
                });
            }

            return {
                valid: true,
                daysUntilExpiration,
                expirationDate
            };
        } catch (error) {
            logger.error('Error checking certificate expiration:', error);
            throw error;
        }
    }
}

module.exports = new SSLConfig(); 