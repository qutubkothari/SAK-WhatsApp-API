# 📱 SAK WhatsApp API

**Professional Multi-Tenant WhatsApp Gateway Service**

Turn any phone number into a powerful WhatsApp API endpoint. Self-hosted, unlimited messages, no monthly fees to third parties.

## 🚀 Features

### For End Users
- ✅ **Easy Registration** - Sign up and get instant API access
- ✅ **Web Dashboard** - Manage sessions, view analytics, check status
- ✅ **QR Code Pairing** - Connect your WhatsApp in seconds
- ✅ **API Documentation** - Complete REST API with examples
- ✅ **Webhooks** - Real-time notifications for incoming messages
- ✅ **Usage Analytics** - Track messages, uptime, and performance

### For Platform Owner (You)
- 💰 **Monetization Ready** - Stripe integration for subscriptions
- 📊 **Admin Dashboard** - Monitor all users and sessions
- 🔐 **Secure** - JWT auth, API keys, rate limiting
- 📈 **Scalable** - Handle 100+ concurrent sessions
- 💳 **Pricing Plans** - Free tier + paid plans
- 📧 **Email Notifications** - Automated user communications

## 💼 Business Model

### Pricing Tiers

**Free Tier**
- 1 WhatsApp session
- 100 messages/day
- Community support
- Perfect for: Testing, small projects

**Starter - $15/month**
- 3 WhatsApp sessions
- 5,000 messages/day
- Email support
- Perfect for: Small businesses, startups

**Professional - $49/month**
- 10 WhatsApp sessions
- 50,000 messages/day
- Priority support
- Webhooks included
- Perfect for: Growing companies, agencies

**Enterprise - $199/month**
- Unlimited sessions
- Unlimited messages
- 24/7 support
- Custom integrations
- Dedicated account manager
- Perfect for: Large enterprises, SaaS platforms

### Revenue Projection
- 100 users × $15/month = **$1,500/month**
- 50 users × $49/month = **$2,450/month**
- 10 users × $199/month = **$1,990/month**

**Total**: **$5,940/month** ($71,280/year)

**Costs**: $50-100/month (VPS + domains)

**Profit**: **$5,840/month** ($70,080/year)

## 🚀 Quick Start

### Automated Setup (Recommended)

**Linux/Mac:**
```bash
git clone https://github.com/YOUR_USERNAME/SAK-WhatsApp-API.git
cd SAK-WhatsApp-API
chmod +x setup.sh
./setup.sh
```

**Windows:**
```cmd
git clone https://github.com/YOUR_USERNAME/SAK-WhatsApp-API.git
cd SAK-WhatsApp-API
setup.bat
```

### Manual Setup

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/SAK-WhatsApp-API.git
cd SAK-WhatsApp-API

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
createdb sak_whatsapp_api
npx knex migrate:latest

# Build projects
npm run build
cd frontend && npm run build && cd ..

# Start development
npm run dev                    # Terminal 1 - Backend
cd frontend && npm run dev     # Terminal 2 - Frontend
```

### Docker Setup

```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec backend npx knex migrate:latest

# View logs
docker-compose logs -f
```

Access dashboard at: **http://localhost:3000**

## 🛠️ Tech Stack

**Backend**
- Node.js + Express + TypeScript
- PostgreSQL (user data, sessions)
- Baileys (WhatsApp Web integration)
- JWT Authentication
- Stripe (payments)

**Frontend** (Dashboard)
- React + TypeScript
- TailwindCSS
- Recharts (analytics)
- Vite (build tool)

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Domain name (for production)

### Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/sak-whatsapp-api.git
cd sak-whatsapp-api

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npm run migrate

# Start development server
npm run dev
```

Server runs on `http://localhost:5000`

## 🔧 Configuration

### Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=sak_whatsapp_api

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@sakwhatsappapi.com

# App
APP_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📚 API Documentation

### Authentication

All API requests require authentication via API key:

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://api.sakwhatsapp.com/v1/sessions/status
```

### Endpoints

#### Create Session
```http
POST /api/v1/sessions
Content-Type: application/json
Authorization: Bearer <user_jwt_token>

{
  "name": "My Business WhatsApp"
}

Response:
{
  "success": true,
  "data": {
    "sessionId": "sess_abc123",
    "apiKey": "sk_live_xyz789",
    "qrCode": "2@abc...",
    "status": "pending"
  }
}
```

#### Send Message
```http
POST /api/v1/send
Headers:
  x-api-key: sk_live_xyz789
  Content-Type: application/json

Body:
{
  "to": "+919876543210",
  "message": "Hello from SAK WhatsApp API!"
}

Response:
{
  "success": true,
  "messageId": "msg_123",
  "status": "sent"
}
```

#### Send Image
```http
POST /api/v1/send-media
Headers:
  x-api-key: sk_live_xyz789
  Content-Type: multipart/form-data

Form:
  to: +919876543210
  caption: Check out this image
  file: [image file]

