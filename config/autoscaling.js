const autoScalingConfig = {
    // Formation configuration
    formation: {
        web: {
            min: 1,
            max: 5,
            metric: 'rps', // requests per second
            target: 150,   // target RPS per dyno
            notification_email: process.env.ALERT_EMAIL
        },
        worker: {
            min: 1,
            max: 3,
            metric: 'queue',
            target: 100    // target queue length per worker
        }
    },

    // Scaling thresholds
    thresholds: {
        scaleUp: {
            cpuPercent: 80,    // Scale up if CPU > 80%
            memoryPercent: 85,  // Scale up if Memory > 85%
            responseTime: 1000, // Scale up if response time > 1000ms
            errorRate: 5        // Scale up if error rate > 5%
        },
        scaleDown: {
            cpuPercent: 30,    // Scale down if CPU < 30%
            memoryPercent: 40,  // Scale down if Memory < 40%
            responseTime: 200,  // Scale down if response time < 200ms
            errorRate: 1        // Scale down if error rate < 1%
        }
    },

    // Cooldown periods
    cooldown: {
        scaleUp: 300,   // Wait 5 minutes before scaling up again
        scaleDown: 600  // Wait 10 minutes before scaling down again
    },

    // Time windows for metrics
    windows: {
        metrics: 300,   // Look at last 5 minutes of metrics
        errors: 600     // Look at last 10 minutes of errors
    }
};

module.exports = autoScalingConfig; 