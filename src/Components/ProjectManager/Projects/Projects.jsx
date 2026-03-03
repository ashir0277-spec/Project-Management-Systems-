import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from '../../firebase';
import { Loader, Trash2, Columns, X, Users } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

const TABLE_LINE      = 'rgba(51,51,51,0.20)';
const TABLE_LINE_BOLD = 'rgba(51,51,51,0.30)';
const AVATAR_COLORS   = ['#7B90A4','#8FA3AC','#7A9BAA','#909AAB','#8A9FAD','#8496A8'];

const STATUS_OPTIONS = [
  { value: 'In Progress',                 text: 'text-blue-700',    dot: 'bg-blue-500'    },
  { value: 'Completed',                   text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { value: 'Testing Required',            text: 'text-violet-700',  dot: 'bg-violet-500'  },
  { value: 'On Hold',                     text: 'text-amber-700',   dot: 'bg-amber-500'   },
  { value: 'Waiting for Client Response', text: 'text-rose-700',    dot: 'bg-rose-500'    },
];
const getStatusStyle = (s) =>
  STATUS_OPTIONS.find(o => o.value === s) ?? { text: 'text-slate-600', dot: 'bg-slate-400' };
const getPriorityStyle = (p) => {
  if (p === 'High')   return { text: 'text-red-600',     dot: 'bg-red-500'     };
  if (p === 'Medium') return { text: 'text-amber-600',   dot: 'bg-amber-500'   };
  return                     { text: 'text-emerald-600', dot: 'bg-emerald-500' };
};

const COLUMN_DEFS = [
  { key: 'index',       label: '#',            defaultW: 44,  minW: 40,  align: 'center', hideable: false },
  { key: 'name',        label: 'Project Name', defaultW: 160, minW: 80,  align: 'left',   hideable: false },
  { key: 'description', label: 'Description',  defaultW: 200, minW: 80,  align: 'left',   hideable: true  },
  { key: 'startDate',   label: 'Start Date',   defaultW: 110, minW: 80,  align: 'center', hideable: true  },
  { key: 'deadline',    label: 'End Date',     defaultW: 110, minW: 80,  align: 'center', hideable: true  },
  { key: 'status',      label: 'Status',       defaultW: 175, minW: 100, align: 'center', hideable: true  },
  { key: 'priority',    label: 'Priority',     defaultW: 100, minW: 70,  align: 'center', hideable: true  },
  { key: 'progress',    label: 'Progress',     defaultW: 130, minW: 80,  align: 'center', hideable: true  },
  { key: 'team',        label: 'Assigned To',  defaultW: 160, minW: 80,  align: 'left',   hideable: true  },
  { key: 'actions',     label: '',             defaultW: 52,  minW: 52,  align: 'center', hideable: false },
];

// ── Build widths as ratios (0–1) not px ──────────────────────────────────────
// We store proportional ratios so the table always fills 100% of its container.
// Actual px = ratio * containerWidth, computed at render time.
const TOTAL_DEFAULT = COLUMN_DEFS.reduce((s, c) => s + c.defaultW, 0);
const buildDefaultRatios = () => {
  const m = {};
  COLUMN_DEFS.forEach(c => { m[c.key] = c.defaultW / TOTAL_DEFAULT; });
  return m;
};

const Projects = () => {
  const { showAddProjectModal, setShowAddProjectModal } = useOutletContext();

  const [filter, setFilter]         = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [projectList, setProjectList] = useState([]);
  const [allMembers, setAllMembers] = useState([]);

  // ── Column ratios (proportional, always sum to 1 across visible cols) ───────
  const [colRatios, setColRatios]   = useState(buildDefaultRatios);
  // containerW is measured once on mount & on resize
  const [containerW, setContainerW] = useState(1000);
  const [hiddenCols, setHiddenCols] = useState(new Set());
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef  = useRef(null);
  const tableWrapRef = useRef(null); // ref to the scroll container

  // ── Resize state ──────────────────────────────────────────────────────────
  const resizeState = useRef(null); // { colKey, startX, startW, nextKey, startNextW }

  // ── Description expand ───────────────────────────────────────────────────
  const [expandedDesc, setExpandedDesc] = useState(null);

  // ── Inline edit ───────────────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState(null);
  const editValueRef  = useRef('');
  const [editDisplay, setEditDisplay] = useState('');
  const cellInputRef  = useRef(null);

  // ── 3-dot menu ────────────────────────────────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos]       = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Team dropdown ─────────────────────────────────────────────────────────
  const [teamInput, setTeamInput]       = useState('');
  const [showTeamDrop, setShowTeamDrop] = useState(false);
  const [sessionMembers, setSessionMembers] = useState([]);
  const teamDropRef  = useRef(null);
  const teamInputRef = useRef(null);
  const teamBoxRef   = useRef(null); // the tag-input box

  const [newProject, setNewProject] = useState({
    name: '', description: '', status: 'In Progress', priority: 'Medium',
    deadline: '', team: [], totalTasks: '', startDate: '',
  });

  // ── Drag reorder ──────────────────────────────────────────────────────────
  const dragItem     = useRef(null);
  const dragOverItem = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [localOrder, setLocalOrder]   = useState([]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (showAddProjectModal) { setShowModal(true); setShowAddProjectModal(false); }
  }, [showAddProjectModal]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current    && !menuRef.current.contains(e.target))    setOpenMenuId(null);
      if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false);
      if (teamDropRef.current && !teamDropRef.current.contains(e.target)) setShowTeamDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjectList(data);
      const members = new Set();
      data.forEach(p => (p.team || []).forEach(m => m && members.add(m.trim())));
      setAllMembers([...members].sort());
    }, console.error);
    return () => unsub();
  }, []);

  useEffect(() => {
    setLocalOrder(prev => {
      const existing = prev.filter(id => projectList.some(p => p.id === id));
      const added    = projectList.map(p => p.id).filter(id => !existing.includes(id));
      return [...existing, ...added];
    });
  }, [projectList]);

  // ── Measure container width ───────────────────────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (tableWrapRef.current) setContainerW(tableWrapRef.current.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (tableWrapRef.current) ro.observe(tableWrapRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Derived px widths (ratio * containerW) ───────────────────────────────
  const colWidths = {};
  COLUMN_DEFS.forEach(c => { colWidths[c.key] = colRatios[c.key] * containerW; });

  // ── Column resize (ratio-based, neighbours swap) ──────────────────────────
  const onResizeMouseDown = useCallback((e, colKey) => {
    e.preventDefault(); e.stopPropagation();
    const visCols = COLUMN_DEFS.filter(c => !hiddenCols.has(c.key));
    const idx     = visCols.findIndex(c => c.key === colKey);
    const nextCol = visCols[idx + 1];
    if (!nextCol) return;

    const cW = tableWrapRef.current?.clientWidth || containerW;

    resizeState.current = {
      colKey, nextKey: nextCol.key,
      startX:      e.clientX,
      startRatio:  colRatios[colKey],
      startNRatio: colRatios[nextCol.key],
      cW,
    };

    const colDef  = COLUMN_DEFS.find(c => c.key === colKey);
    const nextDef = COLUMN_DEFS.find(c => c.key === nextCol.key);

    const onMove = (ev) => {
      if (!resizeState.current) return;
      const { colKey, nextKey, startX, startRatio, startNRatio, cW } = resizeState.current;
      const delta      = (ev.clientX - startX) / cW;        // delta as ratio
      const minR       = colDef.minW  / cW;
      const minNR      = nextDef.minW / cW;
      let newR  = Math.max(minR,  startRatio  + delta);
      let newNR = Math.max(minNR, startNRatio - delta);
      // clamp both
      if (newR  < minR)  { newR  = minR;  newNR = startRatio + startNRatio - minR;  }
      if (newNR < minNR) { newNR = minNR; newR  = startRatio + startNRatio - minNR; }
      setColRatios(prev => ({ ...prev, [colKey]: newR, [nextKey]: newNR }));
    };

    const onUp = () => {
      resizeState.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [colRatios, hiddenCols, containerW]);

  // ── Tabs / filter ─────────────────────────────────────────────────────────
  const TABS = [
    { key: 'all', label: 'All Projects' },
    ...STATUS_OPTIONS.map(s => ({ key: s.value, label: s.value })),
  ];

  const displayProjects = localOrder
    .map(id => projectList.find(p => p.id === id))
    .filter(Boolean)
    .filter(p => filter === 'all' || p.status === filter)
    .filter(p =>
      !searchQuery ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const countFor = (key) =>
    key === 'all' ? projectList.length : projectList.filter(p => p.status === key).length;

  // ── Visible columns ───────────────────────────────────────────────────────
  const visibleCols = COLUMN_DEFS.filter(c => !hiddenCols.has(c.key));
  const toggleCol   = (key) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        // show: give its width back to previous visible col
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e, idx) => {
    dragItem.current = idx; e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if (e.target) e.target.style.opacity = '0.4'; }, 0);
  };
  const handleDragEnter = (e, idx) => { e.preventDefault(); dragOverItem.current = idx; setDragOverIdx(idx); };
  const handleDragOver  = (e, idx) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    if (dragOverItem.current !== idx) { dragOverItem.current = idx; setDragOverIdx(idx); }
  };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    const from = dragItem.current, to = dragOverItem.current ?? idx;
    if (from === null || to === null || from === to) { setDragOverIdx(null); return; }
    const reordered = [...displayProjects];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setLocalOrder([...reordered.map(p => p.id), ...localOrder.filter(id => !displayProjects.some(p => p.id === id))]);
    dragItem.current = null; dragOverItem.current = null; setDragOverIdx(null);
  };
  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    dragItem.current = null; dragOverItem.current = null; setDragOverIdx(null);
  };

  // ── Inline edit ───────────────────────────────────────────────────────────
  const getFieldValue = (project, field) => {
    if (field === 'name')        return project.name        || '';
    if (field === 'description') return project.description || '';
    if (field === 'startDate')   return project.startDate   || project.createdAt?.slice(0,10) || '';
    if (field === 'deadline')    return project.deadline    || '';
    if (field === 'status')      return project.status      || 'In Progress';
    if (field === 'priority')    return project.priority    || 'Medium';
    if (field === 'progress')    return String(project.progress ?? 0);
    if (field === 'team')        return Array.isArray(project.team) ? project.team.join(', ') : '';
    return '';
  };
  const startEdit = (e, project, field) => {
    e.stopPropagation();
    if (editingCell?.projectId === project.id && editingCell?.field === field) return;
    if (editingCell) doCommit(editingCell.projectId, editingCell.field, editValueRef.current);
    const val = getFieldValue(project, field);
    editValueRef.current = val; setEditDisplay(val);
    setEditingCell({ projectId: project.id, field });
    setTimeout(() => { cellInputRef.current?.focus(); cellInputRef.current?.select(); }, 30);
  };
  const doCommit = useCallback(async (projectId, field, value) => {
    const project = projectList.find(p => p.id === projectId);
    if (!project) return;
    let u = {};
    if (field === 'name')        u = { name: value.trim() };
    if (field === 'description') u = { description: value.trim() };
    if (field === 'startDate')   u = { startDate: value };
    if (field === 'deadline')    u = { deadline: value };
    if (field === 'status')      u = { status: value };
    if (field === 'priority')    u = { priority: value };
    if (field === 'progress')    u = { progress: Math.min(100, Math.max(0, parseInt(value) || 0)) };
    if (field === 'team')        u = { team: value.split(',').map(m => m.trim()).filter(Boolean) };
    if (!Object.keys(u).length) return;
    try { await updateDoc(doc(db, 'projects', projectId), { ...u, updatedAt: new Date().toISOString() }); }
    catch (err) { console.error(err); }
  }, [projectList]);
  const commitEdit = () => {
    if (!editingCell) return;
    doCommit(editingCell.projectId, editingCell.field, editValueRef.current);
    setEditingCell(null); setEditDisplay(''); editValueRef.current = '';
  };
  const cancelEdit = () => { setEditingCell(null); setEditDisplay(''); editValueRef.current = ''; };
  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  };
  const handleValueChange = (val) => { editValueRef.current = val; setEditDisplay(val); };
  const isEditing = (project, field) => editingCell?.projectId === project.id && editingCell?.field === field;

  // ── Delete ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteDoc(doc(db, 'projects', deleteTarget.id)); }
    catch { alert('Error deleting.'); }
    setDeleteTarget(null);
  };

  // ── Team dropdown ─────────────────────────────────────────────────────────
  const memberPool = [...new Set([...allMembers, ...sessionMembers, ...newProject.team])].sort();
  const filteredPool = memberPool.filter(m =>
    m.toLowerCase().includes(teamInput.toLowerCase()) && !newProject.team.includes(m)
  );
  const selectMember = (name) => {
    setNewProject(prev => ({ ...prev, team: [...prev.team, name] }));
    setTeamInput(''); teamInputRef.current?.focus();
  };
  const addNewMember = () => {
    const name = teamInput.trim(); if (!name) return;
    if (!newProject.team.includes(name)) {
      setNewProject(prev => ({ ...prev, team: [...prev.team, name] }));
      setSessionMembers(prev => prev.includes(name) ? prev : [...prev, name]);
    }
    setTeamInput(''); teamInputRef.current?.focus();
  };
  const removeMember = (name) => setNewProject(prev => ({ ...prev, team: prev.team.filter(m => m !== name) }));
  const handleTeamKeyDown = (e) => {
    if (e.key === 'Enter')     { e.preventDefault(); addNewMember(); }
    if (e.key === 'Escape')    setShowTeamDrop(false);
    if (e.key === 'Backspace' && !teamInput && newProject.team.length > 0)
      removeMember(newProject.team[newProject.team.length - 1]);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleInputChange = (e) => setNewProject(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newProject.team.length === 0) { alert('Please assign at least one team member.'); return; }
    try {
      await addDoc(collection(db, 'projects'), {
        name: newProject.name, description: newProject.description,
        status: newProject.status, priority: newProject.priority, progress: 0,
        deadline: newProject.deadline, startDate: newProject.startDate || '',
        team: newProject.team, tasks: { total: parseInt(newProject.totalTasks) || 0, completed: 0 },
        createdAt: new Date().toISOString(),
      });
      setNewProject({ name:'', description:'', status:'In Progress', priority:'Medium', deadline:'', team:[], totalTasks:'', startDate:'' });
      setTeamInput(''); setSessionMembers([]); setShowModal(false);
    } catch { alert('Error creating project.'); }
  };

  // ── Style helpers ─────────────────────────────────────────────────────────
  const inputCls = 'w-full px-4 py-3 rounded-lg text-gray-800 placeholder-gray-400 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all duration-200';
  const inlineInputCls = 'w-full border-none outline-none bg-transparent text-gray-900 p-0 text-sm font-medium';

  const inner = (justify = 'flex-start') => ({
    display: 'flex', alignItems: 'center', justifyContent: justify,
    height: '100%', padding: '0 12px', overflow: 'hidden',
  });

  const makeTd = (field, colIdx, editing, isDragOver) => ({
    position: 'relative',
    height: '62px', padding: 0, verticalAlign: 'middle',
    cursor: field ? 'cell' : 'default',
    borderRight: colIdx < visibleCols.length - 1 ? `1px solid ${TABLE_LINE}` : undefined,
    borderBottom: `1px solid ${TABLE_LINE}`,
    outline: editing ? '2px solid #14b8a6' : isDragOver ? '2px solid #14b8a6' : undefined,
    outlineOffset: editing ? '-2px' : undefined,
    backgroundColor: editing ? 'rgba(20,184,166,0.06)' : undefined,
    transition: 'background 0.1s',
    overflow: 'hidden',
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <div className="p-4 md:p-6 space-y-5">

        {/* TOOLBAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

          {/* TABS */}
          <div className="flex gap-1 rounded-xl p-1 bg-white shadow-sm overflow-x-auto flex-shrink-0"
            style={{ border:`1px solid ${TABLE_LINE}`, scrollbarWidth:'none' }}>
            {TABS.map(tab => {
              const active = filter === tab.key;
              return (
                <button key={tab.key} onClick={() => setFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                    ${active ? 'bg-teal-500 text-white shadow' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
                  {tab.label}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none
                    ${active ? 'bg-white/25 text-white' : 'bg-[#EEF2F7] text-gray-500'}`}>
                    {countFor(tab.key)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="pl-9 pr-4 py-2.5 rounded-xl bg-white text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm w-56"
                style={{ border:`1px solid ${TABLE_LINE}` }}/>
            </div>

            {/* Columns button */}
            <div className="relative" ref={colMenuRef}>
              <button onClick={() => setShowColMenu(v => !v)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-all whitespace-nowrap"
                style={{ border:`1px solid ${TABLE_LINE}` }}>
                <Columns size={15}/> Columns
                {hiddenCols.size > 0 && <span className="bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{hiddenCols.size}</span>}
              </button>
              {showColMenu && (
                <div className="absolute right-0 top-full mt-2 z-[999] bg-white rounded-xl shadow-xl p-2 min-w-[190px]"
                  style={{ border:`1px solid ${TABLE_LINE}`, boxShadow:'0 10px 30px rgba(0,0,0,0.12)' }}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1 mb-1">Toggle Columns</p>
                  {COLUMN_DEFS.filter(c => c.hideable).map(col => (
                    <button key={col.key} onClick={() => toggleCol(col.key)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-700 hover:bg-gray-50 transition-colors">
                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all
                        ${hiddenCols.has(col.key) ? 'border-gray-300 bg-white' : 'border-teal-500 bg-teal-500'}`}>
                        {!hiddenCols.has(col.key) && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      {col.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TABLE — fixed layout, no overflow-x so large screens stay clean */}
        <div className="bg-white rounded-2xl shadow-sm w-full" style={{ border:`1px solid ${TABLE_LINE}`, overflow:'hidden' }}>
          <div ref={tableWrapRef}
            style={{ overflowX:'auto', overflowY:'auto', maxHeight:'calc(100vh - 230px)', WebkitOverflowScrolling:'touch' }}>
            <style>{`
              .proj-tbl-wrap { scrollbar-width:thin; scrollbar-color:rgba(20,184,166,0.4) transparent; }
              .proj-tbl-wrap::-webkit-scrollbar { height:5px; width:5px; }
              .proj-tbl-wrap::-webkit-scrollbar-thumb { background:rgba(20,184,166,0.4); border-radius:999px; }
              .proj-tbl-wrap::-webkit-scrollbar-thumb:hover { background:rgba(20,184,166,0.75); }
              .col-resize-handle { position:absolute; right:0; top:0; height:100%; width:6px; cursor:col-resize; z-index:20; }
              .col-resize-handle:hover, .col-resize-handle:active { background:rgba(20,184,166,0.35); }
            `}</style>

            {/*
              width:100% → table always fills the wrapper, no horizontal scroll.
              tableLayout:fixed + explicit col widths → browser distributes
              proportionally. Resize handle swaps px between neighbours so
              total stays constant.
            */}
            <table className="proj-tbl-wrap border-collapse"
              style={{ tableLayout:'fixed', width:'100%' }}>
              <colgroup>
                {visibleCols.map(c => <col key={c.key} style={{ width:`${colWidths[c.key]}px` }}/>)}
              </colgroup>

              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EEF2F7]" style={{ borderBottom:`2px solid ${TABLE_LINE_BOLD}` }}>
                  {visibleCols.map((col, i) => (
                    <th key={col.key}
                      style={{
                        position:'relative', textAlign:col.align, width:`${colWidths[col.key]}px`,
                        borderRight: i < visibleCols.length-1 ? `1px solid ${TABLE_LINE}` : undefined,
                        padding:'14px 12px', overflow:'hidden',
                      }}
                      className="text-xs font-semibold text-gray-600 uppercase tracking-wider select-none whitespace-nowrap">
                      {col.label}
                      {/* Resize handle — not on last column */}
                      {i < visibleCols.length - 1 && (
                        <span
                          className="col-resize-handle"
                          onMouseDown={e => onResizeMouseDown(e, col.key)}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {displayProjects.length === 0 && (
                  <tr>
                    <td colSpan={visibleCols.length} className="py-20 text-center">
                      <div className="flex justify-center mb-3"><Loader className="text-gray-300"/></div>
                      <p className="text-gray-400 text-sm">{filter==='all'?'No projects yet':`No "${filter}" projects`}</p>
                    </td>
                  </tr>
                )}

                {displayProjects.map((project, idx) => {
                  const isDragOver = dragOverIdx === idx && dragItem.current !== idx;
                  const rowBg      = idx % 2 === 0 ? 'bg-white' : '';
                  const ed         = (f) => isEditing(project, f);
                  const sCfg       = getStatusStyle(project.status);
                  const pCfg       = getPriorityStyle(project.priority);

                  const renderCell = (col, ci) => {
                    const tdS = makeTd(!['index','actions'].includes(col.key)?col.key:null, ci, ed(col.key), isDragOver);

                    if (col.key === 'index') return (
                      <td key={col.key} style={{ ...tdS, cursor:'grab' }}>
                        <div style={inner('center')}><span className="text-xs font-bold font-mono text-gray-300">{idx+1}</span></div>
                      </td>
                    );

                    if (col.key === 'name') return (
                      <td key={col.key} style={tdS} onClick={e=>startEdit(e,project,'name')}>
                        <div style={inner()}>
                          {ed('name')
                            ? <input ref={cellInputRef} value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} font-semibold text-[14px]`}/>
                            : <p className="text-[14px] font-semibold text-gray-900 truncate w-full" title={project.name}>{project.name}</p>}
                        </div>
                      </td>
                    );

                    if (col.key === 'description') return (
                      <td key={col.key} style={tdS}
                        onClick={e => startEdit(e, project, 'description')}
                        onDoubleClick={e => { e.stopPropagation(); if (project.description) setExpandedDesc({ name:project.name, description:project.description }); }}>
                        <div style={inner()}>
                          {ed('description')
                            ? <input ref={cellInputRef} value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} placeholder="Add description..." className={`${inlineInputCls} text-[13px]`}/>
                            : <p className="text-[12px] text-gray-500 truncate w-full" title={project.description}>
                                {project.description || <span className="text-gray-300 italic">No description</span>}
                              </p>}
                        </div>
                      </td>
                    );

                    if (col.key === 'startDate') return (
                      <td key={col.key} style={tdS} onClick={e=>startEdit(e,project,'startDate')}>
                        <div style={inner('center')}>
                          {ed('startDate')
                            ? <input ref={cellInputRef} type="date" value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} font-mono text-[12px]`}/>
                            : <span className="text-[12px] font-mono text-gray-900 whitespace-nowrap">{project.startDate||project.createdAt?.slice(0,10)||'—'}</span>}
                        </div>
                      </td>
                    );

                    if (col.key === 'deadline') return (
                      <td key={col.key} style={tdS} onClick={e=>startEdit(e,project,'deadline')}>
                        <div style={inner('center')}>
                          {ed('deadline')
                            ? <input ref={cellInputRef} type="date" value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} font-mono text-[12px]`}/>
                            : <span className="text-[12px] font-mono text-gray-900 whitespace-nowrap">{project.deadline||'—'}</span>}
                        </div>
                      </td>
                    );

                    if (col.key === 'status') return (
                      <td key={col.key} style={tdS} onClick={e=>startEdit(e,project,'status')}>
                        <div style={inner('center')}>
                          {ed('status')
                            ? <select ref={cellInputRef} value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} cursor-pointer text-[12px]`}>
                                {STATUS_OPTIONS.map(o=><option key={o.value}>{o.value}</option>)}
                              </select>
                            : <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${sCfg.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sCfg.dot}`}/>{project.status}
                              </span>}
                        </div>
                      </td>
                    );

                    if (col.key === 'priority') return (
                      <td key={col.key} style={tdS} onClick={e=>startEdit(e,project,'priority')}>
                        <div style={inner('center')}>
                          {ed('priority')
                            ? <select ref={cellInputRef} value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} cursor-pointer text-[13px]`}>
                                <option>Low</option><option>Medium</option><option>High</option>
                              </select>
                            : <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${pCfg.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pCfg.dot}`}/>{project.priority}
                              </span>}
                        </div>
                      </td>
                    );

                    if (col.key === 'progress') return (
                      <td key={col.key} style={tdS} onClick={e=>startEdit(e,project,'progress')}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', padding:'0 12px', gap:'8px', overflow:'hidden' }}>
                          {ed('progress')
                            ? <input ref={cellInputRef} type="number" min="0" max="100" value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} font-mono text-sm w-14`}/>
                            : <>
                                <div className="flex-1 h-1.5 rounded-full bg-[#EEF2F7] overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-teal-400 to-cyan-500 rounded-full transition-all" style={{ width:`${project.progress||0}%` }}/>
                                </div>
                                <span className="text-[12px] font-bold text-gray-600 min-w-[32px] text-right flex-shrink-0">{project.progress||0}%</span>
                              </>}
                        </div>
                      </td>
                    );

                    if (col.key === 'team') return (
                      <td key={col.key} style={tdS} onClick={e=>startEdit(e,project,'team')}>
                        <div style={inner()}>
                          {ed('team')
                            ? <input ref={cellInputRef} value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} placeholder="Alice, Bob" className={`${inlineInputCls} text-[13px]`}/>
                            : <div className="flex items-center" style={{ paddingLeft:'2px' }}>
                                {(project.team||[]).slice(0,3).map((member,i) => (
                                  <div key={i} title={member}
                                    className="w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center flex-shrink-0 select-none text-white"
                                    style={{ backgroundColor:AVATAR_COLORS[i%AVATAR_COLORS.length], border:'2px solid white', marginLeft:i===0?0:'-6px', zIndex:i, boxShadow:'0 1px 3px rgba(0,0,0,0.15)' }}>
                                    {member[0]?.toUpperCase()}
                                  </div>
                                ))}
                                {(project.team||[]).length > 3 && (
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white select-none"
                                    style={{ backgroundColor:'#6B7C8F', border:'2px solid white', marginLeft:'-6px', zIndex:3, boxShadow:'0 1px 3px rgba(0,0,0,0.15)' }}
                                    title={(project.team||[]).slice(3).join(', ')}>
                                    +{(project.team||[]).length-3}
                                  </div>
                                )}
                                {(!project.team||project.team.length===0) && <span className="text-gray-300 text-[12px] italic">Unassigned</span>}
                              </div>}
                        </div>
                      </td>
                    );

                    if (col.key === 'actions') return (
                      <td key={col.key} style={{ height:'62px', padding:0, verticalAlign:'middle', borderBottom:`1px solid ${TABLE_LINE}` }}>
                        <div className="flex items-center justify-center h-full px-2">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (openMenuId === project.id) { setOpenMenuId(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top:rect.bottom+6, right:window.innerWidth-rect.right });
                              setOpenMenuId(project.id);
                            }}
                            className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center gap-[3.5px] transition-all duration-150 ${openMenuId===project.id?'bg-[#EEF2F7]':'hover:bg-[#EEF2F7]'}`}>
                            {[0,1,2].map(i=>(
                              <span key={i} className={`w-1 h-1 rounded-full block ${openMenuId===project.id?'bg-gray-600':'bg-gray-300'}`}/>
                            ))}
                          </button>
                        </div>
                      </td>
                    );
                    return null;
                  };

                  return (
                    <tr key={project.id} draggable
                      onDragStart={e=>handleDragStart(e,idx)} onDragEnter={e=>handleDragEnter(e,idx)}
                      onDragOver={e=>handleDragOver(e,idx)} onDrop={e=>handleDrop(e,idx)} onDragEnd={handleDragEnd}
                      className={`${rowBg} transition-colors duration-100`}>
                      {visibleCols.map((col,ci) => renderCell(col,ci))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DESCRIPTION EXPAND MODAL */}
      {expandedDesc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-sm bg-black/30" onClick={()=>setExpandedDesc(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" style={{ border:`1px solid ${TABLE_LINE}` }} onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:`1px solid ${TABLE_LINE}` }}>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Description</p>
                <h3 className="text-base font-bold text-gray-900">{expandedDesc.name}</h3>
              </div>
              <button onClick={()=>setExpandedDesc(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X size={16}/></button>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{expandedDesc.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* 3-DOT PORTAL */}
      {openMenuId && (
        <div ref={menuRef} onClick={e=>e.stopPropagation()}
          className="fixed z-[9999] bg-white rounded-xl shadow-xl overflow-hidden p-1"
          style={{ top:menuPos.top, right:menuPos.right, minWidth:'165px', border:`1px solid ${TABLE_LINE}`, boxShadow:'0 10px 30px rgba(0,0,0,0.15)' }}>
          <button onClick={()=>{ const p=displayProjects.find(p=>p.id===openMenuId); setOpenMenuId(null); if(p) setDeleteTarget(p); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} strokeWidth={2}/> Delete Project
          </button>
        </div>
      )}

      {/* NEW PROJECT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ border:`1px solid ${TABLE_LINE}`, scrollbarWidth:'none' }}>
            <div className="sticky top-0 bg-white px-6 py-5 flex items-center justify-between rounded-t-2xl z-10" style={{ borderBottom:`1px solid ${TABLE_LINE}` }}>
              <h2 className="text-xl font-bold text-gray-900">Create New Project</h2>
              <button onClick={()=>setShowModal(false)} className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Project Name *</label>
                <input type="text" name="name" value={newProject.name} onChange={handleInputChange} required
                  className={inputCls} style={{ border:`1px solid ${TABLE_LINE}` }} placeholder="Enter project name"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea name="description" value={newProject.description} onChange={handleInputChange} rows="3"
                  className={`${inputCls} resize-none`} style={{ border:`1px solid ${TABLE_LINE}` }} placeholder="Enter project description"/>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                  <select name="status" value={newProject.status} onChange={handleInputChange} className={inputCls} style={{ border:`1px solid ${TABLE_LINE}` }}>
                    {STATUS_OPTIONS.map(o=><option key={o.value}>{o.value}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                  <select name="priority" value={newProject.priority} onChange={handleInputChange} className={inputCls} style={{ border:`1px solid ${TABLE_LINE}` }}>
                    <option>Low</option><option>Medium</option><option>High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date *</label>
                  <input type="date" name="startDate" value={newProject.startDate} onChange={handleInputChange} required className={inputCls} style={{ border:`1px solid ${TABLE_LINE}` }}/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Deadline *</label>
                  <input type="date" name="deadline" value={newProject.deadline} onChange={handleInputChange} required className={inputCls} style={{ border:`1px solid ${TABLE_LINE}` }}/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Total Tasks</label>
                <input type="number" name="totalTasks" value={newProject.totalTasks} onChange={handleInputChange} min="1"
                  className={inputCls} style={{ border:`1px solid ${TABLE_LINE}` }} placeholder="e.g., 30"/>
              </div>

              {/* ── TEAM MEMBERS — tag input with dropdown fixed inside modal ── */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assign Team Members *
                  {newProject.team.length > 0 && (
                    <span className="ml-2 text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">{newProject.team.length} selected</span>
                  )}
                </label>

                {/* Wrapper: position:relative so dropdown is clipped inside modal scroll */}
                <div className="relative" ref={teamDropRef}>

                  {/* Tag-input box */}
                  <div
                    ref={teamBoxRef}
                    className="min-h-[48px] w-full rounded-lg bg-white px-3 py-2 flex flex-wrap gap-1.5 items-center cursor-text transition-all"
                    style={{
                      border: `1px solid ${showTeamDrop ? '#14b8a6' : TABLE_LINE}`,
                      boxShadow: showTeamDrop ? '0 0 0 3px rgba(20,184,166,0.15)' : undefined,
                    }}
                    onClick={() => { teamInputRef.current?.focus(); setShowTeamDrop(true); }}>

                    {/* Placeholder when nothing selected and not typing */}
                    {newProject.team.length === 0 && !teamInput && (
                      <span className="flex items-center gap-1.5 text-gray-400 text-sm pointer-events-none select-none">
                        <Users size={14}/> Choose team members...
                      </span>
                    )}

                    {/* Selected tags */}
                    {newProject.team.map(m => (
                      <span key={m} className="inline-flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-700 text-[12px] font-semibold px-2 py-0.5 rounded-full">
                        <span className="w-4 h-4 rounded-full bg-teal-500 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">{m[0]?.toUpperCase()}</span>
                        {m}
                        <button type="button" onClick={e=>{ e.stopPropagation(); removeMember(m); }} className="text-teal-400 hover:text-red-500 transition-colors leading-none ml-0.5 text-base">×</button>
                      </span>
                    ))}

                    {/* Text input */}
                    <input
                      ref={teamInputRef}
                      type="text"
                      value={teamInput}
                      onChange={e => { setTeamInput(e.target.value); setShowTeamDrop(true); }}
                      onFocus={() => setShowTeamDrop(true)}
                      onKeyDown={handleTeamKeyDown}
                      className="flex-1 min-w-[100px] border-none outline-none bg-transparent text-sm text-gray-800 placeholder-gray-400 py-0.5"
                      placeholder={newProject.team.length > 0 ? 'Add more...' : ''}
                    />
                  </div>

                  {/* Dropdown — positioned absolute within relative wrapper, max-height + overflow-y */}
                  {showTeamDrop && (
                    <div
                      className="absolute left-0 right-0 z-[200] bg-white rounded-xl shadow-xl"
                      style={{
                        top: '100%',
                        marginTop: '4px',
                        border: `1px solid ${TABLE_LINE}`,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        // keep inside modal width — no escape
                      }}>

                      {filteredPool.length > 0 && (
                        <>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-2.5 pb-1 sticky top-0 bg-white">Existing Members</p>
                          {filteredPool.map(m => (
                            <button key={m} type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => selectMember(m)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-teal-50 transition-colors text-left">
                              <div className="w-6 h-6 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{m[0]?.toUpperCase()}</div>
                              <span className="text-[13px] text-gray-700 font-medium">{m}</span>
                            </button>
                          ))}
                        </>
                      )}

                      {teamInput.trim() && !memberPool.includes(teamInput.trim()) && (
                        <>
                          {filteredPool.length > 0 && <div style={{ borderTop:`1px solid ${TABLE_LINE}` }}/>}
                          <button type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={addNewMember}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-teal-50 transition-colors text-left">
                            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-sm font-bold flex items-center justify-center flex-shrink-0">+</div>
                            <span className="text-[13px] text-gray-700">Add <span className="font-semibold text-teal-600">"{teamInput.trim()}"</span> as new member</span>
                          </button>
                        </>
                      )}

                      {filteredPool.length === 0 && !teamInput.trim() && (
                        <p className="text-[12px] text-gray-400 px-3 py-4 text-center">Type a name to search or add new member</p>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">Click to see existing · Type to search or add new · Backspace to remove last</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowModal(false)}
                  className="flex-1 px-6 py-2 font-semibold rounded-xl text-sm text-gray-600 bg-[#EEF2F7] hover:opacity-80"
                  style={{ border:`1px solid ${TABLE_LINE}` }}>Cancel</button>
                <button type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold rounded-xl shadow text-sm">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm bg-black/35">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden" style={{ border:`1px solid ${TABLE_LINE}` }}>
            <div className="p-8 pb-7">
              <div className="w-[52px] h-[52px] rounded-xl bg-red-50 border border-red-200 flex items-center justify-center mb-5">
                <Trash2 size={24} className="text-red-500" strokeWidth={1.8}/>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete this project?</h3>
              <p className="text-sm text-gray-500 mb-4">This action is permanent and cannot be undone.</p>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-7">
                <span className="text-sm font-semibold text-red-600">"{deleteTarget.name}"</span>
                <span className="text-xs text-gray-400 ml-2">will be permanently deleted</span>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setDeleteTarget(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-[#EEF2F7] hover:bg-slate-200" style={{ border:`1px solid ${TABLE_LINE}` }}>Cancel</button>
                <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-red-400 to-red-500 hover:opacity-90 shadow-lg shadow-red-200">Yes, Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;