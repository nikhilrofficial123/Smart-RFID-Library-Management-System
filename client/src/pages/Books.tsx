import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRFID } from '../context/RFIDContext';
import { Plus, Edit2, Trash2, Search, Link2, X, Info, Sparkles, Radio } from 'lucide-react';

export const Books: React.FC = () => {
  const { token, apiUrl, isLibrarian, isAdmin } = useAuth();
  const { registerScanListener } = useRFID();

  // State Management
  const [books, setBooks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [unassignedTags, setUnassignedTags] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Form Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  
  // Book Form Fields
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [shelfNumber, setShelfNumber] = useState('');
  const [totalCopies, setTotalCopies] = useState(1);
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  
  // Link RFID Tag Fields
  const [rfidUid, setRfidUid] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const fetchBooks = async () => {
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (categoryFilter) query.append('category', categoryFilter);

      const res = await fetch(`${apiUrl}/books?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${apiUrl}/books/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUnassignedTags = async () => {
    try {
      const res = await fetch(`${apiUrl}/rfid/tags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnassignedTags(data.filter((t: any) => t.type === 'Book' && !t.linked_id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchCategories();
    fetchUnassignedTags();
  }, [token, categoryFilter]);

  // Handle Search Input Change with simple timeout
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchBooks();
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  // Hook live RFID websocket scan listener when MODAL is open
  useEffect(() => {
    if (!showLinkModal && !showFormModal) return;

    setIsScanning(true);
    // Register listener in our RFID context
    const unsubscribe = registerScanListener((scan) => {
      // Set Scanned RFID tag value automatically!
      setRfidUid(scan.uid);
      setIsScanning(false);
    });

    return () => {
      unsubscribe();
      setIsScanning(false);
    };
  }, [showLinkModal, showFormModal]);

  // Submit Book Add/Edit
  const handleSubmitBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const payload = {
      title,
      author,
      isbn,
      category_id: categoryId ? parseInt(categoryId) : null,
      shelf_number: shelfNumber,
      total_copies: totalCopies,
      image: image || `/assets/VERBS.jpg`,
      rfid_uid: rfidUid.trim() || undefined
    };

    try {
      const url = selectedBook ? `${apiUrl}/books/${selectedBook.id}` : `${apiUrl}/books`;
      const method = selectedBook ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save book');

      fetchBooks();
      fetchUnassignedTags();
      setShowFormModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Submit RFID link mapping
  const handleSubmitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError('');

    if (!rfidUid.trim()) {
      setLinkError('RFID UID is required. Scan or select an RFID tag.');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/books/link-rfid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookId: selectedBook.id, rfidUid: rfidUid.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to bind RFID');

      fetchBooks();
      fetchUnassignedTags();
      setShowLinkModal(false);
      setRfidUid('');
      setSelectedBook(null);
    } catch (err: any) {
      setLinkError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this book? This will clear all linked RFID tags.')) return;
    try {
      const res = await fetch(`${apiUrl}/books/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        fetchBooks();
        fetchUnassignedTags();
      } else {
        alert(data.error || 'Failed to delete book');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting book');
    }
  };

  const handleUnlinkBookRfid = async (bookId: number, tagUid: string, bookTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete/unlink RFID tag "${tagUid}" from book "${bookTitle}"?`)) return;
    try {
      const res = await fetch(`${apiUrl}/books/${bookId}/rfid/${tagUid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        fetchBooks();
        fetchUnassignedTags();
      } else {
        alert(data.error || 'Failed to unlink RFID tag');
      }
    } catch (err: any) {
      alert(err.message || 'Error unlinking RFID tag');
    }
  };

  const handleEditTagUidPrompt = async (oldUid: string) => {
    const newUid = window.prompt(`Edit RFID Tag UID string (current: ${oldUid}):`, oldUid);
    if (!newUid || !newUid.trim() || newUid.trim() === oldUid) return;
    try {
      const res = await fetch(`${apiUrl}/rfid/tags/${oldUid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newUid: newUid.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update tag UID');
      fetchBooks();
      fetchUnassignedTags();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEditModal = (book: any) => {
    setSelectedBook(book);
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn);
    setCategoryId(book.category_id || '');
    setShelfNumber(book.shelf_number);
    setTotalCopies(book.total_copies);
    setImage(book.image || '');
    setRfidUid(book.rfid_tags && book.rfid_tags.length > 0 ? book.rfid_tags[0] : '');
    setShowFormModal(true);
  };

  const openLinkModal = (book: any) => {
    setSelectedBook(book);
    setRfidUid('');
    setLinkError('');
    setShowLinkModal(true);
    fetchUnassignedTags();
  };

  const resetForm = () => {
    setSelectedBook(null);
    setTitle('');
    setAuthor('');
    setIsbn('');
    setCategoryId('');
    setShelfNumber('');
    setTotalCopies(1);
    setImage('');
    setRfidUid('');
    setError('');
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-outfit text-white">Book Management</h1>
          <p className="text-slate-400 text-xs mt-1">Manage catalog metadata and assign RFID tags to physical book copies.</p>
        </div>
        
        {isLibrarian && (
          <button
            onClick={() => { resetForm(); setShowFormModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-sm font-semibold rounded-lg shadow-lg shadow-brand-500/10 transition-all text-white"
          >
            <Plus size={16} />
            <span>Add New Book</span>
          </button>
        )}
      </div>

      {/* Filters & Search Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="md:col-span-2 relative">
          <input
            type="text"
            placeholder="Search by book name, author or ISBN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 pl-11 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all"
          />
          <Search size={16} className="absolute left-4 top-3 text-slate-500" />
        </div>

        {/* Category selector */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-all"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Books Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading catalog inventory...</div>
        ) : books.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No books found in catalogue.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-4 px-6">Book Cover</th>
                  <th className="py-4 px-6">Title & Author</th>
                  <th className="py-4 px-6">ISBN</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Location</th>
                  <th className="py-4 px-6">Copies (Avail/Total)</th>
                  <th className="py-4 px-6">Linked RFID Tags</th>
                  {isLibrarian && <th className="py-4 px-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {books.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-900/30 transition-colors">
                    {/* Book image */}
                    <td className="py-4 px-6">
                      <img 
                        src={row.image || '/assets/VERBS.jpg'} 
                        alt={row.title} 
                        className="w-10 h-14 object-cover rounded shadow-md border border-slate-800"
                        onError={(e: any) => { e.target.src = '/assets/VERBS.jpg' }}
                      />
                    </td>
                    
                    {/* Title */}
                    <td className="py-4 px-6 font-medium">
                      <div className="text-slate-100 font-semibold text-sm">{row.title}</div>
                      <div className="text-slate-500 text-[10px] mt-0.5">{row.author}</div>
                    </td>
                    
                    {/* ISBN */}
                    <td className="py-4 px-6 font-mono text-slate-400">{row.isbn}</td>
                    
                    {/* Category */}
                    <td className="py-4 px-6">
                      <span className="px-2 py-1 bg-slate-800/80 border border-slate-700/50 rounded text-slate-300">{row.category_name || 'General'}</span>
                    </td>
                    
                    {/* Location */}
                    <td className="py-4 px-6 font-semibold text-slate-400">{row.shelf_number}</td>
                    
                    {/* Copies count */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className={row.available_copies > 0 ? 'text-emerald-400' : 'text-rose-400'}>{row.available_copies}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-slate-400">{row.total_copies}</span>
                      </div>
                    </td>
                    
                    {/* RFID tags */}
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap items-center gap-1.5 max-w-[240px]">
                        {row.rfid_tags.length === 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 italic">No tag linked</span>
                            {isLibrarian && (
                              <button
                                onClick={() => openLinkModal(row)}
                                className="px-2 py-0.5 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-brand-400 rounded text-[10px] font-semibold flex items-center gap-1 transition-all"
                              >
                                <Plus size={10} />
                                <span>Assign Tag</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {row.rfid_tags.map((tag: string) => (
                              <div key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 text-brand-400 font-mono text-[10px] font-bold">
                                <span>{tag}</span>
                                {isLibrarian && (
                                  <div className="flex items-center gap-0.5 ml-1 border-l border-brand-500/20 pl-1">
                                    <button
                                      onClick={() => handleEditTagUidPrompt(tag)}
                                      title="Edit Tag UID string"
                                      className="hover:text-white p-0.5 rounded hover:bg-brand-500/20"
                                    >
                                      <Edit2 size={10} />
                                    </button>
                                    <button
                                      onClick={() => handleUnlinkBookRfid(row.id, tag, row.title)}
                                      title="Delete/Unlink Tag from Book"
                                      className="hover:text-rose-400 p-0.5 rounded hover:bg-rose-500/20"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                            {isLibrarian && (
                              <button
                                onClick={() => openLinkModal(row)}
                                title="Add another tag"
                                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[10px]"
                              >
                                + Tag
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    
                    {/* Action buttons */}
                    {isLibrarian && (
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openLinkModal(row)}
                            title="Assign RFID Tag"
                            className="p-2 text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600/20 rounded border border-indigo-500/20 transition-all flex items-center gap-1 text-[11px] font-semibold"
                          >
                            <Link2 size={14} />
                            <span className="hidden xl:inline">Assign RFID</span>
                          </button>
                          <button
                            onClick={() => openEditModal(row)}
                            title="Edit metadata"
                            className="p-2 text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600/20 rounded border border-emerald-500/20 transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          {(isAdmin || isLibrarian) && (
                            <button
                              onClick={() => handleDelete(row.id)}
                              title="Delete Book"
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

      {/* MODAL 1: ADD/EDIT BOOK FORM */}
      {showFormModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 font-outfit">{selectedBook ? 'Edit Book Details' : 'Add New Book to Catalog'}</h3>
              <button onClick={() => { setShowFormModal(false); resetForm(); }} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>
            
            {error && (
              <div className="p-4 mx-6 mt-4 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitBook} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Book Title</label>
                  <input
                    type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Author Name</label>
                  <input
                    type="text" required value={author} onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">ISBN Code</label>
                  <input
                    type="text" required value={isbn} onChange={(e) => setIsbn(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Category</label>
                  <select
                    value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Shelf Number</label>
                  <input
                    type="text" placeholder="e.g. Shelf A-1" required value={shelfNumber} onChange={(e) => setShelfNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Total Copies</label>
                  <input
                    type="number" min="1" required value={totalCopies} onChange={(e) => setTotalCopies(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-slate-400 block">
                      Assign / Edit RFID Tag UID <span className="text-brand-400 font-normal">(Scan card or type UID)</span>
                    </label>
                    {rfidUid && (
                      <button
                        type="button"
                        onClick={() => setRfidUid('')}
                        className="text-[10px] font-semibold text-rose-400 hover:underline flex items-center gap-1"
                      >
                        <X size={10} />
                        <span>Clear/Remove Tag</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Swipe RFID tag on RC522 reader or enter UID (leave blank to clear)..."
                      value={rfidUid}
                      onChange={(e) => setRfidUid(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                    />
                    {isScanning && (
                      <Radio size={14} className="absolute right-3 top-2.5 text-brand-400 animate-pulse" />
                    )}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Book Cover Image URL</label>
                  <input
                    type="text" placeholder="Optional" value={image} onChange={(e) => setImage(e.target.value)}
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
                  Save Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LINK RFID TAG MODAL */}
      {showLinkModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 font-outfit">Assign RFID Book Tag</h3>
              <button onClick={() => { setShowLinkModal(false); setSelectedBook(null); }} className="text-slate-500 hover:text-slate-300">
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
                <p className="leading-relaxed">Scan the RFID card on your RC522 antenna OR select an unassigned RFID tag from the list below.</p>
              </div>

              {/* Scanning status banner */}
              {isScanning && (
                <div className="py-4 flex flex-col items-center justify-center bg-slate-950/40 border border-slate-800/80 rounded-xl border-dashed">
                  <div className="p-3 bg-brand-600/10 text-brand-400 rounded-full scanner-glow mb-2">
                    <Radio size={24} className="animate-pulse" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">RFID Reader Active. Swipe card now...</span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Target Book Title</label>
                <div className="text-xs text-slate-300 font-bold bg-slate-950 px-3 py-2.5 rounded border border-slate-800">{selectedBook?.title}</div>
              </div>

              {unassignedTags.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Choose Unassigned Tag (Optional)</label>
                  <select
                    value={rfidUid}
                    onChange={(e) => setRfidUid(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">-- Select from Registered Tags --</option>
                    {unassignedTags.map((t) => (
                      <option key={t.uid} value={t.uid}>{t.uid} (Registered Unassigned)</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Or Enter / Scanned RFID Tag UID</label>
                <input
                  type="text" placeholder="Waiting for live scan or enter UID..." required value={rfidUid} onChange={(e) => setRfidUid(e.target.value)}
                  className="w-full px-3 py-2.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button" onClick={() => { setShowLinkModal(false); setSelectedBook(null); }}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-lg shadow-brand-500/10 flex items-center gap-1.5"
                >
                  <Link2 size={14} />
                  <span>Assign Tag to Book</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
