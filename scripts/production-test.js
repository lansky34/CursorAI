const axios = require('axios');
const { logger } = require('../utils/logger');
const { Pool } = require('pg');
const { config } = require('../utils/config');

class ProductionTest {
    constructor() {
        this.testResults = {
            api: [],
            database: [],
            security: [],
            performance: []
        };
        this.baseUrl = process.env.PRODUCTION_URL;
    }

    async runAllTests() {
        logger.info('Starting production tests...');
        
        try {
            // Run tests in sequence
            await this.testDatabaseConnection();
            await this.testAPIEndpoints();
            await this.testSecurity();
            await this.testPerformance();

            // Generate report
            return this.generateReport();
        } catch (error) {
            logger.error('Production tests failed:', error);
            throw error;
        }
    }

    async testDatabaseConnection() {
        const pool = new Pool({
            connectionString: config.database.url,
            ssl: { rejectUnauthorized: false }
        });

        try {
            // Test basic connection
            const client = await pool.connect();
            await client.query('SELECT NOW()');
            this.testResults.database.push({
                name: 'Database Connection',
                status: 'passed'
            });

            // Test read operations
            const readResult = await client.query('SELECT COUNT(*) FROM businesses');
            this.testResults.database.push({
                name: 'Read Operation',
                status: 'passed',
                count: readResult.rows[0].count
            });

            // Test write operations
            await client.query('BEGIN');
            await client.query('INSERT INTO test_logs (message) VALUES ($1)', ['Production test']);
            await client.query('ROLLBACK');
            this.testResults.database.push({
                name: 'Write Operation',
                status: 'passed'
            });

            client.release();
        } catch (error) {
            this.testResults.database.push({
                name: 'Database Operations',
                status: 'failed',
                error: error.message
            });
            throw error;
        } finally {
            await pool.end();
        }
    }

    async testAPIEndpoints() {
        const endpoints = [
            { method: 'GET', path: '/api/health' },
            { method: 'GET', path: '/api/businesses' },
            { method: 'GET', path: '/api/metrics' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await axios({
                    method: endpoint.method,
                    url: `${this.baseUrl}${endpoint.path}`,
                    timeout: 5000
                });
                
                this.testResults.api.push({
                    endpoint: endpoint.path,
                    status: 'passed',
                    responseTime: response.headers['x-response-time']
                });
            } catch (error) {
                this.testResults.api.push({
                    endpoint: endpoint.path,
                    status: 'failed',
                    error: error.message
                });
            }
        }
    }

    async testSecurity() {
        const securityChecks = [
            { name: 'SSL', path: '/' },
            { name: 'CORS', path: '/api/health' },
            { name: 'Headers', path: '/api/health' }
        ];

        for (const check of securityChecks) {
            try {
                const response = await axios.get(`${this.baseUrl}${check.path}`);
                
                // Verify security headers
            const headers = response.headers;
            const requiredHeaders = [
                'strict-transport-security',
                'x-content-type-options',
                    'x-frame-options'
            ];

            const missingHeaders = requiredHeaders.filter(
                header => !headers[header]
            );

                if (missingHeaders.length === 0) {
                    this.testResults.security.push({
                        name: check.name,
                        status: 'passed'
                    });
                } else {
            this.testResults.security.push({
                        name: check.name,
                        status: 'failed',
                        missing: missingHeaders
                    });
                }
        } catch (error) {
            this.testResults.security.push({
                    name: check.name,
                status: 'failed',
                error: error.message
            });
            }
        }
    }

    async testPerformance() {
        const iterations = 10;
        const results = [];

        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            try {
                await axios.get(`${this.baseUrl}/api/businesses`);
                results.push(Date.now() - start);
            } catch (error) {
                logger.error('Performance test failed:', error);
            }
        }

        const avgResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
        this.testResults.performance.push({
            name: 'Response Time',
            status: avgResponseTime < 1000 ? 'passed' : 'failed',
            average: avgResponseTime
        });
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            summary: {
                total: 0,
                passed: 0,
                failed: 0
            },
            results: this.testResults,
            recommendations: []
        };

        // Calculate summary
        Object.values(this.testResults).forEach(category => {
            category.forEach(test => {
                report.summary.total++;
                if (test.status === 'passed') {
                    report.summary.passed++;
                } else {
                    report.summary.failed++;
                }
            });
        });

        // Generate recommendations
        if (report.summary.failed > 0) {
            report.recommendations = this.generateRecommendations();
        }

        return report;
    }

    generateRecommendations() {
        const recommendations = [];

        // Check each category for failures
        Object.entries(this.testResults).forEach(([category, tests]) => {
            const failures = tests.filter(test => test.status === 'failed');
            if (failures.length > 0) {
                recommendations.push({
                    category,
                    issues: failures.map(failure => ({
                        name: failure.name,
                        error: failure.error,
                        recommendation: this.getRecommendation(category, failure)
                    }))
                });
            }
        });

        return recommendations;
    }

    getRecommendation(category, failure) {
        const recommendations = {
            database: {
                connection: 'Verify database credentials and network connectivity',
                read: 'Check database permissions and indexes',
                write: 'Verify database write permissions and disk space'
            },
            security: {
                SSL: 'Verify SSL certificate configuration',
                CORS: 'Review CORS policy settings',
                Headers: 'Update security headers configuration'
            },
            performance: {
                'Response Time': 'Optimize database queries and implement caching'
            }
        };

        return recommendations[category]?.[failure.name] || 'Investigate and fix the issue';
    }
}

module.exports = new ProductionTest(); 