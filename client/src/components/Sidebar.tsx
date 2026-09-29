import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Radio, 
  ArrowLeftRight, 
  ClipboardList, 
  FileText, 
  Settings, 
  LogOut 
} from 'lucide-react';

interface SidebarProps {
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  if (!user) return null;

  const isAdmin = user.role === 'Admin';
  const isLibrarian = user.role === 'Librarian' || user.role === 'Admin';

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, show: true },
    { name: 'Books', path: '/books', icon: BookOpen, show: isLibrarian },
    { name: 'Students', path: '/students', icon: Users, show: isLibrarian },
    { name: 'RFID Tags', path: '/rfid', icon: Radio, show: isLibrarian },
    { name: 'Issue / Return', path: '/issue-return', icon: ArrowLeftRight, show: isLibrarian },
    { name: 'Shelf Inventory', path: '/inventory', icon: ClipboardList, show: isLibrarian },
    { name: 'Reports & Logs', path: '/reports', icon: FileText, show: isLibrarian },
    { name: 'Settings', path: '/settings', icon: Settings, show: isAdmin },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      {/* Brand Logo */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="p-2 bg-brand-600 rounded-lg text-white">
          <Radio size={20} className="animate-pulse" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide text-white font-outfit uppercase">Smart RFID</h1>
          <span className="text-[10px] text-slate-400 tracking-wider">Library System</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          if (!item.show) return null;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-brand-600/15 text-brand-400 border border-brand-500/25 shadow-lg shadow-brand-500/5'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
              }`}
            >
              <item.icon size={18} className={isActive ? 'text-brand-400' : 'text-slate-400'} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-3 mb-4">
          <img 
            src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`} 
            alt="User Avatar" 
            className="w-10 h-10 rounded-full border border-slate-700 bg-slate-800"
          />
          <div className="truncate">
            <h2 className="text-sm font-semibold text-slate-200 truncate">{user.username}</h2>
            <span className="text-xs text-brand-400 font-semibold px-2 py-0.5 bg-brand-500/10 rounded border border-brand-500/20">{user.role}</span>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-all"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
