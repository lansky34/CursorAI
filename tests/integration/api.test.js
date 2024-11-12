const request = require('supertest');
const app = require('../../server');
const { Pool } = require('pg');
const { config } = require('../../utils/config');

describe('API Integration Tests', () => {
    let pool;

    beforeAll(async () => {
        // Connect to production database
        pool = new Pool({
            connectionString: config.database.postgresUrl,
            ssl: { rejectUnauthorized: false }
        });
    });

    afterAll(async () => {
        await pool.end();
    });

    describe('Business Endpoints', () => {
        test('GET /api/businesses should return businesses list', async () => {
            const response = await request(app)
                .get('/api/businesses')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toBeInstanceOf(Array);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0]).toHaveProperty('name');
            expect(response.body[0]).toHaveProperty('sentimentScore');
        });

        test('GET /api/businesses/:id should return business details', async () => {
            // Get a valid business ID first
            const businesses = await request(app).get('/api/businesses');
            const testId = businesses.body[0]._id;

            const response = await request(app)
                .get(`/api/businesses/${testId}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('_id', testId);
            expect(response.body).toHaveProperty('reviews');
            expect(response.body).toHaveProperty('photos');
        });

        test('GET /api/businesses/:id/reviews should return reviews', async () => {
            const businesses = await request(app).get('/api/businesses');
            const testId = businesses.body[0]._id;

            const response = await request(app)
                .get(`/api/businesses/${testId}/reviews`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toBeInstanceOf(Array);
            expect(response.body[0]).toHaveProperty('content');
            expect(response.body[0]).toHaveProperty('sentimentScore');
        });
    });

    describe('Search and Filters', () => {
        test('GET /api/businesses/search should return filtered results', async () => {
            const response = await request(app)
                .get('/api/businesses/search')
                .query({ query: 'restaurant' })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toBeInstanceOf(Array);
            expect(response.body.every(b => 
                b.name.toLowerCase().includes('restaurant') ||
                b.categories.includes('Restaurant')
            )).toBe(true);
        });

        test('GET /api/businesses/nearby should return nearby places', async () => {
            const response = await request(app)
                .get('/api/businesses/nearby')
                .query({ 
                    latitude: 40.7128,
                    longitude: -74.0060,
                    radius: 1000
                })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toBeInstanceOf(Array);
            expect(response.body[0]).toHaveProperty('distance');
        });
    });

    describe('Error Handling', () => {
        test('Should handle invalid business ID', async () => {
            await request(app)
                .get('/api/businesses/invalid-id')
                .expect(400)
                .expect(res => {
                    expect(res.body).toHaveProperty('error');
                });
        });

        test('Should handle missing required parameters', async () => {
            await request(app)
                .get('/api/businesses/nearby')
                .expect(400)
                .expect(res => {
                    expect(res.body).toHaveProperty('error');
                });
        });
    });

    describe('Performance', () => {
        test('Should respond within acceptable time limit', async () => {
            const start = Date.now();
            await request(app).get('/api/businesses');
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(1000); // 1 second
        });

        test('Should handle concurrent requests', async () => {
            const requests = Array(10).fill().map(() => 
                request(app).get('/api/businesses')
            );
            const responses = await Promise.all(requests);
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });
    });
}); 