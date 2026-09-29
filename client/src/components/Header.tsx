import React, { useState, useEffect } from 'react';
import { useRFID } from '../context/RFIDContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Bell, Radio, ShieldAlert, Sun, Moon } from 'lucide-react';

export const Header: React.FC = () => {
  const { isReaderOnline } = useRFID();
  const { token, apiUrl } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const unreadCount = notifications.filter(n => n.status === 'Unread').length;

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const markAllAsRead = async () => {
    try {
      const res = await fetch(`${apiUrl}/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, status: 'Read' })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        {/* RFID Reader connection widget */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
          isReaderOnline 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${isReaderOnline ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
          <Radio size={14} />
          <span>RFID Reader: {isReaderOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 relative">
        {/* Dark / Light Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 rounded-lg transition-all flex items-center gap-2 text-xs font-semibold"
        >
          {theme === 'dark' ? (
            <>
              <Sun size={18} className="text-amber-400 animate-spin-slow" />
              <span className="hidden sm:inline text-slate-300">Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={18} className="text-indigo-600" />
              <span className="hidden sm:inline text-slate-700">Dark Mode</span>
            </>
          )}
        </button>

        {/* Notification Bell */}
        <button 
          onClick={() => {
            setShowNotifMenu(!showNotifMenu);
            if (unreadCount > 0) markAllAsRead();
          }}
          className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-all"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-brand-500 text-[10px] text-white font-extrabold flex items-center justify-center rounded-full animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Notifications Dropdown */}
        {showNotifMenu && (
          <div className="absolute right-0 top-12 w-80 bg-slate-900 border border-slate-800 shadow-2xl rounded-xl overflow-hidden z-50">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-200">Alerts & Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-brand-400 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">No alerts today</div>
              ) : (
                notifications.map((item, idx) => (
                  <div key={idx} className={`p-4 flex gap-3 ${item.status === 'Unread' ? 'bg-brand-500/5' : ''}`}>
                    <div className={`p-1.5 rounded-lg h-fit ${
                      item.type === 'Overdue' ? 'bg-rose-500/10 text-rose-400' :
                      item.type === 'DueReminder' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      <ShieldAlert size={14} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-300 leading-normal">{item.message}</p>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
