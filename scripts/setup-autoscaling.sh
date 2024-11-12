#!/bin/bash

# Enable auto-scaling
heroku features:enable runtime-dyno-metadata
heroku labs:enable log-runtime-metrics

# Configure web dyno auto-scaling
heroku autoscaling:enable
heroku autoscaling:notification-email set alerts@yourdomain.com

# Web dyno scaling rules
heroku autoscaling:rule:set web --min 1 --max 5 \
  --metric rps --target 150 \
  --notification-interval 15 \
  --scale-up-by 1 \
  --scale-down-by 1

# Worker dyno scaling rules
heroku autoscaling:rule:set worker --min 1 --max 3 \
  --metric queue --target 100 \
  --notification-interval 15 \
  --scale-up-by 1 \
  --scale-down-by 1

# Set up performance alerts
heroku alerts:add cpu_percent --app your-app-name \
  --period 5m \
  --operator above \
  --threshold 80 \
  --action email

heroku alerts:add memory_percent --app your-app-name \
  --period 5m \
  --operator above \
  --threshold 85 \
  --action email

heroku alerts:add response_time_p95 --app your-app-name \
  --period 5m \
  --operator above \
  --threshold 1000 \
  --action email

# Enable metrics logging
heroku config:set LOG_LEVEL=info
heroku config:set METRICS_INTERVAL=15

# Set up New Relic for advanced monitoring
heroku config:set NEW_RELIC_LICENSE_KEY=your_license_key
heroku config:set NEW_RELIC_APP_NAME=your_app_name
heroku config:set NEW_RELIC_LOG_LEVEL=info

# Configure dyno metadata
heroku config:set HEROKU_APP_NAME=$(heroku apps:info --json | jq -r .app.name)
heroku config:set HEROKU_DYNO_ID=\$DYNO

# Enable log drains for metrics
heroku drains:add --app your-app-name \
  "https://metrics-api.heroku.com/metrics" \
  --format metrics

echo "Auto-scaling configuration complete!" 