import { useEffect, useState } from 'react';
import { sessionAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function Sessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [qrCode, setQrCode] = useState('');

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
    } catch (error) {
      toast.error('QR code not available');
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
          <div key={session.session_id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{session.name}</h3>
                <p className="text-sm text-gray-500">{session.phone_number || 'Not connected'}</p>
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
                    fetchQRCode(session.session_id);
                  }}
                  className="flex-1 px-3 py-2 text-sm text-primary bg-primary/10 rounded hover:bg-primary/20"
                >
                  <RefreshCw className="w-4 h-4 inline mr-1" />
                  Show QR
                </button>
              )}
              <button
                onClick={() => deleteSession(session.session_id)}
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
            <p className="text-sm text-gray-600 text-center mb-4">
              Scan this QR code with WhatsApp to connect your session
            </p>
            <button
              onClick={() => {
                setSelectedSession(null);
                setQrCode('');
              }}
              className="w-full px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary-dark"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
