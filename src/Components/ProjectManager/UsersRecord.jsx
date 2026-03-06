// UsersRecord.jsx – Excel-like Interactive Team Members Table
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, ChevronRight, BarChart2,
  Mail, Phone, X, Building2, User, GripVertical
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

const INIT_COLS = [
  { key: 'rowdrag',    label: '',           width: 36,  fixed: true  },
  { key: 'idx',        label: '#',          width: 48,  fixed: true  },
  { key: 'name',       label: 'Member',     width: 220, editable: true },
  { key: 'email',      label: 'Email',      width: 220, editable: true },
  { key: 'role',       label: 'Role',       width: 180, editable: true },
  { key: 'department', label: 'Department', width: 155, editable: true },
  { key: 'status',     label: 'Status',     width: 125, editable: true },
  { key: 'actions',    label: '',           width: 48,  fixed: true  },
];

const UsersRecord = () => {
  const navigate = useNavigate();
  const [members,    setMembers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const [cols,        setCols]        = useState(INIT_COLS);
  const [rowOrder,    setRowOrder]    = useState([]);
  const [editCell,    setEditCell]    = useState(null);
  const [editVal,     setEditVal]     = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  const dragColRef   = useRef(null);
  const dragRowRef   = useRef(null);
  const isResizing   = useRef(false);
  const lastTapRef   = useRef({ id: null, time: 0 });
  const [dragOverCol, setDragOverCol] = useState(null);
  const [dragOverRow, setDragOverRow] = useState(null);

  // Mobile double-tap handler (300ms window)
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

  // ── Column DnD ────────────────────────────────────────────────────────────
  const onColDragStart = (e, key) => { dragColRef.current = key; e.dataTransfer.effectAllowed = 'move'; };
  const onColDragOver  = (e, key) => {
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

  // ── Row DnD ───────────────────────────────────────────────────────────────
  const onRowDragStart = (e, id) => { dragRowRef.current = id; e.dataTransfer.effectAllowed = 'move'; };
  const onRowDragOver  = (e, id) => { e.preventDefault(); if (dragRowRef.current && dragRowRef.current !== id) setDragOverRow(id); };
  const onRowDrop = (e, targetId) => {
    e.preventDefault();
    const src = dragRowRef.current;
    if (!src || src === targetId) { dragRowRef.current = null; setDragOverRow(null); return; }
    setRowOrder(prev => {
      const arr = [...prev];
      const si  = arr.indexOf(src);
      const di  = arr.indexOf(targetId);
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
          <div className="flex items-center justify-center h-full">
            <button onClick={e => { e.stopPropagation(); navigate(`/userdetails/${member.id}`); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-teal-50 transition-colors">
              <ChevronRight size={14} className="text-gray-300 hover:text-teal-500 transition-colors" />
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
      `}</style>

      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-[1600px] mx-auto space-y-4">

        {/* ── Toolbar ── */}
        <div
          className="bg-white rounded-2xl shadow-sm p-3 flex flex-wrap items-center gap-2"
          style={{ border: `1px solid ${TL}` }}
        >
          {/* Search */}
          <div
            className="flex items-center gap-2 flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-[#EEF2F7]"
            style={{ border: `1px solid ${TL}` }}
          >
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, role..."
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none min-w-0"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Role filter */}
          {roles.length > 1 && (
            <select
              value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="text-[12px] font-semibold px-2.5 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 outline-none cursor-pointer hover:border-teal-300 transition-colors flex-shrink-0"
            >
              {roles.map(r => <option key={r}>{r}</option>)}
            </select>
          )}

          {/* Member count */}
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EEF2F7] flex-shrink-0"
            style={{ border: `1px solid ${TL}` }}
          >
            <Users size={14} className="text-teal-500" />
            <span className="text-sm font-semibold text-gray-700">{members.length} Members</span>
          </div>

          <span className="text-xs text-gray-400 hidden sm:block flex-shrink-0">
            {filtered.length} of {members.length}
          </span>
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
              {/* ─── MOBILE cards (< md) ─── */}
              <div className="md:hidden">
                {filtered.map((member, idx) => {
                  const sc = statusColors[member.status] || statusColors['Inactive'];
                  const rc = roleColors[member.role] || defaultRoleColor;
                  return (
                    <div
                      key={member.id}
                      onClick={() => handleMobileTap(member.id)}
                      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors active:bg-teal-50/60 hover:bg-teal-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                      style={{ borderBottom: `1px solid ${TL}` }}
                    >
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
                            <>
                              <span className="text-gray-200">·</span>
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                <Building2 size={9} />{member.department}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>

              {/* ─── DESKTOP EXCEL TABLE (≥ md) ─── */}
              <div className="hidden md:block table-scroll-wrap">
                <table
                  className="xltable"
                  style={{ width: totalW + 'px', minWidth: '100%' }}
                >
                  <colgroup>
                    {cols.map(col => <col key={col.key} style={{ width: col.width + 'px' }} />)}
                  </colgroup>

                  {/* THEAD */}
                  <thead>
                    <tr style={{ background: '#EEF2F7', borderBottom: `2px solid ${TLB}` }}>
                      {cols.map((col, ci) => {
                        const canDrag = !col.fixed;
                        const isOver  = dragOverCol === col.key;
                        return (
                          <th
                            key={col.key}
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
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider truncate">
                                {col.label}
                              </span>
                            </div>
                            {col.key !== 'actions' && col.key !== 'rowdrag' && (
                              <div className="resize-handle" onMouseDown={e => startResize(e, col.key)}>
                                <div className="resize-bar" />
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* TBODY */}
                  <tbody>
                    {filtered.map((member, idx) => {
                      const isSelected = selectedRow === member.id;
                      const isRowOver  = dragOverRow === member.id;
                      const hasEdit    = editCell?.id === member.id;
                      return (
                        <tr
                          key={member.id}
                          draggable
                          onDragStart={e => onRowDragStart(e, member.id)}
                          onDragOver={e  => onRowDragOver(e, member.id)}
                          onDrop={e      => onRowDrop(e, member.id)}
                          onDragEnd={onRowDragEnd}
                          onClick={() => setSelectedRow(member.id)}
                          className={`group transition-colors duration-75
                            ${isRowOver  ? 'row-over' : ''}
                            ${isSelected ? 'bg-teal-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                            ${!hasEdit   ? 'hover:bg-teal-50/20' : ''}`}
                          style={{ borderBottom: `1px solid ${TL}` }}
                        >
                          {cols.map((col, ci) => {
                            const isCellActive = editCell?.id === member.id && editCell?.field === col.key;
                            return (
                              <td
                                key={col.key}
                                onDoubleClick={col.editable ? e => openEdit(e, member.id, col.key, member[col.key]) : undefined}
                                onClick={col.editable && editCell?.id === member.id
                                  ? e => openEdit(e, member.id, col.key, member[col.key]) : undefined}
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
    </div>
  );
};

export default UsersRecord;