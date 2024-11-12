exports.seed = async function(knex) {
    // Clean the tables first
    await knex('photos').del();
    await knex('reviews').del();
    await knex('businesses').del();

    // Insert businesses
    const businesses = await knex('businesses').insert([
        {
            name: 'Sample Restaurant 1',
            description: 'A fine dining establishment',
            latitude: 40.7128,
            longitude: -74.0060,
            sentiment_score: 0.85,
            visit_count: 150,
            badges: JSON.stringify(['Top Rated', 'Family Friendly']),
            aspect_sentiment: JSON.stringify({
                'service': { score: 0.9, count: 45 },
                'food': { score: 0.85, count: 78 },
                'ambiance': { score: 0.8, count: 32 }
            })
        },
        // Add more sample businesses...
    ]).returning('id');

    // Insert reviews
    await knex('reviews').insert([
        {
            business_id: businesses[0],
            content: 'Excellent service and amazing food!',
            sentiment_score: 0.9,
            aspect_analysis: JSON.stringify({
                'service': 0.95,
                'food': 0.85
            })
        },
        // Add more sample reviews...
    ]);
}; 