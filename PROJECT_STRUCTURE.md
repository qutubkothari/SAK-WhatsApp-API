# SAK WhatsApp API - Complete Project Structure

```
SAK-WhatsApp-API/
├── .github/
│   └── workflows/
│       └── deploy.yml                 # GitHub Actions CI/CD pipeline
│
├── frontend/                          # React Frontend Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.tsx            # Main layout with sidebar
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx       # Authentication context
│   │   ├── pages/
│   │   │   ├── Login.tsx             # Login page
│   │   │   ├── Register.tsx          # Registration page
│   │   │   ├── Dashboard.tsx         # Analytics dashboard
│   │   │   ├── Sessions.tsx          # WhatsApp session management
│   │   │   ├── Analytics.tsx         # Detailed analytics
│   │   │   ├── Webhooks.tsx          # Webhook configuration
│   │   │   ├── Docs.tsx              # API documentation
│   │   │   └── Settings.tsx          # User settings & billing
│   │   ├── services/
│   │   │   └── api.ts                # API client functions
│   │   ├── App.tsx                   # Main app component
│   │   ├── main.tsx                  # React entry point
│   │   └── index.css                 # TailwindCSS styles
│   ├── index.html                    # HTML template
│   ├── package.json                  # Frontend dependencies
│   ├── tsconfig.json                 # TypeScript config
│   ├── vite.config.ts                # Vite configuration
│   ├── tailwind.config.js            # TailwindCSS config
│   ├── postcss.config.js             # PostCSS config
│   ├── Dockerfile                    # Frontend Docker image
│   └── nginx-frontend.conf           # Nginx config for frontend
│
├── src/                              # Backend Source Code
│   ├── config/
│   │   └── database.ts               # Database connection
│   ├── database/
│   │   └── migrations/
│   │       └── 001_create_tables.ts  # Database schema
│   ├── middleware/
│   │   ├── auth.ts                   # JWT & API key auth
│   │   ├── errorHandler.ts           # Global error handler
│   │   └── rateLimiter.ts            # Rate limiting
│   ├── routes/
│   │   ├── auth.routes.ts            # Authentication endpoints
│   │   ├── session.routes.ts         # Session management
│   │   ├── message.routes.ts         # Messaging API
│   │   ├── webhook.routes.ts         # Webhook management
│   │   ├── analytics.routes.ts       # Analytics endpoints
│   │   └── admin.routes.ts           # Admin endpoints
│   ├── services/
│   │   └── whatsapp-gateway.service.ts  # Multi-tenant WhatsApp
│   ├── utils/
│   │   └── logger.ts                 # Winston logger
│   └── server.ts                     # Express server entry
│
├── logs/                             # Application logs (gitignored)
│   ├── combined.log
│   └── error.log
│
├── whatsapp_sessions/                # WhatsApp auth data (gitignored)
│   ├── session-1/
│   ├── session-2/
│   └── ...
│
├── .env.example                      # Environment template
├── .env                             # Environment config (gitignored)
├── .gitignore                       # Git ignore rules
├── package.json                     # Backend dependencies
├── tsconfig.json                    # TypeScript config
├── knexfile.ts                      # Database migrations config
├── Dockerfile                       # Backend Docker image
├── docker-compose.yml               # Multi-container Docker setup
├── nginx.conf                       # Nginx reverse proxy config
├── ecosystem.config.js              # PM2 process manager config
├── setup.sh                         # Linux/Mac setup script
├── setup.bat                        # Windows setup script
├── start-dev.sh                     # Linux/Mac dev starter
├── start-dev.bat                    # Windows dev starter
├── deploy.sh                        # EC2 deployment script
├── README.md                        # Main documentation
├── DEPLOYMENT.md                    # Deployment guide
├── API_REFERENCE.md                 # Complete API docs
├── CONTRIBUTING.md                  # Contribution guidelines
├── CHANGELOG.md                     # Version history
└── LICENSE                          # MIT License

## 📁 Key Directories Explained

### `/frontend` - React Dashboard
Complete user interface for managing WhatsApp sessions, viewing analytics, and configuring webhooks. Built with React, TypeScript, and TailwindCSS.

### `/src` - Backend API
RESTful API server built with Express and TypeScript. Handles authentication, session management, message sending, and webhooks.

### `/src/database/migrations` - Database Schema
Knex migrations defining the complete database structure with 8 tables for users, sessions, messages, webhooks, etc.

### `/whatsapp_sessions` - WhatsApp Data
Each WhatsApp session stores its authentication credentials in a separate folder. This enables multi-tenant isolation.

### `/logs` - Application Logs
Winston logger outputs all application logs here for debugging and monitoring.

## 🔑 Key Files Explained

### Backend Core Files

**`src/server.ts`**
- Express server initialization
- Middleware setup (CORS, Helmet, Morgan)
- Route mounting
- Error handling
- Server startup

**`src/services/whatsapp-gateway.service.ts`**
- Multi-tenant WhatsApp session management
- Baileys integration
- Message queue with retry mechanism
- QR code generation
- Webhook event triggering
- Connection state management

**`src/middleware/auth.ts`**
- JWT token validation
- API key authentication
- Admin role checking
- Request user attachment

**`src/routes/*.routes.ts`**
- RESTful API endpoint definitions
- Request validation
- Response formatting
- Business logic orchestration

### Frontend Core Files

**`frontend/src/App.tsx`**
- React Router setup
- Protected route handling
- Authentication provider
- Toast notifications

**`frontend/src/contexts/AuthContext.tsx`**
- Global authentication state
- Login/register functions
- Token management
- User session persistence

**`frontend/src/pages/*.tsx`**
- Individual page components
- Data fetching with API
- UI state management
- Form handling

**`frontend/src/services/api.ts`**
- Axios HTTP client
- API endpoint functions
- Request interceptors
- Token injection

### Configuration Files

**`.env.example` / `.env`**
- Database credentials
- JWT secrets
- CORS configuration
- Rate limiting settings
- Feature flags

**`knexfile.ts`**
- Database connection config
- Migration settings
- Environment-specific configs

**`docker-compose.yml`**
- Multi-container orchestration
- PostgreSQL service
- Backend API service
- Frontend service
- Nginx reverse proxy

**`ecosystem.config.js`**
- PM2 cluster mode setup
- Process management
- Auto-restart configuration
- Log file paths

**`nginx.conf`**
- Reverse proxy rules
- SSL/TLS configuration
- Load balancing
- Static file serving

### Deployment Files

**`Dockerfile` (Backend)**
- Multi-stage build
- Production dependencies only
- Build optimization
- Security hardening

**`frontend/Dockerfile`**
- Frontend build
- Nginx serving
- Static asset optimization

**`deploy.sh`**
- Automated EC2 setup
- System dependencies
- Database initialization
- Service configuration

**`.github/workflows/deploy.yml`**
- GitHub Actions pipeline
- Automated deployment
- SSH-based deployment
- PM2 restart

### Documentation Files

**`README.md`**
- Project overview
- Quick start guide
- Features list
- Technology stack
- Revenue model

**`DEPLOYMENT.md`**
- Detailed deployment instructions
- Docker setup
- Manual setup
- SSL configuration
- Troubleshooting

**`API_REFERENCE.md`**
- Complete API documentation
- Endpoint descriptions
- Request/response examples
- Error codes
- SDK examples

**`CONTRIBUTING.md`**
- Contribution guidelines
- Code standards
- PR process
- Development setup

## 🗄️ Database Schema

### Tables (8 total)

1. **users** - User accounts and subscription info
2. **sessions** - WhatsApp session configurations
3. **messages** - Message history and status
4. **webhooks** - Webhook configurations
5. **api_keys** - API key management
6. **usage_stats** - Daily usage tracking
7. **invoices** - Billing and payments
8. **activity_logs** - Audit trail

### Key Relationships
- users → sessions (one-to-many)
- users → api_keys (one-to-many)
- sessions → messages (one-to-many)
- sessions → webhooks (one-to-many)
- users → usage_stats (one-to-many)
- users → activity_logs (one-to-many)

## 🚀 Services & Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React development server |
| Backend | 5000 | Express API server |
| PostgreSQL | 5432 | Database server |
| Nginx | 80/443 | Reverse proxy & SSL |

## 📦 Dependencies Summary

### Backend
- **@whiskeysockets/baileys** - WhatsApp Web library
- **express** - Web framework
- **typescript** - Type safety
- **knex** - Database query builder
- **pg** - PostgreSQL client
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **winston** - Logging
- **multer** - File uploads
- **axios** - HTTP client
- **stripe** - Payment processing

### Frontend
- **react** - UI library
- **react-router-dom** - Routing
- **axios** - HTTP client
- **recharts** - Charts & analytics
- **qrcode.react** - QR code display
- **react-hot-toast** - Notifications
- **tailwindcss** - Styling
- **vite** - Build tool

## 🔒 Security Features

- JWT token authentication
- API key per session
- Password hashing (bcrypt)
- Rate limiting
- CORS protection
- SQL injection prevention
- XSS protection (Helmet)
- Input validation
- Environment variable secrets
- SSL/TLS support
- Audit logging

## 📊 Monitoring & Logs

- Winston application logs
- PM2 process logs
- Nginx access/error logs
- Database query logs
- Activity audit trail
- Usage statistics tracking

## 🔄 CI/CD Pipeline

1. Code push to GitHub
2. GitHub Actions triggered
3. SSH to EC2 instance
4. Git pull latest code
5. Install dependencies
6. Build TypeScript
7. Run migrations
8. Restart PM2 processes
9. Deployment complete

## 💾 Backup Strategy

### Database Backups
```bash
# Daily backup
pg_dump -U postgres sak_whatsapp_api > backup_$(date +%Y%m%d).sql
```

### WhatsApp Sessions
```bash
# Backup sessions folder
tar -czf sessions_backup.tar.gz whatsapp_sessions/
```

### Code Repository
- Git version control
- GitHub remote repository
- Branch protection
- Pull request reviews

## 🎯 Performance Optimization

- PostgreSQL connection pooling
- PM2 cluster mode (2+ instances)
- Nginx gzip compression
- Static asset caching
- Database indexing
- Query optimization
- Rate limiting
- Message queue for async processing

## 📈 Scalability Considerations

- **Horizontal**: Add more PM2 instances
- **Vertical**: Increase server resources
- **Database**: Read replicas for analytics
- **Sessions**: Separate session servers
- **Queue**: Redis for message queue
- **Cache**: Redis for API responses
- **CDN**: CloudFlare for static assets
- **Load Balancer**: Nginx or AWS ELB

---

**Total Files**: 60+
**Lines of Code**: ~15,000+
**Production Ready**: ✅
**Documentation**: Complete
**Deployment**: Automated
