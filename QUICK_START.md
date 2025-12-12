# 🚀 Quick Start Guide - SAK WhatsApp API

## ⚡ Fastest Way to Start

### Option 1: Automated Setup (Recommended)

**Windows:**
```cmd
cd C:\Users\musta\OneDrive\Documents\GitHub\SAK-WhatsApp-API
setup.bat
```

**Linux/Mac:**
```bash
cd ~/SAK-WhatsApp-API
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual 5-Minute Setup

```bash
# 1. Install dependencies (2 min)
npm install
cd frontend && npm install && cd ..

# 2. Setup environment (30 sec)
cp .env.example .env
# Edit .env: Set DB_PASSWORD and JWT_SECRET

# 3. Create database (30 sec)
createdb sak_whatsapp_api

# 4. Run migrations (30 sec)
npx knex migrate:latest

# 5. Start servers (1 min)
npm run dev                    # Terminal 1
cd frontend && npm run dev     # Terminal 2
```

**Done!** Open http://localhost:3000

## 📝 Essential Commands

### Development
```bash
# Start both servers with one command
./start-dev.sh          # Linux/Mac
start-dev.bat           # Windows

# Or manually:
npm run dev             # Backend (port 5000)
cd frontend && npm run dev  # Frontend (port 3000)
```

### Database
```bash
# Create migration
npx knex migrate:make migration_name

# Run migrations
npx knex migrate:latest

# Rollback last migration
npx knex migrate:rollback

# Backup database
pg_dump -U postgres sak_whatsapp_api > backup.sql
```

### Production
```bash
# Build
npm run build
cd frontend && npm run build && cd ..

# Start with PM2
pm2 start ecosystem.config.js
pm2 logs
pm2 restart all

# Docker
docker-compose up -d
docker-compose logs -f
docker-compose down
```

## 🔑 First Time Setup Checklist

1. **Edit `.env` file:**
   - [ ] Set `DB_PASSWORD`
   - [ ] Set `JWT_SECRET` (32+ chars)
   - [ ] Set `ADMIN_EMAIL`
   - [ ] Set `CORS_ORIGIN` (for production)

2. **Create PostgreSQL database:**
   ```bash
   createdb sak_whatsapp_api
   ```

3. **Run migrations:**
   ```bash
   npx knex migrate:latest
   ```

4. **Start development servers:**
   ```bash
   ./start-dev.sh
   ```

5. **Access dashboard:**
   - Open: http://localhost:3000
   - Register new account
   - Create WhatsApp session
   - Scan QR code

## 🎯 Common Tasks

### Create New User (via Dashboard)
1. Go to http://localhost:3000/register
2. Enter email and password
3. Click Register
4. Automatically logged in

### Create WhatsApp Session
1. Login to dashboard
2. Go to "Sessions" page
3. Click "New Session"
4. Enter session name
5. Scan QR code with WhatsApp
6. Wait for connection (status turns green)
7. Copy API key

### Send Test Message
```bash
curl -X POST http://localhost:5000/api/v1/messages/send \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "919876543210", "text": "Test message!"}'
```

### View Logs
```bash
# Application logs
tail -f logs/combined.log
tail -f logs/error.log

# PM2 logs
pm2 logs

# Docker logs
docker-compose logs -f backend
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process
lsof -i :5000          # Linux/Mac
netstat -ano | findstr :5000    # Windows

# Kill process
kill -9 <PID>          # Linux/Mac
taskkill /PID <PID> /F # Windows
```

### Database Connection Error
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql    # Linux
brew services list                   # Mac
# Windows: Check Services app

# Test connection
psql -U postgres -h localhost -d sak_whatsapp_api
```

### WhatsApp Won't Connect
1. Delete session folder: `rm -rf whatsapp_sessions/SESSION_ID`
2. Refresh dashboard
3. Generate new QR code
4. Scan with WhatsApp
5. Make sure phone has internet

### Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

cd frontend
rm -rf node_modules
npm install
cd ..
```

## 📱 Testing the API

### 1. Register User
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Create Session (use token from login)
```bash
curl -X POST http://localhost:5000/api/v1/sessions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Test Session"}'
```

### 4. Send Message (use API key from session)
```bash
curl -X POST http://localhost:5000/api/v1/messages/send \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "919876543210",
    "text": "Hello from SAK API!"
  }'
```

## 🚀 Deployment Quick Guide

### Deploy to EC2 (Ubuntu)
```bash
# 1. SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# 2. Clone repository
git clone https://github.com/YOUR_USERNAME/SAK-WhatsApp-API.git
cd SAK-WhatsApp-API

# 3. Run deployment script
chmod +x deploy.sh
./deploy.sh

# 4. Follow prompts and wait for completion
```

### Deploy with Docker
```bash
# 1. Edit .env with production values
nano .env

# 2. Start all services
docker-compose up -d

# 3. Run migrations
docker-compose exec backend npx knex migrate:latest

# 4. Check logs
docker-compose logs -f
```

## 📚 Documentation Quick Links

- **Full Documentation**: README.md
- **API Reference**: API_REFERENCE.md
- **Deployment Guide**: DEPLOYMENT.md
- **Project Structure**: PROJECT_STRUCTURE.md
- **Contribution Guide**: CONTRIBUTING.md
- **Completion Checklist**: COMPLETION_CHECKLIST.md

## 💡 Pro Tips

1. **Use tmux or screen** for persistent sessions on servers
2. **Setup SSL immediately** with Let's Encrypt (free)
3. **Monitor logs regularly** for issues
4. **Backup database daily** with cron job
5. **Keep WhatsApp Web open** on phone for reliability
6. **Test webhooks** with RequestBin or similar
7. **Use environment variables** for secrets
8. **Enable firewall** (UFW) on production
9. **Setup monitoring** (PM2, DataDog, etc.)
10. **Document your customizations**

## 🎯 Quick Wins

### Add Custom Domain
1. Point DNS A record to your server IP
2. Update CORS_ORIGIN in .env
3. Configure Nginx with domain name
4. Get SSL certificate: `certbot --nginx -d your-domain.com`

### Setup Auto-Backup
```bash
# Add to crontab
0 2 * * * pg_dump -U postgres sak_whatsapp_api > ~/backups/db_$(date +\%Y\%m\%d).sql
0 3 * * * tar -czf ~/backups/sessions_$(date +\%Y\%m\%d).tar.gz ~/SAK-WhatsApp-API/whatsapp_sessions/
```

### Enable HTTPS Redirect
Already configured in nginx.conf - just add SSL certificate!

## 🆘 Get Help

- **Check logs first**: `tail -f logs/combined.log`
- **Read error messages carefully**
- **Google the error** (StackOverflow usually has answers)
- **Check GitHub Issues** in Baileys repository
- **Ask in community forums**

## ✅ Success Indicators

Your setup is working when:
- ✅ Frontend loads at http://localhost:3000
- ✅ Backend responds at http://localhost:5000/health
- ✅ You can register and login
- ✅ Session shows "connected" status
- ✅ Test message sends successfully
- ✅ Dashboard shows analytics
- ✅ No errors in logs

## 🎉 You're Ready!

If all checks pass, you're ready to:
1. Customize branding
2. Add your payment processor (Stripe)
3. Deploy to production
4. Start onboarding users
5. Launch your SaaS business!

---

**Need more help?** Check the full documentation in README.md and DEPLOYMENT.md

**Ready to deploy?** See DEPLOYMENT.md for complete deployment guide

**Want to contribute?** See CONTRIBUTING.md for guidelines
