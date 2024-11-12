const Business = require('../models/business');

async function seedTestData() {
    // Only seed if no data exists
    const count = await Business.countDocuments();
    if (count > 0) return;

    const testBusinesses = [
        {
            name: "Test Coffee Shop",
            location: {
                latitude: 37.7749,
                longitude: -122.4194
            },
            sentimentScore: 0.8,
            visitCount: 1000,
            badges: ['TopRated', 'Trending'],
            aspectSentiment: new Map([
                ['service', { score: 0.9, count: 50 }],
                ['food', { score: 0.7, count: 40 }],
                ['pricing', { score: 0.5, count: 30 }]
            ])
        },
        // Add more test businesses...
    ];

    try {
        await Business.insertMany(testBusinesses);
        console.log('Test data seeded successfully');
    } catch (error) {
        console.error('Error seeding test data:', error);
    }
}

module.exports = seedTestData; 