import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, ChevronRight, BarChart2,
  Mail, Phone, X, Building2, User, GripVertical,
  MoreHorizontal, Trash2, CheckSquare, Square,
  MoreVertical, Eye
} from 'lucide-react';

const TL  = 'rgba(51,51,51,0.12)';
const TLB = 'rgba(51,51,51,0.20)';

const statusColors = {
  'Active':   { text: 'text-teal-600',  dot: 'bg-teal-500',  bg: 'bg-teal-50',  border: 'border-teal-200'  },
  'Inactive': { text: 'text-gray-500',  dot: 'bg-gray-400',  bg: 'bg-gray-50',  border: 'border-gray-200'  },
  'On Leave': { text: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Away':     { text: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
};
const roleColors = {
  'Frontend Developer': { text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  'Backend Developer':  { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  'Flutter Developer':  { text: 'text-cyan-600',   bg: 'bg-cyan-50',   border: 'border-cyan-200'   },
  'UI/UX Designer':     { text: 'text-pink-600',   bg: 'bg-pink-50',   border: 'border-pink-200'   },
  'Project Manager':    { text: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200'   },
  'QA Engineer':        { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  'Admin':              { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  'Developer':          { text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  'Designer':           { text: 'text-pink-600',   bg: 'bg-pink-50',   border: 'border-pink-200'   },
  'Manager':            { text: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200'   },
  'QA':                 { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
};
const defaultRoleColor = { text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };

const AVATAR_COLORS = [
  'from-teal-400 to-cyan-500', 'from-violet-400 to-purple-500',
  'from-rose-400 to-pink-500', 'from-amber-400 to-orange-500',
  'from-blue-400 to-indigo-500','from-emerald-400 to-teal-500',
];
const getInitials    = (n = '') => n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
const getAvatarColor = (id= '') => AVATAR_COLORS[id.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const ROLES    = ['Frontend Developer','Backend Developer','Flutter Developer','UI/UX Designer',
                  'Project Manager','QA Engineer','Admin','Developer','Designer','Manager','QA'];
const STATUSES = ['Active','Inactive','On Leave','Away'];

const BASE_COLS = [
  { key: 'rowdrag',    label: '',           width: 36,  fixed: true  },
  { key: 'idx',        label: '#',          width: 48,  fixed: true  },
  { key: 'name',       label: 'Member',     width: 220, editable: true },
  { key: 'email',      label: 'Email',      width: 220, editable: true },
  { key: 'role',       label: 'Role',       width: 180, editable: true },
  { key: 'department', label: 'Department', width: 155, editable: true },
  { key: 'status',     label: 'Status',     width: 125, editable: true },
  { key: 'actions',    label: '',           width: 48,  fixed: true  },
];
const CHECKBOX_COL = { key: 'checkbox', label: '', width: 44, fixed: true };

// ── Checkbox UI ─────────────────────────────────────────────────────────────
const Checkbox = ({ checked, indeterminate, onClick }) => (
  <div
    onClick={onClick}
    style={{
      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `2px solid ${checked || indeterminate ? '#14b8a6' : '#d1d5db'}`,
      background: checked ? '#14b8a6' : indeterminate ? '#ccfbf1' : '#fff',
      cursor: 'pointer', transition: 'all 0.15s',
    }}
  >
    {checked && (
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )}
    {indeterminate && !checked && (
      <div style={{ width: 8, height: 2, background: '#14b8a6', borderRadius: 2 }} />
    )}
  </div>
);

// ── Delete Confirm Modal ────────────────────────────────────────────────────
const DeleteConfirmModal = ({ members, onConfirm, onCancel }) => {
  const isBulk = members.length > 1;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        width: '100%', maxWidth: 380, overflow: 'hidden',
        animation: 'fadeInScale 0.18s ease',
      }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg,#f87171,#fb7185)' }} />
        <div style={{ padding: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Trash2 size={24} color="#ef4444" />
          </div>
          <p style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
            {isBulk ? `Delete ${members.length} Members?` : 'Delete Member?'}
          </p>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
            {isBulk
              ? `You are about to permanently delete ${members.length} selected members.`
              : `You are about to delete "${members[0]?.name || 'this member'}".`
            }
          </p>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#f87171', fontWeight: 500, marginBottom: 24 }}>
            This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={{
              flex: 1, padding: '10px 0', borderRadius: 12, border: '1px solid #e5e7eb',
              fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={onConfirm} style={{
              flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
              fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
              background: 'linear-gradient(135deg,#ef4444,#f43f5e)',
              boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
            }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Row 3-dot Menu — Portal-based ─────────────────────────────────────────────
const RowMenu = ({ anchorEl, onView, onDelete, onClose }) => {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const menuW = 170;
    let left = rect.right + window.scrollX - menuW;
    let top  = rect.bottom + window.scrollY + 4;
    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    setPos({ top, left });
  }, [anchorEl]);

  useEffect(() => {
    const handler = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        anchorEl && !anchorEl.contains(e.target)
      ) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorEl]);

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        minWidth: 170,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
        padding: '4px 0',
        animation: 'fadeInScale 0.14s ease',
      }}
    >
      {/* View Details */}
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onView(); onClose(); }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 14px', fontSize: 13, fontWeight: 500,
          color: '#0f766e', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', borderRadius: 8,
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#f0fdfa'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <Eye size={13} />
        View Details
      </button>

      {/* Divider */}
      <div style={{ margin: '3px 10px', borderTop: '1px solid #f3f4f6' }} />

      {/* Delete */}
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); onClose(); }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 14px', fontSize: 13, fontWeight: 500,
          color: '#ef4444', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', borderRadius: 8,
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <Trash2 size={13} />
        Delete Member
      </button>
    </div>,
    document.body
  );
};

// ── Global 3-dot Menu (Toolbar) ─────────────────────────────────────────────
const GlobalMenu = ({ filtered, selectedIds, selectionMode, onSelectAll, onDeselectAll, onEnableSelection, onDeleteSelected, onClose }) => {
  const menuRef    = useRef(null);
  const allSelected = filtered.length > 0 && filtered.every(m => selectedIds.has(m.id));
  const hasSelection = selectedIds.size > 0;

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const btnStyle = (red = false) => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 14px', fontSize: 13, fontWeight: 500,
    color: red ? '#ef4444' : '#374151',
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  });

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 9999,
        minWidth: 185, background: '#fff', borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
        padding: '4px 0',
        animation: 'fadeInScale 0.14s ease',
      }}
    >
      <div style={{ padding: '6px 14px 4px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Selection
      </div>

      {!selectionMode ? (
        <button
          style={btnStyle()}
          onClick={(e) => { e.stopPropagation(); onEnableSelection(); onClose(); }}
          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <CheckSquare size={13} color="#14b8a6" />
          Select All
        </button>
      ) : (
        <>
          <button
            style={btnStyle()}
            onClick={(e) => { e.stopPropagation(); allSelected ? onDeselectAll() : onSelectAll(); onClose(); }}
            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {allSelected
              ? <><Square size={13} color="#14b8a6" /> Deselect All</>
              : <><CheckSquare size={13} color="#14b8a6" /> Select All</>
            }
          </button>
          <button
            style={btnStyle()}
            onClick={(e) => { e.stopPropagation(); onDeselectAll(); onClose(); }}
            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <X size={13} color="#9ca3af" />
            Cancel Selection
          </button>
          {hasSelection && (
            <>
              <div style={{ margin: '4px 12px', borderTop: '1px solid #f3f4f6' }} />
              <button
                style={btnStyle(true)}
                onClick={(e) => { e.stopPropagation(); onDeleteSelected(); onClose(); }}
                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Trash2 size={13} />
                Delete Selected ({selectedIds.size})
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
const UsersRecord = () => {
  const navigate = useNavigate();
  const [members,    setMembers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const [baseCols,    setBaseCols]    = useState(BASE_COLS);
  const [rowOrder,    setRowOrder]    = useState([]);
  const [editCell,    setEditCell]    = useState(null);
  const [editVal,     setEditVal]     = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  const [selectionMode,  setSelectionMode]  = useState(false);
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [rowMenuId,      setRowMenuId]      = useState(null);
  const [rowMenuAnchor,  setRowMenuAnchor]  = useState(null);
  const [globalMenuOpen, setGlobalMenuOpen] = useState(false);
  const [deleteTarget,   setDeleteTarget]   = useState(null);

  const cols = useMemo(() =>
    selectionMode ? [CHECKBOX_COL, ...baseCols] : baseCols
  , [selectionMode, baseCols]);

  const dragColRef  = useRef(null);
  const dragRowRef  = useRef(null);
  const isResizing  = useRef(false);
  const lastTapRef  = useRef({ id: null, time: 0 });
  const [dragOverCol, setDragOverCol] = useState(null);
  const [dragOverRow, setDragOverRow] = useState(null);

  const handleMobileTap = useCallback((id) => {
    const now = Date.now();
    if (lastTapRef.current.id === id && now - lastTapRef.current.time < 300) {
      lastTapRef.current = { id: null, time: 0 };
      navigate(`/userdetails/${id}`);
    } else {
      lastTapRef.current = { id, time: now };
    }
  }, [navigate]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'teamMembers'),
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMembers(data);
        setRowOrder(prev => {
          const kept   = prev.filter(id => data.some(m => m.id === id));
          const newIds = data.filter(m => !prev.includes(m.id)).map(m => m.id);
          return [...kept, ...newIds];
        });
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const roles = ['All', ...Array.from(new Set(members.map(m => m.role).filter(Boolean)))];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = members.filter(m => {
      const ms = !q || ['name','email','role','department','phone'].some(k => m[k]?.toLowerCase().includes(q));
      return ms && (roleFilter === 'All' || m.role === roleFilter);
    });
    return rowOrder.map(id => base.find(m => m.id === id)).filter(Boolean);
  }, [members, search, roleFilter, rowOrder]);

  // ── Selection ─────────────────────────────────────────────────────────────
  const enableSelection = useCallback(() => {
    setSelectionMode(true);
    setSelectedIds(new Set(filtered.map(m => m.id)));
  }, [filtered]);

  const toggleSelect = useCallback((e, id) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll   = useCallback(() => setSelectedIds(new Set(filtered.map(m => m.id))), [filtered]);
  const deselectAll = useCallback(() => { setSelectedIds(new Set()); setSelectionMode(false); }, []);

  const allSelected  = filtered.length > 0 && filtered.every(m => selectedIds.has(m.id));
  const someSelected = !allSelected && filtered.some(m => selectedIds.has(m.id));

  // ── Delete ────────────────────────────────────────────────────────────────
  const requestDeleteSingle = useCallback((member) => {
    setDeleteTarget({ ids: [member.id], members: [member] });
  }, []);

  const requestDeleteSelected = useCallback(() => {
    const toDelete = filtered.filter(m => selectedIds.has(m.id));
    setDeleteTarget({ ids: toDelete.map(m => m.id), members: toDelete });
  }, [filtered, selectedIds]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await Promise.all(deleteTarget.ids.map(id => deleteDoc(doc(db, 'teamMembers', id))));
      setSelectedIds(prev => {
        const next = new Set(prev);
        deleteTarget.ids.forEach(id => next.delete(id));
        return next;
      });
    } catch (err) { console.error(err); }
    setDeleteTarget(null);
  }, [deleteTarget]);

  // ── Column Resize ─────────────────────────────────────────────────────────
  const startResize = useCallback((e, key) => {
    e.preventDefault(); e.stopPropagation();
    isResizing.current = true;
    const startX = e.clientX;
    const startW = baseCols.find(c => c.key === key)?.width || 100;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = ev => {
      const w = Math.max(60, startW + ev.clientX - startX);
      setBaseCols(prev => prev.map(c => c.key === key ? { ...c, width: w } : c));
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
  }, [baseCols]);

  // ── Column DnD ────────────────────────────────────────────────────────────
  const onColDragStart = (e, key) => { dragColRef.current = key; e.dataTransfer.effectAllowed = 'move'; };
  const onColDragOver  = (e, key) => { if (!dragColRef.current || key === dragColRef.current) return; e.preventDefault(); setDragOverCol(key); };
  const onColDrop = (e, target) => {
    e.preventDefault();
    const src = dragColRef.current;
    if (!src || src === target) { dragColRef.current = null; setDragOverCol(null); return; }
    setBaseCols(prev => {
      const arr = [...prev];
      const si = arr.findIndex(c => c.key === src);
      const di = arr.findIndex(c => c.key === target);
      const [m] = arr.splice(si, 1);
      arr.splice(di, 0, m);
      return arr;
    });
    dragColRef.current = null; setDragOverCol(null);
  };
  const onColDragEnd = () => { dragColRef.current = null; setDragOverCol(null); };

  // ── Row DnD ───────────────────────────────────────────────────────────────
  const onRowDragStart = (e, id) => { dragRowRef.current = id; e.dataTransfer.effectAllowed = 'move'; };
  const onRowDragOver  = (e, id) => { e.preventDefault(); if (dragRowRef.current && dragRowRef.current !== id) setDragOverRow(id); };
  const onRowDrop = (e, targetId) => {
    e.preventDefault();
    const src = dragRowRef.current;
    if (!src || src === targetId) { dragRowRef.current = null; setDragOverRow(null); return; }
    setRowOrder(prev => {
      const arr = [...prev]; const si = arr.indexOf(src); const di = arr.indexOf(targetId);
      arr.splice(si, 1); arr.splice(di, 0, src);
      return arr;
    });
    dragRowRef.current = null; setDragOverRow(null);
  };
  const onRowDragEnd = () => { dragRowRef.current = null; setDragOverRow(null); };

  // ── Cell Edit ─────────────────────────────────────────────────────────────
  const openEdit = useCallback((e, id, field, val) => {
    e.stopPropagation();
    if (isResizing.current) return;
    setEditCell({ id, field }); setEditVal(val ?? '');
  }, []);

  const commitEdit = useCallback(async (id, field, val) => {
    setEditCell(null);
    if (val == null) return;
    try { await updateDoc(doc(db, 'teamMembers', id), { [field]: val }); }
    catch (err) { console.error(err); }
  }, []);

  const onKeyDown = useCallback((e, id, field) => {
    if (e.key === 'Escape') { e.preventDefault(); setEditCell(null); return; }
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit(id, field, editVal); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(id, field, editVal);
      const editables = cols.filter(c => c.editable).map(c => c.key);
      const ri = filtered.findIndex(m => m.id === id);
      const ci = editables.indexOf(field);
      if (!e.shiftKey && ci < editables.length - 1) {
        const nf = editables[ci + 1];
        setTimeout(() => { setEditCell({ id, field: nf }); setEditVal(filtered[ri]?.[nf] ?? ''); }, 0);
      } else if (!e.shiftKey && ri < filtered.length - 1) {
        const nm = filtered[ri + 1];
        setTimeout(() => { setEditCell({ id: nm.id, field: editables[0] }); setEditVal(nm[editables[0]] ?? ''); }, 0);
      } else if (e.shiftKey && ci > 0) {
        const nf = editables[ci - 1];
        setTimeout(() => { setEditCell({ id, field: nf }); setEditVal(filtered[ri]?.[nf] ?? ''); }, 0);
      }
    }
  }, [cols, filtered, editVal, commitEdit]);

  // ── Render cell ───────────────────────────────────────────────────────────
  const renderCell = (col, member, idx) => {
    const isEditing = editCell?.id === member.id && editCell?.field === col.key;
    const inputCls  = 'w-full h-full px-3 text-[13px] bg-white outline-none border-0 text-gray-800 font-medium';
    const isChecked = selectedIds.has(member.id);

    if (isEditing) {
      if (col.key === 'role') return (
        <select autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
          onBlur={() => commitEdit(member.id, col.key, editVal)}
          onKeyDown={e => onKeyDown(e, member.id, col.key)}
          onClick={e => e.stopPropagation()}
          className={inputCls} style={{ height: '100%' }}>
          {ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
      );
      if (col.key === 'status') return (
        <select autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
          onBlur={() => commitEdit(member.id, col.key, editVal)}
          onKeyDown={e => onKeyDown(e, member.id, col.key)}
          onClick={e => e.stopPropagation()}
          className={inputCls} style={{ height: '100%' }}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      );
      return (
        <input autoFocus type="text" value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={() => commitEdit(member.id, col.key, editVal)}
          onKeyDown={e => onKeyDown(e, member.id, col.key)}
          onClick={e => e.stopPropagation()}
          className={inputCls}
          placeholder={`Enter ${col.label.toLowerCase()}...`}
        />
      );
    }

    switch (col.key) {
      case 'checkbox':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Checkbox checked={isChecked} onClick={e => toggleSelect(e, member.id)} />
          </div>
        );
      case 'rowdrag':
        return (
          <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing">
            <GripVertical size={14} className="text-gray-400" />
          </div>
        );
      case 'idx':
        return (
          <div className="flex items-center justify-center h-full">
            <span className="text-[11px] font-mono text-gray-400">{idx + 1}</span>
          </div>
        );
      case 'name':
        return (
          <div className="flex items-center gap-2.5 px-3 h-full">
            <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${getAvatarColor(member.id)} text-white text-[11px] font-bold shadow-sm`}>
              {getInitials(member.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{member.name || '—'}</p>
              <p className="text-[11px] text-gray-400 truncate flex items-center gap-1 mt-0.5">
                <Phone size={9} className="flex-shrink-0" />{member.phone || 'No phone'}
              </p>
            </div>
          </div>
        );
      case 'email':
        return (
          <div className="flex items-center gap-1.5 px-3 h-full min-w-0">
            <Mail size={11} className="text-gray-400 flex-shrink-0" />
            <span className="text-[12px] text-gray-600 truncate">{member.email || '—'}</span>
          </div>
        );
      case 'role': {
        const rc = roleColors[member.role] || defaultRoleColor;
        return (
          <div className="flex items-center px-3 h-full">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${rc.text} ${rc.bg} ${rc.border}`}>
              {member.role || '—'}
            </span>
          </div>
        );
      }
      case 'department':
        return (
          <div className="flex items-center px-3 h-full">
            <span className="text-[12px] text-gray-600 truncate">{member.department || '—'}</span>
          </div>
        );
      case 'status': {
        const sc = statusColors[member.status] || statusColors['Inactive'];
        return (
          <div className="flex items-center px-3 h-full">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${sc.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />{member.status || '—'}
            </span>
          </div>
        );
      }
      case 'actions':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <button
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                if (rowMenuId === member.id) {
                  setRowMenuId(null);
                  setRowMenuAnchor(null);
                } else {
                  setRowMenuId(member.id);
                  setRowMenuAnchor(e.currentTarget);
                }
              }}
              style={{
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <MoreVertical size={14} />
            </button>
          </div>
        );
      default: return null;
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin" />
    </div>
  );

  const totalW = cols.reduce((s, c) => s + c.width, 0);

  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <style>{`
        .xltable { border-collapse: collapse; table-layout: fixed; }
        .xltable th, .xltable td { padding: 0; }
        .resize-handle { position:absolute; right:0; top:0; bottom:0; width:5px; cursor:col-resize; z-index:10; display:flex; align-items:center; justify-content:center; }
        .resize-handle:hover .resize-bar, .resize-handle:active .resize-bar { background:#14b8a6; height:70%; opacity:1; }
        .resize-bar { width:2px; height:40%; background:rgba(0,0,0,0.15); border-radius:2px; transition:all .15s; opacity:0.6; }
        .col-over { background:rgba(20,184,166,0.05) !important; box-shadow: inset 2px 0 0 #14b8a6; }
        .row-over { box-shadow: inset 0 2px 0 #14b8a6; background:rgba(20,184,166,0.04) !important; }
        .cell-active { box-shadow: inset 0 0 0 2px #14b8a6; background:rgba(20,184,166,0.02) !important; }
        .th-draggable:hover { background:rgba(20,184,166,0.06); }
        .table-scroll-wrap { overflow-x: auto; width: 100%; -webkit-overflow-scrolling: touch; scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.15) transparent; }
        .table-scroll-wrap::-webkit-scrollbar { height: 5px; }
        .table-scroll-wrap::-webkit-scrollbar-track { background: transparent; }
        .table-scroll-wrap::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
        .xl-row { cursor: pointer; }
        .xl-row:hover .row-navigate-hint { opacity: 1 !important; }
        @keyframes fadeInScale { from { opacity:0; transform:scale(0.95) translateY(4px); } to { opacity:1; transform:scale(1) translateY(0); } }
      `}</style>

      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-[1600px] mx-auto space-y-4">

        {/* ── Toolbar ── */}
        <div className="bg-white rounded-2xl shadow-sm p-3 flex flex-wrap items-center gap-2" style={{ border: `1px solid ${TL}` }}>
          <div className="flex items-center gap-2 flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-[#EEF2F7]" style={{ border: `1px solid ${TL}` }}>
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, role..."
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none min-w-0"
            />
            {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>}
          </div>

          {roles.length > 1 && (
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="text-[12px] font-semibold px-2.5 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 outline-none cursor-pointer hover:border-teal-300 transition-colors flex-shrink-0">
              {roles.map(r => <option key={r}>{r}</option>)}
            </select>
          )}

          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EEF2F7] flex-shrink-0" style={{ border: `1px solid ${TL}` }}>
            <Users size={14} className="text-teal-500" />
            <span className="text-sm font-semibold text-gray-700">{members.length} Members</span>
          </div>

          <span className="text-xs text-gray-400 hidden sm:block flex-shrink-0">{filtered.length} of {members.length}</span>

          {selectionMode && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 border border-teal-200 flex-shrink-0">
              <span className="text-[12px] font-semibold text-teal-600">{selectedIds.size} selected</span>
              <button onClick={deselectAll} className="text-teal-400 hover:text-teal-600 ml-0.5"><X size={11} /></button>
            </div>
          )}

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setGlobalMenuOpen(prev => !prev)}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all
                ${globalMenuOpen ? 'bg-teal-50 border-teal-200 text-teal-600'
                  : 'bg-[#EEF2F7] border-transparent hover:border-gray-200 text-gray-500 hover:text-gray-700'}`}
            >
              <MoreHorizontal size={16} />
            </button>
            {globalMenuOpen && (
              <GlobalMenu
                filtered={filtered}
                selectedIds={selectedIds}
                selectionMode={selectionMode}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                onEnableSelection={enableSelection}
                onDeleteSelected={requestDeleteSelected}
                onClose={() => setGlobalMenuOpen(false)}
              />
            )}
          </div>
        </div>

        {/* ── Table Card ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
          <div className="flex items-center gap-2 px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${TL}` }}>
            <BarChart2 size={15} className="text-teal-500" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">All Members</h2>
            <span className="ml-auto text-xs text-gray-400">{filtered.length} records</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="flex justify-center mb-3"><User size={36} className="text-gray-300" /></div>
              <p className="text-gray-500 font-semibold">No members found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* ─── MOBILE ─── */}
              <div className="md:hidden">
                {filtered.map((member, idx) => {
                  const sc = statusColors[member.status] || statusColors['Inactive'];
                  const rc = roleColors[member.role] || defaultRoleColor;
                  const isChecked = selectedIds.has(member.id);
                  return (
                    <div key={member.id}
                      onClick={() => handleMobileTap(member.id)}
                      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors active:bg-teal-50/60 hover:bg-teal-50/40
                        ${isChecked ? 'bg-teal-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                      style={{ borderBottom: `1px solid ${TL}` }}
                    >
                      {selectionMode && (
                        <Checkbox checked={isChecked} onClick={e => toggleSelect(e, member.id)} />
                      )}
                      <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${getAvatarColor(member.id)} text-white text-[13px] font-bold shadow-sm`}>
                        {getInitials(member.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-semibold text-gray-900">{member.name || '—'}</p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rc.text} ${rc.bg} ${rc.border}`}>{member.role || '—'}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate flex items-center gap-1">
                          <Mail size={9} />{member.email || '—'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{member.status}
                          </span>
                          {member.department && (
                            <><span className="text-gray-200">·</span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <Building2 size={9} />{member.department}
                            </span></>
                          )}
                        </div>
                      </div>
                      <button
                        onMouseDown={e => {
                          e.preventDefault(); e.stopPropagation();
                          if (rowMenuId === member.id) { setRowMenuId(null); setRowMenuAnchor(null); }
                          else { setRowMenuId(member.id); setRowMenuAnchor(e.currentTarget); }
                        }}
                        style={{
                          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', flexShrink: 0,
                        }}
                      >
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* ─── DESKTOP TABLE ─── */}
              <div className="hidden md:block table-scroll-wrap">
                <table className="xltable" style={{ width: totalW + 'px', minWidth: '100%' }}>
                  <colgroup>
                    {cols.map(col => <col key={col.key} style={{ width: col.width + 'px' }} />)}
                  </colgroup>
                  <thead>
                    <tr style={{ background: '#EEF2F7', borderBottom: `2px solid ${TLB}` }}>
                      {cols.map((col, ci) => {
                        const canDrag = !col.fixed;
                        const isOver  = dragOverCol === col.key;

                        if (col.key === 'checkbox') return (
                          <th key={col.key} style={{ height: 40, position: 'relative', borderRight: `1px solid ${TL}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'pointer' }}>
                              <Checkbox
                                checked={allSelected}
                                indeterminate={someSelected}
                                onClick={() => allSelected ? deselectAll() : selectAll()}
                              />
                            </div>
                          </th>
                        );

                        return (
                          <th key={col.key}
                            draggable={canDrag}
                            onDragStart={canDrag ? e => onColDragStart(e, col.key) : undefined}
                            onDragOver={canDrag  ? e => onColDragOver(e, col.key)  : undefined}
                            onDrop={canDrag      ? e => onColDrop(e, col.key)      : undefined}
                            onDragEnd={canDrag   ? onColDragEnd                    : undefined}
                            className={`th-draggable ${isOver ? 'col-over' : ''}`}
                            style={{
                              height: 40, position: 'relative', userSelect: 'none',
                              borderRight: ci < cols.length - 1 ? `1px solid ${TL}` : undefined,
                              cursor: canDrag ? 'grab' : 'default',
                            }}
                          >
                            <div className="flex items-center h-full px-3 gap-1.5">
                              {canDrag && <span className="text-gray-300 text-[10px] select-none">⠿</span>}
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider truncate">{col.label}</span>
                            </div>
                            {col.key !== 'actions' && col.key !== 'rowdrag' && col.key !== 'checkbox' && (
                              <div className="resize-handle" onMouseDown={e => startResize(e, col.key)}>
                                <div className="resize-bar" />
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((member, idx) => {
                      const isSelected = selectedRow === member.id;
                      const isChecked  = selectedIds.has(member.id);
                      const isRowOver  = dragOverRow === member.id;
                      const hasEdit    = editCell?.id === member.id;
                      return (
                        <tr key={member.id}
                          draggable
                          onDragStart={e => onRowDragStart(e, member.id)}
                          onDragOver={e  => onRowDragOver(e, member.id)}
                          onDrop={e      => onRowDrop(e, member.id)}
                          onDragEnd={onRowDragEnd}
                          onClick={(e) => {
                            // Don't navigate if clicking a cell that's being edited, or if resizing
                            if (isResizing.current) return;
                            if (editCell) return;
                            setSelectedRow(member.id);
                            navigate(`/userdetails/${member.id}`);
                          }}
                          className={`xl-row group transition-colors duration-75
                            ${isRowOver ? 'row-over' : ''}
                            ${isChecked ? 'bg-teal-50/50' : isSelected ? 'bg-teal-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                            ${!hasEdit  ? 'hover:bg-teal-50/30' : ''}`}
                          style={{ borderBottom: `1px solid ${TL}` }}
                        >
                          {cols.map((col, ci) => {
                            const isCellActive = editCell?.id === member.id && editCell?.field === col.key;
                            return (
                              <td key={col.key}
                                onDoubleClick={col.editable ? e => { e.stopPropagation(); openEdit(e, member.id, col.key, member[col.key]); } : undefined}
                                onClick={col.editable && editCell?.id === member.id ? e => openEdit(e, member.id, col.key, member[col.key]) : e => e.stopPropagation()}
                                className={isCellActive ? 'cell-active' : ''}
                                style={{
                                  height: 56, overflow: 'hidden', position: 'relative',
                                  borderRight: ci < cols.length - 1 ? `1px solid ${TL}` : undefined,
                                }}
                              >
                                {renderCell(col, member, idx)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 pb-2">
          Showing {filtered.length} of {members.length} members
        </p>
      </div>

      {/* ── Portal Row Menu ── */}
      {rowMenuId && rowMenuAnchor && (
        <RowMenu
          anchorEl={rowMenuAnchor}
          onView={() => navigate(`/userdetails/${rowMenuId}`)}
          onDelete={() => {
            const member = members.find(m => m.id === rowMenuId);
            if (member) requestDeleteSingle(member);
          }}
          onClose={() => { setRowMenuId(null); setRowMenuAnchor(null); }}
        />
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <DeleteConfirmModal
          members={deleteTarget.members}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default UsersRecord;