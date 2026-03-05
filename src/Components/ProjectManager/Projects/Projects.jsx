import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from '../../firebase';
import { Loader, Trash2, Columns, X, Users, ChevronDown } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

const TABLE_LINE      = 'rgba(51,51,51,0.20)';
const TABLE_LINE_BOLD = 'rgba(51,51,51,0.30)';
const AVATAR_COLORS   = ['#7B90A4','#8FA3AC','#7A9BAA','#909AAB','#8A9FAD','#8496A8'];

const STATUS_OPTIONS = [
  { value: 'In Progress',                 text: 'text-blue-700',    dot: 'bg-blue-500',    bg: ''    },
  { value: 'Completed',                   text: 'text-emerald-700', dot: 'bg-emerald-500', bg: '' },
  { value: 'Testing Required',            text: 'text-violet-700',  dot: 'bg-violet-500',  bg: ''  },
  { value: 'On Hold',                     text: 'text-amber-700',   dot: 'bg-amber-500',   bg: ''   },
  { value: 'Waiting for Client Response', text: 'text-rose-700',    dot: 'bg-rose-500',    bg: ''    },
];
const getStatusStyle = (s) => STATUS_OPTIONS.find(o => o.value === s) ?? { text:'text-slate-600', dot:'bg-slate-400', bg:'bg-slate-50' };
const getPriorityStyle = (p) => {
  if (p === 'High')   return { text:'text-red-600',     dot:'bg-red-500'     };
  if (p === 'Medium') return { text:'text-amber-600',   dot:'bg-amber-500'   };
  return                     { text:'text-emerald-600', dot:'bg-emerald-500' };
};

const COLUMN_DEFS = [
  { key:'index',       label:'#',            defaultW:44,  minW:40,  align:'center', hideable:false },
  { key:'name',        label:'Project Name', defaultW:160, minW:120, align:'left',   hideable:false },
  { key:'description', label:'Description',  defaultW:200, minW:140, align:'left',   hideable:true  },
  { key:'startDate',   label:'Start Date',   defaultW:110, minW:100, align:'center', hideable:true  },
  { key:'deadline',    label:'End Date',     defaultW:110, minW:100, align:'center', hideable:true  },
  { key:'status',      label:'Status',       defaultW:175, minW:140, align:'center', hideable:true  },
  { key:'priority',    label:'Priority',     defaultW:100, minW:90,  align:'center', hideable:true  },
  { key:'progress',    label:'Progress',     defaultW:130, minW:100, align:'center', hideable:true  },
  { key:'team',        label:'Assigned To',  defaultW:160, minW:120, align:'left',   hideable:true  },
  { key:'actions',     label:'',             defaultW:52,  minW:52,  align:'center', hideable:false },
];

const TOTAL_DEFAULT = COLUMN_DEFS.reduce((s,c) => s + c.defaultW, 0);
const buildDefaultRatios = () => {
  const m = {};
  COLUMN_DEFS.forEach(c => { m[c.key] = c.defaultW / TOTAL_DEFAULT; });
  return m;
};

