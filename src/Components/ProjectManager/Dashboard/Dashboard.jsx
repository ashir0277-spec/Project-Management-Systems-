// Dashboard.jsx – Light/White theme with functional search
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useOutletContext } from 'react-router-dom';
import {
  FolderOpen, Users, CheckCircle2,
  Clock, BarChart2, AlertTriangle, CalendarClock, Search
} from 'lucide-react';

const TL  = 'rgba(51,51,51,0.12)';
const TLB = 'rgba(51,51,51,0.18)';

const statusColors = {
  'In Progress': { text: 'text-blue-600',    dot: 'bg-blue-500'    },
  'Planning':    { text: 'text-slate-500',   dot: 'bg-slate-400'   },
  'Review':      { text: 'text-violet-600',  dot: 'bg-violet-500'  },
  'Completed':   { text: 'text-teal-600',    dot: 'bg-teal-500'    },
  'Overdue':     { text: 'text-red-600',     dot: 'bg-red-500'     },
};

const priorityColors = {
  High:     { text: 'text-red-600',     dot: 'bg-red-500'     },
  Medium:   { text: 'text-amber-600',   dot: 'bg-amber-500'   },
  Low:      { text: 'text-emerald-600', dot: 'bg-emerald-500' },
  Critical: { text: 'text-red-600',     dot: 'bg-red-500'     },
};

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ children }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3" style={{ border: `1px solid ${TL}` }}>
    {children}
  </div>
);

