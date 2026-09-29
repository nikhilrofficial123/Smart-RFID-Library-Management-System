import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Settings as SettingsIcon, 
  Database, 
  HelpCircle, 
  RefreshCw, 
  Upload, 
  Info,
  CheckCircle,
  Coins
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { token, apiUrl } = useAuth();
  
  // Settings state
  const [libraryName, setLibraryName] = useState('');
  const [finePerDay, setFinePerDay] = useState(0);
  const [issueDuration, setIssueDuration] = useState(0);
  const [allowSelfReturn, setAllowSelfReturn] = useState(false);
  
  // App operations state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [backupMsg, setBackupMsg] = useState('');
  const [backupFile, setBackupFile] = useState('');

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${apiUrl}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLibraryName(data.libraryName);
        setFinePerDay(data.finePerDay);
        setIssueDuration(data.issueDuration);
        setAllowSelfReturn(data.allowStudentSelfReturn);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');
    
    try {
      const res = await fetch(`${apiUrl}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          libraryName,
          finePerDay,
          issueDuration,
          allowStudentSelfReturn: allowSelfReturn
        })
      });
      if (res.ok) {
        setSuccess('Library configuration policies saved successfully.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    setBackupMsg('');
    try {
      const res = await fetch(`${apiUrl}/settings/backup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBackupMsg('SQLite Database backup created successfully.');
        setBackupFile(data.filename);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestore = async () => {
    if (!backupFile) return;
    if (!window.confirm('Are you sure you want to restore? This will overwrite the active database file.')) return;
    
    setBackupMsg('');
    try {
      const res = await fetch(`${apiUrl}/settings/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filename: backupFile })
      });
      if (res.ok) {
        setBackupMsg('SQLite Database restored successfully! Please restart server.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-2xl font-bold font-outfit text-white">System Settings</h1>
        <p className="text-slate-400 text-xs mt-1">Configure library fine rules, issue window frames, and back up the SQLite database.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: Library Rules Form */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
          <h3 className="font-bold text-sm text-slate-200 mb-6 flex items-center gap-2">
            <SettingsIcon size={16} className="text-brand-400" />
            <span>Library Policy Settings</span>
          </h3>

          {success && (
            <div className="p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex gap-2 items-center">
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Library Display Name</label>
                <input
                  type="text"
                  required
                  value={libraryName}
                  onChange={(e) => setLibraryName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-205 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Fine Per Day (₹)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={finePerDay}
                    onChange={(e) => setFinePerDay(parseFloat(e.target.value))}
                    className="w-full px-3 py-2.5 pl-8 rounded bg-slate-950 border border-slate-800 text-xs text-slate-205 focus:outline-none focus:border-brand-500"
                  />
                  <Coins size={14} className="absolute left-3 top-3.5 text-slate-600" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Book Issue Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={issueDuration}
                  onChange={(e) => setIssueDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-205 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="col-span-2 flex items-center justify-between p-4 bg-slate-950/40 border border-slate-850 rounded-xl mt-2">
                <div>
                  <h4 className="text-xs font-semibold text-slate-350">Allow Student Self-Returns</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Permits student-role logins to perform return book desk triggers.</p>
                </div>
                <input
                  type="checkbox"
                  checked={allowSelfReturn}
                  onChange={(e) => setAllowSelfReturn(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 bg-slate-950 border-slate-800"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white rounded-lg transition-all shadow-md shadow-brand-500/10"
              >
                {saving ? 'Saving...' : 'Apply Configurations'}
              </button>
            </div>
          </form>
        </div>

        {/* Panel 2: Database Backup / Restore */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-200 mb-4 flex items-center gap-2">
              <Database size={16} className="text-amber-400" />
              <span>Database Backups</span>
            </h3>

            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex gap-3 text-xs text-amber-300 mb-6">
              <Info size={16} className="shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px]">Back up the SQLite database to a local file inside the server directory. Can be restored anytime.</p>
            </div>

            {backupMsg && (
              <div className="p-3 mb-4 rounded bg-brand-500/10 border border-brand-500/20 text-[11px] text-slate-200">
                {backupMsg}
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={handleBackup}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-250 rounded border border-slate-750 flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw size={14} />
                <span>Create Database Backup</span>
              </button>

              {backupFile && (
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg text-xs space-y-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Available Restore Point:</span>
                    <span className="font-mono text-slate-400 font-semibold truncate block">{backupFile}</span>
                  </div>
                  <button
                    onClick={handleRestore}
                    className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-[10px] font-bold text-white rounded transition-all"
                  >
                    Restore from backup file
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 text-center flex justify-center items-center gap-1.5 mt-8 border-t border-slate-850 pt-4">
            <HelpCircle size={12} />
            <span>SQLite backup copies `database.sqlite` file.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
