import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RFIDProvider, useRFID } from './context/RFIDContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Books } from './pages/Books';
import { Students } from './pages/Students';
import { RFIDTags } from './pages/RFIDTags';
import { IssueReturn } from './pages/IssueReturn';
import { Inventory } from './pages/Inventory';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Radio, X } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { logout, user } = useAuth();
  const { lastScan, clearLastScan } = useRFID();

  // Automatically clear last scan popup alert after 3 seconds
  useEffect(() => {
    if (lastScan) {
      const timer = setTimeout(() => {
        clearLastScan();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastScan]);

  if (!user) return <Navigate to="/login" replace />;

  const isLibrarian = user.role === 'Librarian' || user.role === 'Admin';
  const isAdmin = user.role === 'Admin';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
      {/* Sidebar navigation */}
      <Sidebar onLogout={logout} />

      {/* Main app body */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-hidden bg-slate-950/40 relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            
            {/* Operator only routes */}
            {isLibrarian && (
              <>
                <Route path="/books" element={<Books />} />
                <Route path="/students" element={<Students />} />
                <Route path="/rfid" element={<RFIDTags />} />
                <Route path="/issue-return" element={<IssueReturn />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/reports" element={<Reports />} />
              </>
            )}

            {/* Admin only route */}
            {isAdmin && <Route path="/settings" element={<Settings />} />}

            {/* Redirect fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Global Live RFID Scanner Toast Overlay Notification */}
      {lastScan && (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-slate-900 border border-brand-500/40 text-slate-100 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2 font-semibold text-xs text-brand-400">
              <Radio size={14} className="animate-pulse" />
              <span>RFID Scanner Event</span>
            </div>
            <button onClick={clearLastScan} className="text-slate-500 hover:text-slate-300">
              <X size={14} />
            </button>
          </div>
          <div className="p-4 text-xs space-y-1 bg-slate-950/60">
            <div className="text-[10px] text-slate-500 font-mono">UID: {lastScan.uid}</div>
            {lastScan.tagType !== 'Unknown' ? (
              <p className="font-semibold text-slate-205 leading-normal">
                Scanned {lastScan.tagType}: <span className="text-slate-100 font-bold">{lastScan.data?.name || lastScan.data?.title}</span>
              </p>
            ) : (
              <p className="text-amber-400 italic">Unassigned tag scanned.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/*" element={<MainLayout />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <RFIDProvider>
            <AppRoutes />
          </RFIDProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;
