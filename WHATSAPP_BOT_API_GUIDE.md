# 🤖 WhatsApp Bot API - Complete Implementation Guide

## For Building Question-Answer WhatsApp Bots

**API Base URL**: `http://13.201.102.10/api/v1`

---

## 📋 Quick Overview

Your bot will:
1. **Receive** customer messages via webhook
2. **Process** the question with your logic
3. **Reply** automatically via API

---

## 🚀 Step-by-Step Setup

### Step 1: Create Your Account

```bash
curl -X POST http://13.201.102.10/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-bot@example.com",
    "password": "your-secure-password",
    "name": "Your Bot Name"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "your-bot@example.com",
      "plan": "free"
    }
  }
}
```

💾 **Save the `token`** - you'll need it for the next steps.

---

### Step 2: Create WhatsApp Session (with Auto-Webhook)

```bash
curl -X POST http://13.201.102.10/api/v1/sessions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Bot Session",
    "webhook": {
      "url": "https://your-bot-server.com/webhook",
      "events": ["message.received"]
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "abc-123-def-456",
    "apiKey": "your-session-api-key-here",
    "status": "pending",
    "message": "Scan QR code to connect",
    "webhook": {
      "url": "https://your-bot-server.com/webhook",
      "events": ["message.received"]
    }
  }
}
```

💾 **Save both `sessionId` and `apiKey`**

---

### Step 3: Get QR Code

```bash
curl http://13.201.102.10/api/v1/sessions/YOUR_SESSION_ID/qr \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgo...",
    "connected": false,
    "message": "Scan this QR code with WhatsApp"
  }
}
```

📱 **Scan the QR code** with WhatsApp on your phone → Session connects automatically!

---

## 📨 Receiving Messages (Webhook)

When a customer sends a WhatsApp message, your webhook receives:

```json
{
  "event": "message.received",
  "sessionId": "abc-123-def-456",
  "data": {
    "from": "919876543210",
    "message": {
      "text": "What is your pricing?",
      "timestamp": 1734602400000
    },
    "contact": {
      "name": "Customer Name",
      "number": "919876543210"
    }
  }
}
```

---

## 💬 Sending Reply Messages

```bash
curl -X POST http://13.201.102.10/api/v1/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-api-key: YOUR_SESSION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "919876543210",
    "text": "Our pricing starts at $99/month. Would you like more details?"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully"
}
```

---

## 🤖 Complete Bot Example

### Node.js Implementation

```javascript
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Your credentials
const API_BASE = 'http://13.201.102.10/api/v1';
const JWT_TOKEN = 'your-jwt-token';
const SESSION_API_KEY = 'your-session-api-key';

// Bot responses database
const botResponses = {
  'pricing': 'Our pricing starts at $99/month for basic plan, $199 for pro.',
  'features': 'We offer 24/7 support, unlimited users, and API access.',
  'contact': 'You can reach us at support@example.com or call +1-234-567-8900',
  'hours': 'We are available Monday-Friday, 9 AM to 6 PM EST.',
  'demo': 'Book a demo at https://example.com/demo',
  'help': 'I can help you with: pricing, features, contact, hours, or demo'
};

// Webhook receiver
app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;

  if (event === 'message.received') {
    const customerPhone = data.from;
    const messageText = data.message.text.toLowerCase();

    console.log(`📨 Received: "${messageText}" from ${customerPhone}`);

    // Find matching response
    let reply = null;
    for (const [keyword, response] of Object.entries(botResponses)) {
      if (messageText.includes(keyword)) {
        reply = response;
        break;
      }
    }

    // Default response if no match
    if (!reply) {
      reply = "I'm not sure about that. Type 'help' to see what I can assist with!";
    }

    // Send reply
    try {
      await axios.post(
        `${API_BASE}/messages/send`,
        {
          to: customerPhone,
          text: reply
        },
        {
          headers: {
            'Authorization': `Bearer ${JWT_TOKEN}`,
            'x-api-key': SESSION_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Replied: "${reply}"`);
    } catch (error) {
      console.error('❌ Failed to send reply:', error.response?.data);
    }
  }

  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log('🤖 WhatsApp Bot running on port 3000');
});
```

---

### Python Flask Implementation

```python
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# Your credentials
API_BASE = 'http://13.201.102.10/api/v1'
JWT_TOKEN = 'your-jwt-token'
SESSION_API_KEY = 'your-session-api-key'

# Bot responses
bot_responses = {
    'pricing': 'Our pricing starts at $99/month for basic plan, $199 for pro.',
    'features': 'We offer 24/7 support, unlimited users, and API access.',
    'contact': 'You can reach us at support@example.com or call +1-234-567-8900',
    'hours': 'We are available Monday-Friday, 9 AM to 6 PM EST.',
    'demo': 'Book a demo at https://example.com/demo',
    'help': 'I can help you with: pricing, features, contact, hours, or demo'
}