// ── Reusable status/priority badge ───────────────────────────────────────────
const StatusBadge = ({ value }) => {
  const cfg = getStatusStyle(value);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${cfg.text} ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`}/>{value}
    </span>
  );
};
const PriorityBadge = ({ value }) => {
  const cfg = getPriorityStyle(value);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${cfg.text} bg-opacity-10`}
      style={{ backgroundColor: value==='High'?'#fef2f2': value==='Medium'?'#fffbeb':'#f0fdf4' }}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`}/>{value}
    </span>
  );
};

// ── Team avatars ──────────────────────────────────────────────────────────────
const TeamAvatars = ({ team = [] }) => (
  <div className="flex items-center">
    {team.slice(0,3).map((m,i) => (
      <div key={i} title={m}
        className="w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center flex-shrink-0 text-white select-none"
        style={{ backgroundColor:AVATAR_COLORS[i%AVATAR_COLORS.length], border:'2px solid white', marginLeft:i===0?0:'-6px', zIndex:i, boxShadow:'0 1px 3px rgba(0,0,0,0.15)' }}>
        {m[0]?.toUpperCase()}
      </div>
    ))}
    {team.length > 3 && (
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white select-none"
        style={{ backgroundColor:'#6B7C8F', border:'2px solid white', marginLeft:'-6px', zIndex:3 }}
        title={team.slice(3).join(', ')}>
        +{team.length-3}
      </div>
    )}
    {team.length === 0 && <span className="text-gray-300 text-[12px] italic">Unassigned</span>}
  </div>
);

// ── Team Dropdown — rendered via portal into document.body ───────────────────
const TeamDropdownPortal = ({ anchorEl, project, allMembers, onSave, onClose }) => {
  const [selected, setSelected] = useState(project.team || []);
  const dropRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 200 });

  // Calculate position from anchor element
  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const dropH = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= dropH
      ? rect.bottom + 4
      : rect.top - dropH - 4;
    setPos({ top, left: rect.left, width: Math.max(rect.width, 210) });
  }, [anchorEl]);

  // Close on outside click or outside scroll
  useEffect(() => {
    const h = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) &&
          anchorEl && !anchorEl.contains(e.target)) {
        onSave(selected); onClose();
      }
    };
    const onScroll = (e) => {
     
      if (dropRef.current && dropRef.current.contains(e.target)) return;
      onSave(selected); onClose();
    };
    setTimeout(() => {
      document.addEventListener('mousedown', h);
      document.addEventListener('scroll', onScroll, true);
    }, 0);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [selected]);

  const toggle = (m) =>
    setSelected(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  return ReactDOM.createPortal(
    <div ref={dropRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 99999,
        background: '#fff',
        border: `1px solid ${TABLE_LINE}`,
        borderRadius: 14,
        boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
        maxHeight: 260,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onClick={e => e.stopPropagation()}>

      {/* Header */}
      <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${TABLE_LINE}`, flexShrink: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          Assigned To
        </p>
      </div>

      {/* Member list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {allMembers.length === 0 && (
          <p style={{ fontSize: 12, color: '#9ca3af', padding: '12px', textAlign: 'center', fontStyle: 'italic' }}>
            No members found
          </p>
        )}
        {allMembers.map((m, i) => {
          const isChecked = selected.includes(m);
          return (
            <button key={m} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => toggle(m)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 12px', background: isChecked ? 'rgba(20,184,166,0.06)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = isChecked ? 'rgba(20,184,166,0.10)' : '#f0fdfa'}
              onMouseLeave={e => e.currentTarget.style.background = isChecked ? 'rgba(20,184,166,0.06)' : 'transparent'}>
              {/* Avatar */}
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
              }}>
                {m[0]?.toUpperCase()}
              </div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m}
              </span>
              {/* Checkbox */}
              <span style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${isChecked ? '#14b8a6' : '#d1d5db'}`,
                background: isChecked ? '#14b8a6' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}>
                {isChecked && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5l2 2L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Apply footer */}
      <div style={{ padding: '8px 10px', borderTop: `1px solid ${TABLE_LINE}`, flexShrink: 0 }}>
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => { onSave(selected); onClose(); }}
          style={{
            width: '100%', padding: '7px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#14b8a6,#06b6d4)', color: '#fff',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
          }}>
          Apply
        </button>
      </div>
    </div>,
    document.body
  );
};

export default function Projects() {
  const { showAddProjectModal, setShowAddProjectModal } = useOutletContext();

  const [filter, setFilter]           = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [projectList, setProjectList] = useState([]);
  const [allMembers, setAllMembers]   = useState([]);

  // column ratios & container width
  const [colRatios, setColRatios]     = useState(buildDefaultRatios);
  // FIX: Start with 0, measure real width immediately — avoids wrong ratio on small screens
  const [containerW, setContainerW]   = useState(0);
  const [hiddenCols, setHiddenCols]   = useState(new Set());
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef   = useRef(null);
  const tableWrapRef = useRef(null);
  const resizeState  = useRef(null);

  const [expandedDesc, setExpandedDesc] = useState(null);

  const [editingCell, setEditingCell] = useState(null);
  const editValueRef = useRef('');
  const [editDisplay, setEditDisplay] = useState('');
  const cellInputRef = useRef(null);

  // Team dropdown: store { id, anchorEl } so portal can position from cell rect
  const [teamDrop, setTeamDrop] = useState(null);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos]       = useState({ top:0, right:0 });
  const menuRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  // team dropdown (modal)
  const [teamInput, setTeamInput]         = useState('');
  const [showTeamDrop, setShowTeamDrop]   = useState(false);
  const [sessionMembers, setSessionMembers] = useState([]);
  const teamDropRef  = useRef(null);
  const teamInputRef = useRef(null);

  const [newProject, setNewProject] = useState({
    name:'', description:'', status:'In Progress', priority:'Medium',
    deadline:'', team:[], totalTasks:'', startDate:'',
  });

  const dragItem     = useRef(null);
  const dragOverItem = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [localOrder, setLocalOrder]   = useState([]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (showAddProjectModal) { setShowModal(true); setShowAddProjectModal(false); }
  }, [showAddProjectModal]);

  useEffect(() => {
    const h = (e) => {
      if (menuRef.current    && !menuRef.current.contains(e.target))    setOpenMenuId(null);
      if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false);
      if (teamDropRef.current && !teamDropRef.current.contains(e.target)) setShowTeamDrop(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects'), (snap) => {
      const data = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      setProjectList(data);
      const ms = new Set();
      data.forEach(p => (p.team||[]).forEach(m => m && ms.add(m.trim())));
      setAllMembers([...ms].sort());
    }, console.error);
    return () => unsub();
  }, []);

  useEffect(() => {
    setLocalOrder(prev => {
      const ex  = prev.filter(id => projectList.some(p => p.id === id));
      const add = projectList.map(p => p.id).filter(id => !ex.includes(id));
      return [...ex, ...add];
    });
  }, [projectList]);

  // FIX: measure container width correctly, use real clientWidth immediately
  useEffect(() => {
    const measure = () => {
      if (tableWrapRef.current) {
        const w = tableWrapRef.current.clientWidth;
        if (w > 0) setContainerW(w);
      }
    };
    // Small delay to ensure DOM is painted
    const t = setTimeout(measure, 0);
    const ro = new ResizeObserver(measure);
    if (tableWrapRef.current) ro.observe(tableWrapRef.current);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, []);

  // FIX: Compute effective container width for table layout
  // On small screens where table needs to scroll, use minWidth sum instead
  const visMinW = COLUMN_DEFS
    .filter(c => !hiddenCols.has(c.key))
    .reduce((s, c) => s + c.minW, 0);

  // Use max of actual container vs min required — this prevents columns from squishing
  const effectiveW = containerW > 0 ? Math.max(containerW, visMinW) : visMinW;

  // derived px widths — always based on effectiveW so ratios stay correct
  const colWidths = {};
  COLUMN_DEFS.forEach(c => { colWidths[c.key] = colRatios[c.key] * effectiveW; });

  // ── Resize handle ─────────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e, colKey) => {
    e.preventDefault(); e.stopPropagation();
    const visCols = COLUMN_DEFS.filter(c => !hiddenCols.has(c.key));
    const idx     = visCols.findIndex(c => c.key === colKey);
    const nextCol = visCols[idx+1];
    if (!nextCol) return;
    const colDef  = COLUMN_DEFS.find(c => c.key === colKey);
    const nextDef = COLUMN_DEFS.find(c => c.key === nextCol.key);
    resizeState.current = { colKey, nextKey:nextCol.key, startX:e.clientX, startR:colRatios[colKey], startNR:colRatios[nextCol.key], cW: effectiveW };

    const onMove = (ev) => {
      if (!resizeState.current) return;
      const { colKey, nextKey, startX, startR, startNR, cW } = resizeState.current;
      const d = (ev.clientX - startX) / cW;
      const minR  = colDef.minW  / cW;
      const minNR = nextDef.minW / cW;
      let r  = Math.max(minR,  startR  + d);
      let nr = Math.max(minNR, startNR - d);
      if (r  < minR)  { r  = minR;  nr = startR + startNR - minR;  }
      if (nr < minNR) { nr = minNR; r  = startR + startNR - minNR; }
      setColRatios(prev => ({ ...prev, [colKey]:r, [nextKey]:nr }));
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
  }, [colRatios, hiddenCols, effectiveW]);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const TABS = [
    { key:'all', label:'All' },
    ...STATUS_OPTIONS.map(s => ({ key:s.value, label:s.value })),
  ];
  const displayProjects = localOrder
    .map(id => projectList.find(p => p.id === id)).filter(Boolean)
    .filter(p => filter==='all' || p.status===filter)
    .filter(p => !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase()));
  const countFor = (k) => k==='all' ? projectList.length : projectList.filter(p=>p.status===k).length;

  const visibleCols = COLUMN_DEFS.filter(c => !hiddenCols.has(c.key));
  const toggleCol   = (key) => setHiddenCols(prev => { const n=new Set(prev); n.has(key)?n.delete(key):n.add(key); return n; });

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleDragStart = (e,idx) => { dragItem.current=idx; e.dataTransfer.effectAllowed='move'; setTimeout(()=>{ if(e.target) e.target.style.opacity='0.4'; },0); };
  const handleDragEnter = (e,idx) => { e.preventDefault(); dragOverItem.current=idx; setDragOverIdx(idx); };
  const handleDragOver  = (e,idx) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; if(dragOverItem.current!==idx){dragOverItem.current=idx;setDragOverIdx(idx);} };
  const handleDrop = (e,idx) => {
    e.preventDefault();
    const from=dragItem.current, to=dragOverItem.current??idx;
    if(from===null||to===null||from===to){setDragOverIdx(null);return;}
    const r=[...displayProjects]; const [mv]=r.splice(from,1); r.splice(to,0,mv);
    setLocalOrder([...r.map(p=>p.id),...localOrder.filter(id=>!displayProjects.some(p=>p.id===id))]);
    dragItem.current=null; dragOverItem.current=null; setDragOverIdx(null);
  };
  const handleDragEnd = (e) => { if(e.target) e.target.style.opacity='1'; dragItem.current=null; dragOverItem.current=null; setDragOverIdx(null); };

  // ── Inline edit ───────────────────────────────────────────────────────────
  const getFieldValue = (p,f) => {
    if(f==='name')        return p.name||'';
    if(f==='description') return p.description||'';
    if(f==='startDate')   return p.startDate||p.createdAt?.slice(0,10)||'';
    if(f==='deadline')    return p.deadline||'';
    if(f==='status')      return p.status||'In Progress';
    if(f==='priority')    return p.priority||'Medium';
    if(f==='progress')    return String(p.progress??0);
    if(f==='team')        return Array.isArray(p.team)?p.team.join(', '):'';
    return '';
  };
  const startEdit = (e,project,field) => {
    e.stopPropagation();
    // Team cell: open portal dropdown with anchor element for positioning
    if (field === 'team') {
      setTeamDrop(prev => prev?.id === project.id ? null : { id: project.id, anchorEl: e.currentTarget });
      return;
    }
    if(editingCell?.projectId===project.id && editingCell?.field===field) return;
    if(editingCell) doCommit(editingCell.projectId,editingCell.field,editValueRef.current);
    const val=getFieldValue(project,field);
    editValueRef.current=val; setEditDisplay(val);
    setEditingCell({projectId:project.id,field});
    setTimeout(()=>{cellInputRef.current?.focus();cellInputRef.current?.select();},30);
  };
  const doCommit = useCallback(async (projectId,field,value) => {
    const p=projectList.find(p=>p.id===projectId); if(!p) return;
    let u={};
    if(field==='name')        u={name:value.trim()};
    if(field==='description') u={description:value.trim()};
    if(field==='startDate')   u={startDate:value};
    if(field==='deadline')    u={deadline:value};
    if(field==='status')      u={status:value};
    if(field==='priority')    u={priority:value};
    if(field==='progress')    u={progress:Math.min(100,Math.max(0,parseInt(value)||0))};
    if(field==='team')        u={team:Array.isArray(value)?value:value.split(',').map(m=>m.trim()).filter(Boolean)};
    if(!Object.keys(u).length) return;
    try { await updateDoc(doc(db,'projects',projectId),{...u,updatedAt:new Date().toISOString()}); }
    catch(err){console.error(err);}
  },[projectList]);
  const commitEdit = () => { if(!editingCell) return; doCommit(editingCell.projectId,editingCell.field,editValueRef.current); setEditingCell(null); setEditDisplay(''); editValueRef.current=''; };
  const cancelEdit = () => { setEditingCell(null); setEditDisplay(''); editValueRef.current=''; };
  const handleCellKeyDown = (e) => { if(e.key==='Enter'){e.preventDefault();commitEdit();} if(e.key==='Escape'){e.preventDefault();cancelEdit();} };
  const handleValueChange = (v) => { editValueRef.current=v; setEditDisplay(v); };
  const isEditing = (p,f) => editingCell?.projectId===p.id && editingCell?.field===f;

  // ── Delete ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if(!deleteTarget) return;
    try { await deleteDoc(doc(db,'projects',deleteTarget.id)); } catch { alert('Error deleting.'); }
    setDeleteTarget(null);
  };

  // ── Team dropdown (modal) ─────────────────────────────────────────────────
  const memberPool   = [...new Set([...allMembers,...sessionMembers,...newProject.team])].sort();
  const filteredPool = memberPool.filter(m => m.toLowerCase().includes(teamInput.toLowerCase()) && !newProject.team.includes(m));
  const selectMember = (name) => { setNewProject(prev=>({...prev,team:[...prev.team,name]})); setTeamInput(''); teamInputRef.current?.focus(); };
  const addNewMember = () => {
    const name=teamInput.trim(); if(!name) return;
    if(!newProject.team.includes(name)) { setNewProject(prev=>({...prev,team:[...prev.team,name]})); setSessionMembers(prev=>prev.includes(name)?prev:[...prev,name]); }
    setTeamInput(''); teamInputRef.current?.focus();
  };
  const removeMember = (name) => setNewProject(prev=>({...prev,team:prev.team.filter(m=>m!==name)}));
  const handleTeamKeyDown = (e) => {
    if(e.key==='Enter'){e.preventDefault();addNewMember();}
    if(e.key==='Escape') setShowTeamDrop(false);
    if(e.key==='Backspace' && !teamInput && newProject.team.length>0) removeMember(newProject.team[newProject.team.length-1]);
  };

  const handleInputChange = (e) => setNewProject(prev=>({...prev,[e.target.name]:e.target.value}));
  const handleSubmit = async (e) => {
    e.preventDefault();
    if(newProject.team.length===0){alert('Please assign at least one team member.');return;}
    try {
      await addDoc(collection(db,'projects'),{
        name:newProject.name, description:newProject.description,
        status:newProject.status, priority:newProject.priority, progress:0,
        deadline:newProject.deadline, startDate:newProject.startDate||'',
        team:newProject.team, tasks:{total:parseInt(newProject.totalTasks)||0,completed:0},
        createdAt:new Date().toISOString(),
      });
      setNewProject({name:'',description:'',status:'In Progress',priority:'Medium',deadline:'',team:[],totalTasks:'',startDate:''});
      setTeamInput(''); setSessionMembers([]); setShowModal(false);
    } catch { alert('Error creating project.'); }
  };

  const inputCls       = 'w-full px-4 py-3 rounded-lg text-gray-800 placeholder-gray-400 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all duration-200';
  const inlineInputCls = 'w-full border-none outline-none bg-transparent text-gray-900 p-0 text-sm font-medium';
  const inner = (j='flex-start') => ({ display:'flex', alignItems:'center', justifyContent:j, height:'100%', padding:'0 12px', overflow:'hidden' });
  const makeTd = (field, ci, editing, isDragOver) => ({
    position:'relative', height:'62px', padding:0, verticalAlign:'middle',
    cursor: field?'cell':'default',
    borderRight: ci<visibleCols.length-1 ? `1px solid ${TABLE_LINE}` : undefined,
    borderBottom: `1px solid ${TABLE_LINE}`,
    outline: editing?'2px solid #14b8a6': isDragOver?'2px solid #14b8a6':undefined,
    outlineOffset: editing?'-2px':undefined,
    backgroundColor: editing?'rgba(20,184,166,0.06)':undefined,
    transition:'background 0.1s', overflow:'hidden',
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <div className="p-3 sm:p-4 md:p-6 space-y-4">

        {/* ── TOOLBAR ── */}
        <div className="flex flex-col gap-2">

          {/* Top row: search + columns btn */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                style={{ border:`1px solid ${TABLE_LINE}` }}/>
            </div>

            <div className="relative flex-shrink-0" ref={colMenuRef}>
              <button onClick={()=>setShowColMenu(v=>!v)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm whitespace-nowrap"
                style={{ border:`1px solid ${TABLE_LINE}` }}>
                <Columns size={15}/> Columns
                {hiddenCols.size>0 && <span className="bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{hiddenCols.size}</span>}
              </button>
              {showColMenu && (
                <div className="absolute right-0 top-full mt-2 z-[999] bg-white rounded-xl shadow-xl p-2 min-w-[190px]"
                  style={{ border:`1px solid ${TABLE_LINE}`, boxShadow:'0 10px 30px rgba(0,0,0,0.12)' }}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1 mb-1">Toggle Columns</p>
                  {COLUMN_DEFS.filter(c=>c.hideable).map(col=>(
                    <button key={col.key} onClick={()=>toggleCol(col.key)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-700 hover:bg-gray-50 transition-colors">
                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${hiddenCols.has(col.key)?'border-gray-300 bg-white':'border-teal-500 bg-teal-500'}`}>
                        {!hiddenCols.has(col.key) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      {col.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabs row */}
          <div className="flex gap-1 rounded-xl p-1 bg-white shadow-sm overflow-x-auto"
            style={{ border:`1px solid ${TABLE_LINE}`, scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}>
            {TABS.map(tab => {
              const active = filter===tab.key;
              return (
                <button key={tab.key} onClick={()=>setFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                    ${active?'bg-teal-500 text-white shadow':'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
                  {tab.label}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none
                    ${active?'bg-white/25 text-white':'bg-[#EEF2F7] text-gray-500'}`}>
                    {countFor(tab.key)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="bg-white rounded-2xl shadow-sm w-full" style={{ border:`1px solid ${TABLE_LINE}`, overflow:'hidden' }}>
          <div ref={tableWrapRef}
            style={{ overflowX:'auto', overflowY:'auto', maxHeight:'calc(100vh - 260px)', WebkitOverflowScrolling:'touch' }}>
            <style>{`
              .proj-wrap { scrollbar-width:thin; scrollbar-color:rgba(20,184,166,0.4) transparent; }
              .proj-wrap::-webkit-scrollbar { height:4px; width:4px; }
              .proj-wrap::-webkit-scrollbar-track { background:transparent; }
              .proj-wrap::-webkit-scrollbar-thumb { background:rgba(20,184,166,0.4); border-radius:999px; }
              .proj-wrap::-webkit-scrollbar-thumb:hover { background:rgba(20,184,166,0.75); }
              .col-rz { position:absolute; right:0; top:0; height:100%; width:6px; cursor:col-resize; z-index:20; }
              .col-rz:hover,.col-rz:active { background:rgba(20,184,166,0.35); }
            `}</style>
            <table className="proj-wrap border-collapse"
              style={{
                tableLayout: 'fixed',
                // FIX: width is effectiveW px on small screens, 100% on large
                width: containerW > 0 && containerW >= visMinW ? '100%' : `${visMinW}px`,
                minWidth: `${visMinW}px`,
              }}>
              <colgroup>
                {visibleCols.map(c => (
                  <col key={c.key} style={{ width: `${colWidths[c.key]}px` }}/>
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EEF2F7]" style={{ borderBottom:`2px solid ${TABLE_LINE_BOLD}` }}>
                  {visibleCols.map((col,i)=>(
                    <th key={col.key}
                      style={{ position:'relative', textAlign:col.align, width:`${colWidths[col.key]}px`, borderRight:i<visibleCols.length-1?`1px solid ${TABLE_LINE}`:undefined, padding:'10px 8px', overflow:'hidden' }}
                      className="text-xs font-semibold text-gray-600 uppercase tracking-wider select-none whitespace-nowrap">
                      {col.label}
                      {i<visibleCols.length-1 && <span className="col-rz" onMouseDown={e=>onResizeMouseDown(e,col.key)}/>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayProjects.length===0 && (
                  <tr><td colSpan={visibleCols.length} className="py-20 text-center">
                    <div className="flex justify-center mb-3"><Loader className="text-gray-300"/></div>
                    <p className="text-gray-400 text-sm">{filter==='all'?'No projects yet':`No "${filter}" projects`}</p>
                  </td></tr>
                )}
                {displayProjects.map((project,idx)=>{
                  const isDragOver = dragOverIdx===idx && dragItem.current!==idx;
                  const rowBg      = idx%2===0?'bg-white':'';
                  const ed         = (f)=>isEditing(project,f);

                  const renderCell = (col,ci) => {
                    const tdS = makeTd(!['index','actions'].includes(col.key)?col.key:null, ci, ed(col.key), isDragOver);

                    if(col.key==='index') return (
                      <td key={col.key} style={{...tdS,cursor:'grab',overflow:'hidden'}}><div style={inner('center')}><span className="text-xs font-bold font-mono text-gray-300">{idx+1}</span></div></td>
                    );
                    if(col.key==='name') return (
                      <td key={col.key} style={{...tdS,overflow:'hidden'}} onClick={e=>startEdit(e,project,'name')}>
                        <div style={inner()}>{ed('name')?<input ref={cellInputRef} value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} font-semibold text-[14px]`}/>:<p className="text-[14px] font-semibold text-gray-900 truncate w-full" title={project.name}>{project.name}</p>}</div>
                      </td>
                    );
                    if(col.key==='description') return (
                      <td key={col.key} style={{...tdS,overflow:'hidden'}} onClick={e=>startEdit(e,project,'description')} onDoubleClick={e=>{e.stopPropagation();if(project.description)setExpandedDesc({name:project.name,description:project.description});}}>
                        <div style={inner()}>{ed('description')?<input ref={cellInputRef} value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} placeholder="Add description..." className={`${inlineInputCls} text-[13px]`}/>:<p className="text-[12px] text-gray-500 truncate w-full">{project.description||<span className="text-gray-300 italic">No description</span>}</p>}</div>
                      </td>
                    );
                    if(col.key==='startDate') return (
                      <td key={col.key} style={{...tdS,overflow:'hidden'}} onClick={e=>startEdit(e,project,'startDate')}>
                        <div style={inner('center')}>{ed('startDate')?<input ref={cellInputRef} type="date" value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} font-mono text-[12px]`}/>:<span className="text-[12px] font-mono text-gray-900 whitespace-nowrap">{project.startDate||project.createdAt?.slice(0,10)||'—'}</span>}</div>
                      </td>
                    );
                    if(col.key==='deadline') return (
                      <td key={col.key} style={{...tdS,overflow:'hidden'}} onClick={e=>startEdit(e,project,'deadline')}>
                        <div style={inner('center')}>{ed('deadline')?<input ref={cellInputRef} type="date" value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} font-mono text-[12px]`}/>:<span className="text-[12px] font-mono text-gray-900 whitespace-nowrap">{project.deadline||'—'}</span>}</div>
                      </td>
                    );
                    if(col.key==='status') return (
                      <td key={col.key} style={{...tdS,overflow:'hidden'}} onClick={e=>startEdit(e,project,'status')}>
                        <div style={inner('center')}>{ed('status')?<select ref={cellInputRef} value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} cursor-pointer text-[12px]`}>{STATUS_OPTIONS.map(o=><option key={o.value}>{o.value}</option>)}</select>:<StatusBadge value={project.status}/>}</div>
                      </td>
                    );
                    if(col.key==='priority') return (
                      <td key={col.key} style={{...tdS,overflow:'hidden'}} onClick={e=>startEdit(e,project,'priority')}>
                        <div style={inner('center')}>{ed('priority')?<select ref={cellInputRef} value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} cursor-pointer text-[13px]`}><option>Low</option><option>Medium</option><option>High</option></select>:<PriorityBadge value={project.priority}/>}</div>
                      </td>
                    );
                    if(col.key==='progress') return (
                      <td key={col.key} style={{...tdS,overflow:'hidden'}} onClick={e=>startEdit(e,project,'progress')}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', padding:'0 12px', gap:'8px', overflow:'hidden' }}>
                          {ed('progress')?<input ref={cellInputRef} type="number" min="0" max="100" value={editDisplay} onChange={e=>handleValueChange(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={`${inlineInputCls} font-mono text-sm w-14`}/>:<><div className="flex-1 h-1.5 rounded-full bg-[#EEF2F7] overflow-hidden"><div className="h-full bg-gradient-to-r from-teal-400 to-cyan-500 rounded-full transition-all" style={{ width:`${project.progress||0}%` }}/></div><span className="text-[12px] font-bold text-gray-600 min-w-[32px] text-right flex-shrink-0">{project.progress||0}%</span></>}
                        </div>
                      </td>
                    );

                    // ── TEAM CELL — portal dropdown ─────────────────────────
                    if(col.key==='team') return (
                      <td key={col.key} style={tdS} onClick={e=>{ e.stopPropagation(); const anchor = e.currentTarget; setTeamDrop(prev => prev?.id===project.id ? null : { id: project.id, anchorEl: anchor }); }}>
                        <div style={{ ...inner(), cursor:'pointer' }}>
                          <div className="flex items-center gap-2 w-full">
                            <TeamAvatars team={project.team||[]}/>
                            <ChevronDown size={12}
                              style={{ color: teamDrop?.id===project.id ? '#14b8a6' : '#d1d5db', flexShrink:0, marginLeft:'auto',
                                transform: teamDrop?.id===project.id ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s' }}/>
                          </div>
                        </div>
                      </td>
                    );

                    if(col.key==='actions') return (
                      <td key={col.key} style={{ height:'62px', padding:0, verticalAlign:'middle', borderBottom:`1px solid ${TABLE_LINE}` }}>
                        <div className="flex items-center justify-center h-full px-2">
                          <button onClick={e=>{ e.stopPropagation(); if(openMenuId===project.id){setOpenMenuId(null);return;} const rect=e.currentTarget.getBoundingClientRect(); setMenuPos({top:rect.bottom+6,right:window.innerWidth-rect.right}); setOpenMenuId(project.id); }}
                            className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center gap-[3.5px] transition-all ${openMenuId===project.id?'bg-[#EEF2F7]':'hover:bg-[#EEF2F7]'}`}>
                            {[0,1,2].map(i=><span key={i} className={`w-1 h-1 rounded-full block ${openMenuId===project.id?'bg-gray-600':'bg-gray-300'}`}/>)}
                          </button>
                        </div>
                      </td>
                    );
                    return null;
                  };
                  return (
                    <tr key={project.id} draggable onDragStart={e=>handleDragStart(e,idx)} onDragEnter={e=>handleDragEnter(e,idx)} onDragOver={e=>handleDragOver(e,idx)} onDrop={e=>handleDrop(e,idx)} onDragEnd={handleDragEnd}
                      className={`${rowBg} transition-colors duration-100`}>
                      {visibleCols.map((col,ci)=>renderCell(col,ci))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── DESCRIPTION MODAL ── */}
      {expandedDesc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-sm bg-black/30" onClick={()=>setExpandedDesc(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" style={{ border:`1px solid ${TABLE_LINE}` }} onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:`1px solid ${TABLE_LINE}` }}>
              <div><p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Description</p><h3 className="text-base font-bold text-gray-900">{expandedDesc.name}</h3></div>
              <button onClick={()=>setExpandedDesc(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X size={16}/></button>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto"><p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{expandedDesc.description}</p></div>
          </div>
        </div>
      )}

      {/* ── 3-DOT PORTAL ── */}
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

      {/* ── NEW PROJECT MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto" style={{ border:`1px solid ${TABLE_LINE}`, scrollbarWidth:'none' }}>
            <div className="sticky top-0 bg-white px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between rounded-t-2xl z-10" style={{ borderBottom:`1px solid ${TABLE_LINE}` }}>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Create New Project</h2>
              <button onClick={()=>setShowModal(false)} className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Project Name *</label>
                <input type="text" name="name" value={newProject.name} onChange={handleInputChange} required className={inputCls} style={{ border:`1px solid ${TABLE_LINE}` }} placeholder="Enter project name"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea name="description" value={newProject.description} onChange={handleInputChange} rows="3" className={`${inputCls} resize-none`} style={{ border:`1px solid ${TABLE_LINE}` }} placeholder="Enter project description"/>
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
                <input type="number" name="totalTasks" value={newProject.totalTasks} onChange={handleInputChange} min="1" className={inputCls} style={{ border:`1px solid ${TABLE_LINE}` }} placeholder="e.g., 30"/>
              </div>

              {/* Team members */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assign Team Members *
                  {newProject.team.length>0 && <span className="ml-2 text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">{newProject.team.length} selected</span>}
                </label>
                <div className="relative" ref={teamDropRef}>
                  <div
                    className="min-h-[48px] w-full rounded-lg bg-white px-3 py-2 flex flex-wrap gap-1.5 items-center cursor-text transition-all"
                    style={{ border:`1px solid ${showTeamDrop?'#14b8a6':TABLE_LINE}`, boxShadow:showTeamDrop?'0 0 0 3px rgba(20,184,166,0.15)':undefined }}
                    onClick={()=>{ teamInputRef.current?.focus(); setShowTeamDrop(true); }}>
                    {newProject.team.length===0 && !teamInput && (
                      <span className="flex items-center gap-1.5 text-gray-400 text-sm pointer-events-none select-none"><Users size={14}/> Choose team members...</span>
                    )}
                    {newProject.team.map(m=>(
                      <span key={m} className="inline-flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-700 text-[12px] font-semibold px-2 py-0.5 rounded-full">
                        <span className="w-4 h-4 rounded-full bg-teal-500 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">{m[0]?.toUpperCase()}</span>
                        {m}
                        <button type="button" onClick={e=>{e.stopPropagation();removeMember(m);}} className="text-teal-400 hover:text-red-500 transition-colors leading-none ml-0.5 text-base">×</button>
                      </span>
                    ))}
                    <input ref={teamInputRef} type="text" value={teamInput}
                      onChange={e=>{setTeamInput(e.target.value);setShowTeamDrop(true);}}
                      onFocus={()=>setShowTeamDrop(true)}
                      onKeyDown={handleTeamKeyDown}
                      className="flex-1 min-w-[100px] border-none outline-none bg-transparent text-sm text-gray-800 placeholder-gray-400 py-0.5"
                      placeholder={newProject.team.length>0?'Add more...':''}/>
                  </div>
                  {showTeamDrop && (
                    <div className="absolute left-0 right-0 z-[200] bg-white rounded-xl shadow-xl"
                      style={{ bottom:'100%', marginBottom:'4px', border:`1px solid ${TABLE_LINE}`, boxShadow:'0 -8px 24px rgba(0,0,0,0.13)', maxHeight:'180px', overflowY:'auto' }}>
                      {filteredPool.map(m=>(
                        <button key={m} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>selectMember(m)}
                          className="w-full px-3 py-2 text-left text-[13px] text-gray-700 font-medium hover:bg-teal-50 transition-colors">
                          {m}
                        </button>
                      ))}
                      {filteredPool.length===0 && (
                        <p className="text-[12px] text-gray-400 px-3 py-3 text-center">No members found</p>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">Click to see existing · Type to search or add · Backspace to remove last</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2.5 font-semibold rounded-xl text-sm text-gray-600 bg-[#EEF2F7] hover:opacity-80" style={{ border:`1px solid ${TABLE_LINE}` }}>Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold rounded-xl shadow text-sm">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm bg-black/35">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden" style={{ border:`1px solid ${TABLE_LINE}` }}>
            <div className="p-6 sm:p-8 pb-6 sm:pb-7">
              <div className="w-[52px] h-[52px] rounded-xl bg-red-50 border border-red-200 flex items-center justify-center mb-5"><Trash2 size={24} className="text-red-500" strokeWidth={1.8}/></div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete this project?</h3>
              <p className="text-sm text-gray-500 mb-4">This action is permanent and cannot be undone.</p>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
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

      {/* ── TEAM DROPDOWN PORTAL ── */}
      {teamDrop && (() => {
        const project = projectList.find(p => p.id === teamDrop.id);
        if (!project) return null;
        return (
          <TeamDropdownPortal
            anchorEl={teamDrop.anchorEl}
            project={project}
            allMembers={allMembers}
            onSave={(newTeam) => doCommit(project.id, 'team', newTeam)}
            onClose={() => setTeamDrop(null)}
          />
        );
      })()}
    </div>
  );
}