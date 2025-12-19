# 🚀 Quick Reference - Connection & Auto-Reply Fix

## Deploy in 3 Steps

### Step 1: Run Deployment Script
```powershell
cd C:\Users\musta\OneDrive\Documents\GitHub\SAK-WhatsApp-API
.\deploy-updates.ps1
```

### Step 2: Enable Auto-Reply
```
Dashboard → Sessions → Auto-Reply Button → Toggle ON → Save
```

### Step 3: Test It
Send a message from another WhatsApp to your connected number.

---

## What's Fixed ✅

1. ✅ **Connection stays alive** - No more manual reconnection
2. ✅ **Auto-reply works** - WhatsApp responds automatically

---

## Key Commands

```powershell
# Deploy changes
.\deploy-updates.ps1

# Test functionality
.\test-updates.ps1

# View logs
pm2 logs

# Restart service
pm2 restart ecosystem.config.js

# Rollback if needed
npx knex migrate:rollback
git revert HEAD
```

---

## Check Logs For

```
✅ "Keep-alive ping sent for session"
✅ "Sending auto-reply to"
✅ "Keep-alive monitor started"
```

---

## Troubleshooting

**Connection drops?** → Check logs for keep-alive pings  
**Auto-reply not working?** → Verify enabled in Sessions page  
**Migration fails?** → Run: `npx knex migrate:rollback`

---

**Full docs:** `SOLUTION_COMPLETE.md`
