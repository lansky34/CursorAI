const logAnalyzer = require('../utils/logAnalyzer');
const { logger } = require('../utils/logger');

async function analyzeAndReport() {
    try {
        console.log('Analyzing logs...');
        const analysis = await logAnalyzer.analyzeLogs();

        console.log('\nLog Analysis Summary:');
        console.log('=====================');
        console.log(`Total Errors: ${analysis.summary.totalErrors}`);
        console.log('\nError Breakdown:');
        Object.entries(analysis.summary.errorBreakdown).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });

        console.log('\nPerformance Issues:');
        Object.entries(analysis.summary.performanceIssues).forEach(([issue, count]) => {
            console.log(`  ${issue}: ${count}`);
        });

        console.log('\nMost Frequent Errors:');
        analysis.summary.mostFrequentErrors.forEach(([error, count]) => {
            console.log(`  ${error}: ${count} times`);
        });

        console.log('\nRecommendations:');
        analysis.recommendations.forEach(rec => {
            console.log(`\n${rec.category} (Priority: ${rec.priority})`);
            rec.issues.forEach(issue => console.log(`  - ${issue}`));
        });

    } catch (error) {
        console.error('Error analyzing logs:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    analyzeAndReport();
}

module.exports = analyzeAndReport; 