export default function Docs() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">API Documentation</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Authentication</h2>
        <p className="text-gray-600 mb-4">All API requests require an API key in the <code className="bg-gray-100 px-2 py-1 rounded">x-api-key</code> header.</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
{`curl -X POST https://api.sakwhatsapp.com/api/v1/messages/send \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "919876543210", "text": "Hello!"}'`}
        </pre>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Send Text Message</h2>
        <p className="text-gray-600 mb-2"><strong>Endpoint:</strong> <code className="bg-gray-100 px-2 py-1 rounded">POST /api/v1/messages/send</code></p>
        <p className="text-gray-600 mb-4"><strong>Headers:</strong> <code className="bg-gray-100 px-2 py-1 rounded">x-api-key: YOUR_API_KEY</code></p>
        <p className="text-gray-600 mb-2"><strong>Request Body:</strong></p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4">
{`{
  "to": "919876543210",
  "text": "Hello from SAK WhatsApp API!"
}`}
        </pre>
        <p className="text-gray-600 mb-2"><strong>Response:</strong></p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
{`{
  "success": true,
  "data": {
    "messageId": "3EB0C...",
    "status": "sent"
  }
}`}
        </pre>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Send Image</h2>
        <p className="text-gray-600 mb-2"><strong>Endpoint:</strong> <code className="bg-gray-100 px-2 py-1 rounded">POST /api/v1/messages/send-image</code></p>
        <p className="text-gray-600 mb-4"><strong>Content-Type:</strong> <code className="bg-gray-100 px-2 py-1 rounded">multipart/form-data</code></p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
{`curl -X POST https://api.sakwhatsapp.com/api/v1/messages/send-image \\
  -H "x-api-key: YOUR_API_KEY" \\
  -F "to=919876543210" \\
  -F "caption=Check this out!" \\
  -F "image=@/path/to/image.jpg"`}
        </pre>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Send Document</h2>
        <p className="text-gray-600 mb-2"><strong>Endpoint:</strong> <code className="bg-gray-100 px-2 py-1 rounded">POST /api/v1/messages/send-document</code></p>
        <p className="text-gray-600 mb-4"><strong>Content-Type:</strong> <code className="bg-gray-100 px-2 py-1 rounded">multipart/form-data</code></p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
{`curl -X POST https://api.sakwhatsapp.com/api/v1/messages/send-document \\
  -H "x-api-key: YOUR_API_KEY" \\
  -F "to=919876543210" \\
  -F "caption=Important document" \\
  -F "document=@/path/to/document.pdf"`}
        </pre>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Webhooks</h2>
        <p className="text-gray-600 mb-4">Webhooks allow you to receive real-time notifications when events occur in your WhatsApp session.</p>
        <p className="text-gray-600 mb-2"><strong>Events:</strong></p>
        <ul className="list-disc list-inside text-gray-600 mb-4">
          <li><code className="bg-gray-100 px-2 py-1 rounded">message.received</code> - Triggered when a message is received</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded">session.connected</code> - Triggered when session connects</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded">session.disconnected</code> - Triggered when session disconnects</li>
        </ul>
        <p className="text-gray-600 mb-2"><strong>Webhook Payload Example:</strong></p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
{`{
  "event": "message.received",
  "sessionId": "abc-123",
  "from": "919876543210@s.whatsapp.net",
  "messageId": "3EB0C...",
  "timestamp": 1702389234,
  "type": "conversation",
  "text": "Hello!"
}`}
        </pre>
      </div>
    </div>
  );
}
