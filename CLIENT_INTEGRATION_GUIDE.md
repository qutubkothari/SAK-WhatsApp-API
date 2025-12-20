# 🔗 Sales Assistant Integration Guide

## Complete Guide for Connecting Your Sales Assistant to WhatsApp API

---

## 📋 Table of Contents
1. [Getting Your Credentials](#getting-your-credentials)
2. [Authentication Flow](#authentication-flow)
3. [API Integration Examples](#api-integration-examples)
4. [Webhook Setup](#webhook-setup)
5. [Complete Code Examples](#complete-code-examples)

---

## 🔑 Getting Your Credentials

### Step 1: Get JWT Token (From Browser)

1. **Open WhatsApp API Console**: http://13.201.102.10
2. **Login** with your credentials
3. **Press F12** to open Developer Tools
4. **Go to Application Tab** (Chrome) or Storage Tab (Firefox)
5. **Find Local Storage** → `http://13.201.102.10`
6. **Copy the `token` value** - This is your JWT token

**Quick Console Method:**
```javascript
// Paste this in F12 Console tab
localStorage.getItem('token')
```

### Step 2: Get Your Session API Key

1. **Go to Sessions Page** in the web console
2. **Find your connected WhatsApp session**
3. **Copy the API Key** displayed for that session

**OR via API:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://13.201.102.10/api/v1/sessions
```

Response includes:
```json
{
  "data": [
    {
      "id": "session-id-here",
      "name": "My Session",
      "api_key": "YOUR_SESSION_API_KEY",
      "status": "connected"
    }
  ]
}
```

---

## 🔐 Authentication Flow

### Understanding the Two Tokens

| Token Type | Purpose | Where Used | Expires |
|------------|---------|------------|---------|
| **JWT Token** | Authenticates **YOU** (the user account) | Authorization header | 7 days |
| **API Key** | Authenticates **WhatsApp Session** | x-api-key header | Never (until regenerated) |

### When to Use What

- **JWT Token alone**: Account operations (list sessions, create sessions, webhooks)
- **JWT Token + API Key**: Send/receive messages, get message history
- **API Key alone**: Can be used for messaging if you want to skip JWT (less secure)

---

## 📡 API Integration Examples

### Base URL
```
http://13.201.102.10/api/v1
```

### 1. Programmatic Login (Get JWT Token)

**Your sales assistant can login automatically:**

```javascript
// Node.js Example
const axios = require('axios');

async function login() {
  const response = await axios.post('http://13.201.102.10/api/v1/auth/login', {
    email: 'your-client@example.com',
    password: 'your-password'
  });
  
  const { token, user } = response.data.data;
  console.log('JWT Token:', token);
  console.log('User:', user);
  
  return token;
}
```

```python
# Python Example
import requests

def login():
    response = requests.post(
        'http://13.201.102.10/api/v1/auth/login',
        json={
            'email': 'your-client@example.com',
            'password': 'your-password'
        }
    )
    
    data = response.json()['data']
    jwt_token = data['token']
    user = data['user']
    
    print(f"JWT Token: {jwt_token}")
    print(f"User: {user}")
    
    return jwt_token
```

```php
// PHP Example
<?php
$curl = curl_init();

curl_setopt_array($curl, array(
  CURLOPT_URL => 'http://13.201.102.10/api/v1/auth/login',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => json_encode([
    'email' => 'your-client@example.com',
    'password' => 'your-password'
  ]),
  CURLOPT_HTTPHEADER => array(
    'Content-Type: application/json'
  ),
));

$response = curl_exec($curl);
$data = json_decode($response, true);

$jwtToken = $data['data']['token'];
echo "JWT Token: " . $jwtToken;

curl_close($curl);
?>
```

---

### 2. Send WhatsApp Message

```javascript
// Node.js Example
async function sendWhatsAppMessage(jwtToken, apiKey, phoneNumber, message) {
  const response = await axios.post(
    'http://13.201.102.10/api/v1/messages/send',
    {
      to: phoneNumber,      // e.g., "919876543210" (country code + number)
      text: message
    },
    {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    }
  );
  
  console.log('Message sent:', response.data);
  return response.data;
}

// Usage
sendWhatsAppMessage(
  'your-jwt-token',
  'your-session-api-key',
  '919876543210',
  'Hello! Here are the product details you requested...'
);
```

```python
# Python Example
def send_whatsapp_message(jwt_token, api_key, phone_number, message):
    response = requests.post(
        'http://13.201.102.10/api/v1/messages/send',
        headers={
            'Authorization': f'Bearer {jwt_token}',
            'x-api-key': api_key,
            'Content-Type': 'application/json'
        },
        json={
            'to': phone_number,
            'text': message
        }
    )
    
    print('Message sent:', response.json())
    return response.json()

# Usage
send_whatsapp_message(
    jwt_token='your-jwt-token',
    api_key='your-session-api-key',
    phone_number='919876543210',
    message='Hello! Here are the product details you requested...'
)
```

```php
// PHP Example
function sendWhatsAppMessage($jwtToken, $apiKey, $phoneNumber, $message) {
    $curl = curl_init();
    
    curl_setopt_array($curl, array(
        CURLOPT_URL => 'http://13.201.102.10/api/v1/messages/send',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'to' => $phoneNumber,
            'text' => $message
        ]),
        CURLOPT_HTTPHEADER => array(
            'Authorization: Bearer ' . $jwtToken,
            'x-api-key: ' . $apiKey,
            'Content-Type: application/json'
        ),
    ));
    
    $response = curl_exec($curl);
    $data = json_decode($response, true);
    
    curl_close($curl);
    
    return $data;
}

// Usage
sendWhatsAppMessage(
    'your-jwt-token',
    'your-session-api-key',
    '919876543210',
    'Hello! Here are the product details you requested...'
);
```

---

### 3. Send Image/Media with Caption

```javascript
// Node.js Example
async function sendImage(jwtToken, apiKey, phoneNumber, imageUrl, caption) {
  const response = await axios.post(
    'http://13.201.102.10/api/v1/messages/send-media',
    {
      to: phoneNumber,
      type: 'image',
      media: imageUrl,      // URL to image
      caption: caption      // Optional caption
    },
    {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data;
}

// Usage - Send product image
sendImage(
  'your-jwt-token',
  'your-session-api-key',
  '919876543210',
  'https://yourstore.com/product-image.jpg',
  'Check out this amazing product! Price: $99.99'
);
```

---

### 4. Get Message History

```javascript
// Node.js Example
async function getMessageHistory(jwtToken, apiKey, limit = 50) {
  const response = await axios.get(
    'http://13.201.102.10/api/v1/messages/history',
    {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'x-api-key': apiKey
      },
      params: {
        limit: limit
      }
    }
  );
  
  return response.data.data;
}
```

---

## 🪝 Webhook Setup

### Why You Need Webhooks

Webhooks let your sales assistant **receive** incoming WhatsApp messages in real-time.

### Setting Up Webhook

```javascript
// Node.js Example
async function setupWebhook(jwtToken, sessionId, webhookUrl) {
  const response = await axios.post(
    'http://13.201.102.10/api/v1/webhooks',
    {
      sessionId: sessionId,
      url: webhookUrl,        // Your sales assistant endpoint
      events: ['message.received', 'message.sent', 'status.change']
    },
    {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  console.log('Webhook created:', response.data);
  return response.data;
}

// Usage
setupWebhook(
  'your-jwt-token',
  'your-session-id',
  'https://your-sales-assistant.com/api/whatsapp-webhook'
);
```

### Webhook Payload Example

When someone messages your WhatsApp, your sales assistant receives:

```json
{
  "event": "message.received",
  "sessionId": "your-session-id",
  "data": {
    "from": "919876543210",
    "message": {
      "text": "I want to buy product X",
      "timestamp": 1734602400000
    },
    "contact": {
      "name": "Customer Name",
      "number": "919876543210"
    }
  }
}
```

### Handling Webhook in Your Sales Assistant

```javascript
// Express.js Example
const express = require('express');
const app = express();

app.post('/api/whatsapp-webhook', express.json(), async (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'message.received') {
    const customerPhone = data.from;
    const messageText = data.message.text;
    
    console.log(`Received from ${customerPhone}: ${messageText}`);
    
    // Your sales assistant logic here
    if (messageText.toLowerCase().includes('price')) {
      // Send price list
      await sendWhatsAppMessage(
        JWT_TOKEN,
        API_KEY,
        customerPhone,
        'Here are our prices:\n1. Product A - $50\n2. Product B - $75'
      );
    }
  }
  
  res.sendStatus(200);
});

app.listen(3000, () => console.log('Webhook server running on port 3000'));
```

```python
# Flask Example
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/api/whatsapp-webhook', methods=['POST'])
def whatsapp_webhook():
    data = request.json
    event = data.get('event')
    
    if event == 'message.received':
        customer_phone = data['data']['from']
        message_text = data['data']['message']['text']
        
        print(f"Received from {customer_phone}: {message_text}")
        
        # Your sales assistant logic
        if 'price' in message_text.lower():
            send_whatsapp_message(
                JWT_TOKEN,
                API_KEY,
                customer_phone,
                'Here are our prices:\n1. Product A - $50\n2. Product B - $75'
            )
    
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(port=3000)
```

---

## 💡 Complete Sales Assistant Integration Example

### Full Working Bot (Node.js)

```javascript
const axios = require('axios');
const express = require('express');

const API_BASE = 'http://13.201.102.10/api/v1';
let JWT_TOKEN = '';
let API_KEY = '';

// Initialize bot
async function initializeBot() {
  // Step 1: Login and get JWT
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: 'your-client@example.com',
    password: 'your-password'
  });
  JWT_TOKEN = loginRes.data.data.token;
  console.log('✅ Logged in');
  
  // Step 2: Get session API key
  const sessionsRes = await axios.get(`${API_BASE}/sessions`, {
    headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
  });
  API_KEY = sessionsRes.data.data[0].api_key;
  console.log('✅ Got API Key');
  
  // Step 3: Setup webhook
  await setupWebhook();
  console.log('✅ Webhook configured');
  
  console.log('🤖 Sales Assistant Bot is ready!');
}

async function setupWebhook() {
  await axios.post(
    `${API_BASE}/webhooks`,
    {
      sessionId: 'your-session-id',
      url: 'https://your-domain.com/api/whatsapp-webhook',
      events: ['message.received']
    },
    { headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }}
  );
}

async function sendMessage(phone, text) {
  return axios.post(
    `${API_BASE}/messages/send`,
    { to: phone, text },
    {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'x-api-key': API_KEY
      }
    }
  );
}

// Webhook handler
const app = express();
app.use(express.json());

app.post('/api/whatsapp-webhook', async (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'message.received') {
    const phone = data.from;
    const message = data.message.text.toLowerCase();
    
    // Sales bot logic
    if (message.includes('price') || message.includes('cost')) {
      await sendMessage(phone, 
        '💰 Our Prices:\n' +
        '1. Product A - $50\n' +
        '2. Product B - $75\n' +
        '3. Product C - $100\n\n' +
        'Reply with product name to order!'
      );
    }
    else if (message.includes('order')) {
      await sendMessage(phone,
        '📦 To place an order, please provide:\n' +
        '1. Product name\n' +
        '2. Quantity\n' +
        '3. Delivery address'
      );
    }
    else if (message.includes('status')) {
      await sendMessage(phone,
        '🚚 Your order status: Out for delivery\n' +
        'Expected delivery: Today by 6 PM'
      );
    }
    else if (message.includes('hi') || message.includes('hello')) {
      await sendMessage(phone,
        '👋 Hello! Welcome to our store!\n\n' +
        'How can I help you today?\n' +
        '- Type "price" for price list\n' +
        '- Type "order" to place an order\n' +
        '- Type "status" to check order status'
      );
    }
    else {
      await sendMessage(phone,
        'I can help you with:\n' +
        '💰 Prices\n' +
        '📦 Orders\n' +
        '🚚 Status\n\n' +
        'Just type what you need!'
      );
    }
  }
  
  res.sendStatus(200);
});