// ── Urgent Task Card ──────────────────────────────────────────────────────────
const UrgentCard = ({ members }) => {
  const allTasks = members.flatMap(m =>
    (m.tasks || []).map(t => ({ ...t, memberName: m.name }))
  ).filter(t => t.status !== 'Done');

  const priorityScore = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const urgent = allTasks
    .map(t => {
      const days   = daysUntil(t.dueDate);
      const pScore = priorityScore[t.priority] || 1;
      const dScore = days === null ? 0 : days <= 0 ? 5 : days <= 3 ? 3 : days <= 7 ? 1 : 0;
      return { ...t, _score: pScore + dScore, _days: days };
    })
    .sort((a, b) => b._score - a._score)[0];

  if (!urgent) return (
    <StatCard>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-rose-400 to-red-500">
        <AlertTriangle size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">—</p>
        <p className="text-sm font-medium text-gray-500 mt-0.5">Urgent Task</p>
        <p className="text-xs text-emerald-500 mt-1 font-medium">All clear! 🎉</p>
      </div>
    </StatCard>
  );

  const pCfg      = priorityColors[urgent.priority] || priorityColors.Medium;
  const isOverdue = urgent._days !== null && urgent._days <= 0;
  const isNear    = urgent._days !== null && urgent._days > 0 && urgent._days <= 3;
  const deadlineLabel =
    urgent._days === null ? null :
    isOverdue             ? `${Math.abs(urgent._days)}d overdue` :
    urgent._days === 0    ? 'Due today!' : `${urgent._days}d left`;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden"
      style={{ border: `1.5px solid rgba(239,68,68,0.25)` }}>
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-red-100 opacity-70 blur-xl pointer-events-none" />
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-rose-400 to-red-500">
          <AlertTriangle size={18} className="text-white" />
        </div>
        {deadlineLabel && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isOverdue ? 'bg-red-100 text-red-600' :
            isNear    ? 'bg-amber-100 text-amber-600' :
                        'bg-slate-100 text-slate-500'
          }`}>{deadlineLabel}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900 leading-snug truncate">{urgent.title}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${pCfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />{urgent.priority}
          </span>
          <span className="text-gray-300 text-xs">·</span>
          <span className="text-[11px] text-gray-400 truncate">{urgent.memberName}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">Urgent Task</p>
      </div>
    </div>
  );
};

// ── Upcoming Deadlines Card ───────────────────────────────────────────────────
const UpcomingDeadlinesCard = ({ members }) => {
  const upcoming = members
    .flatMap(m => (m.tasks || []).map(t => ({ ...t, memberName: m.name })))
    .filter(t => t.status !== 'Done' && t.dueDate)
    .map(t => ({ ...t, _days: daysUntil(t.dueDate) }))
    .filter(t => t._days !== null && t._days <= 7)
    .sort((a, b) => a._days - b._days)
    .slice(0, 5);

  const deadlineBadge = (days) => {
    if (days < 0)   return { label: `${Math.abs(days)}d overdue`, cls: 'bg-red-100 text-red-600' };
    if (days === 0) return { label: 'Due Today',                   cls: 'bg-red-100 text-red-600' };
    if (days === 1) return { label: 'Tomorrow',                    cls: 'bg-amber-100 text-amber-600' };
    return                { label: `${days}d left`,               cls: 'bg-slate-100 text-slate-500' };
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
      <div className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: `1px solid ${TL}` }}>
        <CalendarClock size={16} className="text-amber-500" />
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Upcoming Deadlines</h2>
        <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 whitespace-nowrap">
          {upcoming.length} within 7d
        </span>
      </div>
      <div className="p-5">
        {upcoming.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-sm text-gray-400">No deadlines in the next 7 days!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((task, i) => {
              const badge = deadlineBadge(task._days);
              const pCfg  = priorityColors[task.priority] || priorityColors.Medium;
              return (
                <div key={`${task.id}-${i}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                  style={{ border: `1px solid ${TL}` }}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    task._days <= 0 ? 'bg-red-500' :
                    task._days <= 1 ? 'bg-amber-500' : 'bg-slate-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800 truncate">{task.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-gray-400">{task.memberName}</span>
                      <span className="text-gray-300">·</span>
                      <span className={`text-[11px] font-semibold ${pCfg.text}`}>{task.priority}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { searchQuery = '' } = useOutletContext();
  const [projects, setProjects] = useState([]);
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let loaded = 0;
    const done = () => { loaded++; if (loaded >= 2) setLoading(false); };
    const u1 = onSnapshot(collection(db, 'projects'),    s => { setProjects(s.docs.map(d => ({ id: d.id, ...d.data() }))); done(); }, () => done());
    const u2 = onSnapshot(collection(db, 'teamMembers'), s => { setMembers(s.docs.map(d => ({ id: d.id, ...d.data() }))); done(); }, () => done());
    return () => { u1(); u2(); };
  }, []);

  const activeProjects = projects.filter(p => p.status === 'In Progress').length;
  const activeMembers  = members.filter(m => m.status === 'Active').length;
  const allTasks       = members.flatMap(m => m.tasks || []);
  const doneTasks      = allTasks.filter(t => t.status === 'Done').length;
  const pendingTasks   = allTasks.filter(t => t.status === 'Pending').length;
  const inProgTasks    = allTasks.filter(t => t.status === 'In Progress').length;

  // ── Search filter ────────────────────────────────────────────────────────
  const q = searchQuery.toLowerCase().trim();

  const filteredProjects = q
    ? projects.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q) ||
        p.priority?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      )
    : [...projects].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);

  const filteredTasks = q
    ? members.flatMap(m =>
        (m.tasks || [])
          .filter(t =>
            t.title?.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.priority?.toLowerCase().includes(q) ||
            m.name?.toLowerCase().includes(q)
          )
          .map(t => ({ ...t, memberName: m.name, memberId: m.id }))
      )
    : members
        .flatMap(m => (m.tasks || []).map(t => ({ ...t, memberName: m.name, memberId: m.id })))
        .filter(t => t.status !== 'Done')
        .slice(0, 5);

  const hasResults = filteredProjects.length > 0 || filteredTasks.length > 0;
  const isSearching = q.length > 0;

  if (loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin" />
    </div>
  );

  // ── Search Results View ───────────────────────────────────────────────────
  if (isSearching) {
    return (
      <div className="min-h-screen bg-[#EEF2F7]">
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">

          {/* Search header */}
          <div className="flex items-center gap-3">
            <Search size={18} className="text-teal-500" />
            <p className="text-sm text-gray-500">
              Results for <span className="font-semibold text-gray-800">"{searchQuery}"</span>
            </p>
            <span className="text-xs text-gray-400">
              {filteredProjects.length + filteredTasks.length} found
            </span>
          </div>

          {/* No Results */}
          {!hasResults && (
            <div className="bg-white rounded-2xl shadow-sm p-16 text-center" style={{ border: `1px solid ${TL}` }}>
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-lg font-semibold text-gray-700 mb-2">No results found</p>
              <p className="text-sm text-gray-400">
                Nothing matched "<span className="font-medium">{searchQuery}</span>". Try a different keyword.
              </p>
            </div>
          )}

          {/* Matching Projects */}
          {filteredProjects.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
              <div className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: `1px solid ${TL}` }}>
                <BarChart2 size={16} className="text-teal-500" />
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Projects</h2>
                <span className="ml-auto text-xs text-gray-400">{filteredProjects.length} found</span>
              </div>
              <div className="overflow-x-auto w-full" style={{ scrollbarWidth: 'none' }}>
                <table className="w-full min-w-[600px]">
                  <colgroup>
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#EEF2F7]" style={{ borderBottom: `1px solid ${TLB}` }}>
                      {['Project Name', 'Status', 'Priority', 'Description', 'Deadline'].map((h, i) => (
                        <th key={h} className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left"
                          style={{ borderRight: i < 4 ? `1px solid ${TL}` : undefined }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p, idx) => {
                      const sCfg = statusColors[p.status]     || statusColors['Planning'];
                      const pCfg = priorityColors[p.priority] || priorityColors.Medium;
                      return (
                        <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                          style={{ borderBottom: `1px solid ${TL}` }}>
                          <td className="px-4 py-3" style={{ borderRight: `1px solid ${TL}` }}>
                            <p className="text-[13px] font-semibold text-gray-900 truncate">{p.name}</p>
                          </td>
                          <td className="px-4 py-3" style={{ borderRight: `1px solid ${TL}` }}>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap ${sCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />{p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3" style={{ borderRight: `1px solid ${TL}` }}>
                            <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${pCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />{p.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3" style={{ borderRight: `1px solid ${TL}` }}>
                            <p className="text-[12px] text-gray-500 truncate">{p.description || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-mono text-gray-500 whitespace-nowrap">{p.deadline || '—'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Matching Tasks */}
          {filteredTasks.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
              <div className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: `1px solid ${TL}` }}>
                <CheckCircle2 size={16} className="text-teal-500" />
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Tasks</h2>
                <span className="ml-auto text-xs text-gray-400">{filteredTasks.length} found</span>
              </div>
              <div className="p-5 space-y-2.5">
                {filteredTasks.map(task => {
                  const pCfg = priorityColors[task.priority] || priorityColors.Medium;
                  const tsCfg = {
                    'Done':        'text-emerald-600 bg-emerald-50 border-emerald-200',
                    'In Progress': 'text-amber-600 bg-amber-50 border-amber-200',
                    'Pending':     'text-gray-500 bg-gray-50 border-gray-200',
                  }[task.status] || 'text-gray-500 bg-gray-50 border-gray-200';
                  return (
                    <div key={`${task.memberId}-${task.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                      style={{ border: `1px solid ${TL}` }}>
                      <Clock size={14} className="text-amber-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800 truncate">{task.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-gray-400">{task.memberName}</span>
                          <span className="text-gray-300">·</span>
                          <span className={`text-[11px] font-semibold ${pCfg.text}`}>{task.priority}</span>
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${tsCfg}`}>
                        {task.status}
                      </span>
                      <span className="text-[11px] font-mono text-gray-400 flex-shrink-0">{task.dueDate || '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  // ── Normal Dashboard View ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

        {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <StatCard>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-teal-400 to-cyan-500">
              <FolderOpen size={18} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
              <p className="text-sm font-medium text-gray-500 mt-0.5">Projects</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />{activeProjects} Active
                </span>
                <span className="text-[11px] text-gray-400">{projects.length - activeProjects} Other</span>
              </div>
            </div>
          </StatCard>

          <StatCard>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-400 to-purple-500">
              <Users size={18} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{members.length}</p>
              <p className="text-sm font-medium text-gray-500 mt-0.5">Team Members</p>
              <p className="text-xs text-gray-400 mt-1">{activeMembers} active</p>
            </div>
          </StatCard>

          <StatCard>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-400 to-teal-500">
              <CheckCircle2 size={18} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{doneTasks}</p>
              <p className="text-sm font-medium text-gray-500 mt-0.5">Tasks Done</p>
              <p className="text-xs text-gray-400 mt-1">{allTasks.length} total tasks</p>
            </div>
          </StatCard>

          <StatCard>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500">
              <Clock size={18} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingTasks}</p>
              <p className="text-sm font-medium text-gray-500 mt-0.5">Pending Tasks</p>
              <p className="text-xs text-gray-400 mt-1">{inProgTasks} in progress</p>
            </div>
          </StatCard>

          <UrgentCard members={members} />
        </div>

        {/* ── MAIN ROW ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent Projects Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${TL}` }}>
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-teal-500" />
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Recent Projects</h2>
              </div>
              <span className="text-xs text-gray-400">{projects.length} total</span>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-2">📁</div>
                <p className="text-gray-400 text-sm">No projects yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full" style={{ scrollbarWidth: 'none' }}>
                <table className="w-full min-w-[600px]">
                  <colgroup>
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#EEF2F7]" style={{ borderBottom: `1px solid ${TLB}` }}>
                      {['Project Name', 'Status', 'Priority', 'Description', 'Deadline'].map((h, i) => (
                        <th key={h} className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left"
                          style={{ borderRight: i < 4 ? `1px solid ${TL}` : undefined }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p, idx) => {
                      const sCfg = statusColors[p.status]     || statusColors['Planning'];
                      const pCfg = priorityColors[p.priority] || priorityColors.Medium;
                      return (
                        <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                          style={{ borderBottom: `1px solid ${TL}` }}>
                          <td className="px-4 py-3" style={{ borderRight: `1px solid ${TL}` }}>
                            <p className="text-[13px] font-semibold text-gray-900 truncate">{p.name}</p>
                          </td>
                          <td className="px-4 py-3" style={{ borderRight: `1px solid ${TL}` }}>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap ${sCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />{p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3" style={{ borderRight: `1px solid ${TL}` }}>
                            <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${pCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />{p.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3" style={{ borderRight: `1px solid ${TL}` }}>
                            <p className="text-[12px] text-gray-500 truncate">{p.description || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-mono text-gray-500 whitespace-nowrap">{p.deadline || '—'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
              <div className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: `1px solid ${TL}` }}>
                <CheckCircle2 size={16} className="text-teal-500" />
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Task Overview</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Done',        count: doneTasks,    color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                    { label: 'In Progress', count: inProgTasks,  color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200'   },
                    { label: 'Pending',     count: pendingTasks, color: 'text-gray-500',    bg: 'bg-gray-50',    border: 'border-gray-200'    },
                  ].map(({ label, count, color, bg, border }) => (
                    <div key={label} className={`${bg} border ${border} rounded-xl p-3 text-center`}>
                      <p className={`text-xl font-bold ${color}`}>{count}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{label}</p>
                    </div>
                  ))}
                </div>
                {allTasks.length > 0 && (
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-gray-500 font-medium">Completion Rate</span>
                      <span className="text-xs font-bold text-teal-600">
                        {Math.round((doneTasks / allTasks.length) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#EEF2F7] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500"
                        style={{ width: `${Math.round((doneTasks / allTasks.length) * 100)}%` }} />
                    </div>
                  </div>
                )}
                <div style={{ borderTop: `1px solid ${TL}` }} className="pt-4">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Pending Tasks</p>
                  {filteredTasks.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">All caught up! 🎉</p>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredTasks.map(task => {
                        const pCfg = priorityColors[task.priority] || priorityColors.Medium;
                        return (
                          <div key={`${task.memberId}-${task.id}`} className="flex items-start gap-2.5">
                            <Clock size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-medium text-gray-800 truncate">{task.title}</p>
                              <p className="text-[10px] text-gray-400">{task.memberName} · <span className={pCfg.text}>{task.priority}</span></p>
                            </div>
                            <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{task.dueDate || '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <UpcomingDeadlinesCard members={members} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;