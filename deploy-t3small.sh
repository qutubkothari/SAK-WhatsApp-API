#!/bin/bash

# SAK WhatsApp API - Optimized Deployment Script for AWS t3.small
# This script sets up the application on a t3.small EC2 instance (2GB RAM, 2 vCPUs)

set -e

echo "🚀 Starting SAK WhatsApp API deployment (Optimized for t3.small)..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Update system
echo -e "${BLUE}📦 Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y

# Install essential tools
echo -e "${BLUE}🔧 Installing essential tools...${NC}"
sudo apt-get install -y curl wget git build-essential nginx

# Install Node.js 18.x
echo -e "${BLUE}📦 Installing Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 15
echo -e "${BLUE}🐘 Installing PostgreSQL 15...${NC}"
sudo apt-get install -y postgresql postgresql-contrib

# Configure swap space for t3.small (critical for 2GB RAM)
echo -e "${BLUE}💾 Configuring 2GB swap space for better performance...${NC}"
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    # Optimize swap usage (only use when necessary)
    sudo sysctl vm.swappiness=10
    sudo sysctl vm.vfs_cache_pressure=50
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
    echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf
fi

# Install PM2 globally
echo -e "${BLUE}📦 Installing PM2...${NC}"
sudo npm install -g pm2

# Setup PM2 startup script
sudo pm2 startup systemd -u $USER --hp /home/$USER

# Create application directory
APP_DIR="/var/www/sak-whatsapp-api"
echo -e "${BLUE}📁 Creating application directory...${NC}"
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Clone or copy application files
if [ -d ".git" ]; then
    echo -e "${BLUE}📥 Copying local files...${NC}"
    rsync -av --exclude='node_modules' --exclude='.git' . $APP_DIR/
else
    echo -e "${BLUE}📥 Cloning repository...${NC}"
    git clone https://github.com/YOUR_USERNAME/SAK-WhatsApp-API.git $APP_DIR
fi

cd $APP_DIR

# Setup PostgreSQL database
echo -e "${BLUE}🐘 Setting up PostgreSQL database...${NC}"
sudo -u postgres psql -c "CREATE DATABASE sak_whatsapp_api;" || echo "Database already exists"
sudo -u postgres psql -c "CREATE USER sak_user WITH PASSWORD 'your_secure_password';" || echo "User already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sak_whatsapp_api TO sak_user;"
sudo -u postgres psql -c "ALTER DATABASE sak_whatsapp_api OWNER TO sak_user;"

# Optimize PostgreSQL for t3.small (2GB RAM)
echo -e "${BLUE}⚡ Optimizing PostgreSQL for t3.small...${NC}"
sudo tee -a /etc/postgresql/15/main/postgresql.conf > /dev/null <<EOF

# Optimizations for t3.small (2GB RAM)
shared_buffers = 128MB
effective_cache_size = 512MB
maintenance_work_mem = 32MB
checkpoint_completion_target = 0.9
wal_buffers = 4MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2MB
min_wal_size = 1GB
max_wal_size = 4GB
max_connections = 50
EOF

sudo systemctl restart postgresql

# Create .env file
if [ ! -f .env ]; then
    echo -e "${BLUE}📝 Creating .env file...${NC}"
    cat > .env <<EOF
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_USER=sak_user
DB_PASSWORD=your_secure_password
DB_NAME=sak_whatsapp_api

JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://your-domain.com

ADMIN_EMAIL=admin@your-domain.com
EOF
    echo -e "${YELLOW}⚠️  Please edit .env file with your actual configuration${NC}"
fi

# Install backend dependencies
echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
npm install --production

# Install frontend dependencies
echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
cd frontend
npm install
cd ..

# Build backend
echo -e "${BLUE}🔨 Building backend...${NC}"
npm run build

# Build frontend
echo -e "${BLUE}🔨 Building frontend...${NC}"
cd frontend
npm run build
cd ..

# Run database migrations
echo -e "${BLUE}🗄️  Running database migrations...${NC}"
npx knex migrate:latest

# Create necessary directories
mkdir -p logs
mkdir -p whatsapp_sessions

# Configure Nginx with optimizations
echo -e "${BLUE}🌐 Configuring Nginx...${NC}"
sudo tee /etc/nginx/sites-available/sak-whatsapp-api > /dev/null <<'EOF'
# Optimized Nginx configuration for t3.small

# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

# Connection optimization
keepalive_timeout 65;
keepalive_requests 100;

# Backend API
upstream backend {
    server localhost:5000;
    keepalive 32;
}

# Frontend
upstream frontend {
    server localhost:3000;
    keepalive 16;
}

server {
    listen 80;
    server_name your-domain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Optimize buffer sizes for t3.small
    client_body_buffer_size 16K;
    client_header_buffer_size 1k;
    client_max_body_size 10m;
    large_client_header_buffers 2 1k;

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://backend;
        access_log off;
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://frontend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/sak-whatsapp-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t
sudo systemctl restart nginx

# Start backend with PM2 (optimized for t3.small)
echo -e "${BLUE}🚀 Starting backend with PM2...${NC}"
pm2 delete sak-whatsapp-api 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# Start frontend (using serve for static files - memory efficient)
echo -e "${BLUE}🚀 Starting frontend...${NC}"
sudo npm install -g serve
pm2 delete sak-whatsapp-frontend 2>/dev/null || true
pm2 start "serve -s frontend/dist -l 3000" --name sak-whatsapp-frontend
pm2 save

# Setup PM2 monitoring
echo -e "${BLUE}📊 Setting up PM2 monitoring...${NC}"
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Configure UFW firewall
echo -e "${BLUE}🔒 Configuring firewall...${NC}"
sudo ufw --force enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Setup log rotation for application logs
echo -e "${BLUE}📝 Setting up log rotation...${NC}"
sudo tee /etc/logrotate.d/sak-whatsapp-api > /dev/null <<EOF
$APP_DIR/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $USER $USER
}
EOF

# Create a monitoring script
echo -e "${BLUE}📊 Creating monitoring script...${NC}"
tee $APP_DIR/monitor.sh > /dev/null <<'EOF'
#!/bin/bash
echo "=== System Resources ==="
free -h
echo ""
echo "=== Disk Usage ==="
df -h /
echo ""
echo "=== PM2 Status ==="
pm2 status
echo ""
echo "=== Memory Usage by Process ==="
ps aux --sort=-%mem | head -10
echo ""
echo "=== PostgreSQL Connections ==="
sudo -u postgres psql -c "SELECT count(*) as connections FROM pg_stat_activity;"
EOF

chmod +x $APP_DIR/monitor.sh

# Final checks
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Edit .env file: nano $APP_DIR/.env"
echo "2. Update Nginx server_name: sudo nano /etc/nginx/sites-available/sak-whatsapp-api"
echo "3. Setup SSL: sudo certbot --nginx -d your-domain.com"
echo "4. Check logs: pm2 logs"
echo "5. Monitor resources: $APP_DIR/monitor.sh"
echo ""
echo -e "${BLUE}🔗 Your API is running at:${NC}"
echo "   Frontend: http://$(curl -s ifconfig.me)"
echo "   Backend: http://$(curl -s ifconfig.me)/api/v1"
echo ""
echo -e "${YELLOW}⚡ Performance Tips for t3.small:${NC}"
echo "   - Monitor memory: free -h"
echo "   - Check PM2 status: pm2 status"
echo "   - View logs: pm2 logs"
echo "   - Restart if needed: pm2 restart all"
echo "   - Monitor system: $APP_DIR/monitor.sh"
echo ""
echo -e "${GREEN}🎉 Your WhatsApp API SaaS is ready!${NC}"
