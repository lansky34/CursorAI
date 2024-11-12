module.exports = {
    apps: [{
        name: 'review-aggregator',
        script: 'server.js',
        instances: 'max',
        exec_mode: 'cluster',
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'development'
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        env_staging: {
            NODE_ENV: 'staging',
            PORT: 3000
        }
    }],
    deploy: {
        production: {
            user: 'deploy',
            host: 'production.server.com',
            ref: 'origin/main',
            repo: 'git@github.com:username/repo.git',
            path: '/var/www/production',
            'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
        },
        staging: {
            user: 'deploy',
            host: 'staging.server.com',
            ref: 'origin/develop',
            repo: 'git@github.com:username/repo.git',
            path: '/var/www/staging',
            'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging'
        }
    }
}; 