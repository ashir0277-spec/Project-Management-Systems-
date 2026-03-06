import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Eye, AlertCircle, CheckCircle2, Trash2, Circle, Search, X } from 'lucide-react';
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

// ─── Column definitions ───────────────────────────────────────────────────────
const INIT_COLS = [
  { key: 'idx',         label: '#',            width: 48,  align: 'center', fixed: true   },
  { key: 'project',     label: 'Project',      width: 160, align: 'left',   field: 'project' },
  { key: 'name',        label: 'Client Name',  width: 180, align: 'left',   field: 'name' },
  { key: 'dueDate',     label: 'Due Date',     width: 110, align: 'center', field: 'dueDate' },
  { key: 'status',      label: 'Status',       width: 110, align: 'center', field: 'status' },
  { key: 'totalBudget', label: 'Total Budget', width: 120, align: 'right',  field: 'totalBudget' },
  { key: 'paidAmount',  label: 'Paid',         width: 100, align: 'right',  field: 'paidAmount' },
  { key: 'remaining',   label: 'Remaining',    width: 110, align: 'right'  },
  { key: 'progress',    label: 'Progress',     width: 170, align: 'center' },
  { key: 'eye',         label: '',             width: 48,  align: 'center', fixed: true   },
  { key: 'menu',        label: '',             width: 48,  align: 'center', fixed: true   },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function PayoutDashboard() {
  const [clients,       setClients]       = useState([]);
  const [milestoneMap,  setMilestoneMap]  = useState({});
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(null);
  const [searchQuery,   setSearchQuery]   = useState('');
  const searchRef = useRef(null);

  const { showAddPayoutModal, setShowAddPayoutModal } = useOutletContext();
  const showAddClient    = showAddPayoutModal;
  const setShowAddClient = setShowAddPayoutModal;

  const [showAddMS,     setShowAddMS]     = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [openMenuId,    setOpenMenuId]    = useState(null);
  const [menuPos,       setMenuPos]       = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);

  // ── Column state ──
  const [cols, setCols] = useState(INIT_COLS);
  const dragColRef    = useRef(null);
  const isResizing    = useRef(false);
  const [dragOverCol, setDragOverCol] = useState(null);

  // ── Row drag ──
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

  const filteredClients = enrichedClients.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.project?.toLowerCase().includes(q) ||
      c.status?.toLowerCase().includes(q)
    );
  });

  // ── Column Resize ─────────────────────────────────────────────────────────
  const startResize = useCallback((e, key) => {
    e.preventDefault(); e.stopPropagation();
    isResizing.current = true;
    const startX = e.clientX;
    const startW = cols.find(c => c.key === key)?.width || 100;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = ev => {
      const w = Math.max(60, startW + ev.clientX - startX);
      setCols(prev => prev.map(c => c.key === key ? { ...c, width: w } : c));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setTimeout(() => { isResizing.current = false; }, 50);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [cols]);

  // ── Column DnD (mouse) ────────────────────────────────────────────────────
  const onColDragStart = (e, key) => {
    if (isResizing.current) { e.preventDefault(); return; }
    dragColRef.current = key;
    e.dataTransfer.effectAllowed = 'move';
  };

  // ── Column DnD (touch) ────────────────────────────────────────────────────
  const colTouchStart = useRef(null);
  const onColTouchStart = (e, key) => {
    colTouchStart.current = { key, x: e.touches[0].clientX };
  };
  const onColTouchEnd = (e, key) => {
    if (!colTouchStart.current) return;
    const dx = e.changedTouches[0].clientX - colTouchStart.current.x;
    if (Math.abs(dx) < 30) { colTouchStart.current = null; return; }
    const src = colTouchStart.current.key;
    colTouchStart.current = null;
    setCols(prev => {
      const arr = [...prev];
      const si  = arr.findIndex(c => c.key === src);
      let di    = si + (dx > 0 ? 1 : -1);
      // skip fixed cols
      while (di >= 0 && di < arr.length && arr[di].fixed) di += (dx > 0 ? 1 : -1);
      if (di < 0 || di >= arr.length || arr[di].fixed) return prev;
      const [m] = arr.splice(si, 1);
      arr.splice(di, 0, m);
      return arr;
    });
  };
  const onColDragOver = (e, key) => {
    if (!dragColRef.current || key === dragColRef.current) return;
    e.preventDefault(); setDragOverCol(key);
  };
  const onColDrop = (e, target) => {
    e.preventDefault();
    const src = dragColRef.current;
    if (!src || src === target) { dragColRef.current = null; setDragOverCol(null); return; }
    setCols(prev => {
      const arr = [...prev];
      const si  = arr.findIndex(c => c.key === src);
      const di  = arr.findIndex(c => c.key === target);
      const [m] = arr.splice(si, 1);
      arr.splice(di, 0, m);
      return arr;
    });
    dragColRef.current = null; setDragOverCol(null);
  };
  const onColDragEnd = () => { dragColRef.current = null; setDragOverCol(null); };

  // ── Cell edit ─────────────────────────────────────────────────────────────
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
    if (isResizing.current) return;
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

  // ── Row DnD (mouse) ──────────────────────────────────────────────────────
  const handleDragStart = (e, idx) => {
    if (dragColRef.current) return;
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
    await reorderRows(from, to);
  };
  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    dragItem.current = null; dragOverItem.current = null; setDragOverIdx(null);
  };

  // ── Row reorder (shared) ─────────────────────────────────────────────────
  const reorderRows = async (from, to) => {
    if (from === to) { setDragOverIdx(null); return; }
    const arr = [...enrichedClients];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setDragOverIdx(null);
    const batch = writeBatch(db);
    arr.forEach((c, i) => batch.update(doc(db, 'payouts', c.id), { order: i }));
    await batch.commit();
    dragItem.current = null; dragOverItem.current = null;
  };

  // ── Row DnD (touch) ──────────────────────────────────────────────────────
  const rowTouchRef = useRef({ startIdx: null, startY: 0, currentY: 0 });
  const onRowTouchStart = (e, idx) => {
    rowTouchRef.current = { startIdx: idx, startY: e.touches[0].clientY, currentY: e.touches[0].clientY };
  };
  const onRowTouchMove = (e, idx) => {
    e.preventDefault();
    rowTouchRef.current.currentY = e.touches[0].clientY;
    // find element under touch
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    const row = el?.closest('tr[data-idx]');
    if (row) {
      const overIdx = parseInt(row.getAttribute('data-idx'));
      if (!isNaN(overIdx) && overIdx !== dragOverIdx) setDragOverIdx(overIdx);
    }
  };
  const onRowTouchEnd = async (e, idx) => {
    const overIdx = dragOverIdx;
    setDragOverIdx(null);
    if (overIdx !== null && overIdx !== idx) {
      await reorderRows(idx, overIdx);
    }
    rowTouchRef.current = { startIdx: null, startY: 0, currentY: 0 };
  };

  // ── Add client / milestone ────────────────────────────────────────────────
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

  const totalW = cols.reduce((s, c) => s + c.width, 0);

  // ── Render a single cell's content ────────────────────────────────────────
  const renderCellContent = (col, client, idx) => {
    const isEd = col.field && isEditing(client.id, col.field);
    const remaining = client.totalBudget - client.paidAmount;
    const progress  = pct(client.paidAmount, client.totalBudget);
    const cfg       = statusCfg[client.status] || statusCfg.Active;

    const justifyMap = { center: 'center', right: 'flex-end', left: 'flex-start' };
    const justify    = justifyMap[col.align] || 'flex-start';

    // Single consistent wrapper for all cells
    const cell = (children, overrideJustify) => (
      <div style={{
        display: 'flex', alignItems: 'center', height: '100%',
        width: '100%', boxSizing: 'border-box',
        padding: '0 12px', overflow: 'hidden',
        justifyContent: overrideJustify || justify,
      }}>
        {children}
      </div>
    );

    switch (col.key) {
      case 'idx':
        return cell(<span className="text-xs font-bold font-mono text-gray-300">{idx + 1}</span>);

      case 'name':
        return cell(
          isEd ? (
            <input ref={cellInput} value={editValue}
              onChange={e => handleChange(e.target.value)}
              onBlur={handleBlur} onKeyDown={handleKeyDown}
              className={`${inlineCls} font-semibold text-[14px]`} />
          ) : (
            <div className="flex items-center gap-2.5 overflow-hidden w-full">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {client.name?.[0] || '?'}
              </div>
              <span className="text-[14px] font-semibold text-gray-900 truncate">{client.name}</span>
            </div>
          )
        );

      case 'project':
        return cell(
          isEd ? (
            <input ref={cellInput} value={editValue}
              onChange={e => handleChange(e.target.value)}
              onBlur={handleBlur} onKeyDown={handleKeyDown}
              className={`${inlineCls} text-[13px]`} />
          ) : (
            <span className="text-[13px] text-gray-600 truncate">{client.project}</span>
          )
        );

      case 'dueDate':
        return cell(
          isEd ? (
            <input ref={cellInput} type="date" value={editValue}
              onChange={e => handleChange(e.target.value)}
              onBlur={handleBlur} onKeyDown={handleKeyDown}
              className={`${inlineCls} font-mono text-[12px]`} />
          ) : (
            <span className="text-[12px] font-mono text-gray-600 whitespace-nowrap">{client.dueDate || '—'}</span>
          )
        );

      case 'status':
        return cell(
          isEd ? (
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
          )
        );

      case 'totalBudget':
        return cell(
          isEd ? (
            <input ref={cellInput} type="number" value={editValue}
              onChange={e => handleChange(e.target.value)}
              onBlur={handleBlur} onKeyDown={handleKeyDown}
              className={`${inlineCls} font-mono text-[13px] text-right w-full`} />
          ) : (
            <span className="text-[13px] font-semibold font-mono text-gray-800 whitespace-nowrap">{fmt(client.totalBudget)}</span>
          )
        );

      case 'paidAmount':
        return cell(
          isEd ? (
            <input ref={cellInput} type="number" value={editValue}
              onChange={e => handleChange(e.target.value)}
              onBlur={handleBlur} onKeyDown={handleKeyDown}
              className={`${inlineCls} font-mono text-[13px] text-right w-full`} />
          ) : (
            <span className="text-[13px] font-semibold font-mono text-emerald-600 whitespace-nowrap">{fmt(client.paidAmount)}</span>
          )
        );

      case 'remaining':
        return cell(
          <span className={`text-[13px] font-semibold font-mono whitespace-nowrap ${remaining > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
            {fmt(remaining)}
          </span>
        );

      case 'progress':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%', padding: '0 12px' }}>
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#EEF2F7', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(to right, #2dd4bf, #06b6d4)', width: `${progress}%` }} />
            </div>
            <span className="text-[12px] font-bold text-gray-600" style={{ minWidth: 32, textAlign: 'right' }}>{progress}%</span>
          </div>
        );

      case 'eye':
        return cell(
          <button onClick={e => { e.stopPropagation(); setSelected({ ...client, milestones: client.milestones }); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-teal-500 hover:bg-teal-50 transition-colors">
            <Eye size={15} />
          </button>
        );

      case 'menu':
        return cell(
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
        );

      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <style>{`
        .payout-scroll::-webkit-scrollbar        { height: 6px; width: 6px; }
        .payout-scroll::-webkit-scrollbar-track  { background: rgba(238,242,247,0.9); border-radius: 999px; }
        .payout-scroll::-webkit-scrollbar-thumb  { background: rgba(20,184,166,0.55); border-radius: 999px; }
        .payout-scroll::-webkit-scrollbar-thumb:hover { background: rgba(20,184,166,0.85); }
        .col-resize-handle { position:absolute; right:0; top:0; bottom:0; width:5px; cursor:col-resize; z-index:20; display:flex; align-items:center; justify-content:center; }
        .col-resize-handle:hover .col-resize-bar, .col-resize-handle:active .col-resize-bar { background:#14b8a6; height:70%; opacity:1; }
        .col-resize-bar { width:2px; height:40%; background:rgba(0,0,0,0.15); border-radius:2px; transition:all .15s; opacity:0.6; }
        .col-drag-over { background:rgba(20,184,166,0.05) !important; box-shadow: inset 2px 0 0 #14b8a6; }
        .th-drag:hover { background:rgba(20,184,166,0.06); }
        .cell-editing { box-shadow: inset 0 0 0 2px #14b8a6; background:rgba(20,184,166,0.05) !important; }
        .row-drag-over { box-shadow: inset 0 2px 0 #14b8a6; background:rgba(20,184,166,0.04) !important; }
        @media (min-width: 1024px) {
          .payout-scroll { overflow-x: hidden !important; }
        }
      `}</style>

      {/* ── Page header ── */}
      <div className="px-4 md:px-8 pt-4 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div className="flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-800">Client Payouts</h2>
          <p className="text-xs text-gray-400 mt-0.5">Track budgets, payments &amp; milestones</p>
        </div>
        <div className="relative w-full sm:w-64 md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={searchRef} type="text" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search clients, projects, status..."
            className="w-full pl-8 pr-7 py-2 rounded-lg text-sm text-gray-700 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 transition-all"
            style={{ border: `1px solid ${TL}` }}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── TABLE WRAPPER ── */}
      <div className="p-3 md:p-6 pt-2">
        <div className="bg-white rounded-2xl shadow-sm w-full" style={{ border: `1px solid ${TL}`, overflow: 'hidden' }}>
          <div className="payout-scroll" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)', WebkitOverflowScrolling: 'touch' }}>
            <table
              className="border-collapse payout-table"
              style={{ tableLayout: 'fixed', width: '100%' }}
            >
              <colgroup>
                {cols.map(col => <col key={col.key} style={{ width: col.width + 'px' }} />)}
              </colgroup>

              {/* THEAD */}
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EEF2F7]" style={{ borderBottom: `2px solid ${TLB}` }}>
                  {cols.map((col, ci) => {
                    const canDrag = !col.fixed;
                    const isOver  = dragOverCol === col.key;
                    return (
                      <th key={col.key}
                        draggable={canDrag}
                        onDragStart={canDrag ? e => onColDragStart(e, col.key) : undefined}
                        onDragOver={canDrag  ? e => onColDragOver(e, col.key)  : undefined}
                        onDrop={canDrag      ? e => onColDrop(e, col.key)      : undefined}
                        onDragEnd={canDrag   ? onColDragEnd                    : undefined}
                        onTouchStart={canDrag ? e => onColTouchStart(e, col.key) : undefined}
                        onTouchEnd={canDrag   ? e => onColTouchEnd(e, col.key)   : undefined}
                        className={`th-drag select-none ${isOver ? 'col-drag-over' : ''}`}
                        style={{
                          height: 40, position: 'relative', userSelect: 'none',
                          borderRight: ci < cols.length - 1 ? `1px solid ${TL}` : undefined,
                          cursor: canDrag ? 'grab' : 'default',
                          padding: 0,
                          verticalAlign: 'middle',
                        }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          height: '100%',
                          width: '100%',
                          paddingLeft: 12,
                          paddingRight: 12,
                          boxSizing: 'border-box',
                          justifyContent:
                            col.align === 'right'  ? 'flex-end' :
                            col.align === 'center' ? 'center'   : 'flex-start',
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                            {col.label}
                          </span>
                        </div>
                        {col.key !== 'eye' && col.key !== 'menu' && col.key !== 'idx' && (
                          <div className="col-resize-handle" onMouseDown={e => startResize(e, col.key)}>
                            <div className="col-resize-bar" />
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* TBODY */}
              <tbody>
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={cols.length} className="py-20 text-center">
                      {searchQuery ? (
                        <>
                          <div className="text-4xl mb-3">🔍</div>
                          <p className="text-gray-400 text-sm">No results for "<span className="font-semibold text-gray-600">{searchQuery}</span>"</p>
                          <button onClick={() => setSearchQuery('')} className="mt-2 text-xs text-teal-500 hover:underline">Clear search</button>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl mb-3">💳</div>
                          <p className="text-gray-400 text-sm">No clients yet. Add one from the top!</p>
                        </>
                      )}
                    </td>
                  </tr>
                )}

                {filteredClients.map((client, idx) => {
                  const isDragOver = dragOverIdx === idx && dragItem.current !== idx;
                  const rowBg      = idx % 2 === 0 ? 'bg-white' : '';

                  return (
                    <tr key={client.id}
                      data-idx={idx}
                      draggable
                      onDragStart={e => handleDragStart(e, idx)}
                      onDragEnter={e => handleDragEnter(e, idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={e => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      onTouchStart={e => onRowTouchStart(e, idx)}
                      onTouchMove={e => onRowTouchMove(e, idx)}
                      onTouchEnd={e => onRowTouchEnd(e, idx)}
                      className={`${rowBg} transition-colors duration-100 ${isDragOver ? 'row-drag-over' : ''}`}
                    >
                      {cols.map((col, ci) => {
                        const isCellEditing = col.field && isEditing(client.id, col.field);
                        return (
                          <td key={col.key}
                            onClick={col.field ? e => startEdit(e, client.id, col.field) : undefined}
                            className={isCellEditing ? 'cell-editing' : ''}
                            style={{
                              height: '62px', padding: 0, verticalAlign: 'middle',
                              borderRight: ci < cols.length - 1 ? `1px solid ${TL}` : undefined,
                              borderBottom: `1px solid ${TL}`,
                              cursor: col.field ? 'cell' : 'default',
                              overflow: 'hidden', position: 'relative',
                              transition: 'background 0.1s',
                            }}>
                            {renderCellContent(col, client, idx)}
                          </td>
                        );
                      })}
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