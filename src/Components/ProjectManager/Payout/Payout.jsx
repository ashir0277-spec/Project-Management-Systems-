import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Eye, AlertCircle, CheckCircle2, Trash2, Circle } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

// ─── Firebase imports ────────────────────────────────────────────────────────
import { db } from '../../firebase';
import {
  collection, doc,
  onSnapshot,
  addDoc, updateDoc, deleteDoc,
  writeBatch,
  serverTimestamp,
  query, orderBy,
} from 'firebase/firestore';

// ─── Helpers / constants ─────────────────────────────────────────────────────
const TL  = 'rgba(51,51,51,0.20)';
const TLB = 'rgba(51,51,51,0.30)';

const fmt = (n) => '$' + Number(n).toLocaleString();
const pct = (paid, total) => total ? Math.round((paid / total) * 100) : 0;

const statusCfg = {
  Active:    { badge: 'text-blue-600',    dot: 'bg-blue-500'    },
  Completed: { badge: 'text-emerald-600', dot: 'bg-emerald-500' },
  Overdue:   { badge: 'text-red-500',     dot: 'bg-red-500'     },
  Pending:   { badge: 'text-amber-600',   dot: 'bg-amber-400'   },
  Paid:      { badge: 'text-emerald-600', dot: 'bg-emerald-500' },
};

const msStatusIcon = (s) => {
  if (s === 'Paid')    return <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />;
  if (s === 'Overdue') return <AlertCircle  size={15} className="text-red-500 shrink-0"    />;
  return <Circle size={15} className="text-gray-300 shrink-0" />;
};

const clientsCol    = () => collection(db, 'payouts');
const milestonesCol = (clientId) => collection(db, 'payouts', clientId, 'milestones');

