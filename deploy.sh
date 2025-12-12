#!/bin/bash

echo "🚀 SAK WhatsApp API Deployment Script"
echo "======================================"

# Update system
echo "📦 Updating system..."
sudo apt update && sudo apt upgrade -y

# Install Node.js
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Docker (optional)
echo "📦 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx
echo "📦 Installing Nginx..."
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Setup PostgreSQL database
echo "📦 Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE DATABASE sak_whatsapp_api;"
sudo -u postgres psql -c "CREATE USER sakuser WITH ENCRYPTED PASSWORD 'your-password-here';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sak_whatsapp_api TO sakuser;"

# Clone repository
echo "📦 Cloning repository..."
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/SAK-WhatsApp-API.git
cd SAK-WhatsApp-API

# Setup environment variables
echo "📦 Setting up environment variables..."
cat > .env << EOF
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_USER=sakuser
DB_PASSWORD=your-password-here
DB_NAME=sak_whatsapp_api
DB_SSL=false

JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=7d

CORS_ORIGIN=https://your-domain.com

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

LOG_LEVEL=info

ADMIN_EMAIL=admin@your-domain.com
EOF

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Build backend
echo "📦 Building backend..."
npm run build

# Run database migrations
echo "📦 Running database migrations..."
npx knex migrate:latest

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
npm run build
cd ..

# Setup PM2
echo "📦 Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Setup Nginx
echo "📦 Configuring Nginx..."
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl restart nginx

# Setup firewall
echo "📦 Configuring firewall..."
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your domain DNS to point to this server"
echo "2. Install SSL certificate: sudo certbot --nginx -d your-domain.com"
echo "3. Update CORS_ORIGIN in .env file"
echo "4. Restart services: pm2 restart all"
echo ""
echo "🔗 Access your app at: http://$(curl -s ifconfig.me)"
