import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRFID } from '../context/RFIDContext';
import { 
  User, 
  Book, 
  ArrowRightLeft, 
  ShieldCheck, 
  ShieldAlert, 
  Coins, 
  CheckCircle2, 
  XCircle, 
  Printer, 
  Info,
  Radio,
  Trash
} from 'lucide-react';

export const IssueReturn: React.FC = () => {
  const { token, apiUrl } = useAuth();
  const { registerScanListener } = useRFID();

  // Scanned entities
  const [scannedStudent, setScannedStudent] = useState<any>(null);
  const [scannedBook, setScannedBook] = useState<any>(null);
  const [scannedBookRfid, setScannedBookRfid] = useState('');

  // Fine details (if book is scanned for return check)
  const [calculatedFine, setCalculatedFine] = useState(0);
  const [daysOverdue, setDaysOverdue] = useState(0);
  const [checkingFine, setCheckingFine] = useState(false);

  // Active transactions queue & dropdown options
  const [activeTransactions, setActiveTransactions] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [booksList, setBooksList] = useState<any[]>([]);

  // Manual modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualBookId, setManualBookId] = useState('');
  const [manualReturnRfid, setManualReturnRfid] = useState('');

  // Workflow states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [receipt, setReceipt] = useState<any>(null);

  const fetchDropdownData = async () => {
    try {
      const [resTransactions, resStudents, resBooks] = await Promise.all([
        fetch(`${apiUrl}/transactions`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/students`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/books`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (resTransactions.ok) setActiveTransactions(await resTransactions.json());
      if (resStudents.ok) setStudentsList(await resStudents.json());
      if (resBooks.ok) setBooksList(await resBooks.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDropdownData();
  }, [token]);

  // Register scanner WS listener
  useEffect(() => {
    const unsubscribe = registerScanListener((scan) => {
      setError('');
      setSuccess('');
      
      if (scan.tagType === 'Student') {
        if (scan.data) {
          setScannedStudent(scan.data);
          // Play mock scan sound / visual feedback
          flashScannerVisual('student-scanner-card');
        } else {
          setError(`Scanned Student Card [${scan.uid}] is registered but profile is missing.`);
        }
      } else if (scan.tagType === 'Book') {
        if (scan.data) {
          setScannedBook(scan.data);
          setScannedBookRfid(scan.uid);
          flashScannerVisual('book-scanner-card');
          // Check fine for this book tag if return check
          checkLiveFine(scan.uid);
        } else {
          setError(`Scanned Book Tag [${scan.uid}] is registered but catalog details are missing.`);
        }
      } else {
        setError(`Unrecognized or unlinked RFID Tag scanned: [${scan.uid}]`);
      }
    });

    return () => unsubscribe();
  }, []);

  const flashScannerVisual = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('border-brand-500', 'bg-brand-500/5', 'scale-[1.01]');
      setTimeout(() => el.classList.remove('border-brand-500', 'bg-brand-500/5', 'scale-[1.01]'), 800);
    }
  };

  const checkLiveFine = async (rfid: string) => {
    setCheckingFine(true);
    setCalculatedFine(0);
    setDaysOverdue(0);
    try {
      const res = await fetch(`${apiUrl}/transactions/live-fine/${rfid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const result = await res.json();
        setCalculatedFine(result.fine);
        setDaysOverdue(result.daysOverdue);
      }
    } catch (err) {
      // Book might not be currently issued out, which is fine!
    } finally {
      setCheckingFine(false);
    }
  };

  // Perform Issue transaction
  const handleIssue = async () => {
    if (!scannedStudent || !scannedBook || !scannedBookRfid) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${apiUrl}/transactions/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: scannedStudent.id,
          bookId: scannedBook.id,
          bookRfidUid: scannedBookRfid
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue book');

      setSuccess(`Book "${scannedBook.title}" successfully issued to "${scannedStudent.name}"!`);
      clearScanned();
      fetchDropdownData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Perform Return transaction
  const handleReturn = async (payFine: boolean) => {
    if (!scannedBookRfid) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${apiUrl}/transactions/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bookRfidUid: scannedBookRfid,
          payFine
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to return book');

      setSuccess(`Book returned successfully!`);
      setReceipt(data.receipt);
      clearScanned();
      fetchDropdownData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDirectReturnAndPay = async (rfidUid: string) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${apiUrl}/transactions/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bookRfidUid: rfidUid,
          payFine: true
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to return book');

      setSuccess(`Book returned and dues cleared successfully!`);
      setReceipt(data.receipt);
      clearScanned();
      fetchDropdownData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const clearScanned = () => {
    setScannedStudent(null);
    setScannedBook(null);
    setScannedBookRfid('');
    setCalculatedFine(0);
    setDaysOverdue(0);
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-outfit text-white">Issue & Return Desk</h1>
          <p className="text-slate-400 text-xs mt-1">Process book checkouts or returns via RFID scanner or manual selection.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowIssueModal(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-brand-500/20 transition-all flex items-center gap-2"
          >
            <ArrowRightLeft size={14} />
            <span>Issue Book</span>
          </button>

          <button
            onClick={() => setShowReturnModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
          >
            <Coins size={14} />
            <span>Return Book</span>
          </button>

          {(scannedStudent || scannedBook) && (
            <button
              onClick={clearScanned}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl transition-all"
            >
              <Trash size={14} />
              <span>Reset Desk</span>
            </button>
          )}
        </div>
      </div>

      {/* Global alert prompts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex gap-3 text-xs text-rose-400">
          <XCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 text-xs text-emerald-400">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Scanning Split Desk View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Side: Student scan */}
        <div 
          id="student-scanner-card"
          className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl transition-all duration-300 flex flex-col justify-between min-h-[350px]"
        >
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <User size={16} className="text-brand-400" />
                <span>Student Scanner Card</span>
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/25">Antenna A</span>
            </div>

            {!scannedStudent ? (
              <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 border border-slate-800/80 border-dashed rounded-xl">
                <div className="p-4 bg-brand-600/10 text-brand-400 rounded-full scanner-glow mb-4">
                  <Radio size={32} className="animate-pulse" />
                </div>
                <h4 className="text-slate-300 font-semibold text-xs mb-1">Scan Student RFID Card</h4>
                <p className="text-[10px] text-slate-500 max-w-[200px]">Wave student smart card near reader port to display profile details.</p>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-6 p-4 bg-slate-950/40 border border-slate-850 rounded-xl animate-in fade-in duration-200">
                <img 
                  src={scannedStudent.photo} 
                  alt="Student Profile" 
                  className="w-20 h-24 object-cover rounded-xl border border-slate-800 shadow-md shrink-0 self-center"
                  onError={(e: any) => { e.target.src = 'https://api.dicebear.com/7.x/avataaars/svg' }}
                />
                <div className="space-y-2 text-xs flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-slate-100 font-semibold text-base">{scannedStudent.name}</h4>
                      <span className="text-slate-500 text-[10px]">{scannedStudent.roll_number}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      scannedStudent.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {scannedStudent.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 pt-2 border-t border-slate-800 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Department</span>
                      <span className="text-slate-350 font-semibold">{scannedStudent.department}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Academic Year</span>
                      <span className="text-slate-350 font-semibold">{scannedStudent.year}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Contact</span>
                      <span className="text-slate-350 font-semibold">{scannedStudent.mobile}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">RFID UID</span>
                      <span className="text-brand-400 font-mono font-bold">{scannedStudent.rfid_uid}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 block">Select Student Manually:</label>
            <select
              value={scannedStudent?.id || ''}
              onChange={(e) => {
                const found = studentsList.find(s => s.id === parseInt(e.target.value));
                if (found) setScannedStudent(found);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="">-- Choose Student --</option>
              {studentsList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.roll_number}) - {s.department}</option>
              ))}
            </select>
          </div>
          
          <div className="text-center text-[10px] text-slate-500 mt-2 leading-normal">
            RFID Reader Antenna A active. Simulator ID: <code className="text-brand-400 font-mono">STU_CARD_779213</code>
          </div>
        </div>

        {/* Right Side: Book scan */}
        <div 
          id="book-scanner-card"
          className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl transition-all duration-300 flex flex-col justify-between min-h-[350px]"
        >
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <Book size={16} className="text-emerald-400" />
                <span>Book Tag Scanner</span>
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">Antenna B</span>
            </div>

            {!scannedBook ? (
              <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 border border-slate-800/80 border-dashed rounded-xl">
                <div className="p-4 bg-emerald-600/10 text-emerald-400 rounded-full scanner-glow mb-4">
                  <Radio size={32} className="animate-pulse" />
                </div>
                <h4 className="text-slate-300 font-semibold text-xs mb-1">Scan Book RFID Tag</h4>
                <p className="text-[10px] text-slate-500 max-w-[200px]">Wave book RFID smart labels near reader port to display catalog profile.</p>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-6 p-4 bg-slate-950/40 border border-slate-850 rounded-xl animate-in fade-in duration-200">
                <img 
                  src={scannedBook.image || '/assets/VERBS.jpg'} 
                  alt="Book Cover" 
                  className="w-20 h-24 object-cover rounded-xl border border-slate-800 shadow-md shrink-0 self-center"
                  onError={(e: any) => { e.target.src = '/assets/VERBS.jpg' }}
                />
                <div className="space-y-2 text-xs flex-1">
                  <div>
                    <h4 className="text-slate-100 font-semibold text-base">{scannedBook.title}</h4>
                    <span className="text-slate-500 text-[10px]">{scannedBook.author}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 pt-2 border-t border-slate-800 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">ISBN</span>
                      <span className="text-slate-350 font-mono">{scannedBook.isbn}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Shelf Location</span>
                      <span className="text-slate-350 font-semibold">{scannedBook.shelf_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Availability</span>
                      <span className={`font-bold ${scannedBook.available_copies > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {scannedBook.available_copies > 0 ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Scanned RFID</span>
                      <span className="text-emerald-400 font-mono font-bold">{scannedBookRfid}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 block">Select Book Manually:</label>
            <select
              value={scannedBook?.id || ''}
              onChange={(e) => {
                const found = booksList.find(b => b.id === parseInt(e.target.value));
                if (found) {
                  setScannedBook(found);
                  const tag = (found.rfid_tags && found.rfid_tags[0]) || `BOOK_TAG_${found.id}`;
                  setScannedBookRfid(tag);
                  checkLiveFine(tag);
                }
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Choose Book --</option>
              {booksList.map(b => (
                <option key={b.id} value={b.id}>{b.title} (By {b.author}) - {b.available_copies} available</option>
              ))}
            </select>
          </div>
          
          <div className="text-center text-[10px] text-slate-500 mt-2 leading-normal">
            RFID Reader Antenna B active. Simulator ID: <code className="text-emerald-400 font-mono">BOOK_TAG_1001A</code>
          </div>
        </div>
      </div>

      {/* Dynamic Workflow Actions Panel */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
        <h2 className="font-bold text-sm text-slate-200 mb-4">Select Desk Transaction Operation</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section A: Checkout Issue */}
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-xs text-brand-400 uppercase tracking-wider mb-2">Checkout Operation (Issue Book)</h3>
              <p className="text-[11px] text-slate-400 leading-normal mb-6">Assigns the scanned book copy to the student record for 14 days duration. Both card checks are required.</p>
            </div>
            
            <button
              onClick={handleIssue}
              disabled={!scannedStudent || !scannedBook || scannedBook.available_copies <= 0 || scannedStudent.status === 'Suspended'}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white rounded-lg shadow-lg shadow-brand-500/10 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
            >
              <ArrowRightLeft size={14} />
              <span>Checkout Scanned Book</span>
            </button>
          </div>

          {/* Section B: Checkin Return */}
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-xs text-emerald-400 uppercase tracking-wider mb-2">Checkin Operation (Return Book & Pay Fine)</h3>
              
              {scannedBook && (
                <div className="my-3 p-3 bg-slate-950 border border-slate-850 rounded-lg text-xs space-y-1">
                  {checkingFine ? (
                    <span className="text-slate-500 text-[10px]">Calculating potential dues...</span>
                  ) : daysOverdue > 0 ? (
                    <div className="flex flex-col gap-1 text-[11px]">
                      <span className="text-rose-400 flex items-center gap-1 font-semibold">
                        <ShieldAlert size={14} /> Overdue by {daysOverdue} days!
                      </span>
                      <span className="text-slate-100 font-bold">Outstanding Fine: ₹{calculatedFine.toFixed(2)}</span>
                    </div>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                      <ShieldCheck size={14} /> Book is within timeframe. No fine due.
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleReturn(false)}
                disabled={!scannedBookRfid}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                Return Only
              </button>
              <button
                onClick={() => handleReturn(true)}
                disabled={!scannedBookRfid || (calculatedFine > 0 && checkingFine)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-lg shadow-lg shadow-emerald-500/10 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center gap-1.5"
              >
                <Coins size={14} />
                <span>Return & Pay Fine</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active & Overdue Issues Dues Queue Table */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-bold text-sm text-slate-200">Active & Overdue Checkouts Queue</h2>
            <p className="text-slate-400 text-xs mt-0.5">Select any active or overdue checkout to process returns and settle fine payments directly.</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
            {activeTransactions.filter(t => t.status !== 'Returned').length} Active Checkouts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">RFID Tag</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Book Title</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-300">
              {activeTransactions.filter(t => t.status !== 'Returned').length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">No active or overdue book checkouts found.</td>
                </tr>
              ) : (
                activeTransactions
                  .filter(t => t.status !== 'Returned')
                  .map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-900/30">
                      <td className="py-3 px-4 font-mono text-emerald-400 font-bold">{row.book_rfid_uid}</td>
                      <td className="py-3 px-4 font-medium">{row.student_name} <span className="text-[10px] text-slate-500 block">({row.student_roll})</span></td>
                      <td className="py-3 px-4 font-semibold">{row.book_title}</td>
                      <td className="py-3 px-4">{new Date(row.expected_return_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                          row.status === 'Overdue' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' : 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
                        }`}>
                          {row.status === 'Overdue' ? 'OVERDUE (Fine Due)' : 'Issued'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setScannedBookRfid(row.book_rfid_uid);
                            setScannedBook({ title: row.book_title, author: row.book_author, isbn: 'Registered', shelf_number: 'Shelf', available_copies: 0 });
                            checkLiveFine(row.book_rfid_uid);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold transition-all"
                        >
                          Select For Desk
                        </button>
                        <button
                          onClick={() => handleDirectReturnAndPay(row.book_rfid_uid)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                        >
                          <Coins size={12} />
                          <span>{row.status === 'Overdue' ? 'Pay Fine & Return' : 'Return Book'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MANUAL ISSUE BOOK MODAL */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowIssueModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <XCircle size={18} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-brand-600/10 text-brand-400 rounded-xl border border-brand-500/20">
                <ArrowRightLeft size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Manual Issue Book</h3>
                <p className="text-xs text-slate-400">Select student and book to checkout</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const studentObj = studentsList.find(s => s.id === parseInt(manualStudentId));
                const bookObj = booksList.find(b => b.id === parseInt(manualBookId));
                if (studentObj && bookObj) {
                  const tag = (bookObj.rfid_tags && bookObj.rfid_tags[0]) || `BOOK_TAG_${bookObj.id}`;
                  setScannedStudent(studentObj);
                  setScannedBook(bookObj);
                  setScannedBookRfid(tag);
                  setShowIssueModal(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">Select Student</label>
                <select
                  required
                  value={manualStudentId}
                  onChange={(e) => setManualStudentId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- Choose Student --</option>
                  {studentsList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.roll_number}) - {s.department}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">Select Book to Issue</label>
                <select
                  required
                  value={manualBookId}
                  onChange={(e) => setManualBookId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- Choose Book --</option>
                  {booksList.map(b => (
                    <option key={b.id} value={b.id}>{b.title} (By {b.author}) - {b.available_copies} available</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualStudentId || !manualBookId}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white rounded-lg shadow-lg shadow-brand-500/20 disabled:opacity-40"
                >
                  Load Desk & Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL RETURN BOOK MODAL */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowReturnModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <XCircle size={18} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-600/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Coins size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Manual Return & Pay Fine</h3>
                <p className="text-xs text-slate-400">Select active checkout to return book</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualReturnRfid) {
                  handleDirectReturnAndPay(manualReturnRfid);
                  setShowReturnModal(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">Select Active Checkout</label>
                <select
                  required
                  value={manualReturnRfid}
                  onChange={(e) => setManualReturnRfid(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose Active Checkout --</option>
                  {activeTransactions.filter(t => t.status !== 'Returned').map(t => (
                    <option key={t.id} value={t.book_rfid_uid}>
                      {t.book_title} — {t.student_name} ({t.status === 'Overdue' ? 'OVERDUE' : 'Issued'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualReturnRfid}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-lg shadow-lg shadow-emerald-500/20 disabled:opacity-40"
                >
                  Return Book & Settle Fine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-sm bg-white text-slate-900 rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in fade-in zoom-in duration-200 font-mono text-xs">
            <div className="text-center pb-4 border-b border-dashed border-slate-350">
              <h2 className="font-extrabold text-sm uppercase">Smart RFID Library</h2>
              <span className="text-[10px] text-slate-500">Transaction Receipt</span>
            </div>

            <div className="py-4 space-y-2 border-b border-dashed border-slate-350 text-[11px]">
              <div className="flex justify-between">
                <span>Student:</span>
                <span className="font-bold">{receipt.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span>Book:</span>
                <span className="font-bold truncate max-w-[200px]">{receipt.bookTitle}</span>
              </div>
              <div className="flex justify-between">
                <span>Issued On:</span>
                <span>{new Date(receipt.issueDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Returned On:</span>
                <span>{new Date(receipt.returnDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-100 font-semibold">
                <span>Calculated Fine:</span>
                <span>₹{receipt.fineCalculated.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Paid Fine:</span>
                <span>₹{receipt.finePaid.toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-4 text-center space-y-4">
              <div className="text-[10px] text-slate-500">Thank you for returning books on time!</div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-150 hover:bg-slate-200 text-[11px] font-semibold rounded-lg text-slate-700 transition-all border border-slate-250"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setReceipt(null)}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-[11px] font-bold text-white rounded-lg transition-all"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
