# SAK WhatsApp API - Complete Deployment Guide

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/SAK-WhatsApp-API.git
cd SAK-WhatsApp-API

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# Run migrations
docker-compose exec backend npx knex migrate:latest

# Check logs
docker-compose logs -f
```

### Option 2: Manual Deployment on EC2

```bash
# SSH into EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Run deployment script
chmod +x deploy.sh
./deploy.sh
```

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Nginx (for production)
- Domain name (optional but recommended)
- SSL certificate (Let's Encrypt recommended)

## 🔧 Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
# Server
NODE_ENV=production
PORT=5000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_NAME=sak_whatsapp_api

# JWT
JWT_SECRET=your-jwt-secret-key-min-32-chars
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://your-domain.com

# Admin
ADMIN_EMAIL=admin@your-domain.com
```

## 📦 Installation Steps

### 1. Install Dependencies

```bash
# Backend
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 2. Build Projects

```bash
# Build backend
npm run build

# Build frontend
cd frontend
npm run build
cd ..
```

### 3. Database Setup

```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE sak_whatsapp_api;"

# Run migrations
npx knex migrate:latest
```

### 4. Start Application

#### Development
```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

#### Production with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Production with Docker
```bash
docker-compose up -d
```

## 🌐 Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔒 SSL Certificate Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal (runs automatically)
sudo certbot renew --dry-run
```

## 🔍 Monitoring & Logs

```bash
# PM2 logs
pm2 logs

# Application logs
tail -f logs/combined.log
tail -f logs/error.log

# Docker logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

## 🛠️ Maintenance

### Database Backup
```bash
# Backup
pg_dump -U postgres sak_whatsapp_api > backup.sql

# Restore
psql -U postgres sak_whatsapp_api < backup.sql
```

### Update Application
```bash
git pull origin main
npm install
npm run build
pm2 restart ecosystem.config.js
```

### Clear WhatsApp Sessions
```bash
rm -rf whatsapp_sessions/*
pm2 restart all
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process
sudo lsof -i :5000

# Kill process
kill -9 PID
```

### Database Connection Failed
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check connection
psql -U postgres -h localhost -d sak_whatsapp_api
```

### WhatsApp Connection Issues
```bash
# Clear auth folder and reconnect
rm -rf whatsapp_sessions/SESSION_ID
# Generate new QR code in dashboard
```

## 📊 Performance Optimization

### PostgreSQL Tuning
```sql
-- /etc/postgresql/15/main/postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
max_connections = 100
```

### Node.js Memory
```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" pm2 start ecosystem.config.js
```

## 🔐 Security Checklist

- [ ] Change default passwords
- [ ] Setup firewall (UFW)
- [ ] Enable SSL/TLS
- [ ] Setup fail2ban
- [ ] Regular security updates
- [ ] Database backup automation
- [ ] Monitor logs for suspicious activity
- [ ] Rate limiting configured
- [ ] CORS properly configured

## 📞 Support

For issues and questions:
- GitHub Issues: https://github.com/YOUR_USERNAME/SAK-WhatsApp-API/issues
- Email: support@your-domain.com

## 📄 License

MIT License - See LICENSE file for details
