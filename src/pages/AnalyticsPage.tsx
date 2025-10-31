import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from '../components/home/Sidebar';
import { analyticsService } from '../services/analyticsService';
import type { StudyAnalytics } from '../services/analyticsService';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#b85a3a', '#d4a944', '#8b6f47', '#6b5b95', '#a8e6cf', '#ffd3b6'];

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<StudyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user, days]);

  const loadAnalytics = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await analyticsService.getStudyAnalytics(user.id, days);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#1a1a1a]">
        <Sidebar activePage="analytics" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white text-lg">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex h-screen bg-[#1a1a1a]">
        <Sidebar activePage="analytics" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white text-lg">No analytics data available</div>
        </div>
      </div>
    );
  }

  // Prepare data for charts
  const studyModeData = Object.entries(analytics.studyTimeByMode).map(([mode, time]) => ({
    mode: mode.charAt(0).toUpperCase() + mode.slice(1),
    time: Math.round(time),
  }));

  const folderData = Object.entries(analytics.studyTimeByFolder)
    .map(([, data]) => ({
      name: data.name,
      time: Math.round(data.time),
    }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 10);

  const pieData = studyModeData.map((item) => ({
    name: item.mode,
    value: item.time,
  }));

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      <Sidebar activePage="analytics" />
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="bg-[#2a2a2a] px-8 py-4 border-b border-[#3a3a3a] sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Study Analytics</h1>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-4 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                <div className="text-[#9ca3af] text-sm mb-2">Total Study Time</div>
                <div className="text-3xl font-bold text-white">{formatTime(analytics.totalStudyTime)}</div>
              </div>
              <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                <div className="text-[#9ca3af] text-sm mb-2">Quiz Average Score</div>
                <div className="text-3xl font-bold text-white">
                  {analytics.quizPerformance.averageScore.toFixed(1)}%
                </div>
              </div>
              <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                <div className="text-[#9ca3af] text-sm mb-2">Total Quizzes</div>
                <div className="text-3xl font-bold text-white">{analytics.quizPerformance.totalQuizzes}</div>
              </div>
            </div>

            {/* Study Time by Mode - Pie Chart */}
            {pieData.length > 0 && (
              <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                <h2 className="text-xl font-bold text-white mb-4">Study Time by Mode</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: any) => {
                        const { name, percent } = props;
                        return `${name}: ${((percent || 0) * 100).toFixed(0)}%`;
                      }}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Quiz Performance Over Time */}
            {analytics.quizPerformance.scoresOverTime.length > 0 && (
              <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                <h2 className="text-xl font-bold text-white mb-4">Quiz Performance Over Time</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.quizPerformance.scoresOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #3a3a3a',
                        color: '#fff',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#b85a3a"
                      strokeWidth={2}
                      name="Average Score (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Study Time by Folder */}
            {folderData.length > 0 && (
              <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                <h2 className="text-xl font-bold text-white mb-4">Study Time by Folder</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={folderData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                    <XAxis dataKey="name" stroke="#9ca3af" angle={-45} textAnchor="end" height={100} />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #3a3a3a',
                        color: '#fff',
                      }}
                    />
                    <Bar dataKey="time" fill="#b85a3a" name="Minutes" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Most Studied Topics */}
            {analytics.mostStudiedTopics.length > 0 && (
              <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                <h2 className="text-xl font-bold text-white mb-4">Most Studied Topics</h2>
                <div className="space-y-3">
                  {analytics.mostStudiedTopics.map((topic, index) => (
                    <div
                      key={topic.noteId}
                      className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#3a3a3a] flex items-center justify-center text-white font-bold">
                          {index + 1}
                        </div>
                        <div className="text-white">{topic.title}</div>
                      </div>
                      <div className="text-[#9ca3af]">{topic.studyCount} sessions</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

