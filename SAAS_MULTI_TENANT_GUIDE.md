# 🏢 Multi-Tenant SaaS Integration Guide

## Complete Guide for Building WhatsApp SaaS Applications

**Status**: ✅ **Multi-tenant features are LIVE and deployed**  
**Server**: http://13.201.102.10  
**Last Updated**: December 19, 2025

---

## 🎯 What's New - Multi-Tenant Support

Your SaaS platform can now:

✅ **Create sessions using API keys** (no JWT required)  
✅ **Auto-register webhooks during session creation**  
✅ **Get QR codes via API** for client display  
✅ **Manage multiple WhatsApp sessions** per account  
✅ **Support flexible authentication** (JWT or API Key)

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Getting Started](#getting-started)
3. [Authentication Methods](#authentication-methods)
4. [Creating User-Level API Keys](#creating-user-level-api-keys)
5. [Self-Service WhatsApp Connection Flow](#self-service-whatsapp-connection-flow)
6. [Complete Code Examples](#complete-code-examples)
7. [API Reference](#api-reference)
8. [Webhook Integration](#webhook-integration)
9. [Best Practices](#best-practices)

---

## 🏗️ Architecture Overview

### Multi-Tenant Model

```
Your SaaS Platform
    │
    ├── Client A → WhatsApp Session 1 → Webhook: yourapp.com/webhook/client-a
    │
    ├── Client B → WhatsApp Session 2 → Webhook: yourapp.com/webhook/client-b
    │
    └── Client C → WhatsApp Session 3 → Webhook: yourapp.com/webhook/client-c
```

### Authentication Hierarchy

```
Master Account (You)
    │
    ├── JWT Token (from login) ────┐
    │                               │
    └── User-Level API Key ─────────┼──→ Can create/manage ALL sessions
                                    │
    ├── Session 1 (Client A)        │
    │   └── Session API Key ────────┼──→ Can only use THIS session for messaging
    │                               │
    ├── Session 2 (Client B)        │
    │   └── Session API Key ────────┼──→ Can only use THIS session for messaging
    │                               │
    └── Session 3 (Client C)        │
        └── Session API Key ────────┴──→ Can only use THIS session for messaging
```

---

## 🚀 Getting Started

### Step 1: Create Your Master Account

```bash
# Register your SaaS platform account
curl -X POST http://13.201.102.10/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "yourplatform@example.com",
    "password": "your-secure-password",
    "name": "Your SaaS Platform"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-uuid",
      "email": "yourplatform@example.com",
      "name": "Your SaaS Platform",
      "plan": "free"
    }
  }
}
```

Save the JWT token for the next step.

---

## 🔑 Authentication Methods

### Option 1: User-Level API Key (Recommended for SaaS)

**Best for**: Multi-tenant applications where you manage multiple client sessions

**Advantages**:
- ✅ Never expires (until you revoke it)
- ✅ Can create and manage ALL sessions
- ✅ Can get QR codes for any session
- ✅ Perfect for backend-to-backend integration

**Use cases**:
- Creating sessions for new clients
- Managing multiple WhatsApp connections
- Displaying QR codes in your UI
- Configuring webhooks programmatically

### Option 2: Session API Key

**Best for**: Client-facing operations with specific sessions

**Advantages**:
- ✅ Scoped to one WhatsApp session
- ✅ Can be given to clients directly (if needed)
- ✅ Limited blast radius if compromised

**Use cases**:
- Sending messages for a specific client
- Message history for one session
- Client-specific operations

---

## 🔐 Creating User-Level API Keys

### Step 1: Generate Master API Key

```bash
# Use JWT token from login/register
curl -X POST http://13.201.102.10/api/v1/auth/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SaaS Platform Master Key"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "api-key-uuid",
    "name": "SaaS Platform Master Key",
    "key": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    "lastFour": "y5z6",
    "createdAt": "2025-12-19T10:00:00.000Z"
  }
}
```

⚠️ **IMPORTANT**: Save the `key` value immediately! It's only shown once and cannot be retrieved later.

### Step 2: Store API Key Securely

```javascript
// In your .env file
WHATSAPP_MASTER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### List Your API Keys

```bash
curl -X GET http://13.201.102.10/api/v1/auth/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response shows all your API keys (without revealing the full key):
```json
{
  "success": true,
  "data": {
    "keys": [
      {
        "id": "key-uuid",
        "name": "SaaS Platform Master Key",
        "lastFour": "y5z6",
        "isActive": true,
        "createdAt": "2025-12-19T10:00:00.000Z",
        "lastUsedAt": "2025-12-19T11:30:00.000Z"
      }
    ]
  }
}
```

---

## 🔄 Self-Service WhatsApp Connection Flow

### Complete User Journey

```
1. Client signs up on your SaaS platform
   ↓
2. Client clicks "Connect WhatsApp" button
   ↓
3. Your backend creates session via API (with webhook)
   ↓
4. Your backend fetches QR code
   ↓
5. Your frontend displays QR code to client
   ↓
6. Client scans QR with their phone
   ↓
7. Connection established automatically
   ↓
8. Webhook receives "status.change" event
   ↓
9. Your platform marks client as "Connected"
   ↓
10. Messages start flowing automatically
```

---

## 💻 Complete Code Examples

### Full Node.js Implementation

```javascript
const axios = require('axios');

const API_BASE = 'http://13.201.102.10/api/v1';
const MASTER_API_KEY = process.env.WHATSAPP_MASTER_API_KEY;

// Step 1: Create session for new client
async function createClientSession(clientId, clientName) {
  try {
    const response = await axios.post(
      `${API_BASE}/sessions`,
      {
        name: clientName || `Client ${clientId}`,
        webhook: {
          url: `https://your-saas.com/webhook/${clientId}`,
          events: ['message.received', 'message.sent', 'status.change']
        }
      },
      {
        headers: {
          'x-api-key': MASTER_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const { sessionId, apiKey, webhook } = response.data.data;

    console.log('✅ Session created for client:', clientId);
    console.log('   Session ID:', sessionId);
    console.log('   API Key:', apiKey);
    console.log('   Webhook:', webhook);

    // Store in your database
    await saveClientSession({
      clientId,
      sessionId,
      sessionApiKey: apiKey,
      status: 'pending',
      webhookUrl: webhook.url
    });

    return { sessionId, apiKey };
  } catch (error) {
    console.error('Failed to create session:', error.response?.data);
    throw error;
  }
}

// Step 2: Get QR code for client to scan
async function getQRCode(sessionId) {
  try {
    const response = await axios.get(
      `${API_BASE}/sessions/${sessionId}/qr`,
      {
        headers: {
          'x-api-key': MASTER_API_KEY
        }
      }
    );

    return response.data.data.qrCode;
  } catch (error) {
    console.error('Failed to get QR code:', error.response?.data);
    throw error;
  }
}

// Step 3: Check session status
async function checkSessionStatus(sessionId) {
  try {
    const response = await axios.get(
      `${API_BASE}/sessions/${sessionId}/status`,
      {
        headers: {
          'x-api-key': MASTER_API_KEY
        }
      }
    );

    const { connected, phoneNumber } = response.data.data;
    return { connected, phoneNumber };
  } catch (error) {
    console.error('Failed to check status:', error.response?.data);
    throw error;
  }
}

// Step 4: List all client sessions
async function getAllClientSessions() {
  try {
    const response = await axios.get(
      `${API_BASE}/sessions`,
      {
        headers: {
          'x-api-key': MASTER_API_KEY
        }
      }
    );

    return response.data.data.sessions;
  } catch (error) {
    console.error('Failed to list sessions:', error.response?.data);
    throw error;
  }
}

// Example: Complete onboarding flow
async function onboardClient(clientId, clientName) {
  console.log(`🚀 Starting WhatsApp onboarding for client: ${clientId}`);

  // Create session with webhook
  const { sessionId, apiKey } = await createClientSession(clientId, clientName);

  // Wait for QR code generation (usually takes 2-3 seconds)
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get QR code
  let qrCode = null;
  let attempts = 0;
  while (!qrCode && attempts < 10) {
    qrCode = await getQRCode(sessionId);
    if (!qrCode) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
  }

  if (!qrCode) {
    throw new Error('QR code generation timeout');
  }

  console.log('✅ QR code ready!');
  
  // Return data for your frontend
  return {
    sessionId,
    sessionApiKey: apiKey,
    qrCode,
    webhookUrl: `https://your-saas.com/webhook/${clientId}`
  };
}

// Usage
onboardClient('client-abc-123', 'ABC Corp')
  .then(data => {
    console.log('Client onboarded:', data);
    // Send QR code to frontend for display
  })
  .catch(error => {
    console.error('Onboarding failed:', error);
  });
```

### Express.js REST API Example

```javascript
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const API_BASE = 'http://13.201.102.10/api/v1';
const MASTER_API_KEY = process.env.WHATSAPP_MASTER_API_KEY;

// Your client initiates WhatsApp connection
app.post('/api/clients/:clientId/whatsapp/connect', async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await getClientFromDatabase(clientId);

    // Create WhatsApp session
    const sessionResponse = await axios.post(
      `${API_BASE}/sessions`,
      {
        name: client.name,
        webhook: {
          url: `https://your-saas.com/api/webhook/${clientId}`,
          events: ['message.received', 'message.sent', 'status.change']
        }
      },
      {
        headers: {
          'x-api-key': MASTER_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const { sessionId, apiKey } = sessionResponse.data.data;

    // Save to your database
    await saveClientWhatsAppSession({
      clientId,
      sessionId,
      sessionApiKey: apiKey,
      status: 'pending'
    });

    // Wait for QR
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get QR code
    const qrResponse = await axios.get(
      `${API_BASE}/sessions/${sessionId}/qr`,
      {
        headers: { 'x-api-key': MASTER_API_KEY }
      }
    );

    res.json({
      success: true,
      data: {
        sessionId,
        qrCode: qrResponse.data.data.qrCode,
        message: 'Scan QR code with WhatsApp'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Check connection status
app.get('/api/clients/:clientId/whatsapp/status', async (req, res) => {
  try {
    const { clientId } = req.params;
    const session = await getClientWhatsAppSession(clientId);

    const statusResponse = await axios.get(
      `${API_BASE}/sessions/${session.sessionId}/status`,
      {
        headers: { 'x-api-key': MASTER_API_KEY }
      }
    );

    res.json({
      success: true,
      data: statusResponse.data.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Webhook receiver
app.post('/api/webhook/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const { event, data } = req.body;

  console.log(`Webhook for client ${clientId}:`, event);

  if (event === 'status.change' && data.status === 'connected') {
    // Update client status in your database
    await updateClientWhatsAppStatus(clientId, 'connected', data.phoneNumber);
    console.log(`✅ Client ${clientId} WhatsApp connected: ${data.phoneNumber}`);
  }

  if (event === 'message.received') {
    // Handle incoming message
    console.log(`📨 Message from ${data.from}: ${data.message.text}`);
    
    // Process with your business logic
    await processClientMessage(clientId, data);
  }

  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log('SaaS platform API running on port 3000');
});
```

### Python Flask Example

```python
from flask import Flask, request, jsonify
import requests
import os
import time

app = Flask(__name__)

API_BASE = 'http://13.201.102.10/api/v1'
MASTER_API_KEY = os.getenv('WHATSAPP_MASTER_API_KEY')

@app.route('/api/clients/<client_id>/whatsapp/connect', methods=['POST'])
def connect_whatsapp(client_id):
    try:
        # Get client info
        client = get_client_from_db(client_id)
        
        # Create session with webhook
        response = requests.post(
            f'{API_BASE}/sessions',
            headers={
                'x-api-key': MASTER_API_KEY,
                'Content-Type': 'application/json'
            },
            json={
                'name': client['name'],
                'webhook': {
                    'url': f'https://your-saas.com/api/webhook/{client_id}',
                    'events': ['message.received', 'message.sent', 'status.change']
                }
            }
        )
        
        session_data = response.json()['data']
        session_id = session_data['sessionId']
        api_key = session_data['apiKey']
        
        # Save to database
        save_client_session(client_id, session_id, api_key)
        
        # Wait for QR generation
        time.sleep(3)
        
        # Get QR code
        qr_response = requests.get(
            f'{API_BASE}/sessions/{session_id}/qr',
            headers={'x-api-key': MASTER_API_KEY}
        )
        
        qr_data = qr_response.json()['data']
        
        return jsonify({
            'success': True,
            'data': {
                'sessionId': session_id,
                'qrCode': qr_data['qrCode'],
                'message': 'Scan QR code with WhatsApp'
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/webhook/<client_id>', methods=['POST'])
def webhook_handler(client_id):
    data = request.json
    event = data.get('event')
    
    if event == 'status.change' and data['data']['status'] == 'connected':
        phone = data['data']['phoneNumber']
        update_client_status(client_id, 'connected', phone)
        print(f'✅ Client {client_id} connected: {phone}')
    
    if event == 'message.received':
        message = data['data']['message']['text']
        from_number = data['data']['from']
        print(f'📨 Message from {from_number}: {message}')
        process_client_message(client_id, data['data'])
    
    return '', 200

if __name__ == '__main__':
    app.run(port=3000)
```

---

## 📚 API Reference

### Base URL
```
http://13.201.102.10/api/v1
```

### Authentication Headers

**Using Master API Key:**
```
x-api-key: your-master-api-key
```

**Using JWT Token:**
```
Authorization: Bearer your-jwt-token
```

### Endpoints Supporting API Key Auth

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/sessions` | POST | Create new session | Master API Key or JWT |
| `/sessions` | GET | List all sessions | Master API Key or JWT |
| `/sessions/:id` | GET | Get session details | Master API Key or JWT |
| `/sessions/:id/status` | GET | Check connection status | Master API Key or JWT |
| `/sessions/:id/qr` | GET | Get QR code | Master API Key or JWT |
| `/sessions/:id` | DELETE | Disconnect session | Master API Key or JWT |
| `/sessions/:id/auto-reply` | PUT | Configure auto-reply | Master API Key or JWT |

### Create Session (with Webhook)

```http
POST /api/v1/sessions
x-api-key: your-master-api-key
Content-Type: application/json

{
  "name": "Client ABC",
  "webhook": {
    "url": "https://your-saas.com/webhook/abc",
    "events": ["message.received", "message.sent", "status.change"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-here",
    "apiKey": "session-specific-api-key",
    "name": "Client ABC",
    "status": "pending",
    "message": "Scan QR code to connect",
    "webhook": {
      "id": "webhook-uuid",
      "url": "https://your-saas.com/webhook/abc",
      "events": ["message.received", "message.sent", "status.change"]
    }
  }
}
```

### Get QR Code

```http
GET /api/v1/sessions/:sessionId/qr
x-api-key: your-master-api-key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "connected": false,
    "message": "Scan this QR code with WhatsApp"
  }
}
```

### Check Session Status

```http
GET /api/v1/sessions/:sessionId/status
x-api-key: your-master-api-key
```

**Response (Not Connected):**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "name": "Client ABC",
    "connected": false,
    "phoneNumber": null,
    "lastConnectedAt": null
  }
}
```

**Response (Connected):**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "name": "Client ABC",
    "connected": true,
    "phoneNumber": "919876543210",
    "lastConnectedAt": "2025-12-19T11:30:00.000Z"
  }
}
```

---

## 🪝 Webhook Integration

### Webhook Events

Your webhook will receive these events:

#### 1. `status.change` - Connection Status Changed

```json
{
  "event": "status.change",
  "sessionId": "uuid",
  "data": {
    "status": "connected",
    "phoneNumber": "919876543210",
    "timestamp": "2025-12-19T11:30:00.000Z"
  }
}
```

#### 2. `message.received` - Incoming Message

```json
{
  "event": "message.received",
  "sessionId": "uuid",
  "data": {
    "from": "919876543210",
    "message": {
      "text": "I want to place an order",
      "timestamp": 1734602400000
    },
    "contact": {
      "name": "Customer Name",
      "number": "919876543210"
    }
  }
}
```

#### 3. `message.sent` - Outgoing Message Delivered

```json
{
  "event": "message.sent",
  "sessionId": "uuid",
  "data": {
    "to": "919876543210",
    "message": {
      "text": "Your order has been confirmed!",
      "timestamp": 1734602500000
    },
    "status": "delivered"
  }
}
```

### Webhook Handler Example

```javascript
app.post('/webhook/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const { event, sessionId, data } = req.body;

  console.log(`Webhook received for client ${clientId}:`, event);

  try {
    switch (event) {
      case 'status.change':
        if (data.status === 'connected') {
          await onClientConnected(clientId, data.phoneNumber);
          // Notify client via email/notification
          await sendNotification(clientId, 'WhatsApp connected successfully!');
        }
        break;

      case 'message.received':
        await handleIncomingMessage(clientId, data);
        break;

      case 'message.sent':
        await trackMessageDelivery(clientId, data);
        break;
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});
```

---

## 🎯 Best Practices

### 1. Store API Keys Securely

```javascript
// ❌ DON'T: Hardcode API keys
const apiKey = 'a1b2c3d4e5f6...';

// ✅ DO: Use environment variables
const apiKey = process.env.WHATSAPP_MASTER_API_KEY;
```

### 2. Map Sessions to Clients

```javascript
// Store in your database
{
  clientId: 'client-abc-123',
  clientName: 'ABC Corp',
  whatsappSession: {
    sessionId: 'uuid-from-api',
    sessionApiKey: 'session-specific-key',
    status: 'connected',
    phoneNumber: '919876543210',
    connectedAt: '2025-12-19T11:30:00Z'
  }
}
```

### 3. Handle QR Code Expiration

```javascript
// QR codes expire after ~60 seconds
async function getQRWithRetry(sessionId, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const qrCode = await getQRCode(sessionId);
    if (qrCode) return qrCode;
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('QR code generation timeout');
}
```

### 4. Webhook Idempotency

```javascript
// Track processed webhook events
const processedEvents = new Set();

app.post('/webhook/:clientId', async (req, res) => {
  const eventId = req.body.eventId || req.body.data.timestamp;
  
  if (processedEvents.has(eventId)) {
    return res.sendStatus(200); // Already processed
  }
  
  // Process event
  await handleEvent(req.body);
  processedEvents.add(eventId);
  
  res.sendStatus(200);
});
```

### 5. Monitor Session Health

```javascript
// Periodically check all client sessions
async function monitorClientSessions() {
  const clients = await getAllClients();
  
  for (const client of clients) {
    if (client.whatsappSessionId) {
      const status = await checkSessionStatus(client.whatsappSessionId);
      
      if (!status.connected) {
        // Alert client to reconnect
        await notifyClientReconnect(client.id);
      }
    }
  }
}

// Run every hour
setInterval(monitorClientSessions, 60 * 60 * 1000);
```

---

## 🔧 Troubleshooting

### Common Issues

**1. "API key required" error**
- Ensure you're sending `x-api-key` header
- Verify API key is correct (no extra spaces)
- Check if API key is active: `GET /auth/api-keys`

**2. QR code returns null**
- Wait 2-3 seconds after session creation
- Retry up to 10 times with 2-second intervals
- Check session status - may already be connected

**3. Webhook not receiving events**
- Verify webhook URL is publicly accessible
- Check webhook returns 200 status code
- Use webhook testing tools (webhook.site) for debugging

**4. Session limit reached**
- Check your plan limits (Free: 1, Starter: 3, Pro: 10)
- Contact support to upgrade plan
- Delete unused sessions

---

## 📊 Plan Limits

| Plan | Max Sessions | Rate Limit |
|------|--------------|------------|
| Free | 1 session | 10 req/min |
| Starter | 3 sessions | 30 req/min |
| Pro | 10 sessions | 100 req/min |
| Enterprise | Unlimited | Custom |

---

## 🎉 Success Checklist

Before going live, verify:

- ✅ Master API key created and stored securely
- ✅ Can create sessions via API
- ✅ QR code displays correctly in your UI
- ✅ Webhook endpoint is publicly accessible
- ✅ Webhook handles all event types
- ✅ Client session mapping in your database
- ✅ Error handling for session creation failures
- ✅ QR code retry logic implemented
- ✅ Session status monitoring setup
- ✅ Client notification system working

---

## 📞 Support

If you encounter any issues:

1. Check logs: `sudo docker logs sak-whatsapp-api-backend-1`
2. Verify API key: `GET /auth/api-keys`
3. Test endpoints with curl/Postman
4. Check webhook accessibility with webhook.site

---

**Multi-Tenant Support Status**: ✅ **LIVE**  
**Server**: http://13.201.102.10  
**API Version**: v1  
**Documentation**: Complete  

Ready to build your WhatsApp SaaS! 🚀
