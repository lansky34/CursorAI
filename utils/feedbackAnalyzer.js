const { logger } = require('./logger');
const { metrics } = require('./metrics');
const { AppError } = require('./errorHandler');

class FeedbackAnalyzer {
    constructor() {
        this.feedbackData = {
            errors: [],
            userFeedback: [],
            performance: [],
            suggestions: []
        };

        this.patterns = {
            errors: new Map(),
            slowRequests: new Map(),
            userComplaints: new Map(),
            featureRequests: new Map()
        };

        this.thresholds = {
            errorFrequency: 5,      // Alert if same error occurs 5+ times
            performanceThreshold: 2000, // Slow request threshold (2s)
            userComplaintThreshold: 3,  // Alert if 3+ similar complaints
            analysisInterval: 3600000   // Analyze every hour
        };
    }

    // Analyze all feedback and generate report
    async analyzeAllFeedback() {
        try {
            logger.info('Starting comprehensive feedback analysis');

            const report = {
                timestamp: new Date().toISOString(),
                summary: await this.generateSummary(),
                patterns: await this.identifyPatterns(),
                recommendations: await this.generateRecommendations(),
                metrics: this.calculateMetrics()
            };

            // Log analysis results
            logger.info('Feedback analysis completed', { report });

            return report;

        } catch (error) {
            logger.error('Error analyzing feedback:', error);
            throw new AppError(500, 'Failed to analyze feedback');
        }
    }

    // Generate summary of feedback
    async generateSummary() {
        const summary = {
            totalFeedback: this.feedbackData.userFeedback.length,
            totalErrors: this.feedbackData.errors.length,
            performanceIssues: this.feedbackData.performance.length,
            criticalIssues: 0,
            topIssues: [],
            recentTrends: []
        };

        // Identify critical issues
        summary.criticalIssues = this.feedbackData.errors.filter(
            error => error.severity === 'critical'
        ).length;

        // Get top issues
        summary.topIssues = Array.from(this.patterns.errors.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([error, data]) => ({
                error,
                count: data.count,
                lastOccurrence: data.lastOccurrence
            }));

        // Analyze recent trends
        summary.recentTrends = this.analyzeRecentTrends();

        return summary;
    }

    // Identify patterns in feedback
    async identifyPatterns() {
        return {
            errorPatterns: this.analyzeErrorPatterns(),
            performancePatterns: this.analyzePerformancePatterns(),
            userComplaintPatterns: this.analyzeUserComplaints(),
            featureRequestPatterns: this.analyzeFeatureRequests()
        };
    }

    // Analyze error patterns
    analyzeErrorPatterns() {
        const patterns = [];
        
        for (const [errorType, data] of this.patterns.errors) {
            if (data.count >= this.thresholds.errorFrequency) {
                patterns.push({
                    type: errorType,
                    count: data.count,
                    frequency: data.count / this.feedbackData.errors.length,
                    lastOccurrence: data.lastOccurrence,
                    affectedEndpoints: data.endpoints,
                    priority: this.calculatePriority(data)
                });
            }
        }

        return patterns.sort((a, b) => b.priority - a.priority);
    }

    // Analyze performance patterns
    analyzePerformancePatterns() {
        const slowEndpoints = new Map();

        this.feedbackData.performance.forEach(perf => {
            if (perf.duration > this.thresholds.performanceThreshold) {
                const key = `${perf.method} ${perf.path}`;
                if (!slowEndpoints.has(key)) {
                    slowEndpoints.set(key, {
                        count: 0,
                        totalDuration: 0,
                        maxDuration: 0
                    });
                }

                const data = slowEndpoints.get(key);
                data.count++;
                data.totalDuration += perf.duration;
                data.maxDuration = Math.max(data.maxDuration, perf.duration);
            }
        });

        return Array.from(slowEndpoints.entries())
            .map(([endpoint, data]) => ({
                endpoint,
                averageDuration: data.totalDuration / data.count,
                maxDuration: data.maxDuration,
                occurrences: data.count,
                priority: this.calculatePerformancePriority(data)
            }))
            .sort((a, b) => b.priority - a.priority);
    }

    // Generate recommendations based on patterns
    async generateRecommendations() {
        const recommendations = {
            immediate: [],
            high: [],
            medium: [],
            low: []
        };

        // Error-related recommendations
        this.generateErrorRecommendations(recommendations);

        // Performance recommendations
        this.generatePerformanceRecommendations(recommendations);

        // User feedback recommendations
        this.generateUserFeedbackRecommendations(recommendations);

        // Feature request recommendations
        this.generateFeatureRequestRecommendations(recommendations);

        return recommendations;
    }

    // Generate error-specific recommendations
    generateErrorRecommendations(recommendations) {
        const errorPatterns = this.analyzeErrorPatterns();

        errorPatterns.forEach(pattern => {
            if (pattern.priority >= 0.8) {
                recommendations.immediate.push({
                    type: 'error',
                    issue: `Frequent error: ${pattern.type}`,
                    recommendation: this.getErrorRecommendation(pattern),
                    priority: 'immediate',
                    metrics: {
                        frequency: pattern.frequency,
                        occurrences: pattern.count
                    }
                });
            } else if (pattern.priority >= 0.6) {
                recommendations.high.push({
                    type: 'error',
                    issue: `Recurring error: ${pattern.type}`,
                    recommendation: this.getErrorRecommendation(pattern),
                    priority: 'high'
                });
            }
        });
    }

    // Calculate metrics
    calculateMetrics() {
        return {
            errorRate: this.calculateErrorRate(),
            averageResponseTime: this.calculateAverageResponseTime(),
            userSatisfaction: this.calculateUserSatisfaction(),
            criticalIssueRate: this.calculateCriticalIssueRate()
        };
    }

    // Recent trends analysis
    analyzeRecentTrends() {
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        const recentFeedback = this.feedbackData.userFeedback
            .filter(f => now - new Date(f.timestamp).getTime() < dayInMs);

        return {
            dailyFeedbackCount: recentFeedback.length,
            sentimentTrend: this.calculateSentimentTrend(recentFeedback),
            topComplaints: this.getTopComplaints(recentFeedback),
            emergingIssues: this.identifyEmergingIssues(recentFeedback)
        };
    }

    // Get recommendation for error pattern
    getErrorRecommendation(pattern) {
        const recommendations = {
            'database': 'Implement connection pooling and retry mechanisms',
            'timeout': 'Review and adjust timeout settings, implement circuit breakers',
            'validation': 'Enhance input validation and sanitization',
            'authentication': 'Review and strengthen authentication mechanisms',
            'rate_limit': 'Adjust rate limiting thresholds and implement caching'
        };

        return recommendations[pattern.type] || 'Investigate and implement appropriate error handling';
    }

    // Calculate priority score
    calculatePriority(data) {
        const frequencyScore = Math.min(data.count / this.thresholds.errorFrequency, 1);
        const severityScore = data.severity === 'critical' ? 1 : 0.5;
        const recencyScore = Math.exp(-(Date.now() - data.lastOccurrence) / (24 * 60 * 60 * 1000));

        return (frequencyScore * 0.4 + severityScore * 0.4 + recencyScore * 0.2);
    }
}

module.exports = new FeedbackAnalyzer(); 