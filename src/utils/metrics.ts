import client from 'prom-client';

const register = new client.Registry();

export const metrics = {
  httpRequestDurationMicroseconds: new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5]
  }),

  databaseQueryDurationSeconds: new client.Histogram({
    name: 'database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['query'],
    buckets: [0.1, 0.5, 1, 2, 5]
  })
};

register.setDefaultLabels({
  app: 'review-analytics'
});

client.collectDefaultMetrics({ register });

export { register }; 