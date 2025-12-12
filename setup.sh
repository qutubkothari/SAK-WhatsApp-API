#!/bin/bash

# SAK WhatsApp API - Quick Setup Script
# This script will install all dependencies and set up the project

set -e

echo "🚀 SAK WhatsApp API - Quick Setup"
echo "=================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. Please install PostgreSQL 15+"
    echo "   Visit: https://www.postgresql.org/download/"
    exit 1
fi

echo "✅ PostgreSQL detected"

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
npm install

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Setup environment file
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    
    # Update .env with generated secret
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/your-super-secret-jwt-key-minimum-32-characters/$JWT_SECRET/" .env
    else
        sed -i "s/your-super-secret-jwt-key-minimum-32-characters/$JWT_SECRET/" .env
    fi
    
    echo "✅ .env file created with generated JWT secret"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and update:"
    echo "   - DB_PASSWORD (your PostgreSQL password)"
    echo "   - ADMIN_EMAIL (your admin email)"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Database setup
echo ""
read -p "Setup database now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Setting up database..."
    
    # Get database credentials from .env
    DB_NAME=$(grep DB_NAME .env | cut -d'=' -f2)
    DB_USER=$(grep DB_USER .env | cut -d'=' -f2)
    
    # Create database if it doesn't exist
    if psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
        echo "✅ Database $DB_NAME already exists"
    else
        echo "Creating database $DB_NAME..."
        createdb $DB_NAME || {
            echo "⚠️  Could not create database automatically"
            echo "   Please create it manually: createdb $DB_NAME"
        }
    fi
    
    # Run migrations
    echo "Running database migrations..."
    npx knex migrate:latest
    
    echo "✅ Database setup complete"
fi

# Build projects
echo ""
read -p "Build projects now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔨 Building backend..."
    npm run build
    
    echo "🔨 Building frontend..."
    cd frontend
    npm run build
    cd ..
    
    echo "✅ Build complete"
fi

# Create necessary directories
echo ""
echo "📁 Creating necessary directories..."
mkdir -p whatsapp_sessions
mkdir -p logs
echo "✅ Directories created"

# Summary
echo ""
echo "=============================================="
echo "✅ Setup Complete!"
echo "=============================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Edit .env file with your configuration:"
echo "   - Update DB_PASSWORD"
echo "   - Update ADMIN_EMAIL"
echo "   - Update CORS_ORIGIN (for production)"
echo ""
echo "2. Start development servers:"
echo "   Terminal 1: npm run dev          (Backend on port 5000)"
echo "   Terminal 2: cd frontend && npm run dev  (Frontend on port 3000)"
echo ""
echo "3. Or start with PM2 (production):"
echo "   npm install -g pm2"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "4. Access the dashboard:"
echo "   http://localhost:3000"
echo ""
echo "5. API endpoint:"
echo "   http://localhost:5000/api/v1"
echo ""
echo "📚 Documentation:"
echo "   - README.md - General overview"
echo "   - DEPLOYMENT.md - Production deployment"
echo "   - API_REFERENCE.md - Complete API documentation"
echo ""
echo "🎉 Happy coding!"
