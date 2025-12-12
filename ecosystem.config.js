module.exports = {
  apps: [
    {
      name: 'sak-whatsapp-api',
      script: './dist/server.js',
      instances: 1, // Optimized for t3.small (2GB RAM)
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        NODE_OPTIONS: '--max-old-space-size=1024' // Limit to 1GB for Node.js
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '850M', // Restart before hitting system limits
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'whatsapp_sessions'],
      // Performance optimizations
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: false,
      // Memory management
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
