import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRFID } from '../context/RFIDContext';
import { Plus, Edit2, Trash2, Search, Link2, X, Info, UserCheck, ShieldAlert, Radio } from 'lucide-react';

export const Students: React.FC = () => {
  const { token, apiUrl, isLibrarian, isAdmin } = useAuth();
  const { registerScanListener } = useRFID();

  // State Management
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Form Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  
  // Student Form Fields
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState('');
  const [status, setStatus] = useState('Active');
  const [error, setError] = useState('');
  
  // Link Card Fields
  const [rfidUid, setRfidUid] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const fetchStudents = async () => {
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);

      const res = await fetch(`${apiUrl}/students?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [token]);

  // Debounce search
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchStudents();
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  // Hook live RFID WS scan for assignment
  useEffect(() => {
    if (!showLinkModal) return;

    setIsScanning(true);
    const unsubscribe = registerScanListener((scan) => {
      setRfidUid(scan.uid);
      setIsScanning(false);
    });

    return () => {
      unsubscribe();
      setIsScanning(false);
    };
  }, [showLinkModal]);

  // Submit Register/Edit Student
  const handleSubmitStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const payload = {
      name,
      roll_number: rollNumber,
      department,
      year,
      mobile,
      email,
      status,
      rfid_uid: rfidUid ? rfidUid.trim() : null,
      photo: photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rollNumber}`
    };

    try {
      const url = selectedStudent ? `${apiUrl}/students/${selectedStudent.id}` : `${apiUrl}/students`;
      const method = selectedStudent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save student');

      fetchStudents();
      setShowFormModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Submit Student RFID Link
  const handleSubmitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError('');

    if (!rfidUid.trim()) {
      setLinkError('RFID UID is required. Scan or input manually.');
      return;
    }

    try {
      // Direct call to update student RFID
      const res = await fetch(`${apiUrl}/students/${selectedStudent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rfid_uid: rfidUid })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign RFID card');

      fetchStudents();
      setShowLinkModal(false);
      setRfidUid('');
      setSelectedStudent(null);
    } catch (err: any) {
      setLinkError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this student record? This unlinks their RFID card.')) return;
    try {
      const res = await fetch(`${apiUrl}/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        fetchStudents();
      } else {
        alert(data.error || 'Failed to delete student');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting student');
    }
  };

  const handleUnlinkRfid = async (studentId: number, studentName: string) => {
    if (!window.confirm(`Are you sure you want to delete/unlink the RFID card from student "${studentName}"?`)) return;
    try {
      const res = await fetch(`${apiUrl}/students/${studentId}/rfid`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        fetchStudents();
      } else {
        alert(data.error || 'Failed to unlink RFID card');
      }
    } catch (err: any) {
      alert(err.message || 'Error unlinking RFID card');
    }
  };

  const openEditModal = (student: any) => {
    setSelectedStudent(student);
    setName(student.name);
    setRollNumber(student.roll_number);
    setDepartment(student.department);
    setYear(student.year);
    setMobile(student.mobile);
    setEmail(student.email);
    setPhoto(student.photo || '');
    setStatus(student.status);
    setRfidUid(student.rfid_uid || '');
    setShowFormModal(true);
  };

  const openLinkModal = (student: any) => {
    setSelectedStudent(student);
    setRfidUid(student.rfid_uid || '');
    setLinkError('');
    setShowLinkModal(true);
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setName('');
    setRollNumber('');
    setDepartment('');
    setYear('');
    setMobile('');
    setEmail('');
    setPhoto('');
    setStatus('Active');
    setRfidUid('');
    setError('');
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-outfit text-white">Student Directory</h1>
          <p className="text-slate-400 text-xs mt-1">Register student details and bind RFID Smart Cards for library entry/checkout checkouts.</p>
        </div>
        
        {isLibrarian && (
          <button
            onClick={() => { resetForm(); setShowFormModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-sm font-semibold rounded-lg shadow-lg shadow-brand-500/10 text-white"
          >
            <Plus size={16} />
            <span>Register Student</span>
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <input
            type="text"
            placeholder="Search by name, roll number, email, or card ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 pl-11 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all"
          />
          <Search size={16} className="absolute left-4 top-3 text-slate-500" />
        </div>
      </div>

      {/* Directory Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading student directory...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No student records matches search query.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-4 px-6">Student Info</th>
                  <th className="py-4 px-6">Roll Number</th>
                  <th className="py-4 px-6">Department & Year</th>
                  <th className="py-4 px-6">Contact Info</th>
                  <th className="py-4 px-6">RFID Card ID</th>
                  <th className="py-4 px-6">Status</th>
                  {isLibrarian && <th className="py-4 px-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {students.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-900/30 transition-colors">
                    {/* User profile with face card placeholder */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img 
                          src={row.photo} 
                          alt={row.name} 
                          className="w-10 h-10 object-cover rounded-full border border-slate-800 bg-slate-850"
                          onError={(e: any) => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.roll_number}` }}
                        />
                        <div>
                          <div className="text-slate-100 font-semibold text-sm">{row.name}</div>
                          <div className="text-slate-500 text-[10px] mt-0.5">{row.email}</div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Roll */}
                    <td className="py-4 px-6 font-mono font-semibold text-slate-300">{row.roll_number}</td>
                    
                    {/* Department */}
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-200">{row.department}</div>
                      <div className="text-slate-500 text-[10px]">{row.year}</div>
                    </td>
                    
                    {/* Contact */}
                    <td className="py-4 px-6 text-slate-400">{row.mobile}</td>
                    
                    {/* RFID Card ID */}
                    <td className="py-4 px-6 font-mono">
                      {row.rfid_uid ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-md font-bold">{row.rfid_uid}</span>
                          {isLibrarian && (
                            <>
                              <button
                                onClick={() => openLinkModal(row)}
                                title="Edit/Re-scan RFID Card"
                                className="p-1 text-slate-400 hover:text-brand-400 bg-slate-800/80 hover:bg-slate-800 rounded border border-slate-700/50 transition-all"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleUnlinkRfid(row.id, row.name)}
                                title="Delete/Unlink RFID Card"
                                className="p-1 text-slate-400 hover:text-rose-400 bg-slate-800/80 hover:bg-rose-500/10 rounded border border-slate-700/50 transition-all"
                              >
                                <X size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 italic">Unassigned Card</span>
                          {isLibrarian && (
                            <button
                              onClick={() => openLinkModal(row)}
                              className="px-2 py-0.5 bg-indigo-500/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded text-[10px] font-semibold flex items-center gap-1 transition-all"
                            >
                              <Plus size={10} />
                              <span>Assign Card</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    
                    {/* Status */}
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        row.status === 'Active' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    
                    {/* Actions */}
                    {isLibrarian && (
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openLinkModal(row)}
                            title="Assign RFID Card"
                            className="p-2 text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600/20 rounded border border-indigo-500/20 transition-all"
                          >
                            <Link2 size={14} />
                          </button>
                          <button
                            onClick={() => openEditModal(row)}
                            title="Edit profile"
                            className="p-2 text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600/20 rounded border border-emerald-500/20 transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          {(isAdmin || isLibrarian) && (
                            <button
                              onClick={() => handleDelete(row.id)}
                              title="Remove Student"
                              className="p-2 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600/20 rounded border border-rose-500/20 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FORM MODAL: REGISTER / EDIT STUDENT */}
      {showFormModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 font-outfit">{selectedStudent ? 'Edit Student Profile' : 'Register New Student'}</h3>
              <button onClick={() => { setShowFormModal(false); resetForm(); }} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>
            
            {error && (
              <div className="p-4 mx-6 mt-4 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Full Name</label>
                  <input
                    type="text" required value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Roll Number</label>
                  <input
                    type="text" required value={rollNumber} onChange={(e) => setRollNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Department</label>
                  <input
                    type="text" placeholder="e.g. Computer Science" required value={department} onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Year of Study</label>
                  <select
                    value={year} onChange={(e) => setYear(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Select Year</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Email Address</label>
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Mobile Number</label>
                  <input
                    type="tel" required value={mobile} onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Status</label>
                  <select
                    value={status} onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-slate-400 block">
                      Assigned RFID Card UID <span className="text-brand-400 font-normal">(Editable)</span>
                    </label>
                    {rfidUid && (
                      <button
                        type="button"
                        onClick={() => setRfidUid('')}
                        className="text-[10px] font-semibold text-rose-400 hover:underline flex items-center gap-1"
                      >
                        <X size={10} />
                        <span>Clear/Remove Card</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Scan card or type UID (leave blank to clear)..."
                    value={rfidUid}
                    onChange={(e) => setRfidUid(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Profile Photo URL</label>
                  <input
                    type="text" placeholder="Optional avatar URL" value={photo} onChange={(e) => setPhoto(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button" onClick={() => { setShowFormModal(false); resetForm(); }}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-lg shadow-brand-500/10"
                >
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LINK RFID CARD MODAL */}
      {showLinkModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 font-outfit">Assign RFID Student Card</h3>
              <button onClick={() => { setShowLinkModal(false); setSelectedStudent(null); }} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>
            
            {linkError && (
              <div className="p-4 mx-6 mt-4 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                {linkError}
              </div>
            )}

            <form onSubmit={handleSubmitLink} className="p-6 space-y-4">
              <div className="p-4 bg-brand-500/5 border border-brand-500/10 rounded-xl flex gap-3 text-xs text-brand-300">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p className="leading-relaxed">Scan the student card RFID now. The system automatically reads the card ID from the websocket gateway.</p>
              </div>

              {isScanning && (
                <div className="py-6 flex flex-col items-center justify-center bg-slate-950/40 border border-slate-800/80 rounded-xl border-dashed">
                  <div className="p-4 bg-brand-600/10 text-brand-400 rounded-full scanner-glow mb-3">
                    <Radio size={28} className="animate-pulse" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">RFID Antenna Active. Waiting for card scan...</span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Student Name</label>
                <div className="text-xs text-slate-300 font-bold bg-slate-950 px-3 py-2.5 rounded border border-slate-800">{selectedStudent?.name}</div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Scanned RFID Card UID</label>
                <input
                  type="text" placeholder="Waiting for card scan..." required value={rfidUid} onChange={(e) => setRfidUid(e.target.value)}
                  className="w-full px-3 py-2.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button" onClick={() => { setShowLinkModal(false); setSelectedStudent(null); }}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-lg shadow-brand-500/10"
                >
                  Link Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
