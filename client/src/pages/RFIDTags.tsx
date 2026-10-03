import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRFID } from '../context/RFIDContext';
import { Plus, Trash2, Radio, Info, KeyRound, Sparkles, Link2, BookOpen, X, Edit2 } from 'lucide-react';

export const RFIDTags: React.FC = () => {
  const { token, apiUrl, isAdmin, isLibrarian } = useAuth();
  const { isReaderOnline, simulateScan } = useRFID();

  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Registration Form state
  const [newUid, setNewUid] = useState('');
  const [newType, setNewType] = useState<'Student' | 'Book'>('Book');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Simulator Form state
  const [simUid, setSimUid] = useState('');
  const [simLoading, setSimLoading] = useState(false);

  // Assign to Book Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTag, setSelectedTag] = useState<any>(null);
  const [booksList, setBooksList] = useState<any[]>([]);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchTags = async () => {
    try {
      const res = await fetch(`${apiUrl}/rfid/tags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTags(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBooks = async () => {
    try {
      const res = await fetch(`${apiUrl}/books`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBooksList(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [token]);

  // Open Assign Tag to Book modal
  const openAssignModal = (tag: any) => {
    setSelectedTag(tag);
    setSelectedBookId('');
    setAssignError('');
    setAssignSuccess('');
    setShowAssignModal(true);
    fetchBooks();
  };

  // Handle register tag
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!newUid.trim()) {
      setRegError('UID is required.');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/rfid/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid: newUid.trim(), type: newType })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setRegSuccess('RFID tag registered successfully.');
      setNewUid('');
      fetchTags();
    } catch (err: any) {
      setRegError(err.message);
    }
  };

  // Handle assign tag to selected book
  const handleAssignToBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignError('');
    setAssignSuccess('');

    if (!selectedBookId) {
      setAssignError('Please select a book from the catalog.');
      return;
    }

    setAssignLoading(true);
    try {
      const res = await fetch(`${apiUrl}/books/link-rfid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bookId: parseInt(selectedBookId),
          rfidUid: selectedTag.uid
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign RFID tag to book');

      setAssignSuccess(`RFID tag ${selectedTag.uid} linked successfully!`);
      setTimeout(() => {
        setShowAssignModal(false);
        setSelectedTag(null);
        fetchTags();
      }, 1000);
    } catch (err: any) {
      setAssignError(err.message);
    } finally {
      setAssignLoading(false);
    }
  };

  // Handle simulation trigger
  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simUid.trim()) return;

    setSimLoading(true);
    try {
      await simulateScan(simUid.trim());
      setSimUid('');
      const btn = document.getElementById('sim-btn');
      if (btn) {
        btn.classList.add('bg-emerald-600');
        setTimeout(() => btn.classList.remove('bg-emerald-600'), 1000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  };

  // Edit Tag Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUid, setEditUid] = useState('');
  const [editType, setEditType] = useState<'Student' | 'Book'>('Book');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Open Edit Tag modal
  const openEditTagModal = (tag: any) => {
    setSelectedTag(tag);
    setEditUid(tag.uid);
    setEditType(tag.type || 'Book');
    setEditError('');
    setEditSuccess('');
    setShowEditModal(true);
  };

  // Submit Edit Tag UID
  const handleEditTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');

    if (!editUid.trim()) {
      setEditError('Tag UID cannot be empty.');
      return;
    }

    setEditLoading(true);
    try {
      const res = await fetch(`${apiUrl}/rfid/tags/${selectedTag.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          newUid: editUid.trim(),
          type: editType
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update RFID tag UID');

      setEditSuccess('RFID tag updated successfully!');
      setTimeout(() => {
        setShowEditModal(false);
        setSelectedTag(null);
        fetchTags();
      }, 800);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Unlink Tag
  const handleUnlink = async (uid: string) => {
    if (!window.confirm(`Are you sure you want to unlink tag ${uid} from its associated item/student?`)) return;
    try {
      const res = await fetch(`${apiUrl}/rfid/unlink/${uid}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        fetchTags();
      } else {
        alert(data.error || 'Failed to unlink tag');
      }
    } catch (err: any) {
      alert(err.message || 'Error unlinking tag');
    }
  };

  // Delete / Unregister Tag
  const handleDelete = async (uid: string) => {
    if (!window.confirm(`Are you sure you want to delete tag ${uid}? This clears all linked relationships.`)) return;
    try {
      const res = await fetch(`${apiUrl}/rfid/${uid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        fetchTags();
      } else {
        alert(data.error || 'Failed to delete tag');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting tag');
    }
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-2xl font-bold font-outfit text-white">RFID Tag Registry</h1>
        <p className="text-slate-400 text-xs mt-1">Register new tags, edit UIDs, assign RFID tags to books, and simulate scanner scans.</p>
      </div>

      {/* Grid: Registration, Simulation Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: Register New Tag */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
          <h3 className="font-bold text-sm text-slate-200 mb-4 flex items-center gap-2">
            <Plus size={16} className="text-brand-400" />
            <span>Register New Tag</span>
          </h3>

          {regError && (
            <div className="p-3 mb-4 rounded bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-400">
              {regError}
            </div>
          )}

          {regSuccess && (
            <div className="p-3 mb-4 rounded bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-400">
              {regSuccess}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Tag UID / Hex Code</label>
              <input
                type="text"
                placeholder="e.g. BOOK_TAG_9901B or swipe card"
                value={newUid}
                onChange={(e) => setNewUid(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Assign Tag Usage</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewType('Book')}
                  className={`py-2 rounded text-xs font-semibold border transition-all ${
                    newType === 'Book' 
                      ? 'bg-brand-600/10 text-brand-400 border-brand-500/35' 
                      : 'bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-900'
                  }`}
                >
                  Book Copy Tag
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('Student')}
                  className={`py-2 rounded text-xs font-semibold border transition-all ${
                    newType === 'Student' 
                      ? 'bg-brand-600/10 text-brand-400 border-brand-500/35' 
                      : 'bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-900'
                  }`}
                >
                  Student Card Tag
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white rounded transition-all shadow-md shadow-brand-500/10"
            >
              Add to Registry
            </button>
          </form>
        </div>

        {/* Panel 2: Live Simulator Console */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
          <h3 className="font-bold text-sm text-slate-200 mb-4 flex items-center gap-2">
            <Radio size={16} className="text-indigo-400 animate-pulse" />
            <span>Virtual RFID Scanner</span>
          </h3>

          <div className="p-4 bg-brand-500/5 border border-brand-500/10 rounded-xl flex gap-3 text-xs text-brand-300 mb-4">
            <Info size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">This tool fires mock scan triggers to test live checkouts without physical hardware.</p>
          </div>

          <form onSubmit={handleSimulate} className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Enter Tag UID to Scan</label>
              <input
                type="text"
                placeholder="e.g. STU_CARD_779213 or BOOK_TAG_1001A"
                value={simUid}
                onChange={(e) => setSimUid(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              id="sim-btn"
              type="submit"
              disabled={simLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center gap-2"
            >
              <Sparkles size={14} />
              <span>{simLoading ? 'Transmitting Scan...' : 'Trigger Virtual Scan'}</span>
            </button>
          </form>
        </div>

        {/* Panel 3: Tag Metadata Summary */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-200 mb-4 flex items-center gap-2">
              <KeyRound size={16} className="text-amber-400" />
              <span>Registry Stats</span>
            </h3>
            
            <div className="space-y-4 my-2 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Total Registered Tags</span>
                <span className="font-bold text-slate-200">{tags.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Student Cards</span>
                <span className="font-bold text-brand-400">{tags.filter(t => t.type === 'Student').length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Book Copy Tags</span>
                <span className="font-bold text-emerald-400">{tags.filter(t => t.type === 'Book').length}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Unassigned Tags</span>
                <span className="font-bold text-amber-400">{tags.filter(t => t.linked_id === null).length}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-850/50 rounded-lg text-[10px] text-slate-500 leading-normal">
            Physical antenna scans send raw HEX serial payloads which match the UIDs listed in this registry.
          </div>
        </div>
      </div>

      {/* Tags List Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading tag registry...</div>
        ) : tags.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No RFID tags registered in database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-4 px-6">RFID Tag UID</th>
                  <th className="py-4 px-6">Tag Type</th>
                  <th className="py-4 px-6">Linked Entity Name</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Created On</th>
                  {(isLibrarian || isAdmin) && <th className="py-4 px-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {tags.map((row) => (
                  <tr key={row.uid} className="hover:bg-slate-900/30">
                    <td className="py-4 px-6 font-mono font-bold text-slate-300">{row.uid}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.type === 'Student' ? 'bg-brand-500/10 text-brand-400' : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {row.type} Card
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-200">
                      {row.linked_entity_name === 'Unassigned' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 italic">Unassigned Tag</span>
                          {row.type === 'Book' && (isLibrarian || isAdmin) && (
                            <button
                              onClick={() => openAssignModal(row)}
                              className="px-2 py-0.5 bg-indigo-500/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded text-[10px] font-semibold flex items-center gap-1 transition-all"
                            >
                              <BookOpen size={12} />
                              <span>Assign to Book</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span>{row.linked_entity_name}</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[10px] font-semibold">{row.status}</span>
                    </td>
                    <td className="py-4 px-6 text-slate-500">{new Date(row.created_at).toLocaleDateString()}</td>
                    {(isLibrarian || isAdmin) && (
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditTagModal(row)}
                            title="Edit RFID Tag UID"
                            className="p-1.5 text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600/20 rounded border border-emerald-500/20 transition-all flex items-center gap-1 text-xs font-semibold"
                          >
                            <Edit2 size={14} />
                            <span>Edit UID</span>
                          </button>

                          {row.linked_id && (
                            <button
                              onClick={() => handleUnlink(row.uid)}
                              title="Unlink from student/book"
                              className="p-1.5 text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-600/20 rounded border border-amber-500/20 transition-all text-xs font-semibold flex items-center gap-1"
                            >
                              <X size={14} />
                              <span>Unlink</span>
                            </button>
                          )}

                          {row.type === 'Book' && !row.linked_id && (
                            <button
                              onClick={() => openAssignModal(row)}
                              title="Assign to Book"
                              className="p-1.5 text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600/20 rounded border border-indigo-500/20 text-xs font-semibold flex items-center gap-1 transition-all"
                            >
                              <Link2 size={14} />
                              <span>Assign</span>
                            </button>
                          )}

                          {(isAdmin || isLibrarian) && (
                            <button
                              onClick={() => handleDelete(row.uid)}
                              title="Delete Tag"
                              className="p-1.5 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600/20 rounded border border-rose-500/20 transition-all"
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

      {/* ASSIGN TAG TO BOOK MODAL */}
      {showAssignModal && selectedTag && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 font-outfit">Assign RFID Tag to Book</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>
            
            {assignError && (
              <div className="p-4 mx-6 mt-4 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                {assignError}
              </div>
            )}

            {assignSuccess && (
              <div className="p-4 mx-6 mt-4 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs">
                {assignSuccess}
              </div>
            )}

            <form onSubmit={handleAssignToBook} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Selected RFID Tag UID</label>
                <div className="font-mono text-sm text-brand-400 font-bold bg-slate-950 px-3 py-2.5 rounded border border-slate-800">
                  {selectedTag.uid}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Select Book from Catalog</label>
                <select
                  required
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- Choose Book to Link --</option>
                  {booksList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} (ISBN: {b.isbn}) - {b.rfid_tags?.length ? `${b.rfid_tags.length} tag(s) linked` : 'No tag linked'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="px-4 py-2 rounded bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-lg shadow-brand-500/10 flex items-center gap-2"
                >
                  <Link2 size={14} />
                  <span>{assignLoading ? 'Assigning...' : 'Assign Tag to Book'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RFID TAG MODAL */}
      {showEditModal && selectedTag && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 font-outfit">Edit RFID Tag UID</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>
            
            {editError && (
              <div className="p-4 mx-6 mt-4 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="p-4 mx-6 mt-4 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs">
                {editSuccess}
              </div>
            )}

            <form onSubmit={handleEditTagSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Current RFID Tag UID</label>
                <div className="font-mono text-xs text-slate-400 bg-slate-950 px-3 py-2 rounded border border-slate-850">
                  {selectedTag.uid}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">New Tag UID String</label>
                <input
                  type="text"
                  required
                  placeholder="Enter new UID string or hex..."
                  value={editUid}
                  onChange={(e) => setEditUid(e.target.value)}
                  className="w-full px-3 py-2.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Tag Type Usage</label>
                <select
                  value={editType}
                  onChange={(e: any) => setEditType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="Book">Book Copy Tag</option>
                  <option value="Student">Student Card Tag</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-500/10 flex items-center gap-2"
                >
                  <span>{editLoading ? 'Saving...' : 'Save Tag Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