Response:
{
  "success": true,
  "messageId": "msg_124",
  "status": "sent"
}
```

[Full API Documentation →](./docs/API.md)

## 🎯 Use Cases

### 1. **Business Automation**
- Order confirmations
- Appointment reminders
- Customer support
- Payment notifications

### 2. **Marketing**
- Promotional campaigns
- Newsletter distribution
- Event invitations
- Product launches

### 3. **SaaS Integration**
- Add WhatsApp to your app
- Multi-channel notifications
- Customer engagement
- User onboarding

### 4. **E-commerce**
- Order tracking
- Delivery updates
- Abandoned cart recovery
- Customer reviews

## 🎨 Dashboard Features

### User Dashboard
- 📊 **Analytics** - Messages sent, delivery rates, uptime
- 🔑 **API Keys** - Generate, revoke, manage
- 📱 **Sessions** - Create, delete, reconnect WhatsApp sessions
- 📖 **Logs** - Real-time message logs and debugging
- 💳 **Billing** - Subscription management, invoices
- 🔔 **Webhooks** - Configure incoming message endpoints

### Admin Dashboard
- 👥 **User Management** - View all users, disable accounts
- 📈 **Platform Analytics** - Revenue, usage, growth metrics
- ⚙️ **System Health** - Monitor sessions, database, API
- 💰 **Revenue Tracking** - MRR, churn rate, LTV
- 🎫 **Support Tickets** - User support management

## 🚀 Deployment

### Production Deployment (VPS)

```bash
# 1. Setup server (Ubuntu 22.04)
ssh root@your-server-ip

# 2. Install dependencies
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs postgresql nginx certbot

# 3. Clone and setup
git clone https://github.com/yourusername/sak-whatsapp-api.git
cd sak-whatsapp-api
npm install
npm run build

# 4. Setup PM2
npm install -g pm2
pm2 start dist/server.js --name whatsapp-api -i 2
pm2 startup
pm2 save

# 5. Setup Nginx
nano /etc/nginx/sites-available/whatsapp-api
# Add configuration (see docs/nginx.conf)

# 6. SSL Certificate
certbot --nginx -d api.sakwhatsapp.com

# 7. Database setup
sudo -u postgres psql
CREATE DATABASE sak_whatsapp_api;
\q

npm run migrate
```

### Docker Deployment

```bash
docker-compose up -d
```

## 📈 Marketing Strategy

### Target Audience
1. **Developers** - Need WhatsApp API for projects
2. **Digital Agencies** - Client WhatsApp automation
3. **E-commerce** - Order notifications
4. **SaaS Companies** - Product notifications
5. **Marketing Teams** - Campaign management

### Marketing Channels
- 🎯 Google Ads (WhatsApp API keywords)
- 📝 Content Marketing (Blog, tutorials)
- 💼 LinkedIn (B2B outreach)
- 🐦 Twitter (Developer community)
- 📺 YouTube (Integration tutorials)
- 🤝 Affiliate Program (30% commission)

### Launch Strategy
1. **Week 1-2**: Beta launch with free tier
2. **Week 3-4**: Collect feedback, testimonials
3. **Month 2**: Paid plans launch
4. **Month 3**: Affiliate program
5. **Month 4-6**: Scale marketing

## 🔒 Security

- ✅ JWT authentication
- ✅ API key encryption
- ✅ Rate limiting (100 req/min per user)
- ✅ SQL injection protection
- ✅ XSS prevention
- ✅ HTTPS only in production
- ✅ Webhook signature verification
- ✅ Regular security audits

## 🤝 Support

### For Users
- 📧 Email: support@sakwhatsapp.com
- 💬 Discord Community
- 📖 Documentation: docs.sakwhatsapp.com
- 🎥 Video Tutorials: youtube.com/sakapi

### For Developers
- 🐛 GitHub Issues
- 💻 API Reference
- 🔧 Integration Examples
- 📡 Postman Collection

## 📊 Metrics to Track

- **MRR** (Monthly Recurring Revenue)
- **Churn Rate** (% users who cancel)
- **CAC** (Customer Acquisition Cost)
- **LTV** (Lifetime Value per user)
- **Active Sessions** (sessions online)
- **Message Volume** (messages/day)
- **API Uptime** (target: 99.9%)

## 🗺️ Roadmap

### Phase 1 (Launch) ✅
- [x] Core API functionality
- [x] User registration/login
- [x] Basic dashboard
- [x] Documentation

### Phase 2 (Month 1-2)
- [ ] Stripe integration
- [ ] Advanced analytics
- [ ] Webhook management
- [ ] Email notifications

### Phase 3 (Month 3-4)
- [ ] Message templates
- [ ] Scheduled messages
- [ ] Contact management
- [ ] Bulk messaging

### Phase 4 (Month 5-6)
- [ ] Mobile app (iOS/Android)
- [ ] WhatsApp Business API
- [ ] AI-powered chatbots
- [ ] Team collaboration

## 💡 Why SAK WhatsApp API?

### vs. Twilio WhatsApp
- **Cost**: Free (vs. $0.005/msg)
- **Setup**: 5 minutes (vs. business verification)
- **Limits**: None (vs. 1000 msg/day initially)

### vs. Maytapi
- **Cost**: $15/mo (vs. $95/mo)
- **Control**: Full (vs. limited)
- **Features**: More (vs. basic)

### vs. DIY Baileys
- **UI**: Dashboard (vs. code only)
- **Support**: 24/7 (vs. none)
- **Ready**: Instant (vs. weeks of dev)

## 📄 License

MIT License - Use commercially, modify freely

## 🙏 Credits

Built with:
- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Express](https://expressjs.com/) - Web framework
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Stripe](https://stripe.com/) - Payments

---

**Built by SAK Technologies**

🌐 Website: [sakwhatsapp.com](https://sakwhatsapp.com)
📧 Email: hello@sakwhatsapp.com
🐦 Twitter: [@sakwhatsappapi](https://twitter.com/sakwhatsappapi)

**Start building with WhatsApp today!** 🚀
