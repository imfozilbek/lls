# LLS Deployment

Deployment configuration for Hostinger VPS with PM2 + Nginx.

## Prerequisites

- Node.js 22+
- pnpm 9+
- PM2 (`npm install -g pm2`)
- Nginx
- MongoDB (self-hosted)
- Redis (self-hosted)

## Files

- `ecosystem.config.cjs` - PM2 process configuration
- `nginx.conf` - Nginx reverse proxy configuration
- `deploy.sh` - Automated deployment script

## Setup

### 1. Server Setup

```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2
npm install -g pm2

# Setup PM2 startup
pm2 startup
```

### 2. Nginx Setup

```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/lls
sudo ln -s /etc/nginx/sites-available/lls /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Environment Variables

Create `.env` file in `packages/api/`:

```env
NODE_ENV=production
PORT=4001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/lls

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# CORS
CORS_ORIGIN=https://yourdomain.com
```

### 4. Deploy

```bash
# Deploy API only
./deploy.sh api

# Deploy Admin only
./deploy.sh admin

# Deploy everything
./deploy.sh all
```

## PM2 Commands

```bash
# View logs
pm2 logs lls-api

# Monitor
pm2 monit

# Restart
pm2 restart lls-api

# Stop
pm2 stop lls-api

# List processes
pm2 list
```

## Architecture

```
Internet
    │
    ▼
┌─────────────────┐
│     Nginx       │
│   (port 80/443) │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌────────────┐
│  API  │ │   Admin    │
│ :4001 │ │  (static)  │
└───────┘ └────────────┘
```

## Monitoring

PM2 provides built-in monitoring. For production, consider:

- PM2 Plus (cloud monitoring)
- Custom health checks
- Log aggregation (e.g., using `pm2-logrotate`)

```bash
# Install log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```
