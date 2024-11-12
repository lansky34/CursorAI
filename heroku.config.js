module.exports = {
  apps: {
    web: {
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        NPM_CONFIG_PRODUCTION: true
      }
    },
    worker: {
      script: 'workers/queue-worker.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '256M'
    }
  },
  build: {
    buildpacks: [
      { url: 'heroku/nodejs' }
    ],
    config_vars: {
      NPM_CONFIG_PRODUCTION: true,
      NODE_ENV: 'production'
    }
  },
  addons: [
    'heroku-postgresql:hobby-dev',
    'papertrail:choklad',
    'newrelic:wayne',
    'scheduler:standard'
  ],
  formation: {
    web: {
      quantity: 1,
      size: 'standard-1x'
    },
    worker: {
      quantity: 1,
      size: 'standard-1x'
    }
  },
  features: {
    'runtime-dyno-metadata': { enabled: true },
    'log-runtime-metrics': { enabled: true },
    'http-session-affinity': { enabled: true }
  },
  environments: {
    review: {
      addons: [
        'heroku-postgresql:hobby-dev',
        'papertrail:choklad'
      ],
      formation: {
        web: {
          quantity: 1,
          size: 'standard-1x'
        }
      }
    },
    staging: {
      addons: [
        'heroku-postgresql:hobby-basic',
        'papertrail:choklad',
        'newrelic:wayne'
      ],
      formation: {
        web: {
          quantity: 1,
          size: 'standard-1x'
        },
        worker: {
          quantity: 1,
          size: 'standard-1x'
        }
      }
    }
  }
}; 