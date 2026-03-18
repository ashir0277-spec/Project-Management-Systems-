import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useOutletContext } from 'react-router-dom';
import {
  FolderOpen, Users, CheckCircle2,
  Clock, BarChart2, AlertTriangle, CalendarClock, Search,
  ChevronLeft, ChevronRight, Calendar, X, ChevronDown, AlertCircle,
} from 'lucide-react';

const TL  = 'rgba(51,51,51,0.12)';
const TLB = 'rgba(51,51,51,0.18)';

const statusColors = {
  'In Progress': { text: 'text-blue-600',    dot: 'bg-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-200'    },
  'Planning':    { text: 'text-slate-500',   dot: 'bg-slate-400',   bg: 'bg-slate-50',   border: 'border-slate-200'   },
  'Review':      { text: 'text-violet-600',  dot: 'bg-violet-500',  bg: 'bg-violet-50',  border: 'border-violet-200'  },
  'Completed':   { text: 'text-teal-600',    dot: 'bg-teal-500',    bg: 'bg-teal-50',    border: 'border-teal-200'    },
  'Overdue':     { text: 'text-red-600',     dot: 'bg-red-500',     bg: 'bg-red-50',     border: 'border-red-200'     },
  'Done':        { text: 'text-teal-600',    dot: 'bg-teal-500',    bg: 'bg-teal-50',    border: 'border-teal-200'    },
  'Pending':     { text: 'text-gray-500',    dot: 'bg-gray-400',    bg: 'bg-gray-50',    border: 'border-gray-200'    },
};

const priorityColors = {
  High:     { text: 'text-red-600',     dot: 'bg-red-500',     bg: 'bg-red-50',     border: 'border-red-200'     },
  Medium:   { text: 'text-amber-600',   dot: 'bg-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-200'   },
  Low:      { text: 'text-emerald-600', dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  Critical: { text: 'text-red-600',     dot: 'bg-red-500',     bg: 'bg-red-50',     border: 'border-red-200'     },
};

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const toYMD = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
};
const todayYMD = toYMD(new Date());

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ children }) => (
  <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col gap-2.5 sm:gap-3" style={{ border: `1px solid ${TL}` }}>
    {children}
  </div>
);

// ── Tasks Stat Card ────────────────────────────────────────────────────────────
const TasksStatCard = ({ doneTasks, inProgTasks, pendingTasks, allTasks }) => (
  <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col gap-2.5 sm:gap-3" style={{ border: `1px solid ${TL}` }}>
    <div className="flex items-center justify-between">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-400 to-teal-500">
        <CheckCircle2 size={16} className="text-white" />
      </div>
      <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400">{allTasks.length} total</span>
    </div>
    <div>
      <p className="text-xs sm:text-sm font-bold text-gray-700 mb-2">Task Overview</p>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-center">
          <p className="text-base sm:text-lg font-bold text-emerald-600">{doneTasks}</p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 font-medium">Done</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
          <p className="text-base sm:text-lg font-bold text-amber-600">{inProgTasks}</p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 font-medium">In Prog.</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-2 text-center">
          <p className="text-base sm:text-lg font-bold text-gray-500">{pendingTasks}</p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 font-medium">Pending</p>
        </div>
      </div>
      {allTasks.length > 0 && (
        <div className="mt-2.5">
          <div className="h-1.5 rounded-full bg-[#EEF2F7] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all"
              style={{ width: `${Math.round((doneTasks / allTasks.length) * 100)}%` }}/>
          </div>
          <p className="text-[9px] sm:text-[10px] text-gray-400 mt-1 text-right font-medium">
            {Math.round((doneTasks / allTasks.length) * 100)}% complete
          </p>
        </div>
      )}
    </div>
  </div>
);

