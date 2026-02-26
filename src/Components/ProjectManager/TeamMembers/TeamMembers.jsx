// ─────────────────────────────────────────────────────────────────────────────
//  TeamMembers.jsx  –  White theme, table view
//  Firestore collection: /teamMembers
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Trash2, Search, Plus, Eye, AlertCircle,
  CheckCircle2, Circle, ChevronDown, ChevronUp
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const TL  = 'rgba(51,51,51,0.20)';
const TLB = 'rgba(51,51,51,0.30)';

const ROLES = [
  'Frontend Developer', 'Backend Developer', 'Flutter Developer',
  'UI/UX Designer', 'Project Manager', 'QA Engineer',
  'Marketing Manager', 'Content Writer', 'DevOps Engineer',
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const priorityCfg = {
  Low:      { badge: 'text-gray-500',   dot: 'bg-gray-400'   },
  Medium:   { badge: 'text-blue-600',   dot: 'bg-blue-500'   },
  High:     { badge: 'text-amber-600',  dot: 'bg-amber-400'  },
  Critical: { badge: 'text-red-500',    dot: 'bg-red-500'    },
};

const statusCfg = {
  Active:   { badge: 'text-emerald-600', dot: 'bg-emerald-500' },
  Away:     { badge: 'text-amber-600',   dot: 'bg-amber-400'   },
  Inactive: { badge: 'text-gray-500',    dot: 'bg-gray-400'    },
};

const taskStatusCfg = {
  'Pending':     { color: 'text-gray-500',    bg: 'bg-gray-100',    border: 'border-gray-200',    dot: 'bg-gray-400'    },
  'In Progress': { color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200',   dot: 'bg-amber-400'   },
  'Done':        { color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500' },
};

const TASK_STATUSES = ['Pending', 'In Progress', 'Done'];

const taskStatusIcon = (s) => {
  if (s === 'Done')        return <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />;
  if (s === 'In Progress') return <AlertCircle  size={15} className="text-amber-400 flex-shrink-0"   />;
  return <Circle size={15} className="text-gray-300 flex-shrink-0" />;
};

const generateAvatar = (name) => {
  const w = (name || '').trim().split(' ');
  return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : (name || '??').substring(0, 2).toUpperCase();
};

const getCurrentMonthYear = () => {
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(); return `${m[d.getMonth()]} ${d.getFullYear()}`;
};

// ─── Component ────────────────────────────────────────────────────────────────
const TeamMembers = () => {
  const { showAddMemberModal, setShowAddMemberModal } = useOutletContext();

  const [members,      setMembers]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [filterRole,   setFilterRole]   = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [selected,     setSelected]     = useState(null);
  const [showDrawer,   setShowDrawer]   = useState(false);
  const [showAddTask,  setShowAddTask]  = useState(false);
  const [newTask,      setNewTask]      = useState({ title: '', description: '', priority: 'Medium', dueDate: '', status: 'Pending' });

  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [openMenuId,    setOpenMenuId]    = useState(null);
  const [menuPos,       setMenuPos]       = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);

  const [openTaskDropdown,    setOpenTaskDropdown]    = useState(null);
  const [taskDropdownPos,     setTaskDropdownPos]     = useState({ top: 0, left: 0 });
  const taskDropdownRef = useRef(null);

  const [newMember,  setNewMember]  = useState({ name: '', role: 'Frontend Developer', email: '', phone: '', status: 'Active' });
  const [editMember, setEditMember] = useState({ name: '', role: '', email: '', phone: '', status: '', projects: 0 });

  const dragItem     = useRef(null);
  const dragOverItem = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // ── Firebase listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'teamMembers'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (selected) {
      const fresh = members.find(m => m.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [members]);

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (taskDropdownRef.current && !taskDropdownRef.current.contains(e.target))
        setOpenTaskDropdown(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = members.filter(m => {
    const s = searchTerm.toLowerCase();
    const matchSearch = m.name?.toLowerCase().includes(s) || m.email?.toLowerCase().includes(s) || m.role?.toLowerCase().includes(s);
    const matchRole   = filterRole   === 'all' || m.role   === filterRole;
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleDragStart = (e, idx) => { dragItem.current = idx; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => { if (e.target) e.target.style.opacity = '0.4'; }, 0); };
  const handleDragEnter = (e, idx) => { e.preventDefault(); dragOverItem.current = idx; setDragOverIdx(idx); };
  const handleDragOver  = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; dragOverItem.current = idx; setDragOverIdx(idx); };
  const handleDrop = (e, idx) => { e.preventDefault(); setDragOverIdx(null); dragItem.current = null; dragOverItem.current = null; };
  const handleDragEnd = (e) => { if (e.target) e.target.style.opacity = '1'; dragItem.current = null; dragOverItem.current = null; setDragOverIdx(null); };

  // ── Member CRUD ───────────────────────────────────────────────────────────
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'teamMembers'), {
        name: newMember.name, role: newMember.role, email: newMember.email,
        phone: newMember.phone, projects: 0, status: newMember.status,
        avatar: generateAvatar(newMember.name), joinDate: getCurrentMonthYear(),
        tasks: [], createdAt: serverTimestamp(),
      });
      setNewMember({ name: '', role: 'Frontend Developer', email: '', phone: '', status: 'Active' });
      setShowAddMemberModal(false);
    } catch { alert('Error adding member'); }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'teamMembers', selected.id), {
        name: editMember.name, role: editMember.role, email: editMember.email,
        phone: editMember.phone, status: editMember.status,
        projects: parseInt(editMember.projects) || 0,
        avatar: generateAvatar(editMember.name),
      });
      setShowEditModal(false);
    } catch { alert('Error updating member'); }
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'teamMembers', deleteTarget.id));
      if (selected?.id === deleteTarget.id) { setSelected(null); setShowDrawer(false); }
      setDeleteTarget(null);
    } catch { alert('Error deleting'); }
  };

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  const addTask = async (e) => {
    e.preventDefault();
    if (!selected) return;
    const task = { id: `t${Date.now()}`, title: newTask.title, description: newTask.description, priority: newTask.priority, dueDate: newTask.dueDate, status: newTask.status };
    await updateDoc(doc(db, 'teamMembers', selected.id), {
      tasks: [...(selected.tasks || []), task],
      projects: (selected.projects || 0) + 1,
    });
    setNewTask({ title: '', description: '', priority: 'Medium', dueDate: '', status: 'Pending' });
    setShowAddTask(false);
  };

  const cycleTaskStatus = async (memberId, taskId) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    const cycle = { 'Pending': 'In Progress', 'In Progress': 'Done', 'Done': 'Pending' };
    await updateDoc(doc(db, 'teamMembers', memberId), {
      tasks: (member.tasks || []).map(t => t.id === taskId ? { ...t, status: cycle[t.status] || 'Pending' } : t)
    });
  };

  const setTaskStatus = async (memberId, taskId, newStatus) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    await updateDoc(doc(db, 'teamMembers', memberId), {
      tasks: (member.tasks || []).map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    });
    setOpenTaskDropdown(null);
  };

  const deleteTask = async (memberId, taskId) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    await updateDoc(doc(db, 'teamMembers', memberId), {
      tasks: (member.tasks || []).filter(t => t.id !== taskId),
      projects: Math.max(0, (member.projects || 1) - 1),
    });
  };

  // ── Latest task helper ────────────────────────────────────────────────────
  const getLatestTask = (member) => {
    const tasks = member.tasks || [];
    if (!tasks.length) return null;
    return tasks.find(t => t.status !== 'Done') || tasks[tasks.length - 1];
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const cols = [
    { label: '#',           w: '44px'  },
    { label: 'Member',      w: '200px' },
    { label: 'Role',        w: '160px' },
    { label: 'Tasks',       w: '70px'  },
    { label: 'Status',      w: '110px' },
    { label: 'Priority',    w: '100px' },
    { label: 'Task Status', w: '140px' },
    { label: 'Description', w: '190px' },
    { label: 'Due Date',    w: '100px' },
    { label: '',            w: '48px'  },
    { label: '',            w: '48px'  },
  ];

  const modalInput = 'w-full px-4 py-3 rounded-lg text-sm text-gray-800 bg-white placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all';

  if (loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Loading team members...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#EEF2F7]">

      <div className="h-[15px]" />

      {/* ── FILTER BAR ─────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pb-4 flex flex-wrap items-center gap-3 max-w-[1600px] mx-auto">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by name, email, role..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border text-sm text-gray-700 placeholder-gray-400 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all"
            style={{ border: `1px solid ${TL}` }} />
        </div>
        <div className="relative">
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2.5 bg-white border text-sm text-gray-700 rounded-lg focus:border-teal-500 focus:outline-none transition-all cursor-pointer"
            style={{ border: `1px solid ${TL}` }}>
            <option value="all">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2.5 bg-white border text-sm text-gray-700 rounded-lg focus:border-teal-500 focus:outline-none transition-all cursor-pointer"
            style={{ border: `1px solid ${TL}` }}>
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Away">Away</option>
            <option value="Inactive">Inactive</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── TABLE CARD ─────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pb-8 max-w-[1600px] mx-auto">
        <div className="bg-white rounded-2xl shadow-sm w-full" style={{ border: `1px solid ${TL}`, overflow: 'hidden' }}>

          {/* Scroll container — X + Y */}
          <div
            className="team-scroll-container"
            style={{
              overflowX: 'auto',
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 210px)',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              scrollbarColor: 'rgba(20,184,166,0.6) rgba(238,242,247,0.9)',
            }}
          >
            <style>{`
              .team-scroll-container::-webkit-scrollbar { height: 6px; width: 6px; }
              .team-scroll-container::-webkit-scrollbar-track { background: rgba(238,242,247,0.9); border-radius: 999px; }
              .team-scroll-container::-webkit-scrollbar-thumb { background: rgba(20,184,166,0.55); border-radius: 999px; }
              .team-scroll-container::-webkit-scrollbar-thumb:hover { background: rgba(20,184,166,0.85); }
              .team-scroll-container::-webkit-scrollbar-corner { background: transparent; }
            `}</style>

            <table className="border-collapse" style={{ tableLayout: 'fixed', minWidth: '1210px', width: '100%' }}>
              <colgroup>{cols.map((c, i) => <col key={i} style={{ width: c.w }} />)}</colgroup>

              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EEF2F7]" style={{ borderBottom: `2px solid ${TLB}` }}>
                  {cols.map((col, i) => (
                    <th key={i} className="py-3.5 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider select-none whitespace-nowrap text-center"
                      style={{ borderRight: i < cols.length - 1 ? `1px solid ${TL}` : undefined }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={cols.length} className="py-20 text-center">
                    <div className="text-4xl mb-3">👥</div>
                    <p className="text-gray-400 text-sm">No team members found.</p>
                  </td></tr>
                )}

                {filtered.map((member, idx) => {
                  const latestTask = getLatestTask(member);
                  const taskCount  = (member.tasks || []).length;
                  const isDragOver = dragOverIdx === idx && dragItem.current !== idx;
                  const rowBg      = idx % 2 === 0 ? 'bg-white' : '';
                  const sCfg       = statusCfg[member.status]          || statusCfg.Active;
                  const pCfg       = priorityCfg[latestTask?.priority] || priorityCfg.Medium;
                  const tsCfg      = taskStatusCfg[latestTask?.status] || taskStatusCfg['Pending'];
                  const dropKey    = `${member.id}__${latestTask?.id}`;
                  const isDropOpen = openTaskDropdown === dropKey;

                  const tdStyle = (colIdx) => ({
                    height: '62px', padding: 0, verticalAlign: 'middle',
                    borderRight: colIdx < cols.length - 1 ? `1px solid ${TL}` : undefined,
                    borderBottom: `1px solid ${TL}`,
                    outline: isDragOver ? '2px solid #14b8a6' : undefined,
                    outlineOffset: '-2px',
                    position: colIdx === 6 ? 'relative' : undefined,
                    overflow: colIdx === 6 ? 'visible' : undefined,
                  });

                  const inner = (justify = 'flex-start') => ({
                    display: 'flex', alignItems: 'center', justifyContent: justify,
                    height: '100%', padding: '0 12px', overflow: 'hidden',
                  });

                  return (
                    <tr key={member.id} draggable
                      onDragStart={e => handleDragStart(e, idx)}
                      onDragEnter={e => handleDragEnter(e, idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={e => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`${rowBg} transition-colors duration-100`}>

                      {/* # */}
                      <td style={{ ...tdStyle(0), cursor: 'grab' }}>
                        <div style={inner('center')}><span className="text-xs font-bold font-mono text-gray-300">{idx + 1}</span></div>
                      </td>

                      {/* Member */}
                      <td style={tdStyle(1)}>
                        <div style={inner()}>
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {member.avatar || generateAvatar(member.name)}
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-[14px] font-semibold text-gray-900 truncate">{member.name}</p>
                              <p className="text-[11px] text-gray-400 truncate">{member.email}</p>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={tdStyle(2)}>
                        <div style={inner()}><span className="text-[13px] text-gray-600 truncate">{member.role}</span></div>
                      </td>

                      {/* Task Count */}
                      <td style={tdStyle(3)}>
                        <div style={inner('center')}>
                          <span className={`text-[13px] font-bold font-mono ${taskCount > 0 ? 'text-teal-600' : 'text-gray-300'}`}>{taskCount}</span>
                        </div>
                      </td>

                      {/* Member Status */}
                      <td style={tdStyle(4)}>
                        <div style={inner('center')}>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${sCfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sCfg.dot}`} />{member.status}
                          </span>
                        </div>
                      </td>

                      {/* Priority */}
                      <td style={tdStyle(5)}>
                        <div style={inner('center')}>
                          {latestTask ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${pCfg.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pCfg.dot}`} />{latestTask.priority}
                            </span>
                          ) : <span className="text-gray-300 text-[12px]">—</span>}
                        </div>
                      </td>

                      {/* ── TASK STATUS DROPDOWN ── */}
                      <td style={tdStyle(6)}>
                        <div style={{ ...inner('center'), overflow: 'visible' }}>
                          {latestTask ? (
                            <div className="relative" ref={isDropOpen ? taskDropdownRef : null}>
                              <button
                                onClick={e => { e.stopPropagation(); setOpenTaskDropdown(isDropOpen ? null : dropKey); }}
                                className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[12px] font-semibold border whitespace-nowrap transition-all hover:opacity-80 active:scale-95
                                  ${tsCfg.bg} ${tsCfg.color} ${tsCfg.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tsCfg.dot}`} />
                                {latestTask.status}
                                {isDropOpen ? <ChevronUp size={10} className="opacity-50 ml-0.5" /> : <ChevronDown size={10} className="opacity-50 ml-0.5" />}
                              </button>

                              {isDropOpen && (
                                <div className="absolute left-1/2 -translate-x-1/2 z-[9999] bg-white rounded-xl overflow-hidden"
                                  style={{ top: 'calc(100% + 8px)', minWidth: '156px', border: `1px solid ${TL}`, boxShadow: '0 10px 30px rgba(0,0,0,0.14)' }}
                                  onClick={e => e.stopPropagation()}>
                                  <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rotate-45 border-l border-t border-gray-200" />
                                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-2.5 pb-1.5">Change Status</p>
                                  {TASK_STATUSES.map(s => {
                                    const cfg = taskStatusCfg[s];
                                    const isActive = latestTask.status === s;
                                    return (
                                      <button key={s} onClick={() => setTaskStatus(member.id, latestTask.id, s)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium transition-colors
                                          ${isActive ? `${cfg.bg} ${cfg.color}` : 'text-gray-700 hover:bg-gray-50'}`}>
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                        {s}
                                        {isActive && <CheckCircle2 size={12} className="ml-auto opacity-60" />}
                                      </button>
                                    );
                                  })}
                                  <div className="h-1.5" />
                                </div>
                              )}
                            </div>
                          ) : <span className="text-gray-300 text-[12px]">—</span>}
                        </div>
                      </td>

                      {/* Description */}
                      <td style={tdStyle(7)}>
                        <div style={inner()}>
                          {latestTask ? (
                            <div className="overflow-hidden">
                              <p className="text-[12px] font-medium text-gray-700 truncate">{latestTask.title}</p>
                              {latestTask.description && <p className="text-[11px] text-gray-400 truncate">{latestTask.description}</p>}
                            </div>
                          ) : <span className="text-gray-300 text-[12px]">No tasks</span>}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td style={tdStyle(8)}>
                        <div style={inner('center')}>
                          <span className="text-[12px] font-mono text-gray-600 whitespace-nowrap">{latestTask?.dueDate || '—'}</span>
                        </div>
                      </td>

                      {/* Eye */}
                      <td style={tdStyle(9)}>
                        <div className="flex items-center justify-center h-full">
                          <button onClick={() => { setSelected(member); setShowDrawer(true); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-teal-500 hover:bg-teal-50 transition-colors" title="View details">
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>

                      {/* 3-dot */}
                      <td style={{ ...tdStyle(10), borderRight: undefined }}>
                        <div className="flex items-center justify-center h-full">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (openMenuId === member.id) { setOpenMenuId(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                              setOpenMenuId(member.id);
                            }}
                            className={`w-7 h-7 rounded-lg flex flex-col items-center justify-center gap-[3px] transition-all ${openMenuId === member.id ? 'bg-[#EEF2F7]' : 'hover:bg-[#EEF2F7]'}`}>
                            {[0,1,2].map(i => (
                              <span key={i} className={`w-1 h-1 rounded-full block ${openMenuId === member.id ? 'bg-gray-600' : 'bg-gray-300'}`} />
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

      {/* ── 3-DOT PORTAL ───────────────────────────────────────────────────── */}
      {openMenuId && (
        <div ref={menuRef} onClick={e => e.stopPropagation()}
          className="fixed z-[9999] bg-white rounded-xl overflow-hidden p-1"
          style={{ top: menuPos.top, right: menuPos.right, minWidth: '165px', border: `1px solid ${TL}`, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
          <button onClick={() => {
            const m = members.find(x => x.id === openMenuId); setOpenMenuId(null);
            if (m) { setSelected(m); setEditMember({ name: m.name, role: m.role, email: m.email, phone: m.phone, status: m.status, projects: m.projects || 0 }); setShowEditModal(true); }
          }} className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            ✏️ Edit Member
          </button>
          <button onClick={() => { const m = members.find(x => x.id === openMenuId); setOpenMenuId(null); if (m) setDeleteTarget(m); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} strokeWidth={2} /> Delete Member
          </button>
        </div>
      )}

      {/* ── DETAIL DRAWER ──────────────────────────────────────────────────── */}
      {showDrawer && selected && (
        <div className="fixed inset-0 z-[100]" onClick={() => { setShowDrawer(false); setShowAddTask(false); }}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
          <div className="absolute right-0 top-0 bottom-0 bg-white flex flex-col shadow-2xl w-full sm:w-[520px]"
           style={{ borderLeft: `1px solid ${TL}` }}
             onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-7 pb-5 flex-shrink-0" style={{ borderBottom: `1px solid ${TL}` }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {selected.avatar || generateAvatar(selected.name)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{selected.name}</h2>
                  <p className="text-sm text-teal-600 font-medium mt-0.5">{selected.role}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusCfg[selected.status]?.badge || statusCfg.Active.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg[selected.status]?.dot || 'bg-emerald-500'}`} />{selected.status}
                    </span>
                    <span className="text-[11px] text-gray-400">Since {selected.joinDate}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => { setShowDrawer(false); setShowAddTask(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all text-xl">×</button>
            </div>

            {/* Contact Info */}
            <div className="px-7 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${TL}` }}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Info</h3>
              <div className="grid grid-cols-2 gap-3">
                {[{ label: 'Email', value: selected.email }, { label: 'Phone', value: selected.phone },
                  { label: 'Projects', value: selected.projects || 0 }, { label: 'Tasks', value: (selected.tasks || []).length }
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <p className="text-[11px] text-gray-400 font-medium mb-1">{label}</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks */}
            <div className="flex-1 overflow-y-auto px-7 py-5" style={{ scrollbarWidth: 'thin' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Tasks ({(selected.tasks || []).length})
                </h3>
                <button onClick={() => setShowAddTask(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors">
                  <Plus size={12} /> Add Task
                </button>
              </div>

              {showAddTask && (
                <form onSubmit={addTask} className="mb-4 p-4 rounded-xl bg-teal-50/60 border border-teal-200 space-y-3">
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider">New Task</p>
                  <input required value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="Task title *" className={modalInput} style={{ border: `1px solid ${TL}` }} />
                  <textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description (optional)" rows={2} className={`${modalInput} resize-none`} style={{ border: `1px solid ${TL}` }} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                      <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                        className={modalInput} style={{ border: `1px solid ${TL}` }}>
                        {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                      <select value={newTask.status} onChange={e => setNewTask(p => ({ ...p, status: e.target.value }))}
                        className={modalInput} style={{ border: `1px solid ${TL}` }}>
                        <option>Pending</option><option>In Progress</option><option>Done</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date *</label>
                    <input required type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                      className={modalInput} style={{ border: `1px solid ${TL}` }} />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowAddTask(false)}
                      className="flex-1 py-2.5 rounded-lg text-xs font-semibold text-gray-600 bg-white border hover:bg-gray-50"
                      style={{ border: `1px solid ${TL}` }}>Cancel</button>
                    <button type="submit"
                      className="flex-1 py-2.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600">
                      Add Task
                    </button>
                  </div>
                </form>
              )}

              {(!selected.tasks || selected.tasks.length === 0) && !showAddTask && (
                <div className="text-center py-12">
                  <div className="text-3xl mb-2">📋</div>
                  <p className="text-sm text-gray-400">No tasks yet. Add one above.</p>
                </div>
              )}

              <div className="space-y-2.5">
                {(selected.tasks || []).map(task => {
                  const pCfg = priorityCfg[task.priority] || priorityCfg.Medium;
                  return (
                    <div key={task.id} className="p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100/70 transition-colors group"
                      style={{ border: `1px solid ${TL}` }}>
                      <div className="flex items-start gap-3">
                        <button onClick={() => cycleTaskStatus(selected.id, task.id)}
                          className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110" title="Click to cycle status">
                          {taskStatusIcon(task.status)}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={`text-[13px] font-semibold ${task.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                              {task.title}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${pCfg.badge}`}>
                              <span className={`w-1 h-1 rounded-full ${pCfg.dot}`} />{task.priority}
                            </span>
                          </div>
                          {task.description && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{task.description}</p>}
                          <p className="text-[11px] text-gray-400 font-mono mt-1">📅 {task.dueDate || '—'}</p>
                        </div>
                        <button onClick={() => deleteTask(selected.id, task.id)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0 mt-0.5">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2.5 pl-7">
                        {TASK_STATUSES.map(s => {
                          const cfg = taskStatusCfg[s];
                          const isActive = task.status === s;
                          return (
                            <button key={s} onClick={() => setTaskStatus(selected.id, task.id, s)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all
                                ${isActive
                                  ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm`
                                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50'
                                }`}>
                              {s === 'In Progress' ? 'In Prog.' : s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD MEMBER MODAL ───────────────────────────────────────────────── */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" style={{ border: `1px solid ${TL}` }}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${TL}` }}>
              <h3 className="text-lg font-bold text-gray-900">Add New Member</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xl">×</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
                <input required type="text" value={newMember.name} onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }} placeholder="e.g. Ali Hassan" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role *</label>
                  <select value={newMember.role} onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))}
                    className={modalInput} style={{ border: `1px solid ${TL}` }}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status *</label>
                  <select value={newMember.status} onChange={e => setNewMember(p => ({ ...p, status: e.target.value }))}
                    className={modalInput} style={{ border: `1px solid ${TL}` }}>
                    <option>Active</option><option>Away</option><option>Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address *</label>
                <input required type="email" value={newMember.email} onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }} placeholder="ali@company.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number *</label>
                <input required type="tel" value={newMember.phone} onChange={e => setNewMember(p => ({ ...p, phone: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }} placeholder="+92 300 0000000" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-[#EEF2F7] hover:opacity-80"
                  style={{ border: `1px solid ${TL}` }}>Cancel</button>
                <button type="submit"
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow">
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT MEMBER MODAL ──────────────────────────────────────────────── */}
      {showEditModal && selected && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" style={{ border: `1px solid ${TL}` }}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${TL}` }}>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Edit Member</h3>
                <p className="text-sm text-gray-400 mt-0.5">{selected.name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xl">×</button>
            </div>
            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
                <input required type="text" value={editMember.name} onChange={e => setEditMember(p => ({ ...p, name: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role *</label>
                  <select value={editMember.role} onChange={e => setEditMember(p => ({ ...p, role: e.target.value }))}
                    className={modalInput} style={{ border: `1px solid ${TL}` }}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status *</label>
                  <select value={editMember.status} onChange={e => setEditMember(p => ({ ...p, status: e.target.value }))}
                    className={modalInput} style={{ border: `1px solid ${TL}` }}>
                    <option>Active</option><option>Away</option><option>Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address *</label>
                <input required type="email" value={editMember.email} onChange={e => setEditMember(p => ({ ...p, email: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number *</label>
                <input required type="tel" value={editMember.phone} onChange={e => setEditMember(p => ({ ...p, phone: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Active Projects</label>
                <input type="number" min="0" value={editMember.projects} onChange={e => setEditMember(p => ({ ...p, projects: e.target.value }))}
                  className={modalInput} style={{ border: `1px solid ${TL}` }} />
              </div>
              <div className="pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setShowEditModal(false); setDeleteTarget(selected); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors">
                  <Trash2 size={14} /> Remove Member
                </button>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-[#EEF2F7] hover:opacity-80"
                  style={{ border: `1px solid ${TL}` }}>Cancel</button>
                <button type="submit"
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow">
                  Update Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ─────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden" style={{ border: `1px solid ${TL}` }}>
            <div className="h-1 bg-gradient-to-r from-red-400 to-red-500" />
            <div className="p-7">
              <div className="w-[48px] h-[48px] rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-5">
                <Trash2 size={22} className="text-red-500" strokeWidth={1.8} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Member?</h3>
              <p className="text-sm text-gray-500 mb-4">This will permanently remove the member and all their tasks.</p>
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-6">
                <span className="text-sm font-semibold text-red-600">"{deleteTarget.name}"</span>
                <span className="text-xs text-gray-400 ml-2">will be permanently deleted</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-[#EEF2F7] hover:bg-slate-200"
                  style={{ border: `1px solid ${TL}` }}>Cancel</button>
                <button onClick={confirmDelete}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-red-400 to-red-500 hover:opacity-90 shadow-lg shadow-red-100">
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeamMembers;