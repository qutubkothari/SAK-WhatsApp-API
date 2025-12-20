import { useEffect, useState } from 'react';
import { webhookAPI, sessionAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);
  const [createdWebhookId, setCreatedWebhookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [webhooksRes, sessionsRes] = await Promise.all([
        webhookAPI.getAll(),
        sessionAPI.getAll()
      ]);
      setWebhooks(webhooksRes.data.data.webhooks);
      setSessions(sessionsRes.data.data.sessions);
    } catch (error) {
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const sessionId = (formData.get('sessionId') as string) || '';
    const url = (formData.get('url') as string) || '';

    const selected = sessions.find((s: any) => (s.sessionId || s.session_id) === sessionId);
    if (!selected) {
      toast.error('Please select a session');
      return;
    }

    if (selected.status !== 'connected') {
      toast.error('Please connect the session (scan QR) before adding a webhook');
      return;
    }
    
    try {
      const res = await webhookAPI.create({
        sessionId,
        url,
        events: ['message.received', 'session.connected', 'session.disconnected']
      });
      const data = res.data?.data || res.data;
      const secret = data?.secret as string | undefined;
      const webhookId = (data?.webhookId || data?.webhook_id) as string | undefined;

      if (secret) setCreatedWebhookSecret(secret);
      if (webhookId) setCreatedWebhookId(webhookId);

      toast.success('Webhook created');
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to create webhook');
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    if (!confirm('Delete this webhook?')) return;
    
    try {
      await webhookAPI.delete(webhookId);
      toast.success('Webhook deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete webhook');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Webhooks</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary-dark"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Webhook
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Events</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {webhooks.map((webhook) => (
              <tr key={webhook.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {webhook.session_id}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <a href={webhook.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {webhook.url}
                  </a>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {webhook.events.join(', ')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${
                    webhook.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {webhook.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => deleteWebhook(webhook.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            {!createdWebhookSecret ? (
              <>
                <h2 className="text-xl font-bold mb-4">Create New Webhook</h2>
                <form onSubmit={createWebhook}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Session</label>
                    <select
                      name="sessionId"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select session</option>
                      {sessions.map((session) => {
                        const id = session.sessionId || session.session_id;
                        const label = session.name || id;
                        const status = session.status || 'pending';
                        return (
                          <option key={id} value={id}>
                            {label} ({status})
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Only connected sessions can create webhooks.</p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
                    <input
                      name="url"
                      type="url"
                      placeholder="https://your-domain.com/webhook"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setCreatedWebhookSecret(null);
                        setCreatedWebhookId(null);
                      }}
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
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4">Webhook Created</h2>
                <p className="text-sm text-gray-700 mb-2">Save this webhook secret securely. You’ll use it to verify webhook requests.</p>
                {createdWebhookId ? (
                  <p className="text-xs text-gray-600 mb-2">Webhook ID: <span className="font-mono">{createdWebhookId}</span></p>
                ) : null}
                <p className="text-xs text-gray-600 mb-1">Webhook Secret:</p>
                <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs break-all font-mono mb-4">
                  {createdWebhookSecret}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreatedWebhookSecret(null);
                    setCreatedWebhookId(null);
                  }}
                  className="w-full px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary-dark"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
