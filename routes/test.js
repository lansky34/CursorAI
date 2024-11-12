const express = require('express');
const router = express.Router();
const Business = require('../models/business');

// Test endpoint to verify business data
router.get('/businesses', async (req, res) => {
    try {
        const businesses = await Business.find().limit(10);
        const summary = {
            totalCount: await Business.countDocuments(),
            sampleData: businesses,
            sentimentDistribution: {
                positive: await Business.countDocuments({ sentimentScore: { $gt: 0.3 } }),
                neutral: await Business.countDocuments({ 
                    sentimentScore: { $gte: -0.3, $lte: 0.3 } 
                }),
                negative: await Business.countDocuments({ sentimentScore: { $lt: -0.3 } })
            },
            badgeCounts: await aggregateBadgeCounts(),
            locationCoverage: await checkLocationCoverage()
        };
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to aggregate badge counts
async function aggregateBadgeCounts() {
    return await Business.aggregate([
        { $unwind: '$badges' },
        { $group: { _id: '$badges', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);
}

// Helper function to check location coverage
async function checkLocationCoverage() {
    return await Business.aggregate([
        {
            $group: {
                _id: null,
                latMin: { $min: '$location.latitude' },
                latMax: { $max: '$location.latitude' },
                lngMin: { $min: '$location.longitude' },
                lngMax: { $max: '$location.longitude' },
                totalLocations: { $sum: 1 }
            }
        }
    ]);
}

// Test endpoint to verify map visualization
router.get('/map-data', async (req, res) => {
    try {
        const mapData = {
            clusters: await getClusterStats(),
            heatmap: await getHeatmapStats(),
            markers: await getMarkerStats()
        };
        res.json(mapData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function getClusterStats() {
    return await Business.aggregate([
        {
            $group: {
                _id: {
                    lat: { 
                        $round: [{ $multiply: ['$location.latitude', 100] }, -2]
                    },
                    lng: { 
                        $round: [{ $multiply: ['$location.longitude', 100] }, -2]
                    }
                },
                count: { $sum: 1 },
                avgSentiment: { $avg: '$sentimentScore' }
            }
        },
        { $match: { count: { $gt: 1 } } }
    ]);
}

async function getHeatmapStats() {
    return await Business.aggregate([
        {
            $group: {
                _id: null,
                maxVisits: { $max: '$visitCount' },
                minVisits: { $min: '$visitCount' },
                avgVisits: { $avg: '$visitCount' },
                totalLocations: { $sum: 1 }
            }
        }
    ]);
}

async function getMarkerStats() {
    return {
        sentimentDistribution: await Business.aggregate([
            {
                $bucket: {
                    groupBy: '$sentimentScore',
                    boundaries: [-1, -0.5, 0, 0.5, 1],
                    default: 'other',
                    output: {
                        count: { $sum: 1 },
                        businesses: { $push: '$name' }
                    }
                }
            }
        ]),
        visitCountStats: await Business.aggregate([
            {
                $group: {
                    _id: null,
                    avgVisits: { $avg: '$visitCount' },
                    maxVisits: { $max: '$visitCount' },
                    minVisits: { $min: '$visitCount' }
                }
            }
        ])
    };
}

module.exports = router; 