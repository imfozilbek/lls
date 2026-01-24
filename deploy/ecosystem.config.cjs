/**
 * PM2 Ecosystem Configuration
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 */
module.exports = {
    apps: [
        {
            name: "lls-api",
            cwd: "./packages/api",
            script: "dist/main.js",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
                PORT: 4001,
            },
            env_production: {
                NODE_ENV: "production",
                PORT: 4001,
            },
            // Logging
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            error_file: "./logs/api-error.log",
            out_file: "./logs/api-out.log",
            merge_logs: true,
            // Memory management
            max_memory_restart: "512M",
            // Graceful restart
            kill_timeout: 5000,
            wait_ready: true,
            listen_timeout: 10000,
            // Restart policy
            autorestart: true,
            max_restarts: 10,
            min_uptime: "10s",
            restart_delay: 4000,
            // Watch (disabled in production)
            watch: false,
        },
    ],
}
