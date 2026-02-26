import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from '../../firebase';
import { Loader, Trash2 } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

// ── Constants ───────────────────────────────────────────────────────────────
const TABLE_LINE      = 'rgba(51,51,51,0.20)';
const TABLE_LINE_BOLD = 'rgba(51,51,51,0.30)';

const AVATAR_COLORS = ['#7B90A4','#8FA3AC','#7A9BAA','#909AAB','#8A9FAD','#8496A8'];

const Projects = () => {
  const { showAddProjectModal, setShowAddProjectModal } = useOutletContext();

  const [filter, setFilter]           = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [projectList, setProjectList] = useState([]);

  const [editingCell, setEditingCell] = useState(null);
  const editValueRef  = useRef('');
  const [editDisplay, setEditDisplay] = useState('');
  const cellInputRef  = useRef(null);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos]       = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [newProject, setNewProject] = useState({
    name: '', description: '', status: 'In Progress', priority: 'Medium',
    deadline: '', team: '', totalTasks: '', startDate: '',
  });

  const dragItem     = useRef(null);
  const dragOverItem = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [localOrder, setLocalOrder]   = useState([]);

  // TopBar "New Project" button se modal open karo
  useEffect(() => {
    if (showAddProjectModal) {
      setShowModal(true);
      setShowAddProjectModal(false);
    }
  }, [showAddProjectModal]);



  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjectList(data);
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

  // ── 3 tabs: All, In Progress, Completed ─────────────────────────────────
  const TABS = [
    { key: 'all',         label: 'All Projects' },
    { key: 'In Progress', label: 'In Progress'  },
    { key: 'Completed',   label: 'Completed'    },
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

  // ── Counts for tab badges ────────────────────────────────────────────────
  const countFor = (key) => {
    if (key === 'all') return projectList.length;
    return projectList.filter(p => p.status === key).length;
  };

  // ── Drag handlers ────────────────────────────────────────────────────────
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
  const handleDrop = (e, idx) => {
    e.preventDefault();
    const from = dragItem.current, to = dragOverItem.current ?? idx;
    if (from === null || to === null || from === to) { setDragOverIdx(null); return; }
    const reordered = [...displayProjects];
    const [moved]   = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const displayIds = reordered.map(p => p.id);
    const hiddenIds  = localOrder.filter(id => !displayProjects.some(p => p.id === id));
    setLocalOrder([...displayIds, ...hiddenIds]);
    dragItem.current = null; dragOverItem.current = null; setDragOverIdx(null);
  };
  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    dragItem.current = null; dragOverItem.current = null; setDragOverIdx(null);
  };

  // ── Inline edit ──────────────────────────────────────────────────────────
  const getFieldValue = (project, field) => {
    if (field === 'name')        return project.name        || '';
    if (field === 'description') return project.description || '';
    if (field === 'startDate')   return project.startDate   || project.createdAt?.slice(0, 10) || '';
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
    editValueRef.current = val;
    setEditDisplay(val);
    setEditingCell({ projectId: project.id, field });
    setTimeout(() => { cellInputRef.current?.focus(); cellInputRef.current?.select(); }, 30);
  };

  const doCommit = useCallback(async (projectId, field, value) => {
    const project = projectList.find(p => p.id === projectId);
    if (!project) return;
    let updateData = {};
    if (field === 'name')        updateData = { name: value.trim() };
    if (field === 'description') updateData = { description: value.trim() };
    if (field === 'startDate')   updateData = { startDate: value };
    if (field === 'deadline')    updateData = { deadline: value };
    if (field === 'status')      updateData = { status: value };
    if (field === 'priority')    updateData = { priority: value };
    if (field === 'progress')    updateData = { progress: Math.min(100, Math.max(0, parseInt(value) || 0)) };
    if (field === 'team')        updateData = { team: value.split(',').map(m => m.trim()).filter(Boolean) };
    if (!Object.keys(updateData).length) return;
    try { await updateDoc(doc(db, 'projects', projectId), { ...updateData, updatedAt: new Date().toISOString() }); }
    catch (err) { console.error('Save error:', err); }
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

  // ── Delete ───────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteDoc(doc(db, 'projects', deleteTarget.id)); }
    catch { alert('Error deleting.'); }
    setDeleteTarget(null);
  };

  // ── New project ──────────────────────────────────────────────────────────
  const handleInputChange = (e) => setNewProject(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault();
    const teamArray = newProject.team.split(',').map(m => m.trim()).filter(Boolean);
    try {
      await addDoc(collection(db, 'projects'), {
        name: newProject.name, description: newProject.description,
        status: newProject.status, priority: newProject.priority, progress: 0,
        deadline: newProject.deadline, startDate: newProject.startDate || '',
        team: teamArray, tasks: { total: parseInt(newProject.totalTasks) || 0, completed: 0 },
        createdAt: new Date().toISOString(),
      });
      setNewProject({ name: '', description: '', status: 'In Progress', priority: 'Medium', deadline: '', team: '', totalTasks: '', startDate: '' });
      setShowModal(false);
    } catch { alert('Error creating project.'); }
  };

  // ── Badge helpers ────────────────────────────────────────────────────────
  const statusStyle = (s) => {
    if (s === 'In Progress') return { text: 'text-blue-700',    dot: 'bg-blue-500'    };
    if (s === 'Completed')   return { text: 'text-emerald-700', dot: 'bg-emerald-500' };
    return                          { text: 'text-slate-600',   dot: 'bg-slate-400'   };
  };
  const priorityStyle = (p) => {
    if (p === 'High')   return { text: 'text-red-600',     dot: 'bg-red-500'     };
    if (p === 'Medium') return { text: 'text-amber-600',   dot: 'bg-amber-500'   };
    return                     { text: 'text-emerald-600', dot: 'bg-emerald-500' };
  };

  const inputCls = 'w-full px-4 py-3 rounded-lg text-gray-800 placeholder-gray-400 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all duration-200';
  const inlineInputCls = 'w-full border-none outline-none bg-transparent text-gray-900 p-0 text-sm font-medium';

  const columns = [
    { label: '#',            w: '44px',   align: 'center' },
    { label: 'Project Name', w: '160px',  align: 'left'   },
    { label: 'Description',  w: '190px',  align: 'left'   },
    { label: 'Start Date',   w: '110px',  align: 'center' },
    { label: 'End Date',     w: '110px',  align: 'center' },
    { label: 'Status',       w: '120px',  align: 'center' },
    { label: 'Priority',     w: '100px',  align: 'center' },
    { label: 'Progress',     w: '120px',  align: 'center' },
    { label: 'Assigned To',  w: '160px',  align: 'left'   },
    { label: '',             w: '52px',   align: 'center' },
  ];

  return (
    <div className="min-h-screen bg-[#EEF2F7]">

      {/* ── MAIN CONTENT ── */}
      <div className="p-4 md:p-6 space-y-5">

        {/* FILTER TABS + SEARCH — responsive flex-wrap */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3  ">

          {/* TABS */}
          <div
            className="flex gap-1 rounded-xl p-1 bg-white shadow-sm overflow-x-auto"
            style={{ border: `1px solid ${TABLE_LINE}`, scrollbarWidth: 'none' }}
          >
            {TABS.map(tab => {
              const active = filter === tab.key;
              const count  = countFor(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap
                    ${active ? 'bg-teal-500 text-white shadow' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
                >
                  {tab.label}
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none
                    ${active ? 'bg-white/25 text-white' : 'bg-[#EEF2F7] text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-auto flex-1 sm:max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-sm"
              style={{ border: `1px solid ${TABLE_LINE}` }}
            />
          </div>
        </div>

        {/* TABLE CARD */}
        <div
          className="bg-white rounded-2xl shadow-sm w-full"
          style={{ border: `1px solid ${TABLE_LINE}`, overflow: 'hidden' }}
        >
          {/* ── Scroll Container: X + Y scrollable ── */}
          <div
            style={{
              overflowX: 'auto',
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 220px)',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              scrollbarColor: 'rgba(20,184,166,0.6) rgba(238,242,247,0.9)',
            }}
            // Webkit custom scrollbar via inline style tag below
            className="projects-scroll-container"
          >
            {/* Webkit scrollbar styles injected via style tag */}
            <style>{`
              .projects-scroll-container::-webkit-scrollbar {
                height: 6px;
                width: 6px;
              }
              .projects-scroll-container::-webkit-scrollbar-track {
                background: rgba(238,242,247,0.9);
                border-radius: 999px;
              }
              .projects-scroll-container::-webkit-scrollbar-thumb {
                background: rgba(20,184,166,0.55);
                border-radius: 999px;
              }
              .projects-scroll-container::-webkit-scrollbar-thumb:hover {
                background: rgba(20,184,166,0.85);
              }
              .projects-scroll-container::-webkit-scrollbar-corner {
                background: transparent;
              }
            `}</style>

            <table
              className="border-collapse"
              style={{ tableLayout: 'fixed', minWidth: '1166px', width: '100%' }}
            >
              <colgroup>
                {columns.map((c, i) => <col key={i} style={{ width: c.w }} />)}
              </colgroup>

              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EEF2F7]" style={{ borderBottom: `2px solid ${TABLE_LINE_BOLD}` }}>
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className="py-3.5 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider select-none whitespace-nowrap"
                      style={{
                        textAlign: col.align,
                        borderRight: i < columns.length - 1 ? `1px solid ${TABLE_LINE}` : undefined,
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {displayProjects.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="py-20 text-center">
                      <div className="text-4xl mb-3"><Loader/></div>
                      <p className="text-gray-400 text-sm">
                        {filter === 'all' ? 'No projects yet' : `No ${filter} projects`}
                      </p>
                    </td>
                  </tr>
                )}

                {displayProjects.map((project, idx) => {
                  const isDragOver = dragOverIdx === idx && dragItem.current !== idx;
                  const rowBg      = idx % 2 === 0 ? 'bg-white' : '';
                  const editing    = (field) => isEditing(project, field);
                  const sCfg       = statusStyle(project.status);
                  const pCfg       = priorityStyle(project.priority);

                  const tdStyle = (field, colIdx) => ({
                    height: '62px', padding: 0, verticalAlign: 'middle',
                    cursor: field ? 'cell' : 'default',
                    borderRight: colIdx < columns.length - 1 ? `1px solid ${TABLE_LINE}` : undefined,
                    borderBottom: `1px solid ${TABLE_LINE}`,
                    outline: editing(field) ? '2px solid #14b8a6' : isDragOver ? '2px solid #14b8a6' : undefined,
                    outlineOffset: editing(field) ? '-2px' : undefined,
                    backgroundColor: editing(field) ? 'rgba(20,184,166,0.06)' : undefined,
                    transition: 'background 0.1s',
                  });

                  const inner = (justify = 'flex-start') => ({
                    display: 'flex', alignItems: 'center', justifyContent: justify,
                    height: '100%', padding: '0 12px', overflow: 'hidden',
                  });

                  return (
                    <tr
                      key={project.id}
                      draggable
                      onDragStart={e => handleDragStart(e, idx)}
                      onDragEnter={e => handleDragEnter(e, idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={e => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`${rowBg} transition-colors duration-100`}
                    >

                      {/* # */}
                      <td style={{ height: '62px', padding: 0, verticalAlign: 'middle', cursor: 'grab', borderRight: `1px solid ${TABLE_LINE}`, borderBottom: `1px solid ${TABLE_LINE}` }}>
                        <div style={inner('center')}>
                          <span className="text-xs font-bold font-mono text-gray-300">{idx + 1}</span>
                        </div>
                      </td>

                      {/* Project Name */}
                      <td style={tdStyle('name', 1)} onClick={e => startEdit(e, project, 'name')}>
                        <div style={inner()}>
                          {editing('name') ? (
                            <input ref={cellInputRef} value={editDisplay}
                              onChange={e => handleValueChange(e.target.value)}
                              onBlur={commitEdit} onKeyDown={handleCellKeyDown}
                              className={`${inlineInputCls} font-semibold text-[14px]`} />
                          ) : (
                            <p className="text-[14px] font-semibold text-gray-900 truncate w-full" title={project.name}>{project.name}</p>
                          )}
                        </div>
                      </td>

                      {/* Description */}
                      <td style={tdStyle('description', 2)} onClick={e => startEdit(e, project, 'description')}>
                        <div style={inner()}>
                          {editing('description') ? (
                            <input ref={cellInputRef} value={editDisplay}
                              onChange={e => handleValueChange(e.target.value)}
                              onBlur={commitEdit} onKeyDown={handleCellKeyDown}
                              placeholder="Add description..." className={`${inlineInputCls} text-[13px]`} />
                          ) : (
                            <p className="text-[12px] text-gray-500 truncate w-full" title={project.description}>
                              {project.description || <span className="text-gray-300 italic">No description</span>}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Start Date */}
                      <td style={tdStyle('startDate', 3)} onClick={e => startEdit(e, project, 'startDate')}>
                        <div style={inner('center')}>
                          {editing('startDate') ? (
                            <input ref={cellInputRef} type="date" value={editDisplay}
                              onChange={e => handleValueChange(e.target.value)}
                              onBlur={commitEdit} onKeyDown={handleCellKeyDown}
                              className={`${inlineInputCls} font-mono text-[12px]`} />
                          ) : (
                            <span className="text-[12px] font-mono text-gray-900 whitespace-nowrap">
                              {project.startDate || project.createdAt?.slice(0, 10) || '—'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* End Date */}
                      <td style={tdStyle('deadline', 4)} onClick={e => startEdit(e, project, 'deadline')}>
                        <div style={inner('center')}>
                          {editing('deadline') ? (
                            <input ref={cellInputRef} type="date" value={editDisplay}
                              onChange={e => handleValueChange(e.target.value)}
                              onBlur={commitEdit} onKeyDown={handleCellKeyDown}
                              className={`${inlineInputCls} font-mono text-[12px]`} />
                          ) : (
                            <span className="text-[12px] font-mono text-gray-900 whitespace-nowrap">{project.deadline || '—'}</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={tdStyle('status', 5)} onClick={e => startEdit(e, project, 'status')}>
                        <div style={inner('center')}>
                          {editing('status') ? (
                            <select ref={cellInputRef} value={editDisplay}
                              onChange={e => handleValueChange(e.target.value)}
                              onBlur={commitEdit} onKeyDown={handleCellKeyDown}
                              className={`${inlineInputCls} cursor-pointer text-[13px]`}>
                              <option>In Progress</option>
                              <option>Completed</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${sCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sCfg.dot}`} />{project.status}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td style={tdStyle('priority', 6)} onClick={e => startEdit(e, project, 'priority')}>
                        <div style={inner('center')}>
                          {editing('priority') ? (
                            <select ref={cellInputRef} value={editDisplay}
                              onChange={e => handleValueChange(e.target.value)}
                              onBlur={commitEdit} onKeyDown={handleCellKeyDown}
                              className={`${inlineInputCls} cursor-pointer text-[13px]`}>
                              <option>Low</option><option>Medium</option><option>High</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${pCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pCfg.dot}`} />{project.priority}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Progress */}
                      <td style={tdStyle('progress', 7)} onClick={e => startEdit(e, project, 'progress')}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 12px', gap: '8px', overflow: 'hidden' }}>
                          {editing('progress') ? (
                            <input ref={cellInputRef} type="number" min="0" max="100" value={editDisplay}
                              onChange={e => handleValueChange(e.target.value)}
                              onBlur={commitEdit} onKeyDown={handleCellKeyDown}
                              className={`${inlineInputCls} font-mono text-sm w-14`} />
                          ) : (
                            <>
                              <div className="flex-1 h-1.5 rounded-full bg-[#EEF2F7] overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-teal-400 to-cyan-500 rounded-full transition-all"
                                  style={{ width: `${project.progress || 0}%` }} />
                              </div>
                              <span className="text-[12px] font-bold text-gray-600 min-w-[32px] text-right flex-shrink-0">
                                {project.progress || 0}%
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Assigned To */}
                      <td style={tdStyle('team', 8)} onClick={e => startEdit(e, project, 'team')}>
                        <div style={inner()}>
                          {editing('team') ? (
                            <input ref={cellInputRef} value={editDisplay}
                              onChange={e => handleValueChange(e.target.value)}
                              onBlur={commitEdit} onKeyDown={handleCellKeyDown}
                              placeholder="Alice, Bob, Charlie" className={`${inlineInputCls} text-[13px]`} />
                          ) : (
                            <div className="flex items-center" style={{ paddingLeft: '2px' }}>
                              {(project.team || []).slice(0, 3).map((member, i) => (
                                <div key={i} title={member}
                                  className="w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center flex-shrink-0 select-none text-white"
                                  style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], border: '2px solid white', marginLeft: i === 0 ? 0 : '-6px', zIndex: i, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
                                  {member[0]?.toUpperCase()}
                                </div>
                              ))}
                              {(project.team || []).length > 3 && (
                                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white select-none"
                                  style={{ backgroundColor: '#6B7C8F', border: '2px solid white', marginLeft: '-6px', zIndex: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
                                  title={(project.team || []).slice(3).join(', ')}>
                                  +{(project.team || []).length - 3}
                                </div>
                              )}
                              {(!project.team || project.team.length === 0) && (
                                <span className="text-gray-300 text-[12px] italic">Unassigned</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3-dot */}
                      <td style={{ height: '62px', padding: 0, verticalAlign: 'middle', borderBottom: `1px solid ${TABLE_LINE}` }}>
                        <div className="flex items-center justify-center h-full px-2">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (openMenuId === project.id) { setOpenMenuId(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                              setOpenMenuId(project.id);
                            }}
                            className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center gap-[3.5px] transition-all duration-150 ${openMenuId === project.id ? 'bg-[#EEF2F7]' : 'hover:bg-[#EEF2F7]'}`}>
                            {[0,1,2].map(i => (
                              <span key={i} className={`w-1 h-1 rounded-full block transition-colors duration-150 ${openMenuId === project.id ? 'bg-gray-600' : 'bg-gray-300'}`} />
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
          className="fixed z-[9999] bg-white rounded-xl shadow-xl overflow-hidden p-1"
          style={{ top: menuPos.top, right: menuPos.right, minWidth: '165px', border: `1px solid ${TABLE_LINE}`, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
          <button
            onClick={() => { const proj = displayProjects.find(p => p.id === openMenuId); setOpenMenuId(null); if (proj) setDeleteTarget(proj); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} strokeWidth={2} /> Delete Project
          </button>
        </div>
      )}

      {/* NEW PROJECT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ border: `1px solid ${TABLE_LINE}`, scrollbarWidth: 'none' }}
          >
            <div className="sticky top-0 bg-white px-6 py-5 flex items-center justify-between rounded-t-2xl" style={{ borderBottom: `1px solid ${TABLE_LINE}` }}>
              <h2 className="text-xl font-bold text-gray-900">Create New Project</h2>
              <button onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Project Name *</label>
                <input type="text" name="name" value={newProject.name} onChange={handleInputChange} required
                  className={inputCls} style={{ border: `1px solid ${TABLE_LINE}` }} placeholder="Enter project name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea name="description" value={newProject.description} onChange={handleInputChange} rows="3"
                  className={`${inputCls} resize-none`} style={{ border: `1px solid ${TABLE_LINE}` }} placeholder="Enter project description" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                  <select name="status" value={newProject.status} onChange={handleInputChange}
                    className={inputCls} style={{ border: `1px solid ${TABLE_LINE}` }}>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                  <select name="priority" value={newProject.priority} onChange={handleInputChange}
                    className={inputCls} style={{ border: `1px solid ${TABLE_LINE}` }}>
                    <option>Low</option><option>Medium</option><option>High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date *</label>
                  <input type="date" name="startDate" value={newProject.startDate} onChange={handleInputChange} required
                    className={inputCls} style={{ border: `1px solid ${TABLE_LINE}` }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Deadline *</label>
                  <input type="date" name="deadline" value={newProject.deadline} onChange={handleInputChange} required
                    className={inputCls} style={{ border: `1px solid ${TABLE_LINE}` }} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Total Tasks</label>
                  <input type="number" name="totalTasks" value={newProject.totalTasks} onChange={handleInputChange} min="1"
                    className={inputCls} style={{ border: `1px solid ${TABLE_LINE}` }} placeholder="e.g., 30" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Team Members *</label>
                <input type="text" name="team" value={newProject.team} onChange={handleInputChange} required
                  className={inputCls} style={{ border: `1px solid ${TABLE_LINE}` }} placeholder="Alice, Bob, Charlie" />
                <p className="text-xs text-gray-400 mt-1.5">Separate names with commas</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-2 font-semibold rounded-xl text-sm text-gray-600 bg-[#EEF2F7] hover:opacity-80 whitespace-nowrap"
                  style={{ border: `1px solid ${TABLE_LINE}` }}>Cancel</button>
                <button type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold rounded-xl shadow text-sm whitespace-nowrap">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden" style={{ border: `1px solid ${TABLE_LINE}` }}>
            <div className="p-8 pb-7">
              <div className="w-[52px] h-[52px] rounded-xl bg-red-50 border border-red-200 flex items-center justify-center mb-5">
                <Trash2 size={24} className="text-red-500" strokeWidth={1.8} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete this project?</h3>
              <p className="text-sm text-gray-500 mb-4">This action is permanent and cannot be undone.</p>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-7">
                <span className="text-sm font-semibold text-red-600">"{deleteTarget.name}"</span>
                <span className="text-xs text-gray-400 ml-2">will be permanently deleted</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-[#EEF2F7] hover:bg-slate-200"
                  style={{ border: `1px solid ${TABLE_LINE}` }}>Cancel</button>
                <button onClick={confirmDelete}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-red-400 to-red-500 hover:opacity-90 shadow-lg shadow-red-200">
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Projects;