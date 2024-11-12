const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;

class LogAnalyzer {
    constructor() {
        this.errorPatterns = {
            timeout: /timeout|timed out/i,
            memory: /out of memory|memory limit/i,
            database: /database error|connection refused|deadlock/i,
            api: /api error|rate limit|429|5\d\d/i,
            security: /unauthorized|forbidden|invalid token/i
        };

        this.performanceThresholds = {
            request: 2000,    // 2 seconds
            query: 1000,      // 1 second
            memory: 500,      // 500MB
            cpu: 80          // 80% usage
        };
    }

    async analyzeLogs(days = 7) {
        const logDir = path.join(__dirname, '../logs');
        const results = {
            errors: {
                timeout: 0,
                memory: 0,
                database: 0,
                api: 0,
                security: 0,
                other: 0
            },
            performance: {
                slowRequests: [],
                slowQueries: [],
                highMemory: [],
                highCpu: []
            },
            patterns: {
                commonErrors: new Map(),
                frequentEndpoints: new Map(),
                errorTimes: []
            }
        };

        try {
            // Get all log files
            const files = await fs.readdir(logDir);
            const logFiles = files.filter(f => f.endsWith('.log'));

            for (const file of logFiles) {
                const content = await fs.readFile(path.join(logDir, file), 'utf8');
                const logs = content.split('\n').filter(line => line.trim());

                for (const log of logs) {
                    try {
                        const entry = JSON.parse(log);
                        this.analyzeLogEntry(entry, results);
                    } catch (e) {
                        console.error('Error parsing log entry:', e);
                    }
                }
            }

            // Analyze patterns
            this.analyzePatterns(results);

            return {
                summary: this.generateSummary(results),
                details: results,
                recommendations: this.generateRecommendations(results)
            };

        } catch (error) {
            console.error('Error analyzing logs:', error);
            throw error;
        }
    }

    analyzeLogEntry(entry, results) {
        // Analyze error type
        if (entry.level === 'error') {
            let errorType = 'other';
            for (const [type, pattern] of Object.entries(this.errorPatterns)) {
                if (pattern.test(entry.message)) {
                    errorType = type;
                    break;
                }
            }
            results.errors[errorType]++;

            // Track error patterns
            const errorKey = `${entry.path || 'unknown'}: ${entry.message}`;
            results.patterns.commonErrors.set(
                errorKey,
                (results.patterns.commonErrors.get(errorKey) || 0) + 1
            );

            // Track error times
            if (entry.timestamp) {
                results.patterns.errorTimes.push(new Date(entry.timestamp));
            }
        }

        // Analyze performance
        if (entry.duration) {
            if (entry.type === 'request' && entry.duration > this.performanceThresholds.request) {
                results.performance.slowRequests.push({
                    path: entry.path,
                    duration: entry.duration,
                    timestamp: entry.timestamp
                });
            }
            if (entry.type === 'query' && entry.duration > this.performanceThresholds.query) {
                results.performance.slowQueries.push({
                    query: entry.query,
                    duration: entry.duration,
                    timestamp: entry.timestamp
                });
            }
        }

        // Track endpoint frequency
        if (entry.path) {
            results.patterns.frequentEndpoints.set(
                entry.path,
                (results.patterns.frequentEndpoints.get(entry.path) || 0) + 1
            );
        }

        // Track resource usage
        if (entry.memory && entry.memory.heapUsed > this.performanceThresholds.memory * 1024 * 1024) {
            results.performance.highMemory.push({
                used: entry.memory.heapUsed,
                timestamp: entry.timestamp
            });
        }
        if (entry.cpu && entry.cpu.usage > this.performanceThresholds.cpu) {
            results.performance.highCpu.push({
                usage: entry.cpu.usage,
                timestamp: entry.timestamp
            });
        }
    }

    analyzePatterns(results) {
        // Sort error times to find clusters
        results.patterns.errorTimes.sort((a, b) => a - b);
        
        // Find error clusters (errors occurring within 5 minutes of each other)
        const clusters = [];
        let currentCluster = [];
        
        for (let i = 0; i < results.patterns.errorTimes.length; i++) {
            if (currentCluster.length === 0) {
                currentCluster.push(results.patterns.errorTimes[i]);
            } else {
                const lastError = currentCluster[currentCluster.length - 1];
                const timeDiff = results.patterns.errorTimes[i] - lastError;
                
                if (timeDiff <= 300000) { // 5 minutes
                    currentCluster.push(results.patterns.errorTimes[i]);
                } else {
                    if (currentCluster.length > 1) {
                        clusters.push([...currentCluster]);
                    }
                    currentCluster = [results.patterns.errorTimes[i]];
                }
            }
        }
        
        results.patterns.errorClusters = clusters;
    }

    generateSummary(results) {
        const totalErrors = Object.values(results.errors).reduce((a, b) => a + b, 0);
        const totalSlowRequests = results.performance.slowRequests.length;
        const totalSlowQueries = results.performance.slowQueries.length;

        return {
            totalErrors,
            errorBreakdown: results.errors,
            performanceIssues: {
                slowRequests: totalSlowRequests,
                slowQueries: totalSlowQueries,
                highMemory: results.performance.highMemory.length,
                highCpu: results.performance.highCpu.length
            },
            mostFrequentErrors: Array.from(results.patterns.commonErrors.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            mostFrequentEndpoints: Array.from(results.patterns.frequentEndpoints.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            errorClusters: results.patterns.errorClusters.length
        };
    }

    generateRecommendations(results) {
        const recommendations = [];

        // Database recommendations
        if (results.errors.database > 0) {
            recommendations.push({
                category: 'Database',
                priority: 'High',
                issues: [
                    'Frequent database connection errors detected',
                    'Consider implementing connection pooling',
                    'Add retry logic for failed queries',
                    'Monitor connection pool metrics'
                ]
            });
        }

        // Performance recommendations
        if (results.performance.slowRequests.length > 0) {
            recommendations.push({
                category: 'Performance',
                priority: 'Medium',
                issues: [
                    'Multiple slow requests detected',
                    'Implement request caching',
                    'Add database query optimization',
                    'Consider implementing pagination'
                ]
            });
        }

        // Memory recommendations
        if (results.performance.highMemory.length > 0) {
            recommendations.push({
                category: 'Memory',
                priority: 'High',
                issues: [
                    'High memory usage detected',
                    'Implement memory leak detection',
                    'Add garbage collection monitoring',
                    'Review large object allocations'
                ]
            });
        }

        // API recommendations
        if (results.errors.api > 0) {
            recommendations.push({
                category: 'API',
                priority: 'Medium',
                issues: [
                    'Frequent API errors detected',
                    'Implement rate limiting',
                    'Add request validation',
                    'Improve error handling'
                ]
            });
        }

        // Security recommendations
        if (results.errors.security > 0) {
            recommendations.push({
                category: 'Security',
                priority: 'High',
                issues: [
                    'Security-related errors detected',
                    'Review authentication logic',
                    'Implement request sanitization',
                    'Add security headers'
                ]
            });
        }

        return recommendations;
    }
}

module.exports = new LogAnalyzer(); 