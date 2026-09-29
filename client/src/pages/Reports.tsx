import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  Download, 
  Terminal, 
  Layers, 
  FileCheck, 
  Receipt,
  Search
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { token, apiUrl } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${apiUrl}/logs/audit`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [token]);

  const downloadReport = (endpoint: string, filename: string) => {
    // Standard direct browser fetch and save for file downloads
    fetch(`${apiUrl}/${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => {
        alert('Failed to generate and download PDF report. Make sure server is running.');
      });
  };

  const filteredLogs = logs.filter((log: any) => {
    const searchLower = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(searchLower) ||
      log.entity.toLowerCase().includes(searchLower) ||
      (log.description && log.description.toLowerCase().includes(searchLower)) ||
      (log.username && log.username.toLowerCase().includes(searchLower))
    );
  });

  const reportsList = [
    { name: 'Issues Report', desc: 'Listing of borrowing checkouts, timelines and return dates.', icon: FileText, endpoint: 'reports/issues', file: 'issue-report.pdf' },
    { name: 'Returns Report', desc: 'Listing of returned books, librarian signatures, and paid fines.', icon: FileCheck, endpoint: 'reports/returns', file: 'returns-report.pdf' },
    { name: 'Fine Payment Report', desc: 'Revenue audits from fine payment transactions.', icon: Receipt, endpoint: 'reports/fines', file: 'fine-report.pdf' },
    { name: 'Inventory Logs Report', desc: 'Logs of previous shelf audits showing misplacements and counts.', icon: Layers, endpoint: 'reports/inventory', file: 'inventory-report.pdf' },
  ];

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-2xl font-bold font-outfit text-white">Reports & Audits</h1>
        <p className="text-slate-400 text-xs mt-1">Generate PDF document reports and review system audit timelines.</p>
      </div>

      {/* PDF Reports Panel */}
      <div>
        <h2 className="font-bold text-sm text-slate-200 mb-4">Generate PDF Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportsList.map((item, idx) => (
            <div key={idx} className="glass-panel p-6 rounded-2xl border border-slate-800 flex justify-between items-center group">
              <div className="flex gap-4">
                <div className="p-3 rounded-xl bg-slate-800 text-slate-350 border border-slate-700/50">
                  <item.icon size={22} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 text-sm">{item.name}</h4>
                  <p className="text-[11px] text-slate-500 max-w-[250px] leading-normal mt-1">{item.desc}</p>
                </div>
              </div>
              
              <button
                onClick={() => downloadReport(item.endpoint, item.file)}
                className="p-3 bg-brand-600 hover:bg-brand-500 rounded-xl text-white shadow-lg shadow-brand-500/10 transition-all flex items-center justify-center"
                title="Download PDF"
              >
                <Download size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Logs Section */}
      <div className="glass-panel rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-brand-400" />
            <h2 className="font-bold text-sm text-slate-200">System Operator Audit Logs</h2>
          </div>

          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search logs action, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 pl-9 rounded-lg bg-slate-950 border border-slate-850 text-[11px] text-slate-200 placeholder-slate-650 focus:outline-none"
            />
            <Search size={14} className="absolute left-3 top-2 text-slate-600" />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Retrieving system log records...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No matching audit logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Operator</th>
                  <th className="py-4 px-6">Action Action</th>
                  <th className="py-4 px-6">Affected Target</th>
                  <th className="py-4 px-6">Audit Description</th>
                  <th className="py-4 px-6">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-350">
                {filteredLogs.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-900/20">
                    <td className="py-4 px-6 text-slate-500 font-mono">{new Date(row.timestamp).toLocaleString()}</td>
                    <td className="py-4 px-6 font-semibold text-slate-200">{row.username || 'System Event'}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        row.action.startsWith('DELETE') ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20' :
                        row.action.startsWith('CREATE') ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                        row.action.startsWith('UPDATE') ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                        'bg-slate-800 text-slate-400 border border-slate-750'
                      }`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-400">{row.entity}</td>
                    <td className="py-4 px-6 font-sans">{row.description}</td>
                    <td className="py-4 px-6 text-slate-500 font-mono">{row.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
