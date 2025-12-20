import { useEffect, useState } from 'react';
import { sessionAPI, webhookAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, RefreshCw, MessageSquare } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function Sessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [qrCode, setQrCode] = useState('');
  const [qrConnected, setQrConnected] = useState(false);
  const [connectedApiKey, setConnectedApiKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [connectedWebhookSecret, setConnectedWebhookSecret] = useState<string | null>(null);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [showAutoReplyModal, setShowAutoReplyModal] = useState(false);
  const [autoReplyConfig, setAutoReplyConfig] = useState<any>({ enabled: false, message: '' });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await sessionAPI.getAll();
      setSessions(response.data.data.sessions);
    } catch (error) {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (name: string) => {
    try {
      const response = await sessionAPI.create({ name });
      toast.success('Session created! Scan QR code to connect.');
      setShowCreateModal(false);
      loadSessions();
      
      // Show QR code
      setSelectedSession(response.data.data);
      fetchQRCode(response.data.data.sessionId);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to create session');
    }
  };

  const fetchQRCode = async (sessionId: string) => {
    try {
      const response = await sessionAPI.getQR(sessionId);
      setQrCode(response.data.data.qrCode);
      setQrConnected(Boolean(response.data.data.connected));
    } catch (error) {
      toast.error('QR code not available');
    }
  };

  const pollConnectionAndRevealKey = async (sessionId: string) => {
    try {
      const res = await sessionAPI.getStatus(sessionId);
      const connected = Boolean(res.data?.data?.connected);
      if (!connected) return;

      setQrConnected(true);
      await loadSessions();
      const updated = sessions.find((s) => (s.sessionId || s.session_id) === sessionId);
      const key = (updated?.apiKey || updated?.api_key || selectedSession?.apiKey || selectedSession?.api_key) as string | undefined;
      if (key) setConnectedApiKey(key);
    } catch {
      // ignore polling errors
    }
  };

  useEffect(() => {
    let iv: any;
    const sessionId = selectedSession?.sessionId || selectedSession?.session_id;
    if (selectedSession && qrCode && sessionId) {
      setQrConnected(false);
      setConnectedApiKey(null);
      setWebhookUrl('');
      setConnectedWebhookSecret(null);
      setSavingWebhook(false);
      pollConnectionAndRevealKey(sessionId);
      iv = setInterval(() => pollConnectionAndRevealKey(sessionId), 2500);
    }
    return () => iv && clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession?.sessionId, selectedSession?.session_id, qrCode]);

  const saveWebhookFromQrModal = async () => {
    const sessionId = selectedSession?.sessionId || selectedSession?.session_id;
    if (!sessionId) return;

    const url = webhookUrl.trim();
    if (!url) {
      toast.error('Please enter a webhook URL');
      return;
    }

    setSavingWebhook(true);
    try {
      const res = await webhookAPI.create({
        sessionId,
        url,
        events: ['message.received', 'message.sent', 'session.status']
      });

      const data = res.data?.data || res.data;
      const secret = data?.secret as string | undefined;
      if (!secret) {
        toast.error('Webhook saved, but secret was missing in response');
        return;
      }

      setConnectedWebhookSecret(secret);
      toast.success('Webhook saved');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save webhook');
    } finally {
      setSavingWebhook(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session?')) return;
    
    try {
      await sessionAPI.delete(sessionId);
      toast.success('Session deleted');
      loadSessions();
    } catch (error) {
      toast.error('Failed to delete session');
    }
  };

  const openAutoReplyModal = (session: any) => {
    setSelectedSession(session);
    setAutoReplyConfig({
      enabled: session.autoReplyEnabled || false,
      message: session.autoReplyMessage || 'Thank you for your message! We will get back to you soon.'
    });
    setShowAutoReplyModal(true);
  };

  const updateAutoReply = async () => {
    try {
      await sessionAPI.updateAutoReply(
        selectedSession.sessionId || selectedSession.session_id,
        autoReplyConfig.enabled,
        autoReplyConfig.message
      );
      toast.success('Auto-reply settings updated');
      setShowAutoReplyModal(false);
      loadSessions();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to update auto-reply');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'disconnected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">WhatsApp Sessions</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary-dark"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Session
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session) => (
          <div key={session.sessionId || session.session_id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{session.name}</h3>
                <p className="text-xs text-gray-500 break-all">Session ID: {session.sessionId || session.session_id}</p>
                <p className="text-sm text-gray-500">{session.phoneNumber || session.phone_number || 'Not connected'}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(session.status)}`}>
                {session.status}
              </span>
            </div>

            <div className="flex space-x-2">
              {session.status === 'pending' && (
                <button
                  onClick={() => {
                    setSelectedSession(session);
                    fetchQRCode(session.sessionId || session.session_id);
                  }}
                  className="flex-1 px-3 py-2 text-sm text-primary bg-primary/10 rounded hover:bg-primary/20"
                >
                  <RefreshCw className="w-4 h-4 inline mr-1" />
                  Show QR
                </button>
              )}
              {session.status === 'connected' && (
                <button
                  onClick={() => openAutoReplyModal(session)}
                  className="flex-1 px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                >
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Auto-Reply
                </button>
              )}
              <button
                onClick={() => deleteSession(session.sessionId || session.session_id)}
                className="flex-1 px-3 py-2 text-sm text-red-600 bg-red-50 rounded hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4 inline mr-1" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Session</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createSession(formData.get('name') as string);
            }}>
              <input
                name="name"
                type="text"
                placeholder="Session name"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              />
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary-dark"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {selectedSession && qrCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Scan QR Code</h2>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={qrCode} size={256} />
            </div>
            {!qrConnected ? (
              <p className="text-sm text-gray-600 text-center mb-4">
                Scan this QR code with WhatsApp to connect your session
              </p>
            ) : (
              <div className="mb-4">
                <p className="text-sm text-green-700 text-center mb-2">Connected! Your secret key is now available.</p>
                {connectedApiKey ? (
                  <p className="text-xs text-gray-700 break-all">API Key: <span className="font-mono">{connectedApiKey}</span></p>
                ) : (
                  <p className="text-xs text-gray-600 text-center">Fetching key…</p>
                )}

                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Webhook URL (enter after QR is scanned)</label>
                  <input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    type="url"
                    placeholder="https://your-domain.com/webhook"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={saveWebhookFromQrModal}
                    disabled={savingWebhook || !webhookUrl.trim()}
                    className="w-full mt-2 px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-60"
                  >
                    {savingWebhook ? 'Saving…' : 'Save Webhook & Show Secret'}
                  </button>

                  {connectedWebhookSecret ? (
                    <div className="mt-3">
                      <p className="text-xs text-gray-700 mb-1">Webhook Secret:</p>
                      <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs break-all font-mono">
                        {connectedWebhookSecret}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            <button
              onClick={() => {
                setSelectedSession(null);
                setQrCode('');
                setQrConnected(false);
                setConnectedApiKey(null);
                setWebhookUrl('');
                setConnectedWebhookSecret(null);
                setSavingWebhook(false);
              }}
              className="w-full px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary-dark"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Auto-Reply Modal */}
      {showAutoReplyModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Auto-Reply Settings</h2>
            <div className="mb-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoReplyConfig.enabled}
                  onChange={(e) => setAutoReplyConfig({ ...autoReplyConfig, enabled: e.target.checked })}
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700">Enable Auto-Reply</span>
              </label>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto-Reply Message
              </label>
              <textarea
                value={autoReplyConfig.message}
                onChange={(e) => setAutoReplyConfig({ ...autoReplyConfig, message: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter your auto-reply message..."
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowAutoReplyModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={updateAutoReply}
                className="flex-1 px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary-dark"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
