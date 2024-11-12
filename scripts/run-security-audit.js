const securityAudit = require('../utils/securityAudit');
const { logger } = require('../utils/logger');

async function runAudit() {
    try {
        logger.info('Starting security audit...');
        const report = await securityAudit.runAudit();
        
        // Log summary
        logger.info('Security audit completed', {
            criticalIssues: report.summary.critical,
            highIssues: report.summary.high,
            mediumIssues: report.summary.medium,
            lowIssues: report.summary.low
        });

        // Log critical and high issues
        const importantIssues = report.issues.filter(i => 
            ['Critical', 'High'].includes(i.severity)
        );

        if (importantIssues.length > 0) {
            logger.error('Critical/High security issues found:', {
                issues: importantIssues
            });
            process.exit(1);
        }

    } catch (error) {
        logger.error('Security audit failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runAudit();
}

module.exports = runAudit; 