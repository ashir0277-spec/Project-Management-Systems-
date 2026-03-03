import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query,
  where, orderBy, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../PMS/src/Components/firebase';
import {
  IoCheckmarkCircleOutline, IoTimeOutline, IoAlertCircleOutline,
  IoEllipsisVertical, IoCloseOutline, IoSearchOutline,
  IoCalendarOutline, IoPersonOutline, IoFolderOutline,
  IoChevronDown, IoLogOutOutline, IoNotificationsOutline,
  IoGridOutline, IoListOutline, IoCheckmark,
  IoBarChartOutline, IoLayersOutline, IoFlashOutline,
} from 'react-icons/io5';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ── Status & Priority configs ────────────────────────────────────────────────
const STATUS = {
  todo:        { label: 'To Do',       color: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400',   border: 'border-l-slate-400',   ring: 'ring-slate-300' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',    border: 'border-l-blue-500',    ring: 'ring-blue-300' },
  review:      { label: 'In Review',   color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',   border: 'border-l-amber-500',   ring: 'ring-amber-300' },
  done:        { label: 'Done',        color: 'bg-green-100 text-green-700',   dot: 'bg-green-500',   border: 'border-l-green-500',   ring: 'ring-green-300' },
  blocked:     { label: 'Blocked',     color: 'bg-red-100 text-red-700',       dot: 'bg-red-500',     border: 'border-l-red-500',     ring: 'ring-red-300' },
};

const PRIORITY = {
  low:    { label: 'Low',    color: 'text-slate-500', bg: 'bg-slate-100',  border: 'border-slate-200' },
  normal: { label: 'Normal', color: 'text-blue-600',  bg: 'bg-blue-50',    border: 'border-blue-200' },
  high:   { label: 'High',   color: 'text-orange-600',bg: 'bg-orange-50',  border: 'border-orange-200' },
  urgent: { label: 'Urgent', color: 'text-red-600',   bg: 'bg-red-50',     border: 'border-red-200' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (str) => {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const isOverdue = (str, status) => {
  if (!str || status === 'done') return false;
  return new Date(str) < new Date();
};
const getDev = () => ({
  email: sessionStorage.getItem('userEmail') || '',
  name:  sessionStorage.getItem('userName')  || 'Developer',
  role:  sessionStorage.getItem('userRole')  || 'Developer',
  id:    sessionStorage.getItem('userId')    || '',
});

// ─────────────────────────────────────────────────────────────────────────────
const DeveloperDashboard = ({ onLogout }) => {
  const dev = getDev();

  const [tasks,        setTasks]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode,     setViewMode]     = useState('list');
  const [activeNav,    setActiveNav]    = useState('tasks');
  const [detailTask,   setDetailTask]   = useState(null);
  const [statusMenu,   setStatusMenu]   = useState(null); // task id
  const [updating,     setUpdating]     = useState(null);
  const [notifOpen,    setNotifOpen]    = useState(false);

  // ── Fetch tasks ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dev.email) return;

    // Try fetching by assignedEmails field (array)
    const q = query(
      collection(db, 'tasks'),
      where('assignedEmails', 'array-contains', dev.email),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => {
      // Fallback: try assignedTo field
      console.warn('assignedEmails query failed, trying assignedTo:', err);
      const q2 = query(
        collection(db, 'tasks'),
        where('assignedTo', 'array-contains', dev.email),
        orderBy('createdAt', 'desc')
      );
      const unsub2 = onSnapshot(q2, snap => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
      return unsub2;
    });

    return () => unsub();
  }, [dev.email]);

  // ── Update task status ─────────────────────────────────────────────────────
  const updateStatus = async (taskId, newStatus) => {
    setUpdating(taskId);
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: dev.email,
      });
      if (detailTask?.id === taskId) setDetailTask(p => ({ ...p, status: newStatus }));
      toast.success(`✓ Status → ${STATUS[newStatus]?.label}`, { position: 'top-right', autoClose: 2000 });
    } catch (err) {
      toast.error('Failed to update status');
      console.error(err);
    }
    setUpdating(null);
    setStatusMenu(null);
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try { await signOut(auth); } catch (_) {}
    sessionStorage.clear();
    onLogout && onLogout();
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = tasks.filter(t => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      (t.title || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.projectName || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = {
    total:       tasks.length,
    todo:        tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    review:      tasks.filter(t => t.status === 'review').length,
    done:        tasks.filter(t => t.status === 'done').length,
    blocked:     tasks.filter(t => t.status === 'blocked').length,
  };

  // Unique projects from tasks
  const projects = Object.values(
    tasks.reduce((acc, t) => {
      if (t.projectId && !acc[t.projectId]) {
        acc[t.projectId] = {
          id: t.projectId, name: t.projectName || t.projectId,
          tasks: tasks.filter(x => x.projectId === t.projectId),
        };
      }
      return acc;
    }, {})
  );

  const overdueCount  = tasks.filter(t => isOverdue(t.dueDate, t.status)).length;
  const completePct   = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const boardCols     = ['todo', 'in_progress', 'review', 'done'];

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

        .dev-db, .dev-db * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }

        .dev-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .dev-scroll::-webkit-scrollbar-track { background: transparent; }
        .dev-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }
        .dev-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .fade-up  { animation: fadeUp 0.25s ease-out both; }
        .fu-1 { animation-delay:.04s; } .fu-2 { animation-delay:.08s; }
        .fu-3 { animation-delay:.12s; } .fu-4 { animation-delay:.16s; }
        .fu-5 { animation-delay:.20s; } .fu-6 { animation-delay:.24s; }

        @keyframes spin { to { transform:rotate(360deg); } }
        .spin { animation: spin .75s linear infinite; }

        .task-row { transition: background 0.14s, box-shadow 0.14s, border-color 0.14s; }
        .task-row:hover { background: #f0f7ff; box-shadow: 0 1px 6px rgba(0,129,255,0.07); }

        .board-card { transition: transform 0.15s, box-shadow 0.15s; }
        .board-card:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.09); }

        .stat-chip { transition: transform 0.15s, box-shadow 0.15s; }
        .stat-chip:hover { transform:translateY(-2px); box-shadow:0 6px 18px rgba(0,0,0,0.08); }

        .nav-link { transition: all 0.15s; }
        .progress-fill { transition: width 0.8s cubic-bezier(.4,0,.2,1); }

        .status-btn { transition: all 0.15s; }
        .status-btn:hover:not(.active-status) { border-color:#0081FF; color:#0081FF; }
      `}</style>

      <ToastContainer />

      <div className="dev-db min-h-screen bg-[#F4F7FA] flex">

        {/* ════════════════════════════
            SIDEBAR
        ════════════════════════════ */}
        <aside className="w-[220px] bg-white border-r border-[#E6EAF0] flex flex-col fixed h-full z-20 shrink-0">
          {/* Brand */}
          <div className="px-5 py-5 border-b border-[#E6EAF0]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0081FF] flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="5" height="5" rx="1.5" fill="white"/>
                  <rect x="9" y="2" width="5" height="5" rx="1.5" fill="white" opacity=".5"/>
                  <rect x="2" y="9" width="5" height="5" rx="1.5" fill="white" opacity=".5"/>
                  <rect x="9" y="9" width="5" height="5" rx="1.5" fill="white"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-none">DevSpace</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Project Portal</p>
              </div>
            </div>
          </div>

          {/* Dev Avatar */}
          <div className="px-4 py-4 border-b border-[#E6EAF0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0081FF] to-[#60b4ff] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
                {dev.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{dev.name}</p>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">{dev.role}</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {[
              { key: 'tasks',    label: 'My Tasks',    icon: IoCheckmarkCircleOutline, badge: stats.total },
              { key: 'projects', label: 'Projects',    icon: IoFolderOutline,          badge: projects.length },
              { key: 'progress', label: 'Progress',    icon: IoBarChartOutline,        badge: null },
            ].map(({ key, label, icon: Icon, badge }) => (
              <button
                key={key}
                onClick={() => setActiveNav(key)}
                className={`nav-link w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                  activeNav === key
                    ? 'bg-[#EBF4FF] text-[#0081FF]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="text-[18px] shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {badge !== null && badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                    activeNav === key ? 'bg-[#0081FF] text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="px-3 pb-5 border-t border-[#E6EAF0] pt-3">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <IoLogOutOutline className="text-lg shrink-0" />
              Logout
            </button>
          </div>
        </aside>

        {/* ════════════════════════════
            MAIN
        ════════════════════════════ */}
        <main className="flex-1 ml-[220px] flex flex-col">

          {/* Header */}
          <header className="bg-white border-b border-[#E6EAF0] px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
            <div>
              <h1 className="text-[17px] font-bold text-gray-900">
                {activeNav === 'tasks'    ? 'My Tasks' :
                 activeNav === 'projects' ? 'My Projects' : 'My Progress'}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Notification bell */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors relative"
                >
                  <IoNotificationsOutline className="text-xl text-gray-600" />
                  {(overdueCount > 0 || stats.blocked > 0) && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                  )}
                </button>
                {notifOpen && (
                  <>
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E6EAF0] rounded-2xl shadow-xl z-50 overflow-hidden fade-up">
                      <div className="px-4 py-3 border-b border-[#E6EAF0] flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">Notifications</p>
                        <button onClick={() => setNotifOpen(false)}>
                          <IoCloseOutline className="text-gray-400 text-lg" />
                        </button>
                      </div>
                      <div className="max-h-64 dev-scroll overflow-y-auto">
                        {overdueCount === 0 && stats.blocked === 0 ? (
                          <div className="py-8 text-center">
                            <p className="text-gray-400 text-sm">All clear! No alerts.</p>
                          </div>
                        ) : (
                          <div className="p-3 space-y-2">
                            {overdueCount > 0 && (
                              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                                <p className="text-sm font-semibold text-red-700">⏰ {overdueCount} Overdue Task{overdueCount > 1 ? 's' : ''}</p>
                                <p className="text-xs text-red-500 mt-0.5">Please update their status or complete them.</p>
                              </div>
                            )}
                            {stats.blocked > 0 && (
                              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                                <p className="text-sm font-semibold text-orange-700">🚧 {stats.blocked} Blocked Task{stats.blocked > 1 ? 's' : ''}</p>
                                <p className="text-xs text-orange-500 mt-0.5">Notify your PM about these blockers.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  </>
                )}
              </div>

              {/* Avatar */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0081FF] to-[#60b4ff] flex items-center justify-center text-white font-bold text-sm shadow-md">
                {dev.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </header>

          {/* ── CONTENT ── */}
          <div className="flex-1 p-6">

            {/* ══ TASKS ══════════════════════════════ */}
            {activeNav === 'tasks' && (
              <div>
                {/* Stat chips */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                  {[
                    { label:'Total',      val:stats.total,       icon:IoLayersOutline,          col:'text-gray-600',  bg:'bg-white',        ib:'bg-gray-100' },
                    { label:'In Progress',val:stats.in_progress, icon:IoTimeOutline,            col:'text-blue-600',  bg:'bg-white',        ib:'bg-blue-100' },
                    { label:'In Review',  val:stats.review,      icon:IoFlashOutline,           col:'text-amber-600', bg:'bg-white',        ib:'bg-amber-100' },
                    { label:'Done',       val:stats.done,        icon:IoCheckmarkCircleOutline, col:'text-green-600', bg:'bg-white',        ib:'bg-green-100' },
                    { label:'Blocked',    val:stats.blocked,     icon:IoAlertCircleOutline,     col:'text-red-600',   bg:'bg-white',        ib:'bg-red-100' },
                  ].map(({ label, val, icon: Icon, col, bg, ib }, i) => (
                    <div key={label} className={`stat-chip ${bg} border border-[#E6EAF0] rounded-2xl p-4 flex items-center gap-3 fade-up fu-${i+1}`}>
                      <div className={`${ib} w-10 h-10 rounded-xl flex items-center justify-center shrink-0`}>
                        <Icon className={`text-xl ${col}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900 leading-none">{val}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overall progress bar */}
                {stats.total > 0 && (
                  <div className="bg-white border border-[#E6EAF0] rounded-2xl p-5 mb-5 fade-up fu-3">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Overall Completion</p>
                        <p className="text-xs text-gray-400 mt-0.5">{stats.done} of {stats.total} tasks completed</p>
                      </div>
                      <p className="text-2xl font-bold text-[#0081FF]">{completePct}%</p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="progress-fill h-2.5 rounded-full bg-gradient-to-r from-[#0081FF] to-[#60b4ff]"
                        style={{ width: `${completePct}%` }}
                      />
                    </div>
                    {/* Mini legend */}
                    <div className="flex flex-wrap gap-4 mt-3">
                      {[
                        { label:'To Do',       val:stats.todo,        dot:'bg-slate-400' },
                        { label:'In Progress', val:stats.in_progress, dot:'bg-blue-500' },
                        { label:'Review',      val:stats.review,      dot:'bg-amber-500' },
                        { label:'Done',        val:stats.done,        dot:'bg-green-500' },
                        { label:'Blocked',     val:stats.blocked,     dot:'bg-red-500' },
                      ].map(({ label, val, dot }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
                          <span className="text-xs text-gray-500">{label}: <span className="font-semibold text-gray-700">{val}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Toolbar */}
                <div className="flex flex-wrap gap-3 items-center mb-4 fade-up fu-4">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <IoSearchOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search tasks..."
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#E6EAF0] rounded-xl bg-white focus:outline-none focus:border-[#0081FF] focus:ring-2 focus:ring-[#0081FF]/15 transition-all"
                    />
                  </div>

                  {/* Status select */}
                  <div className="relative">
                    <select
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      className="appearance-none pl-4 pr-9 py-2.5 text-sm border border-[#E6EAF0] rounded-xl bg-white focus:outline-none focus:border-[#0081FF] text-gray-700 cursor-pointer"
                    >
                      <option value="all">All Status</option>
                      {Object.entries(STATUS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <IoChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
                  </div>

                  {/* View toggle */}
                  <div className="flex border border-[#E6EAF0] rounded-xl overflow-hidden bg-white">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-2.5 transition-colors ${viewMode === 'list' ? 'bg-[#0081FF] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <IoListOutline className="text-lg" />
                    </button>
                    <button
                      onClick={() => setViewMode('board')}
                      className={`px-3 py-2.5 transition-colors ${viewMode === 'board' ? 'bg-[#0081FF] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <IoGridOutline className="text-lg" />
                    </button>
                  </div>
                </div>

                {/* ── LIST VIEW ── */}
                {viewMode === 'list' && (
                  <div className="bg-white border border-[#E6EAF0] rounded-2xl overflow-hidden fade-up fu-5">
                    {/* Table head */}
                    <div className="grid grid-cols-[2.5fr_1.5fr_1fr_1.1fr_1fr_36px] px-5 py-3 border-b border-[#E6EAF0] bg-[#FAFBFC]">
                      {['Task', 'Project', 'Priority', 'Due Date', 'Status', ''].map((h, i) => (
                        <p key={i} className={`text-[11px] font-semibold text-gray-500 uppercase tracking-wider ${i === 5 ? '' : ''}`}>{h}</p>
                      ))}
                    </div>

                    {loading ? (
                      <div className="py-16 text-center">
                        <div className="w-8 h-8 border-2 border-[#0081FF] border-t-transparent rounded-full spin mx-auto mb-3" />
                        <p className="text-sm text-gray-400">Loading your tasks...</p>
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <IoCheckmarkCircleOutline className="text-3xl text-gray-300" />
                        </div>
                        <p className="text-gray-500 font-semibold">No tasks found</p>
                        <p className="text-gray-400 text-sm mt-1">
                          {search ? `No results for "${search}"` : 'Your Project Manager has not assigned tasks yet'}
                        </p>
                      </div>
                    ) : (
                      <div className="dev-scroll max-h-[520px] overflow-y-auto divide-y divide-[#F2F5F8]">
                        {filtered.map((task, idx) => {
                          const st  = STATUS[task.status]   || STATUS.todo;
                          const pr  = PRIORITY[task.priority] || PRIORITY.normal;
                          const ov  = isOverdue(task.dueDate, task.status);
                          return (
                            <div
                              key={task.id}
                              className={`task-row grid grid-cols-[2.5fr_1.5fr_1fr_1.1fr_1fr_36px] px-5 py-3.5 cursor-pointer items-center border-l-[3px] fade-up ${st.border}`}
                              style={{ animationDelay: `${idx * 0.03}s` }}
                              onClick={() => setDetailTask(task)}
                            >
                              {/* Title + desc */}
                              <div className="pr-3 min-w-0">
                                <p className={`text-sm font-semibold truncate ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                  {task.title}
                                </p>
                                {task.description && (
                                  <p className="text-xs text-gray-400 truncate mt-0.5">{task.description}</p>
                                )}
                              </div>

                              {/* Project */}
                              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                <IoFolderOutline className="text-gray-300 text-sm shrink-0" />
                                <span className="text-xs text-gray-500 truncate">{task.projectName || task.projectId || '—'}</span>
                              </div>

                              {/* Priority */}
                              <div>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${pr.bg} ${pr.color} ${pr.border}`}>
                                  {pr.label}
                                </span>
                              </div>

                              {/* Due */}
                              <div>
                                <p className={`text-xs flex items-center gap-1 font-medium ${ov ? 'text-red-500' : 'text-gray-500'}`}>
                                  <IoCalendarOutline className="shrink-0" />
                                  {fmtDate(task.dueDate)}
                                </p>
                                {ov && <p className="text-[10px] text-red-400 font-semibold mt-0.5">Overdue</p>}
                              </div>

                              {/* Status badge */}
                              <div>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${st.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot} shrink-0`} />
                                  {st.label}
                                </span>
                              </div>

                              {/* 3-dot menu */}
                              <div className="relative" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => setStatusMenu(statusMenu === task.id ? null : task.id)}
                                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  {updating === task.id
                                    ? <div className="w-4 h-4 border-2 border-[#0081FF] border-t-transparent rounded-full spin" />
                                    : <IoEllipsisVertical className="text-base text-gray-400" />
                                  }
                                </button>

                                {statusMenu === task.id && (
                                  <>
                                    <div className="absolute right-0 mt-1 w-48 bg-white border border-[#E6EAF0] rounded-2xl shadow-xl z-50 overflow-hidden fade-up">
                                      <p className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-[#F2F5F8]">
                                        Change Status
                                      </p>
                                      {Object.entries(STATUS).map(([k, v]) => (
                                        <button
                                          key={k}
                                          onClick={() => updateStatus(task.id, k)}
                                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${task.status === k ? 'bg-[#EBF4FF]' : ''}`}
                                        >
                                          <span className={`w-2 h-2 rounded-full ${v.dot} shrink-0`} />
                                          <span className="text-gray-700 flex-1 text-left">{v.label}</span>
                                          {task.status === k && <IoCheckmark className="text-[#0081FF] text-base" />}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="fixed inset-0 z-40" onClick={() => setStatusMenu(null)} />
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── BOARD VIEW ── */}
                {viewMode === 'board' && (
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 fade-up fu-5">
                    {boardCols.map(col => {
                      const colTasks = filtered.filter(t => t.status === col);
                      const info = STATUS[col];
                      return (
                        <div key={col} className="bg-white border border-[#E6EAF0] rounded-2xl overflow-hidden flex flex-col">
                          {/* Col header */}
                          <div className="px-4 py-3 border-b border-[#E6EAF0] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${info.dot}`} />
                              <span className="text-sm font-semibold text-gray-700">{info.label}</span>
                            </div>
                            <span className="text-xs font-bold bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center">
                              {colTasks.length}
                            </span>
                          </div>

                          <div className="dev-scroll p-3 space-y-2.5 max-h-[440px] overflow-y-auto flex-1">
                            {colTasks.length === 0 ? (
                              <div className="py-10 text-center">
                                <p className="text-xs text-gray-300 font-medium">No tasks here</p>
                              </div>
                            ) : colTasks.map(task => {
                              const pr = PRIORITY[task.priority] || PRIORITY.normal;
                              const ov = isOverdue(task.dueDate, task.status);
                              return (
                                <div
                                  key={task.id}
                                  className={`board-card bg-[#FAFBFC] border border-[#E6EAF0] rounded-xl p-3.5 cursor-pointer border-l-[3px] ${STATUS[task.status]?.border}`}
                                  onClick={() => setDetailTask(task)}
                                >
                                  <p className={`text-sm font-semibold text-gray-800 leading-snug ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                                    {task.title}
                                  </p>
                                  {task.description && (
                                    <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{task.description}</p>
                                  )}
                                  <div className="flex items-center justify-between mt-3 gap-2">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${pr.bg} ${pr.color} ${pr.border}`}>
                                      {pr.label}
                                    </span>
                                    {task.dueDate && (
                                      <span className={`text-[11px] flex items-center gap-1 ${ov ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                                        <IoCalendarOutline className="text-xs" />
                                        {fmtDate(task.dueDate)}
                                      </span>
                                    )}
                                  </div>
                                  {task.projectName && (
                                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#F0F3F7]">
                                      <IoFolderOutline className="text-gray-300 text-xs shrink-0" />
                                      <span className="text-[11px] text-gray-400 truncate">{task.projectName}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══ PROJECTS ══════════════════════════ */}
            {activeNav === 'projects' && (
              <div className="fade-up">
                {projects.length === 0 ? (
                  <div className="bg-white border border-[#E6EAF0] rounded-2xl py-20 text-center">
                    <IoFolderOutline className="text-5xl text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-500 font-semibold">No projects yet</p>
                    <p className="text-gray-400 text-sm mt-2">Projects appear when your PM assigns tasks to you.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {projects.map(({ id, name, tasks: pTasks }, i) => {
                      const done = pTasks.filter(t => t.status === 'done').length;
                      const pct  = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
                      const ip   = pTasks.filter(t => t.status === 'in_progress').length;
                      const bl   = pTasks.filter(t => t.status === 'blocked').length;
                      return (
                        <div
                          key={id}
                          className={`stat-chip bg-white border border-[#E6EAF0] rounded-2xl p-5 cursor-pointer fade-up`}
                          style={{ animationDelay: `${i * 0.06}s` }}
                          onClick={() => { setActiveNav('tasks'); }}
                        >
                          {/* Icon + title */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-11 h-11 bg-[#EBF4FF] rounded-xl flex items-center justify-center">
                              <IoFolderOutline className="text-xl text-[#0081FF]" />
                            </div>
                            {bl > 0 && (
                              <span className="text-xs font-semibold bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full">
                                {bl} blocked
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-gray-800 mb-1 truncate">{name}</h3>
                          <p className="text-xs text-gray-400 mb-4">
                            {pTasks.length} task{pTasks.length !== 1 ? 's' : ''} · {ip} in progress
                          </p>

                          {/* Progress */}
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-2">
                            <div className="progress-fill h-1.5 rounded-full bg-[#0081FF]" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">{done}/{pTasks.length} completed</p>
                            <p className="text-xs font-bold text-[#0081FF]">{pct}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══ PROGRESS ══════════════════════════ */}
            {activeNav === 'progress' && (
              <div className="fade-up space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6">
                    <p className="text-sm font-semibold text-gray-600 mb-4">Task Status Breakdown</p>
                    <div className="space-y-3">
                      {Object.entries(STATUS).map(([k, v]) => {
                        const cnt = tasks.filter(t => t.status === k).length;
                        const pct = stats.total > 0 ? Math.round((cnt / stats.total) * 100) : 0;
                        return (
                          <div key={k}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                                <span className="text-xs font-medium text-gray-600">{v.label}</span>
                              </div>
                              <span className="text-xs font-bold text-gray-700">{cnt} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`progress-fill h-1.5 rounded-full ${v.dot}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6">
                    <p className="text-sm font-semibold text-gray-600 mb-4">Quick Summary</p>
                    <div className="space-y-4">
                      {[
                        { label: 'Total Assigned Tasks', val: stats.total, icon: IoLayersOutline, col: 'text-gray-600', bg: 'bg-gray-100' },
                        { label: 'Completion Rate', val: `${completePct}%`, icon: IoCheckmarkCircleOutline, col: 'text-green-600', bg: 'bg-green-100' },
                        { label: 'Overdue Tasks', val: overdueCount, icon: IoAlertCircleOutline, col: 'text-red-600', bg: 'bg-red-100' },
                        { label: 'Active Projects', val: projects.length, icon: IoFolderOutline, col: 'text-blue-600', bg: 'bg-blue-100' },
                      ].map(({ label, val, icon: Icon, col, bg }) => (
                        <div key={label} className="flex items-center gap-3">
                          <div className={`${bg} w-9 h-9 rounded-xl flex items-center justify-center shrink-0`}>
                            <Icon className={`text-base ${col}`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className="text-sm font-bold text-gray-800">{val}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent activity */}
                <div className="bg-white border border-[#E6EAF0] rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E6EAF0]">
                    <p className="text-sm font-semibold text-gray-700">Recently Updated Tasks</p>
                  </div>
                  <div className="dev-scroll max-h-80 overflow-y-auto divide-y divide-[#F2F5F8]">
                    {tasks.filter(t => t.updatedAt)
                      .sort((a,b) => (b.updatedAt?.toDate?.()?.getTime()||0) - (a.updatedAt?.toDate?.()?.getTime()||0))
                      .slice(0, 15)
                      .map(t => {
                        const st = STATUS[t.status] || STATUS.todo;
                        return (
                          <div key={t.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                            <span className={`w-2.5 h-2.5 rounded-full ${st.dot} shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                              {t.projectName && <p className="text-xs text-gray-400 mt-0.5">{t.projectName}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                              <p className="text-[11px] text-gray-400 mt-1">
                                {t.updatedAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    {tasks.filter(t => t.updatedAt).length === 0 && (
                      <div className="py-10 text-center">
                        <p className="text-gray-400 text-sm">No activity yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ════════════════════════════
          TASK DETAIL MODAL
      ════════════════════════════ */}
      {detailTask && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailTask(null)} />

          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl fade-up overflow-hidden flex flex-col max-h-[90vh]">
            {/* Status strip */}
            <div className={`h-1.5 w-full ${STATUS[detailTask.status]?.dot || 'bg-gray-300'}`} />

            {/* Header */}
            <div className="px-6 py-5 border-b border-[#E6EAF0] flex items-start justify-between shrink-0">
              <div className="flex-1 pr-4 min-w-0">
                <h2 className="text-base font-bold text-gray-900 leading-snug">{detailTask.title}</h2>
                {detailTask.projectName && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <IoFolderOutline className="text-gray-300 text-sm shrink-0" />
                    <p className="text-xs text-gray-400">{detailTask.projectName}</p>
                  </div>
                )}
              </div>
              <button onClick={() => setDetailTask(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                <IoCloseOutline className="text-xl" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="dev-scroll overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 ${STATUS[detailTask.status]?.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS[detailTask.status]?.dot}`} />
                  {STATUS[detailTask.status]?.label || detailTask.status}
                </span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${PRIORITY[detailTask.priority]?.bg} ${PRIORITY[detailTask.priority]?.color} ${PRIORITY[detailTask.priority]?.border}`}>
                  {PRIORITY[detailTask.priority]?.label || 'Normal'} Priority
                </span>
              </div>

              {/* Description */}
              {detailTask.description && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm text-gray-700 leading-relaxed bg-[#F7F9FB] rounded-xl p-4 border border-[#E6EAF0]">
                    {detailTask.description}
                  </p>
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: IoCalendarOutline, label: 'Due Date',    val: fmtDate(detailTask.dueDate) },
                  { icon: IoPersonOutline,   label: 'Assigned By', val: detailTask.createdBy || '—' },
                  { icon: IoFolderOutline,   label: 'Project',     val: detailTask.projectName || '—' },
                  { icon: IoTimeOutline,     label: 'Created',     val: detailTask.createdAt?.toDate?.() ? detailTask.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
                ].map(({ icon: Icon, label, val }) => (
                  <div key={label} className="bg-[#F7F9FB] border border-[#E6EAF0] rounded-xl p-3.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon className="text-gray-400 text-xs shrink-0" />
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">{val}</p>
                  </div>
                ))}
              </div>

              {/* Subtasks */}
              {detailTask.subtasks?.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Subtasks ({detailTask.subtasks.filter(s => s.done).length}/{detailTask.subtasks.length})
                  </p>
                  <div className="space-y-2">
                    {detailTask.subtasks.map((st, i) => (
                      <div key={i} className="flex items-center gap-3 bg-[#F7F9FB] border border-[#E6EAF0] rounded-xl px-3.5 py-2.5">
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 ${st.done ? 'bg-[#0081FF] border-[#0081FF]' : 'border-gray-300 bg-white'}`}>
                          {st.done && <IoCheckmark className="text-white text-xs" />}
                        </div>
                        <p className={`text-sm ${st.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{st.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {detailTask.notes && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Notes</p>
                  <p className="text-sm text-gray-700 leading-relaxed bg-amber-50 border border-amber-100 rounded-xl p-4">
                    {detailTask.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Footer: update status */}
            <div className="px-6 py-4 border-t border-[#E6EAF0] bg-[#FAFBFC] shrink-0">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => updateStatus(detailTask.id, k)}
                    disabled={detailTask.status === k || updating === detailTask.id}
                    className={`status-btn text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                      detailTask.status === k
                        ? `${v.color} border-transparent`
                        : 'bg-white border-[#E6EAF0] text-gray-600 hover:border-[#0081FF] hover:text-[#0081FF]'
                    } ${updating === detailTask.id ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
                    {v.label}
                    {updating === detailTask.id && detailTask.status !== k && (
                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full spin ml-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DeveloperDashboard;