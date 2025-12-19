# Deployment Guide: Connection Keep-Alive & Auto-Reply Features

## Changes Made

### 1. **Connection Keep-Alive System**
- Added periodic ping mechanism (every 30 seconds) to maintain WhatsApp connection
- Implemented connection monitoring that checks for inactive sessions every 2 minutes
- Sessions now track last activity timestamp
- Automatic cleanup of keep-alive intervals on disconnect

### 2. **Auto-Reply Feature**
- Added database migration to support auto-reply configuration per session
- Auto-reply can be enabled/disabled per session
- Customizable auto-reply message per session
- Auto-reply only triggers for text messages (not media-only)
- Auto-reply respects phone-based JID (doesn't reply to unresolved @lid addresses)

## Deployment Steps

### Step 1: Backup Database
```powershell
# Create a backup before applying migrations
pg_dump -U your_user -d your_database > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql
```

### Step 2: Run Database Migration
```powershell
# Run the new migration
npm run migrate
```

Or manually:
```powershell
npx knex migrate:latest
```

### Step 3: Rebuild and Restart Services

#### For Docker Deployment:
```powershell
# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d

# Check logs
docker-compose logs -f api
```

#### For PM2 Deployment:
```powershell
# Rebuild TypeScript
npm run build

# Restart PM2 process
pm2 restart ecosystem.config.js

# Check logs
pm2 logs
```

### Step 4: Verify Deployment
1. Check that existing sessions remain connected
2. Test auto-reply configuration via frontend
3. Monitor logs for keep-alive pings
4. Send test messages to verify auto-reply works

## API Changes

### New Endpoint: Update Auto-Reply Settings
```
PUT /api/v1/sessions/:sessionId/auto-reply
Authorization: Bearer <token>

Request Body:
{
  "enabled": true,
  "message": "Thank you for your message! We will get back to you soon."
}

Response:
{
  "success": true,
  "message": "Auto-reply settings updated",
  "data": {
    "autoReplyEnabled": true,
    "autoReplyMessage": "Thank you for your message! We will get back to you soon."
  }
}
```

### Updated Endpoint: Get Sessions
The `/api/v1/sessions` GET endpoint now returns additional fields:
- `autoReplyEnabled`: boolean
- `autoReplyMessage`: string

## Testing Instructions

### Test Keep-Alive:
1. Connect a WhatsApp session
2. Leave it idle for 5-10 minutes
3. Send a message to the number - it should still work without reconnecting
4. Check logs for "Keep-alive ping sent" messages every 30 seconds

### Test Auto-Reply:
1. Navigate to Sessions page in frontend
2. Click "Auto-Reply" button on a connected session
3. Enable auto-reply and set a custom message
4. Send a message from another WhatsApp number
5. Verify auto-reply is sent immediately after webhook delivery

## Configuration

### Keep-Alive Settings (in whatsapp-gateway.service.ts):
- Ping interval: 30 seconds (configurable)
- Monitor interval: 2 minutes
- Inactive threshold: 5 minutes

### Auto-Reply Behavior:
- Only responds to text messages
- Skips empty or media-only messages
- Respects phone-based JID requirements
- Runs after webhook delivery

## Rollback Instructions

If issues occur:

### Step 1: Rollback Migration
```powershell
npx knex migrate:rollback
```

### Step 2: Restore Previous Code
```powershell
git revert HEAD
npm run build
pm2 restart ecosystem.config.js
```

### Step 3: Restore Database Backup (if needed)
```powershell
psql -U your_user -d your_database < backup_file.sql
```

## Monitoring

### Key Log Messages to Watch:
- `Keep-alive ping sent for session: <sessionId>`
- `Keep-alive monitor started`
- `Session connected: <sessionId>`
- `Sending auto-reply to <jid> for session <sessionId>`
- `Auto-reply settings updated`

### Troubleshooting:

**Connection keeps dropping:**
- Check network stability
- Verify keep-alive pings are being sent (check logs)
- Ensure WhatsApp account is not being used on another device simultaneously

**Auto-reply not working:**
- Verify `auto_reply_enabled` is true in database
- Check that incoming messages have text content
- Ensure session is connected
- Review logs for auto-reply errors

**Migration fails:**
- Check if columns already exist: `\d sessions` in psql
- Ensure database user has ALTER TABLE permissions
- Verify knex configuration in knexfile.ts

## Support

For issues, check:
1. Application logs: `pm2 logs` or `docker-compose logs api`
2. Database connectivity: Test with `psql -U user -d database`
3. WhatsApp connection status: Check frontend Sessions page
4. Network connectivity: Ensure server can reach WhatsApp servers

## Additional Notes

- Keep-alive pings are lightweight and won't count toward message limits
- Auto-reply messages are logged as regular outgoing messages
- Both features work independently - keep-alive works even if auto-reply is disabled
- Frontend automatically refreshes to show auto-reply status
