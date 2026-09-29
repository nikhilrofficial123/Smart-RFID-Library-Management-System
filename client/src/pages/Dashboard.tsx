import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRFID } from '../context/RFIDContext';
import { 
  BookOpen, 
  ArrowLeftRight, 
  BookMarked, 
  Users, 
  Radio, 
  CalendarCheck, 
  CalendarClock, 
  Activity, 
  Sparkles,
  Coins,
  CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  AreaChart,
  Area
} from 'recharts';

export const Dashboard: React.FC = () => {
  const { token, apiUrl } = useAuth();
  const { isReaderOnline } = useRFID();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch(`${apiUrl}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReturnAndPay = async (bookRfidUid: string, bookTitle: string) => {
    try {
      const res = await fetch(`${apiUrl}/transactions/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookRfidUid, payFine: true })
      });
      if (res.ok) {
        setActionSuccess(`Returned "${bookTitle}" and cleared outstanding dues.`);
        setTimeout(() => setActionSuccess(''), 4000);
        fetchDashboardStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 10000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Gathering library analytics...</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {
    totalBooks: 0,
    issuedBooks: 0,
    availableBooks: 0,
    registeredStudents: 0,
    todayIssues: 0,
    todayReturns: 0
  };

  const recentIssues = data?.recentIssues || [];
  const weeklyData = data?.weeklyData || [];

  const cards = [
    { name: 'Total Books', value: stats.totalBooks, sub: 'Copies in collection', icon: BookOpen, color: 'from-blue-500 to-indigo-500 shadow-blue-500/10' },
    { name: 'Currently Issued', value: stats.issuedBooks, sub: 'Out of library', icon: BookMarked, color: 'from-brand-500 to-purple-500 shadow-brand-500/10' },
    { name: 'Available Books', value: stats.availableBooks, sub: 'On shelf ready', icon: Sparkles, color: 'from-emerald-500 to-teal-500 shadow-emerald-500/10' },
    { name: 'Registered Students', value: stats.registeredStudents, sub: 'Library members', icon: Users, color: 'from-amber-500 to-orange-500 shadow-amber-500/10' },
  ];

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-outfit text-white">Library Dashboard</h1>
          <p className="text-slate-400 text-xs mt-1">Real-time status updates of books inventory and RFID scanning gateways.</p>
        </div>
        
        {/* Connection health check bar */}
        <div className={`flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold border ${
          isReaderOnline 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          <Radio size={16} className={isReaderOnline ? 'animate-bounce' : ''} />
          <span>Active RFID Station: {isReaderOnline ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Grid Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <div key={idx} className="glass-card rounded-2xl p-6 relative overflow-hidden group shadow-lg">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.color} opacity-5 group-hover:opacity-10 rounded-bl-full transition-all duration-300`} />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{card.name}</p>
                <h3 className="text-3xl font-extrabold font-outfit text-white mt-2">{card.value}</h3>
              </div>
              <div className={`p-3 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700/50`}>
                <card.icon size={22} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Analytics Chart & Daily stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Area Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="font-bold text-sm text-slate-200">Weekly Transaction Summary</h2>
              <p className="text-slate-500 text-[10px] mt-0.5">Frequency count of book issues and returns for last 7 days</p>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-brand-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500" /> Issues
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Returns
              </span>
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIssues" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '11px' }} />
                <Area type="monotone" dataKey="issues" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorIssues)" name="Issues" />
                <Area type="monotone" dataKey="returns" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReturns)" name="Returns" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Today's Transactions Overview */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-sm text-slate-200">Today's Transactions</h2>
            <p className="text-slate-500 text-[10px] mt-0.5">Summary of automated RFID checkouts and checkins</p>
          </div>

          <div className="space-y-6 my-6">
            <div className="flex items-center justify-between p-4 bg-brand-500/5 border border-brand-500/10 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-500/10 rounded-lg text-brand-400">
                  <CalendarClock size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-300">Books Checked Out</h4>
                  <span className="text-[10px] text-slate-500">Today's issue operations</span>
                </div>
              </div>
              <span className="text-2xl font-extrabold text-white font-outfit">{stats.todayIssues}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <CalendarCheck size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-300">Books Checked In</h4>
                  <span className="text-[10px] text-slate-500">Today's return operations</span>
                </div>
              </div>
              <span className="text-2xl font-extrabold text-white font-outfit">{stats.todayReturns}</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-500 flex justify-center items-center gap-1.5">
            <Activity size={12} className="text-brand-400" />
            <span>Updates dynamically when RFID reader scans</span>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 text-xs text-emerald-400">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Recent checkout timeline table */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
        <h2 className="font-bold text-sm text-slate-200 mb-6">Recent Checkouts Feed</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">RFID Tag</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Book Title</th>
                <th className="py-3 px-4">Issue Time</th>
                <th className="py-3 px-4">Expected Return</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-300">
              {recentIssues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">No checkout history recorded yet.</td>
                </tr>
              ) : (
                recentIssues.map((row: any) => (
                  <tr key={row.id} className="hover:bg-slate-900/30">
                    <td className="py-3 px-4 font-mono text-brand-400">{row.book_rfid_uid}</td>
                    <td className="py-3 px-4 font-medium">{row.student_name}</td>
                    <td className="py-3 px-4">{row.book_title}</td>
                    <td className="py-3 px-4">{new Date(row.issue_date).toLocaleString()}</td>
                    <td className="py-3 px-4">{new Date(row.expected_return_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        row.status === 'Overdue' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' :
                        row.status === 'Returned' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/25'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {row.status !== 'Returned' ? (
                        <button
                          onClick={() => handleQuickReturnAndPay(row.book_rfid_uid, row.book_title)}
                          className={`px-3 py-1.5 rounded text-[11px] font-bold shadow transition-all inline-flex items-center gap-1.5 ${
                            row.status === 'Overdue' 
                              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20' 
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                          }`}
                        >
                          <Coins size={12} />
                          <span>{row.status === 'Overdue' ? 'Pay Fine & Return' : 'Return Book'}</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Returned</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
