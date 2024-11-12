const os = require('os');
const { logger } = require('./logger');
const { metrics } = require('./metrics');

class ResourceMonitor {
    constructor() {
        this.metrics = {
            cpu: {
                usage: 0,
                loadAverage: [],
                history: []
            },
            memory: {
                used: 0,
                total: 0,
                free: 0,
                history: []
            },
            process: {
                cpu: 0,
                memory: 0,
                uptime: 0
            }
        };

        this.thresholds = {
            cpu: {
                warning: 70,  // 70% CPU usage
                critical: 85  // 85% CPU usage
            },
            memory: {
                warning: 75,  // 75% memory usage
                critical: 90  // 90% memory usage
            }
        };

        this.historyLength = 60; // Keep 1 hour of history (1 sample per minute)
    }

    // Start monitoring
    start(interval = 60000) { // Default to checking every minute
        this.interval = setInterval(() => this.check(), interval);
        logger.info('Resource monitoring started', {
            checkInterval: interval,
            thresholds: this.thresholds
        });
    }

    // Stop monitoring
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            logger.info('Resource monitoring stopped');
        }
    }

    // Check current resource usage
    async check() {
        try {
            // Get CPU usage
            const cpuUsage = await this.getCpuUsage();
            this.metrics.cpu.usage = cpuUsage;
            this.metrics.cpu.loadAverage = os.loadavg();
            this.metrics.cpu.history.push({
                timestamp: Date.now(),
                value: cpuUsage
            });

            // Get memory usage
            const memUsage = this.getMemoryUsage();
            this.metrics.memory = {
                ...memUsage,
                history: [...this.metrics.memory.history, {
                    timestamp: Date.now(),
                    value: memUsage.used
                }]
            };

            // Get process-specific metrics
            const processMetrics = this.getProcessMetrics();
            this.metrics.process = processMetrics;

            // Trim history arrays
            this.trimHistory();

            // Log metrics
            this.logMetrics();

            // Check for alerts
            this.checkAlerts();

            // Update Prometheus metrics
            this.updatePrometheusMetrics();

        } catch (error) {
            logger.error('Error checking resource usage:', error);
        }
    }

    // Get CPU usage percentage
    async getCpuUsage() {
        const cpus = os.cpus();
        const totalCpu = cpus.reduce((acc, cpu) => {
            acc.idle += cpu.times.idle;
            acc.total += Object.values(cpu.times).reduce((a, b) => a + b);
            return acc;
        }, { idle: 0, total: 0 });

        return 100 - ((totalCpu.idle / totalCpu.total) * 100);
    }

    // Get memory usage
    getMemoryUsage() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const usedPercent = (used / total) * 100;

        return {
            total,
            free,
            used,
            usedPercent
        };
    }

    // Get process-specific metrics
    getProcessMetrics() {
        const processMemoryUsage = process.memoryUsage();
        
        return {
            cpu: process.cpuUsage(),
            memory: {
                heapUsed: processMemoryUsage.heapUsed,
                heapTotal: processMemoryUsage.heapTotal,
                external: processMemoryUsage.external,
                rss: processMemoryUsage.rss
            },
            uptime: process.uptime()
        };
    }

    // Trim history arrays to maintain fixed length
    trimHistory() {
        if (this.metrics.cpu.history.length > this.historyLength) {
            this.metrics.cpu.history = this.metrics.cpu.history.slice(-this.historyLength);
        }
        if (this.metrics.memory.history.length > this.historyLength) {
            this.metrics.memory.history = this.metrics.memory.history.slice(-this.historyLength);
        }
    }

    // Log current metrics
    logMetrics() {
        logger.info('Resource usage metrics:', {
            cpu: {
                usage: `${this.metrics.cpu.usage.toFixed(2)}%`,
                loadAverage: this.metrics.cpu.loadAverage
            },
            memory: {
                usedPercent: `${this.metrics.memory.usedPercent.toFixed(2)}%`,
                used: `${(this.metrics.memory.used / 1024 / 1024).toFixed(2)}MB`,
                total: `${(this.metrics.memory.total / 1024 / 1024).toFixed(2)}MB`
            },
            process: {
                heapUsed: `${(this.metrics.process.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                rss: `${(this.metrics.process.memory.rss / 1024 / 1024).toFixed(2)}MB`,
                uptime: `${(this.metrics.process.uptime / 60).toFixed(2)} minutes`
            }
        });
    }

    // Check for resource usage alerts
    checkAlerts() {
        // CPU alerts
        if (this.metrics.cpu.usage >= this.thresholds.cpu.critical) {
            logger.error('Critical CPU usage detected', {
                usage: this.metrics.cpu.usage,
                threshold: this.thresholds.cpu.critical
            });
        } else if (this.metrics.cpu.usage >= this.thresholds.cpu.warning) {
            logger.warn('High CPU usage detected', {
                usage: this.metrics.cpu.usage,
                threshold: this.thresholds.cpu.warning
            });
        }

        // Memory alerts
        if (this.metrics.memory.usedPercent >= this.thresholds.memory.critical) {
            logger.error('Critical memory usage detected', {
                usage: this.metrics.memory.usedPercent,
                threshold: this.thresholds.memory.critical
            });
        } else if (this.metrics.memory.usedPercent >= this.thresholds.memory.warning) {
            logger.warn('High memory usage detected', {
                usage: this.metrics.memory.usedPercent,
                threshold: this.thresholds.memory.warning
            });
        }
    }

    // Update Prometheus metrics
    updatePrometheusMetrics() {
        metrics.cpuUsage.set(this.metrics.cpu.usage);
        metrics.memoryUsage.set(this.metrics.memory.usedPercent);
        metrics.processHeapUsage.set(this.metrics.process.memory.heapUsed);
        metrics.processRssUsage.set(this.metrics.process.memory.rss);
    }

    // Get current metrics
    getMetrics() {
        return this.metrics;
    }

    // Get resource usage history
    getHistory() {
        return {
            cpu: this.metrics.cpu.history,
            memory: this.metrics.memory.history
        };
    }

    // Update monitoring thresholds
    updateThresholds(newThresholds) {
        this.thresholds = {
            ...this.thresholds,
            ...newThresholds
        };
        logger.info('Resource monitoring thresholds updated', this.thresholds);
    }
}

// Create and export singleton instance
const resourceMonitor = new ResourceMonitor();
module.exports = resourceMonitor; 