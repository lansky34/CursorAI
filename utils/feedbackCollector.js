const winston = require('winston');
const Sentry = require('@sentry/node');
const { logger } = require('./logger');

class FeedbackCollector {
    constructor() {
        // Configure feedback logger
        this.feedbackLogger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'user-feedback' },
            transports: [
                new winston.transports.File({
                    filename: 'logs/feedback.log',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                })
            ]
        });

        // Initialize feedback metrics
        this.metrics = {
            totalFeedback: 0,
            bugReports: 0,
            featureRequests: 0,
            performanceIssues: 0,
            criticalIssues: 0
        };

        // Alert thresholds
        this.thresholds = {
            criticalIssues: 5,    // Alert after 5 critical issues
            errorRate: 0.05,      // Alert if error rate exceeds 5%
            responseTime: 2000    // Alert if response time exceeds 2s
        };
    }

    // Collect user feedback
    async collectFeedback(feedback) {
        try {
            const feedbackData = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                type: feedback.type,
                severity: feedback.severity,
                description: feedback.description,
                metadata: {
                    userId: feedback.userId,
                    userAgent: feedback.userAgent,
                    page: feedback.page,
                    environment: process.env.NODE_ENV
                }
            };

            // Log feedback
            this.feedbackLogger.info('User feedback received', feedbackData);

            // Update metrics
            this.updateMetrics(feedbackData);

            // Check if feedback requires immediate attention
            if (this.requiresImmediateAttention(feedbackData)) {
                await this.triggerAlert(feedbackData);
            }

            // Store in database
            await this.storeFeedback(feedbackData);

            return { success: true, id: feedbackData.id };

        } catch (error) {
            logger.error('Error collecting feedback:', error);
            Sentry.captureException(error);
            throw error;
        }
    }

    // Update feedback metrics
    updateMetrics(feedback) {
        this.metrics.totalFeedback++;

        switch (feedback.type) {
            case 'bug':
                this.metrics.bugReports++;
                break;
            case 'feature':
                this.metrics.featureRequests++;
                break;
            case 'performance':
                this.metrics.performanceIssues++;
                break;
        }

        if (feedback.severity === 'critical') {
            this.metrics.criticalIssues++;
            this.checkAlertThresholds();
        }
    }

    // Check if feedback needs immediate attention
    requiresImmediateAttention(feedback) {
        return (
            feedback.severity === 'critical' ||
            feedback.type === 'security' ||
            feedback.description.toLowerCase().includes('crash') ||
            feedback.description.toLowerCase().includes('data loss')
        );
    }

    // Trigger alert for critical issues
    async triggerAlert(feedback) {
        const alert = {
            title: `Critical Feedback Received: ${feedback.type}`,
            description: feedback.description,
            severity: feedback.severity,
            timestamp: new Date().toISOString(),
            metadata: feedback.metadata
        };

        // Log alert
        logger.error('Critical feedback alert:', alert);

        // Send to error tracking
        Sentry.captureMessage(alert.title, {
            level: 'error',
            extra: alert
        });

        // Send notifications
        await this.sendAlertNotifications(alert);
    }

    // Check alert thresholds
    checkAlertThresholds() {
        if (this.metrics.criticalIssues >= this.thresholds.criticalIssues) {
            this.triggerThresholdAlert('Critical Issues Threshold Exceeded', {
                current: this.metrics.criticalIssues,
                threshold: this.thresholds.criticalIssues
            });
        }

        const errorRate = this.metrics.bugReports / this.metrics.totalFeedback;
        if (errorRate >= this.thresholds.errorRate) {
            this.triggerThresholdAlert('High Error Rate Detected', {
                current: errorRate,
                threshold: this.thresholds.errorRate
            });
        }
    }

    // Send alert notifications
    async sendAlertNotifications(alert) {
        try {
            // Email notification
            if (process.env.ALERT_EMAIL) {
                await this.sendEmailAlert(alert);
            }

            // Slack notification
            if (process.env.SLACK_WEBHOOK_URL) {
                await this.sendSlackAlert(alert);
            }

            // PagerDuty for critical issues
            if (process.env.PAGERDUTY_API_KEY && alert.severity === 'critical') {
                await this.sendPagerDutyAlert(alert);
            }

        } catch (error) {
            logger.error('Error sending alert notifications:', error);
            Sentry.captureException(error);
        }
    }

    // Store feedback in database
    async storeFeedback(feedback) {
        try {
            // Store in database (implement your storage logic here)
            // Example: await FeedbackModel.create(feedback);
            
            // Archive old feedback periodically
            await this.archiveOldFeedback();

        } catch (error) {
            logger.error('Error storing feedback:', error);
            throw error;
        }
    }

    // Archive old feedback
    async archiveOldFeedback() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        try {
            // Archive logic here
            // Example: await FeedbackModel.archive({ timestamp: { $lt: thirtyDaysAgo } });
        } catch (error) {
            logger.error('Error archiving feedback:', error);
        }
    }

    // Get feedback statistics
    getStatistics() {
        return {
            metrics: this.metrics,
            errorRate: this.metrics.bugReports / this.metrics.totalFeedback,
            criticalRate: this.metrics.criticalIssues / this.metrics.totalFeedback,
            lastUpdated: new Date().toISOString()
        };
    }

    // Reset metrics
    resetMetrics() {
        Object.keys(this.metrics).forEach(key => {
            this.metrics[key] = 0;
        });
    }
}

module.exports = new FeedbackCollector(); 