// ── Upcoming Deadlines Stat Card ───────────────────────────────────────────────
const UpcomingDeadlinesStatCard = ({ members }) => {
  const upcoming = members
    .flatMap(m => (m.tasks || []).map(t => ({ ...t, memberName: m.name })))
    .filter(t => t.status !== 'Done' && t.dueDate)
    .map(t => ({ ...t, _days: daysUntil(t.dueDate) }))
    .filter(t => t._days !== null && t._days <= 7)
    .sort((a, b) => a._days - b._days)
    .slice(0, 3);

  const deadlineBadge = (days) => {
    if (days < 0)   return { label: `${Math.abs(days)}d over`, cls: 'text-red-600 bg-red-50 border-red-200' };
    if (days === 0) return { label: 'Today',                   cls: 'text-red-600 bg-red-50 border-red-200' };
    if (days === 1) return { label: 'Tomorrow',                cls: 'text-amber-600 bg-amber-50 border-amber-200' };
    return                 { label: `${days}d left`,           cls: 'text-slate-500 bg-slate-50 border-slate-200' };
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col gap-2.5 sm:gap-3" style={{ border: `1px solid ${TL}` }}>
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500">
          <CalendarClock size={16} className="text-white" />
        </div>
        <span className={`text-[9px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full border ${
          upcoming.length > 0 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-50 text-gray-400 border-gray-200'
        }`}>
          {upcoming.length} / 7d
        </span>
      </div>
      <div>
        <p className="text-xs sm:text-sm font-bold text-gray-700 mb-2">Upcoming Deadlines</p>
        {upcoming.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-[10px] text-gray-400">No deadlines this week!</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {upcoming.map((task, i) => {
              const badge = deadlineBadge(task._days);
              return (
                <div key={`${task.id}-${i}`} className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-xl bg-gray-50"
                  style={{ border: `1px solid ${TL}` }}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    task._days <= 0 ? 'bg-red-500' : task._days <= 1 ? 'bg-amber-500' : 'bg-slate-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-semibold text-gray-800 truncate">{task.title}</p>
                    <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">{task.memberName}</p>
                  </div>
                  <span className={`text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full border flex-shrink-0 ${badge.cls}`}>
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
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-rose-400 to-red-500">
        <AlertTriangle size={16} className="text-white" />
      </div>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">—</p>
        <p className="text-xs sm:text-sm font-medium text-gray-500 mt-0.5">Urgent Task</p>
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
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col gap-2.5 sm:gap-3 relative overflow-hidden"
      style={{ border: `1.5px solid rgba(239,68,68,0.25)` }}>
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-red-100 opacity-70 blur-xl pointer-events-none" />
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-rose-400 to-red-500">
          <AlertTriangle size={16} className="text-white" />
        </div>
        {deadlineLabel && (
          <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${
            isOverdue ? 'bg-red-100 text-red-600' :
            isNear    ? 'bg-amber-100 text-amber-600' :
                        'bg-slate-100 text-slate-500'
          }`}>{deadlineLabel}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-bold text-gray-900 leading-snug truncate">{urgent.title}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold ${pCfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />{urgent.priority}
          </span>
          <span className="text-gray-300 text-xs">·</span>
          <span className="text-[10px] sm:text-[11px] text-gray-400 truncate">{urgent.memberName}</span>
        </div>
        <p className="text-[10px] sm:text-xs text-gray-400 mt-1">Urgent Task</p>
      </div>
    </div>
  );
};

// ── Upcoming Deadlines Card ────────────────────────────────────────────────────
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
    return                 { label: `${days}d left`,               cls: 'bg-slate-100 text-slate-500' };
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: `1px solid ${TL}` }}>
        <CalendarClock size={15} className="text-amber-500" />
        <h2 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wider">Upcoming Deadlines</h2>
        <span className="ml-auto text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 whitespace-nowrap">
          {upcoming.length} within 7d
        </span>
      </div>
      <div className="p-3 sm:p-5">
        {upcoming.length === 0 ? (
          <div className="text-center py-6 sm:py-8">
            <p className="text-xs sm:text-sm text-gray-400">No deadlines in the next 7 days!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((task, i) => {
              const badge = deadlineBadge(task._days);
              const pCfg  = priorityColors[task.priority] || priorityColors.Medium;
              return (
                <div key={`${task.id}-${i}`}
                  className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-gray-50 transition-colors"
                  style={{ border: `1px solid ${TL}` }}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    task._days <= 0 ? 'bg-red-500' :
                    task._days <= 1 ? 'bg-amber-500' : 'bg-slate-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{task.title}</p>
                    <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5">
                      <span className="text-[10px] sm:text-[11px] text-gray-400 truncate max-w-[80px] sm:max-w-none">{task.memberName}</span>
                      <span className="text-gray-300">·</span>
                      <span className={`text-[10px] sm:text-[11px] font-semibold ${pCfg.text}`}>{task.priority}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex-shrink-0 ${badge.cls}`}>
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

// ── Projects Table (shared, scrollable on small screens) ──────────────────────
const ProjectsTable = ({ filteredProjects, isFiltered, hasSingle, selectedDate, todayYMD }) => (
  <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
    <table className="w-full" style={{ minWidth: 560 }}>
      <colgroup>
        <col style={{ width: '24%' }}/>
        <col style={{ width: '18%' }}/>
        <col style={{ width: '14%' }}/>
        <col style={{ width: '28%' }}/>
        <col style={{ width: '16%' }}/>
      </colgroup>
      <thead>
        <tr className="bg-[#EEF2F7]" style={{ borderBottom: `1px solid ${TLB}` }}>
          {['Project Name','Status','Priority','Description','Deadline'].map((h,i) => (
            <th key={h} className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-left whitespace-nowrap"
              style={{ borderRight: i < 4 ? `1px solid ${TL}` : undefined }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filteredProjects.map((p, idx) => {
          const sCfg       = statusColors[p.status]     || statusColors['Planning'];
          const pCfg       = priorityColors[p.priority] || priorityColors.Medium;
          const isTodayDL  = toYMD(p.deadline)  === todayYMD;
          const isStart    = hasSingle && toYMD(p.startDate) === selectedDate;
          const isDeadline = hasSingle && toYMD(p.deadline)  === selectedDate;
          return (
            <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
              style={{ borderBottom: `1px solid ${TL}`, background: isTodayDL ? 'rgba(239,68,68,0.03)' : undefined }}>
              <td className="px-3 py-2.5" style={{ borderRight: `1px solid ${TL}` }}>
                <p className="text-[12px] font-semibold text-gray-900 truncate">{p.name}</p>
                {(isStart || isDeadline || (!isFiltered && isTodayDL)) && (
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {isStart    && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-200">Start</span>}
                    {isDeadline && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">Deadline</span>}
                    {!isFiltered && isTodayDL && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">Due Today</span>}
                  </div>
                )}
              </td>
              <td className="px-3 py-2.5" style={{ borderRight: `1px solid ${TL}` }}>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${sCfg.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sCfg.dot}`}/>
                  <span className="truncate">{p.status}</span>
                </span>
              </td>
              <td className="px-3 py-2.5" style={{ borderRight: `1px solid ${TL}` }}>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${pCfg.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pCfg.dot}`}/>
                  <span className="truncate">{p.priority}</span>
                </span>
              </td>
              <td className="px-3 py-2.5" style={{ borderRight: `1px solid ${TL}` }}>
                <p className="text-[11px] text-gray-500 truncate">{p.description || '—'}</p>
              </td>
              <td className="px-3 py-2.5">
                <span className={`text-[11px] font-mono block truncate ${isTodayDL ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                  {p.deadline || '—'}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// ── Calendar Dropdown (portal) ────────────────────────────────────────────────
const CalendarDropdown = ({ anchorRef, members, projects, selectedDate, rangeFrom, rangeTo, onSelectDate, onSelectRange, onClose }) => {
  const dropRef = useRef(null);
  const today   = new Date();

  const [mode,           setMode]           = useState(rangeFrom ? 'range' : 'single');
  const [viewYear,       setViewYear]       = useState(() => {
    const base = rangeFrom || selectedDate;
    return base ? parseInt(base.slice(0,4)) : today.getFullYear();
  });
  const [viewMonth,      setViewMonth]      = useState(() => {
    const base = rangeFrom || selectedDate;
    return base ? parseInt(base.slice(5,7))-1 : today.getMonth();
  });
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [pos,            setPos]            = useState({ top: 0, left: 0, width: 320 });

  const [rangeStart, setRangeStart] = useState(rangeFrom || null);
  const [rangeEnd,   setRangeEnd]   = useState(rangeTo   || null);
  const [hoverDate,  setHoverDate]  = useState(null);

  const yearRange = Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i);

  useEffect(() => {
    if (!anchorRef.current) return;
    const recalc = () => {
      const rect    = anchorRef.current.getBoundingClientRect();
      const vw      = window.innerWidth;
      const dropW   = vw < 380 ? vw - 16 : 340;
      let   left    = rect.right - dropW;
      if (left < 8)      left = 8;
      if (left + dropW > vw - 8) left = Math.max(8, vw - dropW - 8);
      setPos({ top: rect.bottom + 6, left, width: dropW });
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [anchorRef]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) &&
          anchorRef.current && !anchorRef.current.contains(e.target)) onClose();
    };
    const handleScroll = (e) => {
      if (dropRef.current && dropRef.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [anchorRef, onClose]);

  const activeDates = useMemo(() => {
    const set = new Set();
    members.forEach(m => (m.tasks||[]).forEach(t => { if (t.dueDate) set.add(toYMD(t.dueDate)); }));
    projects.forEach(p => { if (p.deadline) set.add(toYMD(p.deadline)); if (p.startDate) set.add(toYMD(p.startDate)); });
    return set;
  }, [members, projects]);

  const overdueDates = useMemo(() => {
    const set = new Set();
    members.forEach(m => (m.tasks||[]).forEach(t => {
      if (t.dueDate && t.status !== 'Done' && toYMD(t.dueDate) < todayYMD) set.add(toYMD(t.dueDate));
    }));
    return set;
  }, [members]);

  const prevMonth = () => { if (viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); };
  const goToday   = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    if (mode === 'single') onSelectDate(todayYMD);
    setShowYearPicker(false);
  };

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();
  const cells = [];
  for (let i=firstDay-1;i>=0;i--)     cells.push({day:daysInPrev-i, month:'prev', ymd:toYMD(new Date(viewYear,viewMonth-1,daysInPrev-i))});
  for (let d=1;d<=daysInMonth;d++)     cells.push({day:d,            month:'cur',  ymd:toYMD(new Date(viewYear,viewMonth,d))});
  for (let d=1;d<=42-cells.length;d++) cells.push({day:d,            month:'next', ymd:toYMD(new Date(viewYear,viewMonth+1,d))});
  const weeks = Array.from({length:6},(_,i)=>cells.slice(i*7,i*7+7));

  const effectiveEnd = rangeEnd || hoverDate;
  const rFrom = rangeStart && effectiveEnd ? (rangeStart <= effectiveEnd ? rangeStart : effectiveEnd) : rangeStart;
  const rTo   = rangeStart && effectiveEnd ? (rangeStart <= effectiveEnd ? effectiveEnd : rangeStart) : null;
  const inRange    = (ymd) => rFrom && rTo && ymd > rFrom && ymd < rTo;
  const isRangeEnd = (ymd) => (ymd === rFrom || ymd === rTo) && rFrom && rTo;

  const handleDayClick = (ymd, isCur) => {
    if (mode === 'single') {
      onSelectDate(selectedDate === ymd ? null : ymd);
      setShowYearPicker(false);
      return;
    }
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(ymd);
      setRangeEnd(null);
    } else {
      const from = rangeStart <= ymd ? rangeStart : ymd;
      const to   = rangeStart <= ymd ? ymd : rangeStart;
      setRangeEnd(to);
      setRangeStart(from);
      onSelectRange(from, to);
    }
    setShowYearPicker(false);
  };

  const clearAll = () => {
    setRangeStart(null); setRangeEnd(null); setHoverDate(null);
    onSelectDate(null); onSelectRange(null, null);
  };

  const yday = toYMD(new Date(Date.now()-86400000));
  const tmrw = toYMD(new Date(Date.now()+86400000));

  const activeLabel = () => {
    if (mode === 'range' && rFrom && rTo) {
      const fmt = (y) => { const d = new Date(y+'T00:00:00'); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}`; };
      return `${fmt(rFrom)} → ${fmt(rTo)}`;
    }
    if (mode === 'single' && selectedDate) {
      if (selectedDate===todayYMD) return 'Today';
      if (selectedDate===yday)     return 'Yesterday';
      if (selectedDate===tmrw)     return 'Tomorrow';
      const d = new Date(selectedDate+'T00:00:00');
      return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
    }
    return null;
  };

  const label = activeLabel();

  return ReactDOM.createPortal(
    <div ref={dropRef}
      style={{
        position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999,
        background: '#fff', borderRadius: 18, border: `1px solid ${TL}`,
        boxShadow: '0 16px 48px rgba(0,0,0,0.16)', overflow: 'hidden',
      }}>

      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3" style={{ borderBottom: `1px solid ${TL}` }}>
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-teal-500"/>
          <span className="text-[12px] sm:text-[13px] font-bold text-gray-800">Filter by Date</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={goToday}
            className="text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-lg text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors">
            Today
          </button>
          <button onClick={onClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={12}/>
          </button>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1 px-3 sm:px-4 pt-2.5 pb-1">
        {['single', 'range'].map(m => (
          <button key={m} onClick={() => { setMode(m); clearAll(); }}
            className={`flex-1 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold border transition-all
              ${mode===m ? 'bg-teal-500 text-white border-teal-500' : 'text-gray-500 bg-gray-50 border-gray-200 hover:border-teal-300 hover:text-teal-600'}`}>
            {m === 'single' ? 'Single Day' : 'Date Range'}
          </button>
        ))}
      </div>

      {/* Range Hint */}
      {mode === 'range' && (
        <div className="px-3 sm:px-4 pb-1">
          <p className="text-[9px] sm:text-[10px] text-gray-400 text-center">
            {!rangeStart ? 'Click a start date' : !rangeEnd ? 'Now click an end date' : 'Range selected ✓'}
          </p>
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between px-3 sm:px-4 pt-2 pb-1">
        <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <ChevronLeft size={14}/>
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-xs sm:text-sm font-bold text-gray-800">{MONTHS[viewMonth].slice(0,3)}</span>
          <div className="relative">
            <button onClick={() => setShowYearPicker(v=>!v)}
              className={`flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs sm:text-sm font-bold border transition-all
                ${showYearPicker ? 'bg-teal-500 text-white border-teal-500' : 'text-teal-600 bg-teal-50 hover:bg-teal-100 border-teal-200'}`}>
              {viewYear}
              <ChevronDown size={10} style={{ transform: showYearPicker ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}/>
            </button>
            {showYearPicker && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white rounded-xl shadow-xl overflow-hidden"
                style={{ border: `1px solid ${TL}`, width: 120 }}>
                <div className="p-1 max-h-36 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {yearRange.map(yr => (
                    <button key={yr} onClick={() => { setViewYear(yr); setShowYearPicker(false); }}
                      className={`w-full py-1.5 rounded-lg text-[11px] sm:text-[12px] font-semibold transition-colors
                        ${yr===viewYear ? 'bg-teal-500 text-white' : yr===today.getFullYear() ? 'text-teal-600 bg-teal-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                      {yr}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <ChevronRight size={14}/>
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 px-2 sm:px-3 pb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider py-0.5">{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="px-2 sm:px-2.5 pb-2 space-y-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.map(cell => {
              const isTod   = cell.ymd === todayYMD;
              const isSel   = mode === 'single' && cell.ymd === selectedDate;
              const isStart = mode === 'range'  && cell.ymd === rFrom && rTo;
              const isEnd   = mode === 'range'  && cell.ymd === rTo   && rFrom;
              const isMid   = mode === 'range'  && inRange(cell.ymd);
              const isCur   = cell.month === 'cur';
              const hasAct  = activeDates.has(cell.ymd);
              const hasOvr  = overdueDates.has(cell.ymd);

              let bg = undefined, border = '1.5px solid transparent';
              if (isSel)               { bg = 'linear-gradient(135deg,#14b8a6,#06b6d4)'; }
              else if (isStart||isEnd) { bg = 'linear-gradient(135deg,#14b8a6,#06b6d4)'; }
              else if (isMid)          { bg = 'rgba(20,184,166,0.12)'; border = '1.5px solid rgba(20,184,166,0.2)'; }
              else if (isTod)          { bg = 'rgba(20,184,166,0.08)'; border = '1.5px solid rgba(20,184,166,0.3)'; }

              return (
                <button key={cell.ymd}
                  onClick={() => handleDayClick(cell.ymd, isCur)}
                  onMouseEnter={() => mode==='range' && rangeStart && !rangeEnd && setHoverDate(cell.ymd)}
                  onMouseLeave={() => mode==='range' && setHoverDate(null)}
                  className="relative flex flex-col items-center justify-center rounded-xl transition-all group"
                  style={{ height: 30, background: bg, border }}>
                  <span className={`text-[10px] sm:text-[11px] font-semibold leading-none
                    ${isSel||isStart||isEnd ? 'text-white' : isTod ? 'text-teal-600' : isMid ? 'text-teal-700' : !isCur ? 'text-gray-300' : 'text-gray-700 group-hover:text-gray-900'}`}>
                    {cell.day}
                  </span>
                  {hasAct && !isSel && !isStart && !isEnd && (
                    <span className={`absolute bottom-[2px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${hasOvr ? 'bg-red-400' : 'bg-teal-400'}`}/>
                  )}
                  {hasAct && (isSel || isStart || isEnd) && (
                    <span className="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/70"/>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Quick Filters — Single Mode Only */}
      {mode === 'single' && (
        <div className="px-2.5 sm:px-3 pb-3 pt-2" style={{ borderTop: `1px solid ${TL}` }}>
          <div className="flex gap-1 sm:gap-1.5">
            {[{label:'Yesterday',ymd:yday},{label:'Today',ymd:todayYMD},{label:'Tomorrow',ymd:tmrw}].map(f => (
              <button key={f.label}
                onClick={() => onSelectDate(selectedDate===f.ymd ? null : f.ymd)}
                className={`flex-1 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-semibold border transition-all
                  ${selectedDate===f.ymd ? 'bg-teal-500 text-white border-teal-500' : 'text-gray-600 bg-gray-50 border-gray-200 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Filter Label */}
      {label && (
        <div className="px-2.5 sm:px-3 pb-3" style={{ borderTop: mode==='range' ? `1px solid ${TL}` : undefined, paddingTop: mode==='range' ? 8 : 0 }}>
          <div className="rounded-xl px-3 py-1.5 flex items-center gap-2"
            style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0"/>
            <span className="text-[10px] sm:text-[11px] font-semibold text-teal-700 truncate">Showing: {label}</span>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { searchQuery = '' } = useOutletContext();
  const [projects,     setProjects]     = useState([]);
  const [members,      setMembers]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayYMD);
  const [rangeFrom,    setRangeFrom]    = useState(null);
  const [rangeTo,      setRangeTo]      = useState(null);
  const [showCalDrop,  setShowCalDrop]  = useState(false);
  const calBtnRef = useRef(null);

  // Firebase Listeners
  useEffect(() => {
    const loadState = { projects: false, members: false };
    const checkDone = () => { if (loadState.projects && loadState.members) setLoading(false); };
    const u1 = onSnapshot(collection(db, 'projects'),
      (snapshot) => { setProjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); loadState.projects = true; checkDone(); },
      (err) => { console.error('Projects listener error:', err); loadState.projects = true; checkDone(); }
    );
    const u2 = onSnapshot(collection(db, 'teamMembers'),
      (snapshot) => { setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); loadState.members = true; checkDone(); },
      (err) => { console.error('Members listener error:', err); loadState.members = true; checkDone(); }
    );
    return () => { u1(); u2(); };
  }, []);

  // Derived Stats
  const activeProjects = projects.filter(p => p.status === 'In Progress').length;
  const activeMembers  = members.filter(m => m.status === 'Active').length;
  const allTasks       = useMemo(() => members.flatMap(m => m.tasks || []), [members]);
  const doneTasks      = useMemo(() => allTasks.filter(t => t.status === 'Done').length,        [allTasks]);
  const pendingTasks   = useMemo(() => allTasks.filter(t => t.status === 'Pending').length,     [allTasks]);
  const inProgTasks    = useMemo(() => allTasks.filter(t => t.status === 'In Progress').length, [allTasks]);
  const todayDeadlines = useMemo(() => projects.filter(p => toYMD(p.deadline) === todayYMD), [projects]);

  const q         = searchQuery.toLowerCase().trim();
  const yesterday = toYMD(new Date(Date.now() - 86400000));
  const tomorrow  = toYMD(new Date(Date.now() + 86400000));

  const hasRange   = rangeFrom && rangeTo;
  const hasSingle  = !!selectedDate && !hasRange;
  const isFiltered = hasRange || hasSingle;

  const dateBadgeLabel = hasRange
    ? (() => {
        const fmt = (y) => { const d = new Date(y+'T00:00:00'); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}`; };
        return `${fmt(rangeFrom)} → ${fmt(rangeTo)}`;
      })()
    : !selectedDate      ? null
    : selectedDate === todayYMD  ? 'Today'
    : selectedDate === yesterday ? 'Yesterday'
    : selectedDate === tomorrow  ? 'Tomorrow'
    : (() => { const d = new Date(selectedDate+'T00:00:00'); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`; })();

  const projectMatchesDateFilter = useCallback((p) => {
    if (hasRange) {
      const pStart = p.startDate || p.createdAt?.slice(0,10) || '';
      const pEnd   = p.deadline  || '';
      const s = pStart || pEnd, e = pEnd || pStart;
      return s <= rangeTo && e >= rangeFrom;
    }
    if (hasSingle) return toYMD(p.deadline) === selectedDate || toYMD(p.startDate) === selectedDate;
    return false;
  }, [hasRange, hasSingle, rangeFrom, rangeTo, selectedDate]);

  const taskMatchesDateFilter = useCallback((t) => {
    if (hasRange)  return toYMD(t.dueDate) >= rangeFrom && toYMD(t.dueDate) <= rangeTo;
    if (hasSingle) return toYMD(t.dueDate) === selectedDate;
    return false;
  }, [hasRange, hasSingle, rangeFrom, rangeTo, selectedDate]);

  const filteredProjects = useMemo(() => {
    if (q) return projects.filter(p =>
      p.name?.toLowerCase().includes(q) || p.status?.toLowerCase().includes(q) ||
      p.priority?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
    );
    if (isFiltered) return projects.filter(projectMatchesDateFilter);
    return [...projects].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);
  }, [projects, q, isFiltered, projectMatchesDateFilter]);

  const filteredTasks = useMemo(() => {
    if (q) return members.flatMap(m =>
      (m.tasks || [])
        .filter(t => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) ||
          t.priority?.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q))
        .map(t => ({ ...t, memberName: m.name, memberId: m.id }))
    );
    if (isFiltered) return members.flatMap(m =>
      (m.tasks || []).filter(taskMatchesDateFilter).map(t => ({ ...t, memberName: m.name, memberId: m.id }))
    );
    return members
      .flatMap(m => (m.tasks || []).map(t => ({ ...t, memberName: m.name, memberId: m.id })))
      .filter(t => t.status !== 'Done').slice(0, 5);
  }, [members, q, isFiltered, taskMatchesDateFilter]);

  const hasResults  = filteredProjects.length > 0 || filteredTasks.length > 0;
  const isSearching = q.length > 0;

  const handleSelectRange = useCallback((from, to) => {
    setRangeFrom(from); setRangeTo(to);
    if (from) setSelectedDate(null);
  }, []);

  const handleSelectDate = useCallback((d) => {
    setSelectedDate(d);
    setRangeFrom(null); setRangeTo(null);
  }, []);

  const clearFilter = () => { setSelectedDate(null); setRangeFrom(null); setRangeTo(null); };

  if (loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin" />
    </div>
  );

  // ── Search Results View ───────────────────────────────────────────────────
  if (isSearching) {
    return (
      <div className="min-h-screen bg-[#EEF2F7]">
        <div className="p-3 sm:p-6 max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Search size={16} className="text-teal-500 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-gray-500">
              Results for <span className="font-semibold text-gray-800">"{searchQuery}"</span>
            </p>
            <span className="text-xs text-gray-400">{filteredProjects.length + filteredTasks.length} found</span>
          </div>

          {!hasResults && (
            <div className="bg-white rounded-2xl shadow-sm p-10 sm:p-16 text-center" style={{ border: `1px solid ${TL}` }}>
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🔍</div>
              <p className="text-base sm:text-lg font-semibold text-gray-700 mb-1.5 sm:mb-2">No results found</p>
              <p className="text-xs sm:text-sm text-gray-400">Nothing matched "<span className="font-medium">{searchQuery}</span>".</p>
            </div>
          )}

          {filteredProjects.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
              <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: `1px solid ${TL}` }}>
                <BarChart2 size={15} className="text-teal-500" />
                <h2 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wider">Projects</h2>
                <span className="ml-auto text-xs text-gray-400">{filteredProjects.length} found</span>
              </div>

              {/* Scrollable table — all screen sizes */}
              <ProjectsTable
                filteredProjects={filteredProjects}
                isFiltered={isFiltered}
                hasSingle={hasSingle}
                selectedDate={selectedDate}
                todayYMD={todayYMD}
              />
            </div>
          )}

          {filteredTasks.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
              <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: `1px solid ${TL}` }}>
                <CheckCircle2 size={15} className="text-teal-500" />
                <h2 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wider">Tasks</h2>
                <span className="ml-auto text-xs text-gray-400">{filteredTasks.length} found</span>
              </div>
              <div className="p-3 sm:p-5 space-y-2">
                {filteredTasks.map(task => {
                  const pCfg  = priorityColors[task.priority] || priorityColors.Medium;
                  const tsCfg = {
                    'Done':        'text-emerald-600 bg-emerald-50 border-emerald-200',
                    'In Progress': 'text-amber-600 bg-amber-50 border-amber-200',
                    'Pending':     'text-gray-500 bg-gray-50 border-gray-200',
                  }[task.status] || 'text-gray-500 bg-gray-50 border-gray-200';
                  return (
                    <div key={`${task.memberId}-${task.id}`}
                      className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-gray-50 transition-colors"
                      style={{ border: `1px solid ${TL}` }}>
                      <Clock size={13} className="text-amber-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] sm:text-[13px] font-semibold text-gray-800 truncate">{task.title}</p>
                        <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] sm:text-[11px] text-gray-400 truncate max-w-[80px] sm:max-w-none">{task.memberName}</span>
                          <span className="text-gray-300">·</span>
                          <span className={`text-[10px] sm:text-[11px] font-semibold ${pCfg.text}`}>{task.priority}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full border ${tsCfg}`}>{task.status}</span>
                        <span className="text-[9px] sm:text-[10px] font-mono text-gray-400">{task.dueDate || '—'}</span>
                      </div>
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
      <div className="p-3 sm:p-6 space-y-3 sm:space-y-5 max-w-[1600px] mx-auto">

        {/* Row 1 — Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatCard>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-teal-400 to-cyan-500">
              <FolderOpen size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{projects.length}</p>
              <p className="text-xs sm:text-sm font-medium text-gray-500 mt-0.5">Projects</p>
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500"/>{activeProjects} Active
              </span>
            </div>
          </StatCard>

          <StatCard>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-400 to-purple-500">
              <Users size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{members.length}</p>
              <p className="text-xs sm:text-sm font-medium text-gray-500 mt-0.5">Team Members</p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{activeMembers} active</p>
            </div>
          </StatCard>

          <TasksStatCard doneTasks={doneTasks} inProgTasks={inProgTasks} pendingTasks={pendingTasks} allTasks={allTasks} />
          <UpcomingDeadlinesStatCard members={members} />
        </div>

        {/* Today's Deadlines Banner */}
        {todayDeadlines.length > 0 && (
          <div className="rounded-2xl px-3 sm:px-5 py-3 flex items-start sm:items-center gap-2 sm:gap-3 flex-wrap"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <AlertCircle size={14} className="text-red-500"/>
              <span className="text-[12px] sm:text-[13px] font-bold text-red-600">Today's Deadlines</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              {todayDeadlines.map(p => {
                const sCfg = statusColors[p.status] || statusColors['Planning'];
                return (
                  <span key={p.id} className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full bg-white text-[11px] sm:text-[12px] font-semibold text-gray-800"
                    style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`}/>
                    <span className="truncate max-w-[100px] sm:max-w-none">{p.name}</span>
                    <span className={`text-[9px] sm:text-[10px] font-bold ml-0.5 hidden sm:inline ${sCfg.text}`}>{p.status}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Section Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-[13px] sm:text-[15px] font-bold text-gray-800 truncate">
              {isFiltered ? `Results for ${dateBadgeLabel}` : 'Projects & Tasks'}
            </h2>
            <p className="text-[11px] sm:text-[12px] text-gray-400 mt-0.5">
              {isFiltered
                ? `${filteredProjects.length} project${filteredProjects.length!==1?'s':''} · ${filteredTasks.length} task${filteredTasks.length!==1?'s':''}`
                : 'Recent projects and pending tasks'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isFiltered && (
              <button onClick={clearFilter}
                className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100">
                <X size={11}/> Clear
              </button>
            )}
            <button ref={calBtnRef}
              onClick={() => setShowCalDrop(v => !v)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl font-semibold text-[11px] sm:text-[13px] transition-all border
                ${showCalDrop || isFiltered
                  ? 'bg-teal-500 text-white border-teal-500 shadow-md'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50 shadow-sm'}`}
              style={{ boxShadow: showCalDrop || isFiltered ? '0 4px 14px rgba(20,184,166,0.3)' : undefined }}>
              <Calendar size={13}/>
              <span className="max-w-[90px] sm:max-w-none truncate">
                {isFiltered ? dateBadgeLabel : 'Filter by Date'}
              </span>
              <ChevronDown size={11} style={{ transform: showCalDrop ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s', flexShrink: 0 }}/>
            </button>
          </div>
        </div>

        {/* Calendar Dropdown */}
        {showCalDrop && (
          <CalendarDropdown
            anchorRef={calBtnRef}
            members={members}
            projects={projects}
            selectedDate={selectedDate}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            onSelectDate={handleSelectDate}
            onSelectRange={handleSelectRange}
            onClose={() => setShowCalDrop(false)}
          />
        )}

        {/* Row 2 — Projects Table + Task Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5">

          {/* Projects Panel */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: `1px solid ${TL}` }}>
              <div className="flex items-center gap-2">
                <BarChart2 size={14} className="text-teal-500" />
                <h3 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wider">
                  {isFiltered ? 'Projects' : 'Recent Projects'}
                </h3>
              </div>
              <span className="text-xs text-gray-400">{filteredProjects.length} {isFiltered ? 'found' : 'total'}</span>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="py-12 sm:py-16 text-center">
                <p className="text-gray-400 text-xs sm:text-sm">{isFiltered ? 'No projects in this range' : 'No projects yet'}</p>
              </div>
            ) : (
              /* Scrollable table — all screen sizes */
              <ProjectsTable
                filteredProjects={filteredProjects}
                isFiltered={isFiltered}
                hasSingle={hasSingle}
                selectedDate={selectedDate}
                todayYMD={todayYMD}
              />
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-3 sm:gap-5">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: `1px solid ${TL}` }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-teal-500" />
                  <h3 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wider">
                    {isFiltered ? 'Tasks' : 'Task Overview'}
                  </h3>
                </div>
                <span className="text-xs text-gray-400">{filteredTasks.length} {isFiltered ? 'found' : 'active'}</span>
              </div>
              <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
                {!isFiltered && (
                  <>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                      {[
                        { label: 'Done',        count: doneTasks,    color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                        { label: 'In Progress', count: inProgTasks,  color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200'   },
                        { label: 'Pending',     count: pendingTasks, color: 'text-gray-500',    bg: 'bg-gray-50',    border: 'border-gray-200'    },
                      ].map(({ label, count, color, bg, border }) => (
                        <div key={label} className={`${bg} border ${border} rounded-xl p-2 sm:p-3 text-center`}>
                          <p className={`text-lg sm:text-xl font-bold ${color}`}>{count}</p>
                          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 font-medium leading-tight">{label}</p>
                        </div>
                      ))}
                    </div>
                    {allTasks.length > 0 && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] sm:text-xs text-gray-500 font-medium">Completion Rate</span>
                          <span className="text-[11px] sm:text-xs font-bold text-teal-600">{Math.round((doneTasks / allTasks.length) * 100)}%</span>
                        </div>
                        <div className="h-1.5 sm:h-2 rounded-full bg-[#EEF2F7] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all"
                            style={{ width: `${Math.round((doneTasks / allTasks.length) * 100)}%` }}/>
                        </div>
                      </div>
                    )}
                    <div style={{ borderTop: `1px solid ${TL}` }} className="pt-2 sm:pt-3">
                      <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Pending Tasks</p>
                    </div>
                  </>
                )}
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-4 sm:py-6">
                    <p className="text-xs text-gray-400">{isFiltered ? 'No tasks in this range' : 'All caught up!'}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 sm:space-y-2">
                    {filteredTasks.map(task => {
                      const pCfg      = priorityColors[task.priority] || priorityColors.Medium;
                      const sCfg      = statusColors[task.status]     || statusColors['Pending'];
                      const isTodayTask = toYMD(task.dueDate) === todayYMD;
                      return (
                        <div key={`${task.memberId}-${task.id}`}
                          className="flex items-start gap-2 p-2 sm:p-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                          style={{ border: `1px solid ${TL}` }}>
                          <Clock size={12} className={`flex-shrink-0 mt-0.5 ${isTodayTask ? 'text-red-400' : 'text-amber-400'}`}/>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] sm:text-[12px] font-semibold text-gray-800 truncate">{task.title}</p>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-gray-400 truncate max-w-[70px] sm:max-w-[80px]">{task.memberName}</span>
                              <span className="text-gray-300 text-[10px]">·</span>
                              <span className={`text-[10px] font-semibold ${pCfg.text}`}>{task.priority}</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-1">
                            {isFiltered ? (
                              <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${sCfg.text} ${sCfg.bg} ${sCfg.border}`}>{task.status}</span>
                            ) : isTodayTask ? (
                              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 whitespace-nowrap">Due Today</span>
                            ) : (
                              <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 whitespace-nowrap">{task.dueDate || '—'}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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