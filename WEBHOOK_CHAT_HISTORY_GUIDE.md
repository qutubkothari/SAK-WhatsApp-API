# 📨 Complete Webhook Implementation Guide

## Store & Retrieve WhatsApp Chat History

**Your Session**: `af2bbc2d-323d-4429-b653-455393d9f9e2`  
**Phone Number**: `918484830021`  
**API Key**: `a636b4e1746fe74e72b61d54f2b40516942bc9bd44c96a7fb33f79b89bc2ad06`

---

## 🎯 Architecture Overview

```
Customer sends WhatsApp message
    ↓
SAK API receives it
    ↓
Webhook delivers to YOUR server
    ↓
YOU store in YOUR database
    ↓
YOU query from YOUR database for chat history
```

---

## Step 1: Register Your Webhook

### Using API (Recommended)

```bash
curl -X POST http://13.201.102.10/api/v1/webhooks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "af2bbc2d-323d-4429-b653-455393d9f9e2",
    "url": "https://your-server.com/whatsapp-webhook",
    "events": ["message.received", "message.sent"]
  }'
```

### PowerShell Version

```powershell
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmMDRiY2Q0MS04YzgyLTQxZjAtODUxOS0yMDM5NTViYjgxMDciLCJpYXQiOjE3NjYxNTY5MTYsImV4cCI6MTc2Njc2MTcxNn0.Z7GUlreudZjtcTMCnIXJG0r6rsXp4NMy4U2UhW2S-lQ"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    sessionId = "af2bbc2d-323d-4429-b653-455393d9f9e2"
    url = "https://your-server.com/whatsapp-webhook"
    events = @("message.received", "message.sent")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://13.201.102.10/api/v1/webhooks" -Method Post -Headers $headers -Body $body
```

### For Testing: Use webhook.site

```powershell
# Test with webhook.site first (get URL from https://webhook.site)
$body = @{
    sessionId = "af2bbc2d-323d-4429-b653-455393d9f9e2"
    url = "https://webhook.site/your-unique-url"
    events = @("message.received", "message.sent")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://13.201.102.10/api/v1/webhooks" -Method Post -Headers $headers -Body $body
```

Then send a WhatsApp message to `918484830021` and see it appear on webhook.site!

---

## Step 2: Create Database Schema

### SQL Schema for Storing Messages

```sql
CREATE TABLE whatsapp_messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) UNIQUE,
    session_id VARCHAR(255) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'incoming' or 'outgoing'
    from_number VARCHAR(50),
    to_number VARCHAR(50),
    message_type VARCHAR(50), -- 'text', 'image', 'video', 'document'
    message_text TEXT,
    media_url TEXT,
    caption TEXT,
    status VARCHAR(50),
    timestamp BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_from_number (from_number),
    INDEX idx_to_number (to_number),
    INDEX idx_timestamp (timestamp)
);

CREATE TABLE whatsapp_contacts (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    last_message_at TIMESTAMP,
    unread_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Step 3: Webhook Receiver Implementation

### Node.js + Express + MySQL

```javascript
const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');

const app = express();
app.use(express.json());

// Database connection
const pool = mysql.createPool({
    host: 'localhost',
    user: 'your_db_user',
    password: 'your_db_password',
    database: 'whatsapp_db',
    waitForConnections: true,
    connectionLimit: 10
});

// Your WhatsApp API credentials
const API_BASE = 'http://13.201.102.10/api/v1';
const JWT_TOKEN = 'your-jwt-token';
const SESSION_API_KEY = 'a636b4e1746fe74e72b61d54f2b40516942bc9bd44c96a7fb33f79b89bc2ad06';
const MY_PHONE = '918484830021';