def send_message(phone, text):
    """Send WhatsApp message"""
    response = requests.post(
        f'{API_BASE}/messages/send',
        headers={
            'Authorization': f'Bearer {JWT_TOKEN}',
            'x-api-key': SESSION_API_KEY,
            'Content-Type': 'application/json'
        },
        json={
            'to': phone,
            'text': text
        }
    )
    return response.json()

@app.route('/webhook', methods=['POST'])
def webhook():
    data = request.json
    event = data.get('event')

    if event == 'message.received':
        customer_phone = data['data']['from']
        message_text = data['data']['message']['text'].lower()

        print(f'📨 Received: "{message_text}" from {customer_phone}')

        # Find matching response
        reply = None
        for keyword, response in bot_responses.items():
            if keyword in message_text:
                reply = response
                break

        # Default response
        if not reply:
            reply = "I'm not sure about that. Type 'help' to see what I can assist with!"

        # Send reply
        try:
            send_message(customer_phone, reply)
            print(f'✅ Replied: "{reply}"')
        except Exception as e:
            print(f'❌ Failed to send reply: {e}')

    return '', 200

if __name__ == '__main__':
    app.run(port=3000)
```

---

### PHP Implementation

```php
<?php
// webhook.php

$API_BASE = 'http://13.201.102.10/api/v1';
$JWT_TOKEN = 'your-jwt-token';
$SESSION_API_KEY = 'your-session-api-key';

// Bot responses
$botResponses = [
    'pricing' => 'Our pricing starts at $99/month for basic plan, $199 for pro.',
    'features' => 'We offer 24/7 support, unlimited users, and API access.',
    'contact' => 'You can reach us at support@example.com or call +1-234-567-8900',
    'hours' => 'We are available Monday-Friday, 9 AM to 6 PM EST.',
    'demo' => 'Book a demo at https://example.com/demo',
    'help' => 'I can help you with: pricing, features, contact, hours, or demo'
];

function sendMessage($phone, $text) {
    global $API_BASE, $JWT_TOKEN, $SESSION_API_KEY;
    
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => "$API_BASE/messages/send",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'to' => $phone,
            'text' => $text
        ]),
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $JWT_TOKEN",
            "x-api-key: $SESSION_API_KEY",
            "Content-Type: application/json"
        ],
    ]);
    
    $response = curl_exec($curl);
    curl_close($curl);
    
    return json_decode($response, true);
}

// Get webhook data
$data = json_decode(file_get_contents('php://input'), true);

if ($data['event'] === 'message.received') {
    $customerPhone = $data['data']['from'];
    $messageText = strtolower($data['data']['message']['text']);
    
    error_log("📨 Received: \"$messageText\" from $customerPhone");
    
    // Find matching response
    $reply = null;
    foreach ($botResponses as $keyword => $response) {
        if (strpos($messageText, $keyword) !== false) {
            $reply = $response;
            break;
        }
    }
    
    // Default response
    if (!$reply) {
        $reply = "I'm not sure about that. Type 'help' to see what I can assist with!";
    }
    
    // Send reply
    sendMessage($customerPhone, $reply);
    error_log("✅ Replied: \"$reply\"");
}

http_response_code(200);
?>
```

---

## 🎯 Testing Your Bot

### 1. Test Webhook (Use webhook.site first)

Before deploying, test with webhook.site:

```bash
curl -X POST http://13.201.102.10/api/v1/sessions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Bot",
    "webhook": {
      "url": "https://webhook.site/unique-url-here",
      "events": ["message.received"]
    }
  }'
```

Send a WhatsApp message → See it appear on webhook.site!

### 2. Test Sending Messages

```bash
curl -X POST http://13.201.102.10/api/v1/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-api-key: YOUR_SESSION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "919876543210",
    "text": "Test message from bot"
  }'
```

---

## 🔒 Security Best Practices

### 1. Environment Variables

```bash
# .env file
WHATSAPP_JWT_TOKEN=your-jwt-token
WHATSAPP_SESSION_API_KEY=your-session-api-key
WHATSAPP_API_BASE=http://13.201.102.10/api/v1
```

```javascript
// In your code
require('dotenv').config();
const JWT_TOKEN = process.env.WHATSAPP_JWT_TOKEN;
```

### 2. Verify Webhook Requests (Optional but recommended)

Add a secret parameter to your webhook URL:
```
https://your-server.com/webhook?secret=your-random-secret
```

Check the secret in your webhook handler:
```javascript
app.post('/webhook', (req, res) => {
  if (req.query.secret !== 'your-random-secret') {
    return res.sendStatus(403);
  }
  // Process webhook...
});
```

---

## 📊 Advanced Bot Features

### Send Images

```bash
curl -X POST http://13.201.102.10/api/v1/messages/send-media \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-api-key: YOUR_SESSION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "919876543210",
    "type": "image",
    "media": "https://example.com/product-image.jpg",
    "caption": "Check out this product!"
  }'
