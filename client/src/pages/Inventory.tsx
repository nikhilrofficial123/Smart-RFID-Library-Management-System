import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRFID } from '../context/RFIDContext';
import { 
  ClipboardCheck, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  HelpCircle,
  Play,
  Activity,
  FileSpreadsheet
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const { token, apiUrl } = useAuth();
  const { registerScanListener } = useRFID();

  const [shelfNumber, setShelfNumber] = useState('Shelf A-1');
  const [scannedUids, setScannedUids] = useState<string[]>([]);
  const [report, setReport] = useState<any>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState('');

  // Register live WS scanner listener for shelf audit scanning
  useEffect(() => {
    if (!isScanning) return;

    const unsubscribe = registerScanListener((scan) => {
      if (scan.uid && !scannedUids.includes(scan.uid)) {
        setScannedUids(prev => [...prev, scan.uid]);
      }
    });

    return () => unsubscribe();
  }, [isScanning, scannedUids]);

  const startShelfAudit = () => {
    setScannedUids([]);
    setReport(null);
    setIsScanning(true);
  };

  const submitManualInput = () => {
    if (!manualInput.trim()) return;
    const items = manualInput.split(',').map(u => u.trim()).filter(Boolean);
    // Add unique items
    setScannedUids(prev => Array.from(new Set([...prev, ...items])));
    setManualInput('');
  };

  const runAnalysis = async () => {
    setIsScanning(false);
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/inventory/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shelfNumber, scannedUids })
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const clearAudit = () => {
    setScannedUids([]);
    setReport(null);
    setIsScanning(false);
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-2xl font-bold font-outfit text-white">Shelf Inventory Audit</h1>
        <p className="text-slate-400 text-xs mt-1">Scan a physical shelf row to audit correct inventory placement and automatically identify missing or misplaced books.</p>
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Step 1: Select Shelf & Start */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-200 mb-4 flex items-center gap-2">
              <span className="w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">1</span>
              <span>Select Shelf Target</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Target Shelf Name</label>
                <select
                  value={shelfNumber}
                  onChange={(e) => setShelfNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="Shelf A-1">Shelf A-1 (Algorithms)</option>
                  <option value="Shelf A-2">Shelf A-2 (Clean Code)</option>
                  <option value="Shelf A-3">Shelf A-3 (Patterns)</option>
                  <option value="Shelf B-1">Shelf B-1 (Maths)</option>
                  <option value="Shelf C-1">Shelf C-1 (Physics)</option>
                  <option value="Shelf D-2">Shelf D-2 (Microelectronics)</option>
                </select>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg text-[10px] text-slate-500 leading-normal">
                Auditing matches the scanned RFID list with the shelf metadata assigned in the database.
              </div>
            </div>
          </div>

          <button
            onClick={startShelfAudit}
            disabled={isScanning}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white rounded shadow-md shadow-brand-500/10 disabled:opacity-30 disabled:pointer-events-none mt-4 transition-all"
          >
            Start Shelf Scan Session
          </button>
        </div>

        {/* Step 2: Live Scanning Feed */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-200 mb-4 flex items-center gap-2">
              <span className="w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">2</span>
              <span>Scanned RFID Tags Stream</span>
            </h3>

            {isScanning ? (
              <div className="py-2.5 flex items-center gap-2 text-brand-400 font-semibold animate-pulse text-[11px]">
                <Activity size={14} />
                <span>RFID Antenna Swiping Active...</span>
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 block mb-2">Scan session inactive.</span>
            )}

            {/* Manual test simulation input */}
            {isScanning && (
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Simulate: e.g. BOOK_TAG_1001A, BOOK_TAG_1002A"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded bg-slate-950 border border-slate-850 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={submitManualInput}
                  className="px-3 bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold rounded text-slate-300"
                >
                  Add
                </button>
              </div>
            )}

            <div className="h-28 overflow-y-auto bg-slate-950 border border-slate-850 p-3 rounded-lg flex flex-wrap gap-1">
              {scannedUids.length === 0 ? (
                <span className="text-[10px] text-slate-500 italic">No tag UIDs in cache. Scan items now.</span>
              ) : (
                scannedUids.map((uid) => (
                  <span key={uid} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-450 font-mono text-[9px]">{uid}</span>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={clearAudit}
              disabled={scannedUids.length === 0}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-350 rounded disabled:opacity-40"
            >
              Clear
            </button>
            <button
              onClick={runAnalysis}
              disabled={scannedUids.length === 0 || loading}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded shadow-md shadow-indigo-500/10 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Play size={12} />
              <span>{loading ? 'Analyzing...' : 'Audit Shelf'}</span>
            </button>
          </div>
        </div>

        {/* Step 3: Fast Summary */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-200 mb-4 flex items-center gap-2">
              <span className="w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">3</span>
              <span>Result Summary</span>
            </h3>

            {!report ? (
              <div className="py-8 text-center text-slate-500 text-xs italic">
                Awaiting audit execution.
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Total Scanned</span>
                  <span className="font-bold text-slate-200">{report.totalScanned}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-450">Correctly Shelved</span>
                  <span className="font-bold text-emerald-400">{report.correctCount}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-450">Misplaced Books</span>
                  <span className="font-bold text-amber-400">{report.misplacedCount}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-450">Missing Books</span>
                  <span className="font-bold text-rose-400">{report.missingCount}</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-950 border border-slate-850/50 rounded-lg text-[10px] text-slate-500 leading-normal mt-4">
            Auditing records are stored in the database logs for historical reporting.
          </div>
        </div>
      </div>

      {/* Audit Detail Breakdown */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Box 1: Correctly Shelved */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800">
            <h4 className="font-bold text-xs text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <CheckCircle size={14} />
              <span>Correct Books ({report.correctCount})</span>
            </h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {report.correctBooks.length === 0 ? (
                <div className="text-slate-500 text-[10px] italic">None scanned.</div>
              ) : (
                report.correctBooks.map((b: any) => (
                  <div key={b.rfid_uid} className="p-2.5 bg-slate-950/40 rounded border border-slate-850 text-xs">
                    <div className="font-semibold text-slate-200">{b.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Tag: <code className="text-brand-400">{b.rfid_uid}</code></div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Box 2: Misplaced Books */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800">
            <h4 className="font-bold text-xs text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <AlertTriangle size={14} />
              <span>Misplaced Books ({report.misplacedCount})</span>
            </h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {report.misplacedBooks.length === 0 ? (
                <div className="text-slate-500 text-[10px] italic">None detected.</div>
              ) : (
                report.misplacedBooks.map((b: any) => (
                  <div key={b.rfid_uid} className="p-2.5 bg-amber-500/5 rounded border border-amber-500/10 text-xs">
                    <div className="font-semibold text-slate-200">{b.title || 'Unknown Title'}</div>
                    <div className="text-[10px] text-amber-400 mt-0.5">{b.reason}</div>
                    <div className="text-[9px] text-slate-550 mt-1">Tag: <code className="text-brand-405">{b.rfid_uid}</code></div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Box 3: Missing Books */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800">
            <h4 className="font-bold text-xs text-rose-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <HelpCircle size={14} />
              <span>Missing from Shelf ({report.missingCount})</span>
            </h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {report.missingBooks.length === 0 ? (
                <div className="text-slate-500 text-[10px] italic">No books missing. Shelf is matching.</div>
              ) : (
                report.missingBooks.map((b: any) => (
                  <div key={b.rfid_uid} className="p-2.5 bg-rose-500/5 rounded border border-rose-500/10 text-xs">
                    <div className="font-semibold text-slate-200">{b.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Expected Tag: <code className="text-brand-400">{b.rfid_uid}</code></div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
