import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { debugLog } from '../utils/debug';
import { QRCodeSVG } from 'qrcode.react';

type ApiKey = { key: string; sessionId: string; name: string };
type Session = { sessionId: string; name: string; status: string; phoneNumber?: string };

const STORAGE_KEY = 'sak.onboarding';

export default function Onboarding() {
  useAuth();
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState<ApiKey | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const next = () => setStep((s) => Math.min(s + 1, 6));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  useEffect(() => {
    debugLog('Onboarding step', step, { sessionId: session?.sessionId, status: session?.status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function resetOnboarding(message?: string) {
    debugLog('Reset onboarding', { message });
    setApiKey(null);
    setSession(null);
    setQr(null);
    setStep(1);
    if (message) setErrorMsg(message);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  async function loadExistingSessionFromServer() {
    try {
      debugLog('Load existing session from server');
      const res = await api.get('/sessions');
      const sessions = res.data?.data?.sessions || res.data?.sessions || [];
      const first = Array.isArray(sessions) ? sessions[0] : null;
      if (!first) return false;

      const sessionId = first.sessionId || first.session_id;
      const name = first.name || 'primary-number';
      const status = first.status || 'pending';
      const key = first.apiKey || first.api_key;

      if (!sessionId) return false;

      setSession({ sessionId, name, status, phoneNumber: first.phoneNumber || first.phone_number });
      if (key) {
        setApiKey({ key, sessionId, name });
      }

      debugLog('Reused session', { sessionId, status });

      // If we restored a later step from localStorage but the session isn't connected,
      // force the UI back to the QR step so polling runs.
      if (status !== 'connected') {
        setStep((s) => (s > 4 ? 4 : s));
      }
      return true;
    } catch (e) {
      debugLog('Load existing session failed', e);
      return false;
    }
  }

  async function validateStoredSessionIsActive(sessionId: string) {
    try {
      const res = await api.get('/sessions');
      const sessions = res.data?.data?.sessions || res.data?.sessions || [];
      if (!Array.isArray(sessions)) return true;
      return sessions.some((s: any) => (s.sessionId || s.session_id) === sessionId);
    } catch {
      return true;
    }
  }

  useEffect(() => {
    (async () => {
      try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      if (parsed?.apiKey?.key && parsed?.apiKey?.sessionId && parsed?.apiKey?.name) {
        setApiKey(parsed.apiKey);
      }
      if (parsed?.session?.sessionId && parsed?.session?.name && parsed?.session?.status) {
        setSession(parsed.session);
      }
      if (typeof parsed?.webhookUrl === 'string') {
        setWebhookUrl(parsed.webhookUrl);
      }
      if (typeof parsed?.step === 'number') {
        setStep(Math.max(1, Math.min(6, parsed.step)));
      }
      } catch {
        // ignore
      }

      // If local storage has a sessionId that was deleted, reset and reuse the remaining active session.
      const storedRaw = localStorage.getItem(STORAGE_KEY);
      if (storedRaw) {
        try {
          const stored = JSON.parse(storedRaw);
          const storedSessionId = stored?.session?.sessionId;
          if (storedSessionId) {
            const ok = await validateStoredSessionIsActive(storedSessionId);
            if (!ok) {
              resetOnboarding('Your previous session was deleted. Please continue with the active session.');
              await loadExistingSessionFromServer();
              return;
            }
          }
        } catch {
          // ignore
        }
      }

      // If local storage doesn't have enough to proceed, try reusing the existing server session.
      await loadExistingSessionFromServer();
    })();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step, apiKey, session, webhookUrl })
      );
    } catch {
      // ignore
    }
  }, [step, apiKey, session, webhookUrl]);

  async function createApiKey() {
    setErrorMsg(null);
    try {
      debugLog('Create session (POST /sessions)');
      const res = await api.post('/sessions', { name: 'primary-number' });
      const data = res.data.data || res.data;

      const sessionId = data.sessionId || data.session_id || data.id;
      const key = data.apiKey || data.api_key;
      const name = data.name || 'primary-number';
      const status = data.status || 'pending';

      if (!sessionId || !key) {
        setErrorMsg('Session created but API key was missing in response.');
        return;
      }

      setApiKey({ key, sessionId, name });
      setSession({ sessionId, name, status });
      debugLog('Session created', { sessionId, status });
      next();
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.error?.code;

      debugLog('Create session failed', { status, code, err });

      // Free plan users hit this if they refresh and try to create another session.
      if (status === 403 && code === 'SESSION_LIMIT_REACHED') {
        const reused = await loadExistingSessionFromServer();
        if (reused) {
          setErrorMsg('Session limit reached. Reusing your existing session. Click Continue.');
          return;
        }

        setErrorMsg('Session limit reached (Free plan allows 1 session). Go to Sessions and delete the old session, then try again.');
        return;
      }

      setErrorMsg(err?.response?.data?.error?.message || 'Failed to create session.');
      return;
    }
  }

  async function createSession() {
    if (!session) {
      await createApiKey();
      return;
    }

    try {
      debugLog('Fetch session status', { sessionId: session.sessionId });
      const res = await api.get(`/sessions/${session.sessionId}/status`);
      const data = res.data.data || res.data;
      const connected = data.connected ?? data.status === 'connected';

      setSession({
        ...session,
        status: connected ? 'connected' : session.status,
        phoneNumber: data.phoneNumber || session.phoneNumber
      });

      debugLog('Session status', { sessionId: session.sessionId, connected, phoneNumber: data.phoneNumber });
      next();
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.error?.code;

      debugLog('Fetch status failed', { status, code, err });
      if (status === 404 && code === 'SESSION_NOT_FOUND') {
        resetOnboarding('Session not found (it was deleted). Please create a new session.');
        await loadExistingSessionFromServer();
        return;
      }
      setErrorMsg(err?.response?.data?.error?.message || 'Failed to fetch session status.');
    }
  }

  async function fetchQr() {
    if (!session || !apiKey) return;
    try {
      debugLog('Fetch QR', { sessionId: session.sessionId });
      const res = await api.get(`/sessions/${session.sessionId}/qr`);
      const qrCode =
        res.data.data?.qrCode ||
        res.data.data?.qr_code ||
        res.data.qrCode ||
        res.data.qr_code ||
        null;
      const connected = Boolean(res.data?.data?.connected);

      if (connected) {
        setSession((prev) => (prev ? { ...prev, status: 'connected' } : prev));
        setQr(null);
        debugLog('QR response indicates connected; advancing', { sessionId: session.sessionId });
        setStep((s) => (s < 5 ? 5 : s));
        return;
      }

      setQr(qrCode || null);

      debugLog('QR response', {
        sessionId: session.sessionId,
        hasQr: Boolean(qrCode),
        connected
      });
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.error?.code;

      debugLog('Fetch QR failed', { status, code, err });

      // Expected while gateway is initializing or already connected.
      if (status === 404 && code === 'QR_NOT_AVAILABLE') return;

      if (status === 404 && code === 'SESSION_NOT_FOUND') {
        resetOnboarding('Session not found (it was deleted). Please create a new session.');
        await loadExistingSessionFromServer();
        return;
      }

      // Avoid unhandled promise rejections spamming the console.
      return;
    }
  }

  async function fetchStatusAndAdvance() {
    if (!session) return;
    try {
      debugLog('Fetch status (QR step)', { sessionId: session.sessionId });
      const res = await api.get(`/sessions/${session.sessionId}/status`);
      const data = res.data.data || res.data;
      const connected = Boolean(data.connected ?? data.status === 'connected');
      if (connected) {
        setSession((prev) => (prev ? { ...prev, status: 'connected', phoneNumber: data.phoneNumber || prev.phoneNumber } : prev));
        setQr(null);
        setStep((s) => (s < 5 ? 5 : s));
      }
    } catch (e) {
      // ignore; QR polling will continue
    }
  }

  useEffect(() => {
    let iv: any;
    if (step === 4 && session && apiKey) {
      fetchQr();
      fetchStatusAndAdvance();
      iv = setInterval(() => {
        fetchQr();
        fetchStatusAndAdvance();
      }, 5000);
    }
    return () => iv && clearInterval(iv);
  }, [step, session?.sessionId, apiKey?.key]);

  async function saveWebhook() {
    if (!session) return;
    await api.post('/webhooks', { sessionId: session.sessionId, url: webhookUrl, events: ['message.received','message.status','session.status'] });
    next();
  }

  async function sendTestMessage() {
    if (!session || !apiKey) return;
    setSendingTest(true);
    try {
      await api.post('/messages/send', {
        to: '919000000000',
        text: 'Hello from SAK API!'
      }, { headers: { 'x-api-key': apiKey.key } });
      alert('Test message queued');
    } catch (e) {
      alert('Failed to send test message');
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Get Started</h1>
      <p className="text-sm text-gray-600 mb-6">Onboard like Maytapi: API key → Session → QR → Webhook → Test.</p>

      {errorMsg ? (
        <div className="mb-6 border border-red-200 bg-red-50 text-red-700 rounded p-3 text-sm">
          {errorMsg}
        </div>
      ) : null}

      <div className="space-y-6">
        <div className={`border rounded p-4 ${step===2? 'border-blue-500':'border-gray-200'}`}>
          <h2 className="font-medium">Step 1: Create API Key & Session</h2>
          {apiKey && session ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm">Key: <code className="bg-gray-100 px-1 py-0.5 rounded">{apiKey.key}</code></p>
              <p className="text-sm">Session ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{session.sessionId}</code></p>
              <p className="text-sm">Session: {session.name} ({session.status})</p>
              <button className="mt-3 btn" onClick={next}>Continue</button>
            </div>
          ) : (
            <button className="mt-3 btn" onClick={createApiKey}>Generate</button>
          )}
        </div>

        <div className={`border rounded p-4 ${step===3? 'border-blue-500':'border-gray-200'}`}>
          <h2 className="font-medium">Step 2: Confirm Session Status</h2>
          {session ? (
            <div className="mt-2">
              <p className="text-sm">Status: {session.status}{session.phoneNumber ? ` · ${session.phoneNumber}` : ''}</p>
              <button className="mt-3 btn" onClick={createSession}>Refresh & Continue</button>
            </div>
          ) : (
            <button className="mt-3 btn" onClick={createApiKey}>Create Session First</button>
          )}
        </div>

        <div className={`border rounded p-4 ${step===4? 'border-blue-500':'border-gray-200'}`}>
          <h2 className="font-medium">Step 3: Scan QR in WhatsApp</h2>
          <p className="text-sm text-gray-600">Open WhatsApp → Linked Devices → Link a device → Scan this QR.</p>
          <div className="mt-3">
            {qr ? (
              qr.startsWith('data:image') ? (
                <img src={qr} alt="QR" className="border rounded" />
              ) : (
                <div className="flex justify-center">
                  <div className="border rounded p-3 bg-white">
                    <QRCodeSVG value={qr} size={256} />
                  </div>
                </div>
              )
            ) : (
              <p className="text-sm">Loading QR…</p>
            )}
          </div>
        </div>

        <div className={`border rounded p-4 ${step===5? 'border-blue-500':'border-gray-200'}`}>
          <h2 className="font-medium">Step 4: Set Webhook URL</h2>
          <div className="mt-2 flex gap-2">
            <input className="input flex-1" placeholder="https://yourapp.example.com/sak/webhook" value={webhookUrl} onChange={(e)=>setWebhookUrl(e.target.value)} />
            <button className="btn" onClick={saveWebhook} disabled={!webhookUrl || !session}>Save</button>
          </div>
        </div>

        <div className={`border rounded p-4 ${step===6? 'border-blue-500':'border-gray-200'}`}>
          <h2 className="font-medium">Step 5: Send Test Message</h2>
          <button className="btn" onClick={sendTestMessage} disabled={sendingTest || !session || !apiKey}>{sendingTest? 'Sending…':'Send Hello'}</button>
        </div>

        <div className="flex justify-between">
          <button className="btn-secondary" onClick={prev} disabled={step===1}>Back</button>
          <button className="btn" onClick={next} disabled={step===6}>Next</button>
        </div>
      </div>
    </div>
  );
}