```

### Context-Aware Conversations

```javascript
// Store conversation state
const conversations = new Map();

app.post('/webhook', async (req, res) => {
  const { data } = req.body;
  const phone = data.from;
  const message = data.message.text.toLowerCase();

  // Get or create conversation state
  let state = conversations.get(phone) || { step: 'initial' };

  if (state.step === 'initial') {
    if (message.includes('order')) {
      await sendMessage(phone, 'Great! What would you like to order?');
      state = { step: 'awaiting_product' };
    }
  } else if (state.step === 'awaiting_product') {
    state.product = message;
    await sendMessage(phone, `Perfect! How many ${message} would you like?`);
    state.step = 'awaiting_quantity';
  } else if (state.step === 'awaiting_quantity') {
    state.quantity = message;
    await sendMessage(phone, 
      `Order confirmed: ${state.quantity}x ${state.product}. Total: $${state.quantity * 10}`
    );
    state = { step: 'initial' }; // Reset
  }

  conversations.set(phone, state);
  res.sendStatus(200);
});
```

### Integration with AI (ChatGPT, Claude, etc.)

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/webhook', async (req, res) => {
  const { data } = req.body;
  const phone = data.from;
  const message = data.message.text;

  // Get AI response
  const completion = await openai.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a helpful customer support assistant.' },
      { role: 'user', content: message }
    ],
    model: 'gpt-3.5-turbo',
  });

  const reply = completion.choices[0].message.content;

  // Send via WhatsApp
  await sendMessage(phone, reply);
  res.sendStatus(200);
});
```

---

## 🚨 Troubleshooting

### Webhook Not Receiving Messages

**Solution 1**: Enable auto-reply first
```bash
curl -X PUT http://13.201.102.10/api/v1/sessions/YOUR_SESSION_ID/auto-reply \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "message": "Thanks for your message! Processing..."
  }'
```

**Solution 2**: Make sure webhook URL is:
- ✅ Publicly accessible (not localhost)
- ✅ Using HTTPS (or use ngrok for testing)
- ✅ Returns 200 status code

### Session Disconnected

Check status:
```bash
curl http://13.201.102.10/api/v1/sessions/YOUR_SESSION_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

If disconnected, get new QR code and scan again.

### Rate Limiting

Free plan: 10 messages/min  
If you need more, upgrade your plan.

---

## 📚 Complete API Reference

### Authentication
```
POST /auth/register - Create account
POST /auth/login - Get JWT token
POST /auth/api-keys - Generate API key (for multi-session)
```

### Sessions
```
POST /sessions - Create session (with optional webhook)
GET /sessions - List all sessions
GET /sessions/:id/status - Check connection status
GET /sessions/:id/qr - Get QR code
DELETE /sessions/:id - Disconnect session
PUT /sessions/:id/auto-reply - Configure auto-reply
```

### Messages
```
POST /messages/send - Send text message
POST /messages/send-media - Send image/video/document
GET /messages/history - Get message history
```

### Webhooks
```
POST /webhooks - Register webhook (or use webhook param in session creation)
GET /webhooks - List webhooks
DELETE /webhooks/:id - Delete webhook
```

---

## 🎉 Quick Start Checklist

- [ ] Register account
- [ ] Create session with webhook
- [ ] Scan QR code
- [ ] Test webhook with webhook.site
- [ ] Deploy bot server
- [ ] Update webhook URL to your server
- [ ] Send test message
- [ ] Verify bot replies
- [ ] Go live!

---

## 💡 Example Use Cases

### Customer Support Bot
- Answer FAQs automatically
- Collect customer information
- Create support tickets
- Escalate to human when needed

### Order Taking Bot
- Show product catalog
- Process orders
- Confirm payment
- Send order status updates

### Appointment Booking Bot
- Check availability
- Book appointments
- Send reminders
- Handle rescheduling

### Lead Generation Bot
- Qualify leads
- Collect contact info
- Schedule demos
- Send follow-ups

---

## 📞 Support

**Server**: http://13.201.102.10  
**API Version**: v1  
**Status**: ✅ Live and Ready

Need help? Check the logs:
```bash
# On your server
docker logs sak-whatsapp-api-backend-1
```

---

**Ready to build your WhatsApp bot!** 🚀

Start with the basic example, then customize based on your needs. The bot can be as simple or sophisticated as you want!
