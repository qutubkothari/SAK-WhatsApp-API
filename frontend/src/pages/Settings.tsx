import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { user } = useAuth();

  const plans = [
    { name: 'Free', price: 0, sessions: 1, messages: 100 },
    { name: 'Starter', price: 15, sessions: 3, messages: 1000 },
    { name: 'Pro', price: 49, sessions: 10, messages: 10000 },
    { name: 'Enterprise', price: 199, sessions: 'Unlimited', messages: 'Unlimited' }
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Account Information</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600">Name</label>
            <p className="text-gray-900">{user?.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Email</label>
            <p className="text-gray-900">{user?.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Current Plan</label>
            <p className="text-gray-900 font-semibold">{user?.plan.toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Upgrade Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div key={plan.name} className={`border rounded-lg p-6 ${user?.plan.toLowerCase() === plan.name.toLowerCase() ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h3>
              <p className="text-3xl font-bold text-primary mb-4">${plan.price}<span className="text-sm text-gray-600">/mo</span></p>
              <ul className="space-y-2 mb-6 text-sm text-gray-600">
                <li>✓ {plan.sessions} Session{typeof plan.sessions === 'number' && plan.sessions > 1 ? 's' : ''}</li>
                <li>✓ {plan.messages} Messages/mo</li>
                <li>✓ Webhook Support</li>
                <li>✓ API Access</li>
              </ul>
              {user?.plan.toLowerCase() === plan.name.toLowerCase() ? (
                <button disabled className="w-full px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed">
                  Current Plan
                </button>
              ) : (
                <button className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">
                  Upgrade
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