// Webhook receiver
app.post('/whatsapp-webhook', async (req, res) => {
    try {
        const { event, sessionId, data } = req.body;

        console.log(`📨 Webhook received: ${event}`);

        if (event === 'message.received') {
            await handleIncomingMessage(data);
        } else if (event === 'message.sent') {
            await handleOutgoingMessage(data);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// Handle incoming message
async function handleIncomingMessage(data) {
    const { from, message, contact } = data;
    
    console.log(`📥 Message from ${contact.name || from}: ${message.text}`);

    // Store message in database
    await pool.query(
        `INSERT INTO whatsapp_messages 
        (message_id, session_id, direction, from_number, to_number, message_type, message_text, timestamp)
        VALUES (?, ?, 'incoming', ?, ?, 'text', ?, ?)`,
        [
            message.id || Date.now().toString(),
            'af2bbc2d-323d-4429-b653-455393d9f9e2',
            from,
            MY_PHONE,
            message.text,
            message.timestamp || Date.now()
        ]
    );

    // Update or create contact
    await pool.query(
        `INSERT INTO whatsapp_contacts (phone_number, name, last_message_at, unread_count)
        VALUES (?, ?, NOW(), 1)
        ON DUPLICATE KEY UPDATE 
            name = VALUES(name),
            last_message_at = NOW(),
            unread_count = unread_count + 1`,
        [from, contact.name || from]
    );

    console.log('✅ Message stored in database');
}

// Handle outgoing message (sent via API)
async function handleOutgoingMessage(data) {
    const { to, message } = data;
    
    console.log(`📤 Message sent to ${to}: ${message.text}`);

    // Store outgoing message
    await pool.query(
        `INSERT INTO whatsapp_messages 
        (message_id, session_id, direction, from_number, to_number, message_type, message_text, status, timestamp)
        VALUES (?, ?, 'outgoing', ?, ?, 'text', ?, 'sent', ?)`,
        [
            message.id || Date.now().toString(),
            'af2bbc2d-323d-4429-b653-455393d9f9e2',
            MY_PHONE,
            to,
            message.text,
            Date.now()
        ]
    );

    // Update contact
    await pool.query(
        `INSERT INTO whatsapp_contacts (phone_number, last_message_at)
        VALUES (?, NOW())
        ON DUPLICATE KEY UPDATE last_message_at = NOW()`,
        [to]
    );

    console.log('✅ Sent message stored');
}

// API endpoint: Get chat history with specific contact
app.get('/api/chats/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const [messages] = await pool.query(
            `SELECT * FROM whatsapp_messages 
            WHERE (from_number = ? OR to_number = ?)
            ORDER BY timestamp DESC
            LIMIT ?`,
            [phoneNumber, phoneNumber, limit]
        );

        res.json({
            success: true,
            data: {
                phoneNumber,
                messages: messages.reverse() // Oldest first
            }
        });
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint: Get all conversations
app.get('/api/chats', async (req, res) => {
    try {
        const [contacts] = await pool.query(
            `SELECT * FROM whatsapp_contacts 
            ORDER BY last_message_at DESC`
        );

        res.json({
            success: true,
            data: { contacts }
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint: Mark messages as read
app.post('/api/chats/:phoneNumber/read', async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        await pool.query(
            `UPDATE whatsapp_contacts 
            SET unread_count = 0 
            WHERE phone_number = ?`,
            [phoneNumber]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint: Send message (and store it)
app.post('/api/send', async (req, res) => {
    try {
        const { to, text } = req.body;

        // Send via WhatsApp API
        const response = await axios.post(
            `${API_BASE}/messages/send`,
            { to, text },
            {
                headers: {
                    'Authorization': `Bearer ${JWT_TOKEN}`,
                    'x-api-key': SESSION_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Store in our database
        await pool.query(
            `INSERT INTO whatsapp_messages 
            (message_id, session_id, direction, from_number, to_number, message_type, message_text, status, timestamp)
            VALUES (?, ?, 'outgoing', ?, ?, 'text', ?, 'sent', ?)`,
            [
                response.data.data.messageId,
                'af2bbc2d-323d-4429-b653-455393d9f9e2',
                MY_PHONE,
                to,
                text,
                Date.now()
            ]
        );

        res.json({ success: true, data: response.data.data });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(3000, () => {
    console.log('🚀 WhatsApp webhook server running on port 3000');
    console.log('📨 Webhook endpoint: http://localhost:3000/whatsapp-webhook');
});
```

---

## Step 4: Python + Flask + PostgreSQL Version

```python
from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
from datetime import datetime

app = Flask(__name__)

# Database connection
def get_db():
    return psycopg2.connect(
        host="localhost",
        database="whatsapp_db",
        user="your_user",
        password="your_password"
    )

# WhatsApp API credentials
API_BASE = 'http://13.201.102.10/api/v1'
JWT_TOKEN = 'your-jwt-token'
SESSION_API_KEY = 'a636b4e1746fe74e72b61d54f2b40516942bc9bd44c96a7fb33f79b89bc2ad06'
MY_PHONE = '918484830021'

@app.route('/whatsapp-webhook', methods=['POST'])
def webhook():
    data = request.json
    event = data.get('event')
    
    print(f'📨 Webhook: {event}')
    
    try:
        if event == 'message.received':
            handle_incoming_message(data['data'])
        elif event == 'message.sent':
            handle_outgoing_message(data['data'])
        
        return '', 200
    except Exception as e:
        print(f'Error: {e}')
        return '', 500

def handle_incoming_message(data):
    from_number = data['from']
    message = data['message']
    contact = data.get('contact', {})
    
    conn = get_db()
    cur = conn.cursor()
    
    # Store message
    cur.execute(
        """INSERT INTO whatsapp_messages 
        (message_id, session_id, direction, from_number, to_number, message_type, message_text, timestamp)
        VALUES (%s, %s, 'incoming', %s, %s, 'text', %s, %s)""",
        (
            message.get('id', str(int(datetime.now().timestamp()))),
            'af2bbc2d-323d-4429-b653-455393d9f9e2',
            from_number,
            MY_PHONE,
            message.get('text', ''),
            message.get('timestamp', int(datetime.now().timestamp() * 1000))
        )
    )
    
    # Update contact
    cur.execute(
        """INSERT INTO whatsapp_contacts (phone_number, name, last_message_at, unread_count)
        VALUES (%s, %s, NOW(), 1)
        ON CONFLICT (phone_number) DO UPDATE SET
            name = EXCLUDED.name,
            last_message_at = NOW(),
            unread_count = whatsapp_contacts.unread_count + 1""",
        (from_number, contact.get('name', from_number))
    )
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f'✅ Stored message from {from_number}')

@app.route('/api/chats/<phone_number>')
def get_chat(phone_number):
    limit = request.args.get('limit', 50, type=int)
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute(
        """SELECT * FROM whatsapp_messages 
        WHERE from_number = %s OR to_number = %s
        ORDER BY timestamp DESC
        LIMIT %s""",
        (phone_number, phone_number, limit)
    )
    
    messages = cur.fetchall()
    cur.close()
    conn.close()
    
    return jsonify({
        'success': True,
        'data': {
            'phoneNumber': phone_number,
            'messages': list(reversed(messages))
        }
    })

@app.route('/api/chats')
def get_all_chats():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute(
        "SELECT * FROM whatsapp_contacts ORDER BY last_message_at DESC"
    )
    
    contacts = cur.fetchall()
    cur.close()
    conn.close()
    
    return jsonify({
        'success': True,
        'data': {'contacts': contacts}
    })

if __name__ == '__main__':
    app.run(port=3000, debug=True)
```

---

## Step 5: Usage Examples

### Get All Conversations

```bash
curl http://localhost:3000/api/chats
```

Response:
```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "phone_number": "919876543210",
        "name": "John Doe",
        "last_message_at": "2025-12-19T15:30:00",
        "unread_count": 3
      }
    ]
  }
}
```

### Get Chat History with Specific Contact

```bash
curl http://localhost:3000/api/chats/919876543210?limit=100
```

Response:
```json
{
  "success": true,
  "data": {
    "phoneNumber": "919876543210",
    "messages": [
      {
        "id": 1,
        "direction": "incoming",
        "from_number": "919876543210",
        "message_text": "Hi, do you have this in stock?",
        "timestamp": 1734621000000,
        "created_at": "2025-12-19T15:10:00"
      },
      {
        "id": 2,
        "direction": "outgoing",
        "to_number": "919876543210",
        "message_text": "Yes, we have it available!",
        "timestamp": 1734621120000,
        "created_at": "2025-12-19T15:12:00"
      }
    ]
  }
}
```

### Send Message and Store

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "919876543210",
    "text": "Your order has been confirmed!"
  }'
```

---

## Step 6: Testing Workflow

### 1. Register Webhook with webhook.site

```powershell
# Get unique URL from https://webhook.site
$webhookUrl = "https://webhook.site/your-unique-id"

$body = @{
    sessionId = "af2bbc2d-323d-4429-b653-455393d9f9e2"
    url = $webhookUrl
    events = @("message.received")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://13.201.102.10/api/v1/webhooks" -Method Post -Headers $headers -Body $body
```

### 2. Send Test Message

Send a WhatsApp message to `918484830021` from any phone.

### 3. See Webhook Payload

Check webhook.site - you'll see:
```json
{
  "event": "message.received",
  "sessionId": "af2bbc2d-323d-4429-b653-455393d9f9e2",
  "data": {
    "from": "919876543210",
    "message": {
      "text": "Test message",
      "timestamp": 1734621000000
    },
    "contact": {
      "name": "Contact Name",
      "number": "919876543210"
    }
  }
}
```

### 4. Deploy Your Server

Once you see webhooks working, deploy your Node.js/Python server and update webhook URL:

```powershell
$body = @{
    sessionId = "af2bbc2d-323d-4429-b653-455393d9f9e2"
    url = "https://your-production-server.com/whatsapp-webhook"
    events = @("message.received", "message.sent")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://13.201.102.10/api/v1/webhooks" -Method Post -Headers $headers -Body $body
```

---

## 🎯 Quick Deploy Options

### Deploy on Railway.app
```bash
# Free tier, auto-HTTPS
railway init
railway up
# Get URL: https://your-app.railway.app
```

### Deploy on Render.com
```bash
# Free tier, auto-HTTPS
# Connect your GitHub repo
# Get URL: https://your-app.onrender.com
```

### Deploy with ngrok (Testing)
```bash
# Expose local server
ngrok http 3000
# Get URL: https://abc123.ngrok.io
```

---

## ✅ Checklist

- [ ] Create database schema
- [ ] Build webhook receiver server
- [ ] Test with webhook.site
- [ ] Deploy server (Railway/Render/VPS)
- [ ] Update webhook URL to production
- [ ] Test sending message to your WhatsApp
- [ ] Verify message appears in your database
- [ ] Query chat history from your API
- [ ] Build frontend UI (optional)

---

## 📚 Additional Resources

- **Webhook Events**: `message.received`, `message.sent`, `status.change`
- **Message Types**: `text`, `image`, `video`, `document`, `audio`
- **Testing Tool**: https://webhook.site
- **Free Hosting**: Railway.app, Render.com, Fly.io

---

**You're all set!** 🚀

Start with webhook.site to see the data structure, then implement your server. Messages will be stored in your database and you can build any chat interface you want!
