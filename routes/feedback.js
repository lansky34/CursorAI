const express = require('express');
const router = express.Router();
const feedbackCollector = require('../utils/feedbackCollector');
const { validateFeedback } = require('../middleware/validation');
const feedbackAnalyzer = require('../utils/feedbackAnalyzer');
const { catchAsync } = require('../utils/errorHandler');

// Submit feedback
router.post('/', validateFeedback, async (req, res) => {
    try {
        const feedback = await feedbackCollector.collectFeedback({
            type: req.body.type,
            severity: req.body.severity,
            description: req.body.description,
            userId: req.user?.id,
            userAgent: req.headers['user-agent'],
            page: req.body.page
        });

        res.json({ success: true, feedbackId: feedback.id });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to submit feedback' 
        });
    }
});

// Get feedback statistics (admin only)
router.get('/stats', isAdmin, async (req, res) => {
    try {
        const stats = feedbackCollector.getStatistics();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get feedback statistics' 
        });
    }
});

// Get feedback analysis
router.get('/analysis', catchAsync(async (req, res) => {
    const analysis = await feedbackAnalyzer.analyzeAllFeedback();
    res.json(analysis);
}));

// Get specific recommendations
router.get('/recommendations', catchAsync(async (req, res) => {
    const { type } = req.query;
    const analysis = await feedbackAnalyzer.analyzeAllFeedback();
    
    if (type) {
        res.json(analysis.recommendations[type] || []);
    } else {
        res.json(analysis.recommendations);
    }
}));

// Get error patterns
router.get('/errors/patterns', catchAsync(async (req, res) => {
    const analysis = await feedbackAnalyzer.analyzeAllFeedback();
    res.json(analysis.patterns.errorPatterns);
}));

// Get performance patterns
router.get('/performance/patterns', catchAsync(async (req, res) => {
    const analysis = await feedbackAnalyzer.analyzeAllFeedback();
    res.json(analysis.patterns.performancePatterns);
}));

module.exports = router; 