app.listen(3000, async () => {
  console.log('🚀 Starting Sales Assistant Bot...');
  await initializeBot();
});
```

---

## 🔄 Auto-Reply Feature

Enable auto-reply for instant first message response:

```javascript
async function enableAutoReply(jwtToken, sessionId, message) {
  await axios.put(
    `http://13.201.102.10/api/v1/sessions/${sessionId}/auto-reply`,
    {
      enabled: true,
      message: message || 'Thank you for contacting us! Our sales team will respond shortly.'
    },
    {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    }
  );
}

// Usage
enableAutoReply(
  'your-jwt-token',
  'your-session-id',
  '👋 Hi! Thanks for reaching out. How can we help you today?'
);
```

---

## ⚙️ Environment Variables (Best Practice)

Store credentials securely:

```bash
# .env file
WHATSAPP_API_URL=http://13.201.102.10/api/v1
WHATSAPP_EMAIL=your-client@example.com
WHATSAPP_PASSWORD=your-password
WHATSAPP_SESSION_ID=your-session-id
WEBHOOK_URL=https://your-sales-assistant.com/api/whatsapp-webhook
```

```javascript
// Load in your code
require('dotenv').config();

const config = {
  apiUrl: process.env.WHATSAPP_API_URL,
  email: process.env.WHATSAPP_EMAIL,
  password: process.env.WHATSAPP_PASSWORD,
  sessionId: process.env.WHATSAPP_SESSION_ID,
  webhookUrl: process.env.WEBHOOK_URL
};
```

---

## 📞 Quick Reference

### All Available Endpoints

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/auth/login` | POST | Get JWT token | No |
| `/auth/register` | POST | Create account | No |
| `/sessions` | GET | List sessions | JWT |
| `/sessions` | POST | Create session | JWT |
| `/sessions/:id/status` | GET | Check connection | JWT |
| `/sessions/:id/qr` | GET | Get QR code | JWT |
| `/sessions/:id/auto-reply` | PUT | Configure auto-reply | JWT |
| `/messages/send` | POST | Send text message | JWT + API Key |
| `/messages/send-media` | POST | Send image/video | JWT + API Key |
| `/messages/history` | GET | Get chat history | JWT + API Key |
| `/webhooks` | POST | Setup webhook | JWT |
| `/webhooks` | GET | List webhooks | JWT |