const recalcPaid = async (clientId, milestones) => {
  const paid = milestones
    .filter(m => m.status === 'Paid')
    .reduce((s, m) => s + (m.amount || 0), 0);
  await updateDoc(doc(db, 'payouts', clientId), { paidAmount: paid });
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function PayoutDashboard() {
  const [clients,       setClients]       = useState([]);
  const [milestoneMap,  setMilestoneMap]  = useState({});
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(null);
  const { showAddPayoutModal, setShowAddPayoutModal } = useOutletContext();
  const showAddClient    = showAddPayoutModal;
  const setShowAddClient = setShowAddPayoutModal;   // ✅ FIX: setter properly aliased
  const [showAddMS,     setShowAddMS]     = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [openMenuId,    setOpenMenuId]    = useState(null);
  const [menuPos,       setMenuPos]       = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);

  const dragItem     = useRef(null);
  const dragOverItem = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const [newClient, setNewClient] = useState({ name: '', project: '', dueDate: '', totalBudget: '', status: 'Active' });
  const [newMS,     setNewMS]     = useState({ title: '', amount: '', dueDate: '', status: 'Pending' });

  const [editingCell, setEditingCell] = useState(null);
  const [editValue,   setEditValue]   = useState('');
  const savedValue  = useRef('');
  const cellInput   = useRef(null);
  const skipBlur    = useRef(false);

  useEffect(() => {
    const q = query(clientsCol(), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (clients.length === 0) return;
    const unsubs = clients.map(client => {
      const q = query(milestonesCol(client.id), orderBy('order', 'asc'));
      return onSnapshot(q, (snap) => {
        const ms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMilestoneMap(prev => ({ ...prev, [client.id]: ms }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [clients.map(c => c.id).join(',')]);

  useEffect(() => {
    if (selected) {
      const fresh = clients.find(c => c.id === selected.id);
      if (fresh) setSelected({ ...fresh, milestones: milestoneMap[fresh.id] || [] });
    }
  }, [clients, milestoneMap]);

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const enrichedClients = clients.map(c => ({ ...c, milestones: milestoneMap[c.id] || [] }));

  const getVal = useCallback((clientId, field) => {
    const c = clients.find(x => x.id === clientId);
    if (!c) return '';
    return String(c[field] ?? '');
  }, [clients]);

  const applyEdit = useCallback(async (clientId, field, value) => {
    if (value === '') return;
    const update = {};
    if (field === 'totalBudget') update.totalBudget = parseFloat(value) || 0;
    else if (field === 'paidAmount') update.paidAmount = parseFloat(value) || 0;
    else update[field] = value;
    await updateDoc(doc(db, 'payouts', clientId), update);
  }, []);

  const startEdit = (e, clientId, field) => {
    e.stopPropagation();
    if (editingCell?.clientId === clientId && editingCell?.field === field) return;
    if (editingCell) applyEdit(editingCell.clientId, editingCell.field, savedValue.current);
    const initial = getVal(clientId, field);
    savedValue.current = initial;
    setEditValue(initial);
    setEditingCell({ clientId, field });
    skipBlur.current = false;
    setTimeout(() => { cellInput.current?.focus(); cellInput.current?.select?.(); }, 20);
  };

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    applyEdit(editingCell.clientId, editingCell.field, savedValue.current);
    setEditingCell(null); setEditValue(''); savedValue.current = '';
  }, [editingCell, applyEdit]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null); setEditValue(''); savedValue.current = '';
  }, []);

  const handleChange  = (val) => { savedValue.current = val; setEditValue(val); };
  const handleBlur    = () => { if (skipBlur.current) { skipBlur.current = false; return; } commitEdit(); };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter')       { e.preventDefault(); skipBlur.current = true; commitEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); skipBlur.current = true; cancelEdit(); }
  };
  const isEditing = (clientId, field) => editingCell?.clientId === clientId && editingCell?.field === field;

  const handleDragStart = (e, idx) => {
    dragItem.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if (e.target) e.target.style.opacity = '0.4'; }, 0);
  };
  const handleDragEnter = (e, idx) => { e.preventDefault(); dragOverItem.current = idx; setDragOverIdx(idx); };
  const handleDragOver  = (e, idx) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    if (dragOverItem.current !== idx) { dragOverItem.current = idx; setDragOverIdx(idx); }
  };
  const handleDrop = async (e, idx) => {
    e.preventDefault();
    const from = dragItem.current, to = dragOverItem.current ?? idx;
    if (from === null || to === null || from === to) { setDragOverIdx(null); return; }
    const arr = [...enrichedClients];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setDragOverIdx(null);
    const batch = writeBatch(db);
    arr.forEach((c, i) => batch.update(doc(db, 'payouts', c.id), { order: i }));
    await batch.commit();
    dragItem.current = null; dragOverItem.current = null;
  };
  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    dragItem.current = null; dragOverItem.current = null; setDragOverIdx(null);
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    await addDoc(clientsCol(), {
      name:        newClient.name,
      project:     newClient.project,
      status:      newClient.status,
      dueDate:     newClient.dueDate,
      totalBudget: parseFloat(newClient.totalBudget) || 0,
      paidAmount:  0,
      order:       enrichedClients.length,
      createdAt:   serverTimestamp(),
    });
    setNewClient({ name: '', project: '', dueDate: '', totalBudget: '', status: 'Active' });
    setShowAddClient(false);
  };

  const confirmDeleteClient = async () => {
    const msDocs = milestoneMap[deleteTarget.id] || [];
    const batch  = writeBatch(db);
    msDocs.forEach(m => batch.delete(doc(db, 'payouts', deleteTarget.id, 'milestones', m.id)));
    batch.delete(doc(db, 'payouts', deleteTarget.id));
    await batch.commit();
    if (selected?.id === deleteTarget.id) setSelected(null);
    setDeleteTarget(null);
  };

  const addMilestone = async (e) => {
    e.preventDefault();
    if (!selected) return;
    const ms = {
      title:   newMS.title,
      amount:  parseFloat(newMS.amount) || 0,
      dueDate: newMS.dueDate,
      status:  newMS.status,
      order:   (milestoneMap[selected.id] || []).length,
    };
    await addDoc(milestonesCol(selected.id), ms);
    if (ms.status === 'Paid') {
      await recalcPaid(selected.id, [...(milestoneMap[selected.id] || []), ms]);
    }
    setNewMS({ title: '', amount: '', dueDate: '', status: 'Pending' });
    setShowAddMS(false);
  };

  const toggleMSStatus = async (clientId, msId) => {
    const ms = (milestoneMap[clientId] || []).find(m => m.id === msId);
    if (!ms) return;
    const nextStatus = ms.status === 'Paid' ? 'Pending' : 'Paid';
    await updateDoc(doc(db, 'payouts', clientId, 'milestones', msId), { status: nextStatus });
    await recalcPaid(clientId, (milestoneMap[clientId] || []).map(m => m.id === msId ? { ...m, status: nextStatus } : m));
  };

  const deleteMilestone = async (clientId, msId) => {
    await deleteDoc(doc(db, 'payouts', clientId, 'milestones', msId));
    await recalcPaid(clientId, (milestoneMap[clientId] || []).filter(m => m.id !== msId));
  };

  const inlineCls  = 'w-full border-none outline-none bg-transparent text-gray-900 p-0 text-sm leading-none';
  const modalInput = 'w-full px-4 py-3 rounded-lg text-sm text-gray-800 bg-white placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all';

  if (loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Loading payouts...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#EEF2F7]">

      {/* ── Page header ── */}
      <div className="px-4 md:px-8 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Client Payouts</h2>
          <p className="text-xs text-gray-400 mt-0.5">Track budgets, payments &amp; milestones</p>
        </div>
        <button
          onClick={() => setShowAddClient(true)}
          className="flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 text-white font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 transition-all shadow text-xs md:text-sm"
        >
          <Plus size={15} /> Add Client
        </button>
      </div>

      {/* ── TABLE WRAPPER ── */}
      <div className="p-3 md:p-6 pt-2">
        <div className="bg-white rounded-2xl shadow-sm w-full" style={{ border: `1px solid ${TL}`, overflow: 'hidden' }}>
          <div
            className="payout-scroll"
            style={{
              overflowX: 'auto',
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 200px)',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <style>{`
              .payout-scroll::-webkit-scrollbar        { height: 6px; width: 6px; }
              .payout-scroll::-webkit-scrollbar-track  { background: rgba(238,242,247,0.9); border-radius: 999px; }
              .payout-scroll::-webkit-scrollbar-thumb  { background: rgba(20,184,166,0.55); border-radius: 999px; }
              .payout-scroll::-webkit-scrollbar-thumb:hover { background: rgba(20,184,166,0.85); }
              @media (min-width: 1024px) {
                .payout-table { min-width: unset !important; width: 100% !important; }
              }
            `}</style>

            <table
              className="border-collapse payout-table"
              style={{ tableLayout: 'auto', minWidth: '950px', width: '100%' }}
            >
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EEF2F7]" style={{ borderBottom: `2px solid ${TLB}` }}>
                  {[
                    { label: '#',            align: 'center' },
                    { label: 'Client Name',  align: 'left'   },
                    { label: 'Project',      align: 'left'   },
                    { label: 'Due Date',     align: 'center' },
                    { label: 'Status',       align: 'center' },
                    { label: 'Total Budget', align: 'right'  },
                    { label: 'Paid',         align: 'right'  },
                    { label: 'Remaining',    align: 'right'  },
                    { label: 'Progress',     align: 'center' },
                    { label: '',             align: 'center' },
                    { label: '',             align: 'center' },
                  ].map((col, i, arr) => (
                    <th key={i}
                      className="py-3.5 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider select-none whitespace-nowrap"
                      style={{
                        textAlign: col.align,
                        borderRight: i < arr.length - 1 ? `1px solid ${TL}` : undefined,
                      }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {enrichedClients.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-20 text-center">
                      <div className="text-4xl mb-3">💳</div>
                      <p className="text-gray-400 text-sm">No clients yet. Add one above!</p>
                    </td>
                  </tr>
                )}

                {enrichedClients.map((client, idx) => {
                  const remaining  = client.totalBudget - client.paidAmount;
                  const progress   = pct(client.paidAmount, client.totalBudget);
                  const isDragOver = dragOverIdx === idx && dragItem.current !== idx;
                  const rowBg      = idx % 2 === 0 ? 'bg-white' : '';
                  const cfg        = statusCfg[client.status] || statusCfg.Active;
                  const TOTAL_COLS = 11;

                  const tdStyle = (field, colIdx) => ({
                    height: '62px', padding: 0, verticalAlign: 'middle',
                    borderRight: colIdx < TOTAL_COLS - 1 ? `1px solid ${TL}` : undefined,
                    borderBottom: `1px solid ${TL}`,
                    outline: isDragOver
                      ? '2px solid #14b8a6'
                      : (field && isEditing(client.id, field) ? '2px solid #14b8a6' : undefined),
                    outlineOffset: '-2px',
                    backgroundColor: field && isEditing(client.id, field)
                      ? 'rgba(20,184,166,0.07)' : 'transparent',
                    cursor: field ? 'cell' : 'default',
                    transition: 'background 0.1s',
                  });

                  const inner = (j = 'flex-start') => ({
                    display: 'flex', alignItems: 'center', justifyContent: j,
                    height: '100%', padding: '0 12px', overflow: 'hidden',
                  });

                  return (
                    <tr key={client.id} draggable
                      onDragStart={e => handleDragStart(e, idx)}
                      onDragEnter={e => handleDragEnter(e, idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={e => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`${rowBg} transition-colors duration-100`}>

                      {/* # */}
                      <td style={{ ...tdStyle(null, 0), cursor: 'grab' }}>
                        <div style={inner('center')}>
                          <span className="text-xs font-bold font-mono text-gray-300">{idx + 1}</span>
                        </div>
                      </td>

                      {/* Client Name */}
                      <td style={tdStyle('name', 1)} onClick={e => startEdit(e, client.id, 'name')}>
                        <div style={inner()}>
                          {isEditing(client.id, 'name') ? (
                            <input ref={cellInput} value={editValue}
                              onChange={e => handleChange(e.target.value)}
                              onBlur={handleBlur} onKeyDown={handleKeyDown}
                              className={`${inlineCls} font-semibold text-[14px]`} />
                          ) : (
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {client.name?.[0] || '?'}
                              </div>
                              <span className="text-[14px] font-semibold text-gray-900 truncate">{client.name}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Project */}
                      <td style={tdStyle('project', 2)} onClick={e => startEdit(e, client.id, 'project')}>
                        <div style={inner()}>
                          {isEditing(client.id, 'project') ? (
                            <input ref={cellInput} value={editValue}
                              onChange={e => handleChange(e.target.value)}
                              onBlur={handleBlur} onKeyDown={handleKeyDown}
                              className={`${inlineCls} text-[13px]`} />
                          ) : (
                            <span className="text-[13px] text-gray-600 truncate">{client.project}</span>
                          )}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td style={tdStyle('dueDate', 3)} onClick={e => startEdit(e, client.id, 'dueDate')}>
                        <div style={inner('center')}>
                          {isEditing(client.id, 'dueDate') ? (
                            <input ref={cellInput} type="date" value={editValue}
                              onChange={e => handleChange(e.target.value)}
                              onBlur={handleBlur} onKeyDown={handleKeyDown}
                              className={`${inlineCls} font-mono text-[12px]`} />
                          ) : (
                            <span className="text-[12px] font-mono text-gray-600 whitespace-nowrap">{client.dueDate || '—'}</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={tdStyle('status', 4)} onClick={e => startEdit(e, client.id, 'status')}>
                        <div style={inner('center')}>
                          {isEditing(client.id, 'status') ? (
                            <select ref={cellInput} value={editValue}
                              onChange={e => {
                                handleChange(e.target.value);
                                skipBlur.current = true;
                                applyEdit(client.id, 'status', e.target.value);
                                setEditingCell(null); setEditValue(''); savedValue.current = '';
                              }}
                              onBlur={handleBlur} onKeyDown={handleKeyDown}
                              className={`${inlineCls} cursor-pointer text-[12px]`}>
                              <option>Active</option>
                              <option>Completed</option>
                              <option>Overdue</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${cfg.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />{client.status}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Budget */}
                      <td style={tdStyle('totalBudget', 5)} onClick={e => startEdit(e, client.id, 'totalBudget')}>
                        <div style={inner('flex-end')}>
                          {isEditing(client.id, 'totalBudget') ? (
                            <input ref={cellInput} type="number" value={editValue}
                              onChange={e => handleChange(e.target.value)}
                              onBlur={handleBlur} onKeyDown={handleKeyDown}
                              className={`${inlineCls} font-mono text-[13px] text-right`} />
                          ) : (
                            <span className="text-[13px] font-semibold font-mono text-gray-800 whitespace-nowrap">{fmt(client.totalBudget)}</span>
                          )}
                        </div>
                      </td>

                      {/* Paid */}
                      <td style={tdStyle('paidAmount', 6)} onClick={e => startEdit(e, client.id, 'paidAmount')}>
                        <div style={inner('flex-end')}>
                          {isEditing(client.id, 'paidAmount') ? (
                            <input ref={cellInput} type="number" value={editValue}
                              onChange={e => handleChange(e.target.value)}
                              onBlur={handleBlur} onKeyDown={handleKeyDown}
                              className={`${inlineCls} font-mono text-[13px] text-right`} />
                          ) : (
                            <span className="text-[13px] font-semibold font-mono text-emerald-600 whitespace-nowrap">{fmt(client.paidAmount)}</span>
                          )}
                        </div>
                      </td>

                      {/* Remaining */}
                      <td style={tdStyle(null, 7)}>
                        <div style={inner('flex-end')}>
                          <span className={`text-[13px] font-semibold font-mono whitespace-nowrap ${remaining > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                            {fmt(remaining)}
                          </span>
                        </div>
                      </td>

                      {/* Progress */}
                      <td style={tdStyle(null, 8)}>
                        <div className="flex items-center gap-2 h-full px-3">
                          <div className="flex-1 h-1.5 rounded-full bg-[#EEF2F7] overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500"
                              style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[12px] font-bold text-gray-600 min-w-[30px] text-right">{progress}%</span>
                        </div>
                      </td>

                      {/* Eye */}
                      <td style={tdStyle(null, 9)}>
                        <div className="flex items-center justify-center h-full">
                          <button onClick={e => { e.stopPropagation(); setSelected({ ...client, milestones: client.milestones }); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-teal-500 hover:bg-teal-50 transition-colors">
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>

                      {/* 3-dot */}
                      <td style={{ ...tdStyle(null, 10), borderRight: undefined }}>
                        <div className="flex items-center justify-center h-full">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (openMenuId === client.id) { setOpenMenuId(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                              setOpenMenuId(client.id);
                            }}
                            className={`w-7 h-7 rounded-lg flex flex-col items-center justify-center gap-[3px] transition-all ${openMenuId === client.id ? 'bg-[#EEF2F7]' : 'hover:bg-[#EEF2F7]'}`}>
                            {[0,1,2].map(i => (
                              <span key={i} className={`w-1 h-1 rounded-full block ${openMenuId === client.id ? 'bg-gray-600' : 'bg-gray-300'}`} />
                            ))}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3-DOT PORTAL */}
      {openMenuId && (
        <div ref={menuRef} onClick={e => e.stopPropagation()}
          className="fixed z-[9999] bg-white rounded-xl overflow-hidden p-1"
          style={{ top: menuPos.top, right: menuPos.right, minWidth: '165px', border: `1px solid ${TL}`, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
          <button
            onClick={() => { const c = enrichedClients.find(cl => cl.id === openMenuId); setOpenMenuId(null); if (c) setDeleteTarget(c); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} strokeWidth={2} /> Delete Client
          </button>
        </div>
      )}

      {/* ── CLIENT DETAIL DRAWER ── */}
      {selected && (
        <div className="fixed inset-0 z-[100]" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
          <div className="absolute right-0 top-0 bottom-0 bg-white flex flex-col shadow-2xl w-full sm:w-[420px] md:w-[520px]"
            style={{ borderLeft: `1px solid ${TL}` }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between px-5 md:px-7 pt-5 md:pt-7 pb-4 flex-shrink-0"
              style={{ borderBottom: `1px solid ${TL}` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {selected.name?.[0] || '?'}
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-bold text-gray-900 leading-tight">{selected.name}</h2>
                  <p className="text-xs md:text-sm text-gray-400 mt-0.5">{selected.project}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all text-xl">×</button>
            </div>

            <div className="px-5 md:px-7 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${TL}` }}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Payment Summary</h3>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {[
                  { label: 'Total Budget', value: fmt(selected.totalBudget),                       color: 'text-gray-900',    bg: 'bg-gray-50',    border: 'border-gray-100'    },
                  { label: 'Received',     value: fmt(selected.paidAmount),                        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                  { label: 'Remaining',    value: fmt(selected.totalBudget - selected.paidAmount), color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100'   },
                ].map(({ label, value, color, bg, border }) => (
                  <div key={label} className={`${bg} border ${border} rounded-xl p-2.5 md:p-3`}>
                    <p className="text-[10px] text-gray-400 font-medium mb-1">{label}</p>
                    <p className={`text-sm font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400">Overall Progress</span>
                  <span className="text-xs font-bold text-teal-600">{pct(selected.paidAmount, selected.totalBudget)}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all duration-500"
                    style={{ width: `${pct(selected.paidAmount, selected.totalBudget)}%` }} />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 md:px-7 py-4" style={{ scrollbarWidth: 'none' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Milestones ({selected.milestones?.length || 0})
                </h3>
                <button onClick={() => setShowAddMS(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors">
                  <Plus size={12} /> Add Milestone
                </button>
              </div>

              {(!selected.milestones || selected.milestones.length === 0) && (
                <div className="text-center py-12">
                  <div className="text-3xl mb-2">🎯</div>
                  <p className="text-sm text-gray-400">No milestones yet. Add one above.</p>
                </div>
              )}

              <div className="space-y-2.5">
                {(selected.milestones || []).map((ms) => {
                  const msCfg = statusCfg[ms.status] || statusCfg.Pending;
                  return (
                    <div key={ms.id}
                      className="flex items-center gap-3 p-3 md:p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100/70 transition-colors group"
                      style={{ border: `1px solid ${TL}` }}>
                      <button onClick={() => toggleMSStatus(selected.id, ms.id)} className="flex-shrink-0 transition-transform hover:scale-110">
                        {msStatusIcon(ms.status)}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[13px] font-semibold truncate ${ms.status === 'Paid' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {ms.title}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${msCfg.badge}`}>
                            {ms.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-mono">Due: {ms.dueDate || '—'}</p>
                      </div>
                      <span className={`text-[13px] font-bold font-mono flex-shrink-0 ${ms.status === 'Paid' ? 'text-emerald-600' : 'text-gray-700'}`}>
                        {fmt(ms.amount)}
                      </span>
                      <button onClick={() => deleteMilestone(selected.id, ms.id)}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD MILESTONE MODAL ── */}
      {showAddMS && selected && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" style={{ border: `1px solid ${TL}` }}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${TL}` }}>
              <h3 className="text-lg font-bold text-gray-900">Add Milestone</h3>
              <button onClick={() => setShowAddMS(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xl">×</button>
            </div>
            <form onSubmit={addMilestone} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Milestone Title *</label>
                <input required type="text" value={newMS.title}
                  onChange={e => setNewMS(p => ({ ...p, title: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }} placeholder="e.g. Design Phase" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount ($) *</label>
                  <input required type="number" value={newMS.amount}
                    onChange={e => setNewMS(p => ({ ...p, amount: e.target.value }))}
                    className={modalInput} style={{ border: `1px solid ${TL}` }} placeholder="5000" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Due Date *</label>
                  <input required type="date" value={newMS.dueDate}
                    onChange={e => setNewMS(p => ({ ...p, dueDate: e.target.value }))}
                    className={modalInput} style={{ border: `1px solid ${TL}` }} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                <select value={newMS.status} onChange={e => setNewMS(p => ({ ...p, status: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }}>
                  <option>Pending</option><option>Paid</option><option>Overdue</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddMS(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-[#EEF2F7] hover:opacity-80"
                  style={{ border: `1px solid ${TL}` }}>Cancel</button>
                <button type="submit"
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow">
                  Add Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD CLIENT MODAL ── */}
      {showAddClient && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ border: `1px solid ${TL}` }}>
            <div className="flex items-center justify-between px-6 py-5 sticky top-0 bg-white" style={{ borderBottom: `1px solid ${TL}` }}>
              <h3 className="text-lg font-bold text-gray-900">Add New Client</h3>
              <button onClick={() => setShowAddClient(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xl">×</button>
            </div>
            <form onSubmit={handleAddClient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Client Name *</label>
                <input required type="text" value={newClient.name}
                  onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }} placeholder="e.g. Apex Technologies" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Project Name *</label>
                <input required type="text" value={newClient.project}
                  onChange={e => setNewClient(p => ({ ...p, project: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }} placeholder="e.g. ERP System Integration" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Total Budget ($) *</label>
                  <input required type="number" value={newClient.totalBudget}
                    onChange={e => setNewClient(p => ({ ...p, totalBudget: e.target.value }))}
                    className={modalInput} style={{ border: `1px solid ${TL}` }} placeholder="50000" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Due Date *</label>
                  <input required type="date" value={newClient.dueDate}
                    onChange={e => setNewClient(p => ({ ...p, dueDate: e.target.value }))}
                    className={modalInput} style={{ border: `1px solid ${TL}` }} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                <select value={newClient.status} onChange={e => setNewClient(p => ({ ...p, status: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }}>
                  <option>Active</option><option>Completed</option><option>Overdue</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddClient(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-[#EEF2F7] hover:opacity-80"
                  style={{ border: `1px solid ${TL}` }}>Cancel</button>
                <button type="submit"
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow">
                  Add Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden" style={{ border: `1px solid ${TL}` }}>
            <div className="h-1 bg-gradient-to-r from-red-400 to-red-500" />
            <div className="p-6 md:p-7">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-5">
                <Trash2 size={22} className="text-red-500" strokeWidth={1.8} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Client?</h3>
              <p className="text-sm text-gray-500 mb-4">This will permanently remove the client and all milestones.</p>
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-6">
                <span className="text-sm font-semibold text-red-600">"{deleteTarget.name}"</span>
                <span className="text-xs text-gray-400 ml-2">will be permanently deleted</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-[#EEF2F7] hover:bg-slate-200"
                  style={{ border: `1px solid ${TL}` }}>Cancel</button>
                <button onClick={confirmDeleteClient}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-red-400 to-red-500 hover:opacity-90 shadow-lg shadow-red-100">
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}