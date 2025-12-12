import { useEffect, useState } from 'react';
import { analyticsAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MessageSquare, TrendingUp, AlertCircle, Activity } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await analyticsAPI.getUsage();
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  const statCards = [
    {
      name: 'Messages Sent',
      value: stats?.summary?.totalMessagesSent || 0,
      icon: MessageSquare,
      color: 'text-green-600 bg-green-100'
    },
    {
      name: 'Messages Received',
      value: stats?.summary?.totalMessagesReceived || 0,
      icon: TrendingUp,
      color: 'text-blue-600 bg-blue-100'
    },
    {
      name: 'Failed Messages',
      value: stats?.summary?.totalMessagesFailed || 0,
      icon: AlertCircle,
      color: 'text-red-600 bg-red-100'
    },
    {
      name: 'API Calls',
      value: stats?.summary?.totalApiCalls || 0,
      icon: Activity,
      color: 'text-purple-600 bg-purple-100'
    }
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Message Activity (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats?.daily?.slice(0, 30).reverse() || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="messages_sent" fill="#25D366" name="Sent" />
            <Bar dataKey="messages_received" fill="#3B82F6" name="Received" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