---

## 🆘 Troubleshooting

### Common Issues

**1. "Invalid token" error**
- JWT expired (lasts 7 days) - login again
- Token copied incorrectly - check for spaces

**2. Webhook not receiving messages**
- Enable auto-reply OR send a test message from web console first
- Ensure webhook URL is publicly accessible
- Check webhook URL returns 200 status

**3. "Session not found"**
- Session disconnected - reconnect via web console
- Wrong session ID - check `/sessions` endpoint

**4. Rate limits**
- Max 10 messages per second per session
- Use delays between bulk messages

---

## 📬 Testing Your Integration

### Quick Test Script

```bash
# Test 1: Login
curl -X POST http://13.201.102.10/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"your-password"}'

# Test 2: Send message (replace tokens)
curl -X POST http://13.201.102.10/api/v1/messages/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to":"919876543210","text":"Test message from sales assistant"}'
```

---

## 📧 Support

If you encounter any issues:
1. Check logs: See [DEPLOYMENT_SUCCESS.md](DEPLOYMENT_SUCCESS.md)
2. Verify session is connected in web console
3. Test API endpoints with curl/Postman first
4. Check webhook URL is accessible publicly

---

**Integration Status**: Ready for Production ✅  
**API Base URL**: http://13.201.102.10/api/v1  
**Documentation**: This guide + API_REFERENCE.md  

Happy integrating! 🚀
