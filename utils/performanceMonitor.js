// Add performance monitoring
const PerformanceMonitor = {
    slowThreshold: 2000, // 2 seconds
    metrics: {
        requests: new Map(),
        slowRequests: [],
        averageResponseTime: 0,
        totalRequests: 0
    },

    startRequest(req) {
        req.startTime = process.hrtime();
        this.metrics.requests.set(req, {
            path: req.path,
            method: req.method,
            startTime: req.startTime
        });
    },

    endRequest(req, res) {
        const data = this.metrics.requests.get(req);
        if (!data) return;

        const [seconds, nanoseconds] = process.hrtime(data.startTime);
        const duration = seconds * 1000 + nanoseconds / 1000000;

        // Update metrics
        this.metrics.totalRequests++;
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + duration) 
            / this.metrics.totalRequests;

        // Log slow requests
        if (duration > this.slowThreshold) {
            logger.warn('Slow request detected', {
                path: data.path,
                method: data.method,
                duration,
                statusCode: res.statusCode
            });

            this.metrics.slowRequests.push({
                path: data.path,
                method: data.method,
                duration,
                timestamp: new Date()
            });
        }

        this.metrics.requests.delete(req);
    },

    getMetrics() {
        return {
            averageResponseTime: this.metrics.averageResponseTime,
            totalRequests: this.metrics.totalRequests,
            slowRequests: this.metrics.slowRequests.slice(-10),
            activeRequests: this.metrics.requests.size
        };
    }
}; 