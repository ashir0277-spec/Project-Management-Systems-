import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  collection, doc, setDoc, onSnapshot, deleteDoc,
  getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Calendar, ChevronLeft, ChevronRight, Download, Link2,
  Edit2, Trash2, CheckCircle2, Clock, Copy, Check, FileText,
  X, Loader2, UserCheck, UserX, AlertCircle, RefreshCw,
  BarChart2, ChevronDown, Share2, Mail, MessageCircle,
  Shield, Users, LogIn, Coffee, LogOut, Timer, Search,
  CalendarRange, Minus, AlignLeft, TrendingUp, Award,
  ClockIcon, Activity,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════════════════════════════
const TL  = 'rgba(51,51,51,0.1)';
const TLB = 'rgba(51,51,51,0.16)';

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_L   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_S   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const STATUS_LIST  = ['Present', 'Absent', 'Late', 'Leave'];
const STATUS_CYCLE = [...STATUS_LIST, ''];

const statusCfg = {
  Present: { text: 'text-emerald-600', bg: '',  border: 'border-emerald-200', dot: 'bg-emerald-500', short: 'P'  },
  Absent:  { text: 'text-red-600',     bg: '',  border: 'border-red-200',     dot: 'bg-red-500',     short: 'A'  },
  Late:    { text: 'text-amber-600',   bg: '',  border: 'border-amber-200',   dot: 'bg-amber-500',   short: 'L'  },
  Leave:   { text: 'text-violet-600',  bg: '',  border: 'border-violet-200',  dot: 'bg-violet-500',  short: 'LV' },
};

const REASON_REQUIRED = ['Absent', 'Late', 'Leave'];
const TARGET_MINS = 9 * 60;

const to12hr = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2,'0')} ${ampm}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM TIME INPUT
// ═══════════════════════════════════════════════════════════════════════════
const TimeInput = ({ value, onChange, placeholder = '--:--' }) => {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState('');
  const inputRef = useRef(null);
  const displayVal = value ? value : '';
  const startEdit = () => { setLocalVal(value || ''); setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); };
  const commit = (v) => {
    setEditing(false);
    if (!v) { onChange(''); return; }
    let cleaned = v.trim().toUpperCase();
    let isPM = cleaned.includes('PM'); let isAM = cleaned.includes('AM');
    cleaned = cleaned.replace('AM','').replace('PM','').trim();
    const parts = cleaned.split(':');
    if (parts.length < 2) { onChange(''); return; }
    let h = parseInt(parts[0]), m = parseInt(parts[1]);
    if (isNaN(h) || isNaN(m)) { onChange(''); return; }
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    if (h > 23 || m > 59) { onChange(''); return; }
    onChange(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  };
  return (
    <div className="relative">
      {!editing ? (
        <button onClick={startEdit} className="w-full px-1.5 py-1.5 rounded-lg transition-all hover:border-teal-300">
          {value ? <span className="text-[14px] font-medium text-gray-700">{to12hr(value)}</span>
                 : <span className="text-[14px] text-gray-300 font-medium">{placeholder}</span>}
        </button>
      ) : (
        <input ref={inputRef} type="time" defaultValue={displayVal}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(e.target.value); if (e.key === 'Escape') setEditing(false); }}
          className="w-full px-1.5 py-1.5 rounded-lg text-[11px] font-mono text-gray-700 outline-none"
          style={{ border:`1px solid rgba(20,184,166,0.6)`, background:'#fff', minWidth:0 }}/>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════
const toYMD = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
};
const todayYMD = toYMD(new Date());
const fmtFull  = (ymd) => { if (!ymd) return ''; const d = new Date(ymd+'T00:00:00'); return `${DAYS_L[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtShort = (ymd) => { if (!ymd) return ''; const d = new Date(ymd+'T00:00:00'); return `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`; };
const timeToMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const calcWork = (li, bo, bi, oo) => {
  const a = timeToMin(li), b = timeToMin(bo), c = timeToMin(bi), e = timeToMin(oo);
  if (a === null || e === null) return null;
  let w = e - a;
  if (b !== null && c !== null && c > b) w -= (c - b);
  return Math.max(0, w);
};
const fmtMins = (m) => {
  if (m === null || m === undefined) return '—';
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
const fmtHrs = (m) => {
  if (m === null || m === undefined || m === 0) return '—';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min === 0 ? `${h} hrs` : `${h}h ${min}m`;
};
const hoursColor = (m) => {
  if (m === null || m === undefined) return { text:'text-gray-300', bg:'bg-gray-50', border:'border-gray-100', bar:'bg-gray-200' };
  if (m / 60 >= 9) return { text:'text-emerald-600', bg:'bg-emerald-50', border:'border-emerald-200', bar:'bg-emerald-500' };
  if (m / 60 >= 7) return { text:'text-amber-600',   bg:'bg-amber-50',   border:'border-amber-200',   bar:'bg-amber-500'   };
  return              { text:'text-red-600',     bg:'bg-red-50',     border:'border-red-200',     bar:'bg-red-500'     };
};
const genId = () => Array.from({length:24}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*62)]).join('');

const fmtTodayLabel = (ymd) => {
  if (!ymd) return '';
  const d = new Date(ymd + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR DROPDOWN
// ═══════════════════════════════════════════════════════════════════════════
const CalDrop = ({ anchorRef, value, rFrom, rTo, onDate, onRange, onClose }) => {
  const ref  = useRef(null);
  const now  = new Date();
  const [mode, setMode] = useState(rFrom ? 'range' : 'single');
  const [yr,   setYr]   = useState(() => { const b = rFrom || value; return b ? parseInt(b.slice(0,4)) : now.getFullYear(); });
  const [mo,   setMo]   = useState(() => { const b = rFrom || value; return b ? parseInt(b.slice(5,7))-1 : now.getMonth(); });
  const [pos,  setPos]  = useState({ top:0, left:0 });
  const [rS,   setRS]   = useState(rFrom || null);
  const [rE,   setRE]   = useState(rTo   || null);
  const [hov,  setHov]  = useState(null);

  useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    let left = r.left;
    if (left + 316 > window.innerWidth) left = window.innerWidth - 324;
    setPos({ top: r.bottom + 6, left: Math.max(8, left) });
  }, [anchorRef]);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target) && anchorRef.current && !anchorRef.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [anchorRef, onClose]);

  const prevM = () => mo === 0 ? (setMo(11), setYr(y => y-1)) : setMo(m => m-1);
  const nextM = () => mo === 11 ? (setMo(0), setYr(y => y+1)) : setMo(m => m+1);

  const dim = new Date(yr, mo+1, 0).getDate();
  const fd  = new Date(yr, mo, 1).getDay();
  const dp  = new Date(yr, mo, 0).getDate();
  const cells = [];
  for (let i = fd-1; i >= 0; i--)        cells.push({ d: dp-i,  m:'p', ymd: toYMD(new Date(yr, mo-1, dp-i)) });
  for (let d = 1; d <= dim; d++)          cells.push({ d,        m:'c', ymd: toYMD(new Date(yr, mo,   d))    });
  for (let d = 1; cells.length < 42; d++) cells.push({ d,        m:'n', ymd: toYMD(new Date(yr, mo+1, d))    });
  const weeks = Array.from({ length:6 }, (_, i) => cells.slice(i*7, i*7+7));

  const effE = rE || hov;
  const rf   = rS && effE ? (rS <= effE ? rS : effE) : rS;
  const rt   = rS && effE ? (rS <= effE ? effE : rS) : null;
  const inR  = (y) => rf && rt && y > rf && y < rt;
  const isEd = (y) => y === rf || y === rt;
  const switchMode = (m) => { setMode(m); setRS(null); setRE(null); setHov(null); onDate(null); onRange(null, null); };
  const onDay = (ymd) => {
    if (mode === 'single') { onDate(value === ymd ? null : ymd); return; }
    if (!rS || (rS && rE)) { setRS(ymd); setRE(null); }
    else { const f = rS <= ymd ? rS : ymd, t = rS <= ymd ? ymd : rS; setRE(t); setRS(f); onRange(f, t); }
  };

  return ReactDOM.createPortal(
    <div ref={ref} style={{ position:'fixed', top:pos.top, left:pos.left, width:308, zIndex:9999, background:'#fff', borderRadius:16, border:`1px solid ${TL}`, boxShadow:'0 16px 40px rgba(0,0,0,0.14)' }}>
      <div className="flex gap-1 p-2.5" style={{ borderBottom:`1px solid ${TL}` }}>
        {[{ k:'single', l:'Single Date' }, { k:'range', l:'Date Range' }].map(tab => (
          <button key={tab.k} onClick={() => switchMode(tab.k)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${mode===tab.k ? 'bg-teal-500 text-white border-teal-500' : 'text-gray-500 bg-gray-50 border-gray-200 hover:border-teal-300 hover:text-teal-600'}`}>
            {tab.l}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <button onClick={prevM} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><ChevronLeft size={13}/></button>
        <span className="text-[13px] font-bold text-gray-800">{MONTHS[mo].slice(0,3)} {yr}</span>
        <button onClick={nextM} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><ChevronRight size={13}/></button>
      </div>
      <div className="px-2 pb-3">
        <div className="grid grid-cols-7 mb-0.5">
          {DAYS_S.map(d => <div key={d} className="text-center text-[9px] font-bold text-gray-300 py-0.5 uppercase">{d}</div>)}
        </div>
        {weeks.map((wk, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {wk.map(cell => {
              const iT = cell.ymd === todayYMD, iS = mode==='single' && cell.ymd===value;
              const iE = mode==='range' && isEd(cell.ymd) && rf && rt, iM = mode==='range' && inR(cell.ymd), iC = cell.m==='c';
              let bg='', bd='1.5px solid transparent';
              if (iS||iE)      { bg='linear-gradient(135deg,#14b8a6,#06b6d4)'; }
              else if (iM)     { bg='rgba(20,184,166,0.1)'; bd='1.5px solid rgba(20,184,166,0.2)'; }
              else if (iT)     { bg='rgba(20,184,166,0.07)'; bd='1.5px solid rgba(20,184,166,0.28)'; }
              return (
                <button key={cell.ymd} onClick={() => onDay(cell.ymd)}
                  onMouseEnter={() => mode==='range' && rS && !rE && setHov(cell.ymd)}
                  onMouseLeave={() => mode==='range' && setHov(null)}
                  className="flex items-center justify-center rounded-lg transition-all"
                  style={{ height:30, background:bg, border:bd }}>
                  <span className={`text-[11px] font-semibold ${iS||iE?'text-white':iT?'text-teal-600':iM?'text-teal-700':!iC?'text-gray-300':'text-gray-700'}`}>{cell.d}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {mode === 'range' && (
        <div className="px-3 pb-3 pt-0">
          <p className="text-center text-[10px] text-gray-400 bg-gray-50 rounded-lg py-1.5">
            {!rS ? '📅 Click start date' : !rE ? '📅 Click end date' : `✓ ${fmtShort(rf)} → ${fmtShort(rt)}`}
          </p>
        </div>
      )}
    </div>,
    document.body
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// STATUS CELL
// ═══════════════════════════════════════════════════════════════════════════
const StatusCell = ({ status, reason, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn);
  }, []);
  const cfg = statusCfg[status];
  const cycle = (e) => { e.stopPropagation(); const idx = STATUS_CYCLE.indexOf(status||''); onChange(STATUS_CYCLE[(idx+1)%STATUS_CYCLE.length], reason); };
  const pick = (s) => { onChange(s, reason); setOpen(false); };
  const clearStatus = () => { onChange('', ''); setOpen(false); };
  return (
    <div ref={ref} className="relative">
      <div className="flex">
        <button onClick={cycle} className={`flex items-center gap-1 px-2 py-1 rounded-l-lg text-[11px] font-bold transition-all ${cfg ? `${cfg.bg} ${cfg.text}` : 'text-gray-400 hover:bg-teal-50 hover:text-teal-600'}`}>
          {cfg && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`}/>}
          <span className="truncate max-w-[54px]">{status || '—'}</span>
        </button>
        <button onClick={() => setOpen(v => !v)} className={`px-1 py-1 rounded-r-lg transition-all ${cfg ? `${cfg.bg} ${cfg.text}` : 'text-gray-400 hover:bg-teal-50 hover:text-teal-600'}`}>
          <ChevronDown size={10} style={{ transform:open?'rotate(180deg)':'rotate(0)', transition:'transform .15s' }}/>
        </button>
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-xl overflow-hidden min-w-[140px]" style={{ border:`1px solid ${TL}` }}>
          <button onClick={clearStatus} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-400 hover:bg-gray-50"><Minus size={10}/> Clear</button>
          {STATUS_LIST.map(s => { const c = statusCfg[s]; return (
            <button key={s} onClick={() => pick(s)} className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-gray-50 ${status===s?c.text:'text-gray-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`}/>{s}
            </button>
          );})}
        </div>
      )}
      {reason && !open && (
        <div className="mt-0.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100">
          <AlignLeft size={8} className="text-gray-400 flex-shrink-0"/>
          <span className="text-[9px] text-gray-400 truncate max-w-[90px]">{reason}</span>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// EDIT MODAL
// ═══════════════════════════════════════════════════════════════════════════
const EditModal = ({ rec, member, date, onSave, onDelete, onClose }) => {
  const [form, setForm] = useState({ status:rec?.status||'', loginIn:rec?.loginIn||'', breakOut:rec?.breakOut||'', breakIn:rec?.breakIn||'', officeOut:rec?.officeOut||'', note:rec?.note||'', reason:rec?.reason||'' });
  const w = calcWork(form.loginIn, form.breakOut, form.breakIn, form.officeOut);
  const hc = hoursColor(w);
  const needsReason = REASON_REQUIRED.includes(form.status);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.45)', backdropFilter:'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" style={{ border:`1px solid ${TL}` }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:`1px solid ${TL}` }}>
          <div><p className="text-sm font-bold text-gray-800">Edit Attendance</p><p className="text-[11px] text-gray-400 mt-0.5">{member.name} · {fmtShort(date)}</p></div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={14}/></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Status</p>
            <div className="grid grid-cols-3 gap-1.5">
              {['', ...STATUS_LIST].map(s => { const c = statusCfg[s]; return (
                <button key={s||'none'} onClick={() => setForm(f => ({ ...f, status:s }))}
                  className={`py-1.5 rounded-lg text-[11px] font-bold border transition-all ${form.status===s?(c?`${c.bg} ${c.border} ${c.text}`:'bg-gray-100 border-gray-300 text-gray-600'):'bg-gray-50 border-gray-200 text-gray-400 hover:border-teal-300 hover:text-teal-600'}`}>
                  {s || 'Clear'}
                </button>
              );})}
            </div>
          </div>
          {needsReason && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><AlignLeft size={9}/> Reason <span className="text-red-400">*</span></p>
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason:e.target.value }))} placeholder={`Why ${form.status}?`} className="w-full px-3 py-2 rounded-lg text-[12px] text-gray-700 outline-none" style={{ border:`1px solid ${TL}`, background:'#FAFAFA' }}/>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {[{ k:'loginIn', l:'Login In', I:LogIn },{ k:'breakOut', l:'Break Out', I:Coffee },{ k:'breakIn', l:'Break In', I:Coffee },{ k:'officeOut', l:'Office Out', I:LogOut }].map(({ k, l, I }) => (
              <div key={k}>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1"><I size={9}/>{l}</label>
                <TimeInput value={form[k]} onChange={v => setForm(f => ({ ...f, [k]:v }))}/>
              </div>
            ))}
          </div>
          {w !== null && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${hc.bg} border ${hc.border}`}>
              <Timer size={12} className={hc.text}/>
              <span className={`text-[11px] font-bold ${hc.text}`}>{fmtMins(w)} working</span>
              <span className="text-[10px] text-gray-400 ml-auto">9h target</span>
              <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden"><div className={`h-full rounded-full ${hc.bar}`} style={{ width:`${Math.min(100,(w/TARGET_MINS)*100)}%` }}/></div>
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Note (Optional)</p>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note:e.target.value }))} placeholder="Any additional notes..." rows={2} className="w-full px-3 py-2 rounded-lg text-[12px] text-gray-700 resize-none outline-none" style={{ border:`1px solid ${TL}`, background:'#FAFAFA' }}/>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          {rec && (<button onClick={onDelete} className="w-9 h-9 rounded-lg flex items-center justify-center text-red-400 bg-red-50 border border-red-200 hover:bg-red-100 flex-shrink-0"><Trash2 size={14}/></button>)}
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2 rounded-lg text-[12px] font-bold text-white bg-teal-500 hover:bg-teal-600">Save</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE LINK MODAL
// ═══════════════════════════════════════════════════════════════════════════
const LinkModal = ({ onClose, genLink, generating, onGenerate }) => {
  const [copied, setCopied] = useState(false);
  const [ld, setLd] = useState(todayYMD);
  const copy    = () => { navigator.clipboard.writeText(genLink); setCopied(true); setTimeout(() => setCopied(false), 2500); };
  const shareWA = () => window.open(`https://wa.me/?text=${encodeURIComponent('Attendance Link: '+genLink)}`, '_blank');
  const shareEM = () => window.open(`mailto:?subject=Mark Your Attendance&body=${encodeURIComponent('Please mark your attendance:\n'+genLink)}`, '_blank');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.45)', backdropFilter:'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ border:`1px solid ${TL}` }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:`1px solid ${TL}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center"><Link2 size={16} className="text-white"/></div>
            <div><p className="text-sm font-bold text-gray-800">Generate Link</p><p className="text-[11px] text-gray-400">One-time use per member</p></div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={14}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Date</p>
            <input type="date" value={ld} onChange={e => setLd(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[13px] text-gray-700 outline-none" style={{ border:`1px solid ${TL}`, background:'#FAFAFA' }}/>
          </div>
          {!genLink ? (
            <button onClick={() => onGenerate(ld)} disabled={generating} className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
              {generating ? <Loader2 size={14} className="animate-spin"/> : <Link2 size={14}/>}{generating ? 'Generating...' : 'Generate Link'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-3 flex items-start gap-2.5" style={{ background:'rgba(20,184,166,0.05)', border:'1px solid rgba(20,184,166,0.25)' }}>
                <p className="flex-1 text-[11px] text-teal-700 font-mono break-all leading-relaxed">{genLink}</p>
                <button onClick={copy} className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${copied?'bg-emerald-100 text-emerald-600':'bg-teal-100 text-teal-600 hover:bg-teal-200'}`}>
                  {copied ? <Check size={14}/> : <Copy size={14}/>}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={shareWA} className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100"><MessageCircle size={16}/> WhatsApp</button>
                <button onClick={shareEM} className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100"><Mail size={16}/> Email</button>
                <button onClick={copy} className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold border ${copied?'text-emerald-600 bg-emerald-50 border-emerald-200':'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>{copied?<Check size={16}/>:<Copy size={16}/>}{copied?'Copied!':'Copy'}</button>
              </div>
              <button onClick={() => onGenerate(ld)} className="w-full py-2 rounded-xl text-[12px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 flex items-center justify-center gap-1.5"><RefreshCw size={12}/> New Link</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPUTE MEMBER SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
const computeSummary = (memberRecs, dates) => {
  let present=0, absent=0, late=0, leave=0, totalMins=0, daysWithHours=0;
  dates.forEach(dt => {
    const r = memberRecs?.[dt];
    const s = r?.status || '';
    if      (s === 'Present') present++;
    else if (s === 'Absent')  absent++;
    else if (s === 'Late')    late++;
    else if (s === 'Leave')   leave++;
    const w = r ? calcWork(r.loginIn, r.breakOut, r.breakIn, r.officeOut) : null;
    if (w !== null && w > 0) { totalMins += w; daysWithHours++; }
  });
  const avgMins = daysWithHours > 0 ? Math.round(totalMins / daysWithHours) : null;
  const totalDays = dates.length;
  const attendancePct = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 0;
  return { present, absent, late, leave, totalMins, avgMins, daysWithHours, totalDays, attendancePct };
};

// ═══════════════════════════════════════════════════════════════════════════
// MEMBER SUMMARY CARD
// ═══════════════════════════════════════════════════════════════════════════
const MemberSummaryCard = ({ member, memberRecs, dates }) => {
  const s = computeSummary(memberRecs, dates);
  return (
    <div className="rounded-2xl bg-white overflow-hidden" style={{ border:`1px solid ${TL}`, boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom:`1px solid ${TL}`, background:'#FAFAFA' }}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0">
          {member.name?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-800 truncate">{member.name}</p>
          {member.role && <p className="text-[10px] text-gray-400 truncate">{member.role}</p>}
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-stretch gap-0 rounded-xl overflow-hidden" style={{ border:`1px solid ${TL}` }}>
          <div className="flex-1 flex flex-col items-center justify-center px-3 py-2.5" style={{ borderRight:`1px solid ${TL}`, background:'#F0FDFA' }}>
            <span className="text-[20px] font-bold text-teal-700">{s.totalDays}</span>
            <span className="text-[9px] font-semibold text-teal-500 uppercase tracking-wider mt-0.5">Total Days</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-3 py-2.5" style={{ borderRight:`1px solid ${TL}`, background:'#F0FDF4' }}>
            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-bold text-emerald-600">{s.present}</span>
              <span className="text-[11px] font-bold text-emerald-300">1</span>
            </div>
            <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider mt-0.5">Present</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-3 py-2.5" style={{ background:'#FFF5F5' }}>
            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-bold text-red-500">{s.absent}</span>
              <span className="text-[11px] font-bold text-red-300">0</span>
            </div>
            <span className="text-[9px] font-semibold text-red-400 uppercase tracking-wider mt-0.5">Absent</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background:'#F8FAFB', border:`1px solid ${TL}` }}>
          <div className="flex items-center gap-1.5">
            <Timer size={12} className="text-gray-400"/>
            <span className="text-[12px] font-semibold text-gray-600">Working Hours</span>
          </div>
          <span className={`text-[14px] font-bold ${hoursColor(s.totalMins).text}`}>{fmtHrs(s.totalMins)}</span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// REPORT MODAL
// ═══════════════════════════════════════════════════════════════════════════
const ReportModal = ({ member, members, onClose }) => {
  const isAll   = !member;
  const targets = isAll ? members : [member];

  const [period,  setPeriod]  = useState('weekly');
  const [month,   setMonth]   = useState(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`);
  const [rf,      setRf]      = useState('');
  const [rt,      setRt]      = useState('');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [sOpen,   setSOpen]   = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [sLink,   setSLink]   = useState('');
  const [sLinking,setSLinking]= useState(false);
  const [view,    setView]    = useState('summary');

  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = useRef(null);
  const [showRangeCal, setShowRangeCal] = useState(false);
  const calBtnRef = useRef(null);
  const [weekMonth, setWeekMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(null);

  useEffect(() => {
    const fn = (e) => { if (periodRef.current && !periodRef.current.contains(e.target)) setPeriodOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const rangeLabel = rf && rt ? (rf === rt ? fmtShort(rf) : `${fmtShort(rf)} → ${fmtShort(rt)}`) : 'Pick date';

  const getWeeksOfMonth = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const weeks = [];
    let d = new Date(y, m-1, 1);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    while (d.getMonth() === m-1 || (d.getMonth() === (m%12) && new Date(y,m-1,1).getMonth() !== d.getMonth())) {
      const mon = new Date(d);
      const fri = new Date(d); fri.setDate(d.getDate()+4);
      if (mon.getMonth() !== m-1 && fri.getMonth() !== m-1) break;
      weeks.push({ mon: toYMD(mon), fri: toYMD(fri), label: `${mon.getDate()} ${MONTHS_S[mon.getMonth()]} – ${fri.getDate()} ${MONTHS_S[fri.getMonth()]}` });
      d.setDate(d.getDate()+7);
    }
    return weeks;
  };

  const weeksOfMonth = useMemo(() => getWeeksOfMonth(weekMonth), [weekMonth]);

  const resolvedWeekIdx = useMemo(() => {
    if (selectedWeekIdx !== null) return selectedWeekIdx;
    const today = todayYMD;
    const idx = weeksOfMonth.findIndex(w => w.mon <= today && today <= w.fri);
    return idx >= 0 ? idx : 0;
  }, [selectedWeekIdx, weeksOfMonth]);

  const selectedWeek = weeksOfMonth[resolvedWeekIdx] || weeksOfMonth[0];

  const periodLabel = useMemo(() => {
    if (period === 'weekly' && selectedWeek) return `Week ${resolvedWeekIdx+1} · ${selectedWeek.label}`;
    if (period === 'monthly') {
      const [y, m] = month.split('-').map(Number);
      return `${MONTHS[m-1]} ${y}`;
    }
    if (period === 'custom' && rf && rt) return rf === rt ? fmtShort(rf) : `${fmtShort(rf)} → ${fmtShort(rt)}`;
    if (period === 'custom') return 'Custom Range';
    return '';
  }, [period, month, rf, rt, selectedWeek, resolvedWeekIdx]);

  const periodBtnLabel = useMemo(() => {
    if (period === 'weekly' && selectedWeek) return selectedWeek.label;
    if (period === 'monthly') {
      const [y, m] = month.split('-').map(Number);
      return `${MONTHS_S[m-1]} ${y}`;
    }
    if (period === 'custom' && rf && rt) return rf === rt ? fmtShort(rf) : `${fmtShort(rf)} → ${fmtShort(rt)}`;
    return 'Custom';
  }, [period, month, rf, rt, selectedWeek]);

  const load = async () => {
    setLoading(true); setData(null);
    try {
      let q;
      if (period === 'monthly') {
        const [y, m] = month.split('-').map(Number);
        q = query(collection(db,'attendance'),
          where('date','>=',`${y}-${String(m).padStart(2,'0')}-01`),
          where('date','<=',`${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}`));
      } else if (period === 'custom' && rf && rt) {
        q = query(collection(db,'attendance'), where('date','>=',rf), where('date','<=',rt));
      } else if (period === 'weekly' && selectedWeek) {
        q = query(collection(db,'attendance'), where('date','>=',selectedWeek.mon), where('date','<=',selectedWeek.fri));
      }
      if (!q) { setLoading(false); return; }
      const snap = await getDocs(q);
      const recs = {};
      snap.forEach(d => { const it = d.data(); if (!recs[it.memberId]) recs[it.memberId]={}; recs[it.memberId][it.date]=it; });

      let dates = [];
      if (period === 'weekly' && selectedWeek) {
        let cur = new Date(selectedWeek.mon+'T00:00:00');
        const end = new Date(selectedWeek.fri+'T00:00:00');
        while (cur <= end) { if (cur.getDay()!==0 && cur.getDay()!==6) dates.push(toYMD(cur)); cur.setDate(cur.getDate()+1); }
      } else if (period === 'monthly') {
        const [y, m] = month.split('-').map(Number);
        const dim = new Date(y,m,0).getDate();
        for (let d=1; d<=dim; d++) { const dt = new Date(y,m-1,d); if (dt.getDay()!==0 && dt.getDay()!==6) dates.push(toYMD(dt)); }
      } else if (period === 'custom' && rf && rt) {
        if (rf === rt) {
          dates.push(rf);
        } else {
          let cur = new Date(rf+'T00:00:00'); const end = new Date(rt+'T00:00:00');
          while (cur <= end) { if (cur.getDay()!==0 && cur.getDay()!==6) dates.push(toYMD(cur)); cur.setDate(cur.getDate()+1); }
        }
      }

      setData({ dates, recs });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const dlCSV = () => {
    if (!data) return;
    const rows = [['Name','Role',...data.dates,'Present','Absent','Late','Leave','Total Hrs','Avg Hrs/Day','Attendance%']];
    targets.forEach(m => {
      const s = computeSummary(data.recs[m.id], data.dates);
      const cells = data.dates.map(dt => { const r = data.recs[m.id]?.[dt]; return r?.status || '-'; });
      rows.push([m.name, m.role||'', ...cells, s.present, s.absent, s.late, s.leave, fmtHrs(s.totalMins), s.avgMins!==null?fmtHrs(s.avgMins):'—', `${s.attendancePct}%`]);
    });
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download=`attendance_${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const genSLink = async () => {
    setSLinking(true);
    try {
      const id = genId();
      await setDoc(doc(db,'attendanceLinks',id), { date:rf, createdAt:new Date().toISOString(), expiresAt:new Date(Date.now()+7*24*3600000).toISOString(), isActive:true, usedBy:[] });
      setSLink(`${window.location.origin}/mark-attendance/${id}`);
    } catch (e) { console.error(e); }
    setSLinking(false);
  };

  const cpLink = () => { navigator.clipboard.writeText(sLink); setCopied(true); setTimeout(()=>setCopied(false),2500); };
  const waLink = () => window.open(`https://wa.me/?text=${encodeURIComponent('Attendance: '+sLink)}`, '_blank');
  const emLink = () => window.open(`mailto:?subject=Attendance&body=${encodeURIComponent(sLink)}`, '_blank');

  const teamAggregate = useMemo(() => {
    if (!data || !isAll) return null;
    let present=0, absent=0, late=0, leave=0, totalMins=0;
    targets.forEach(m => {
      const s = computeSummary(data.recs[m.id], data.dates);
      present+=s.present; absent+=s.absent; late+=s.late; leave+=s.leave; totalMins+=s.totalMins;
    });
    return { present, absent, late, leave, totalMins, memberCount: targets.length };
  }, [data, targets, isAll]);

  useEffect(() => {
    if (period === 'custom' && (!rf || !rt)) return;
    if (period === 'weekly' && !selectedWeek) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, month, rf, rt, resolvedWeekIdx, weekMonth]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" style={{ background:'rgba(0,0,0,0.45)', backdropFilter:'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col" style={{ border:`1px solid ${TL}`, maxHeight:'95vh', height:'95vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 flex-shrink-0" style={{ borderBottom:`1px solid ${TL}` }}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center flex-shrink-0"><FileText size={15} className="text-white"/></div>
            <div className="min-w-0">
              <p className="text-[13px] sm:text-sm font-bold text-gray-800 truncate">{isAll ? 'All Members Report' : `${member.name}'s Report`}</p>
              <p className="text-[10px] text-gray-400">{data ? `${data.dates.length} working days · ${periodLabel}` : 'Select period'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div ref={periodRef} className="relative">
              <button onClick={() => setPeriodOpen(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all
                  ${periodOpen ? 'bg-teal-500 text-white border-teal-500 shadow-sm' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50'}`}>
                <Calendar size={12} className="flex-shrink-0"/>
                <div className="text-left">
                  {period === 'weekly' ? (
                    <>
                      <p className="text-[10px] font-bold leading-tight opacity-70">Weekly</p>
                      <p className="text-[11px] font-semibold leading-tight">{periodBtnLabel}</p>
                    </>
                  ) : (
                    <p className="text-[11px] sm:text-[12px] font-semibold leading-tight">{periodBtnLabel}</p>
                  )}
                </div>
                <ChevronDown size={10} className="flex-shrink-0" style={{ transform:periodOpen?'rotate(180deg)':'rotate(0)', transition:'transform .15s' }}/>
              </button>

              {periodOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-[100] bg-white rounded-2xl shadow-2xl" style={{ border:`1px solid ${TL}`, minWidth:190 }}>
                  <div className="p-2 space-y-0.5">
                    <div className={`rounded-xl border transition-all ${period==='weekly' ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-center gap-1 px-3 py-2" style={{ borderBottom:`1px solid rgba(51,51,51,0.08)` }}>
                        <Calendar size={12} className={period==='weekly' ? 'text-teal-600' : 'text-gray-400'}/>
                        <span className={`text-[12px] font-semibold flex-1 ${period==='weekly' ? 'text-teal-700' : 'text-gray-700'}`}>Weekly</span>
                        <button onClick={() => {
                          const [y,m] = weekMonth.split('-').map(Number);
                          const prev = m===1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`;
                          setWeekMonth(prev); setSelectedWeekIdx(0); setPeriod('weekly');
                        }} className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-white hover:text-teal-600"><ChevronLeft size={11}/></button>
                        <span className="text-[10px] font-bold text-gray-500 w-16 text-center">
                          {(() => { const [y,m] = weekMonth.split('-').map(Number); return `${MONTHS_S[m-1]} ${y}`; })()}
                        </span>
                        <button onClick={() => {
                          const [y,m] = weekMonth.split('-').map(Number);
                          const next = m===12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`;
                          setWeekMonth(next); setSelectedWeekIdx(0); setPeriod('weekly');
                        }} className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-white hover:text-teal-600"><ChevronRight size={11}/></button>
                      </div>
                      <div className="p-1.5 space-y-0.5">
                        {weeksOfMonth.map((wk, i) => {
                          const isSelected = period==='weekly' && resolvedWeekIdx===i;
                          const isCurrent = wk.mon <= todayYMD && todayYMD <= wk.fri;
                          return (
                            <button key={wk.mon} onClick={() => { setPeriod('weekly'); setSelectedWeekIdx(i); setPeriodOpen(false); }}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all text-left
                                ${isSelected ? 'bg-teal-500 text-white' : 'hover:bg-white text-gray-700'}`}>
                              <span className={`text-[10px] font-bold w-12 flex-shrink-0 ${isSelected ? 'text-teal-100' : 'text-gray-400'}`}>Week {i+1}</span>
                              <span className={`text-[11px] font-semibold flex-1 ${isSelected ? 'text-white' : 'text-gray-700'}`}>{wk.label}</span>
                              {isCurrent && !isSelected && <span className="text-[8px] font-bold text-teal-500 bg-teal-100 px-1 py-0.5 rounded">NOW</span>}
                              {isSelected && <Check size={10} className="text-white flex-shrink-0"/>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button onClick={() => setPeriod('monthly')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all
                        ${period==='monthly' ? 'border-teal-400 bg-teal-50' : 'border-transparent hover:bg-gray-50'}`}>
                      <Calendar size={13} className={period==='monthly' ? 'text-teal-600' : 'text-gray-400'}/>
                      <div className="flex-1 text-left">
                        <p className={`text-[12px] font-semibold leading-tight ${period==='monthly' ? 'text-teal-700' : 'text-gray-700'}`}>Monthly</p>
                        <p className={`text-[10px] leading-tight mt-0.5 ${period==='monthly' ? 'text-teal-500' : 'text-gray-400'}`}>
                          {(() => { const [y,m] = month.split('-').map(Number); return `${MONTHS[m-1]} ${y}`; })()}
                        </p>
                      </div>
                      {period==='monthly' && <Check size={11} className="text-teal-500 flex-shrink-0"/>}
                    </button>
                    {period === 'monthly' && (
                      <div className="px-1 pb-1">
                        <input type="month" value={month}
                          onChange={e => { setMonth(e.target.value); setPeriodOpen(false); }}
                          className="w-full px-3 py-1.5 rounded-lg text-[12px] text-gray-700 outline-none"
                          style={{ border:`1px solid ${TL}`, background:'#FAFAFA' }}/>
                      </div>
                    )}

                    <button ref={calBtnRef} onClick={() => { setPeriod('custom'); setShowRangeCal(true); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all
                        ${period==='custom' ? 'border-teal-400 bg-teal-50' : 'border-transparent hover:bg-gray-50'}`}>
                      <Calendar size={13} className={period==='custom' ? 'text-teal-600' : 'text-gray-400'}/>
                      <div className="flex-1 text-left">
                        <p className={`text-[12px] font-semibold leading-tight ${period==='custom' ? 'text-teal-700' : 'text-gray-700'}`}>Custom</p>
                        <p className={`text-[10px] leading-tight mt-0.5 ${period==='custom' ? 'text-teal-500' : 'text-gray-400'}`}>
                          {rf && rt ? rangeLabel : 'Pick any date range'}
                        </p>
                      </div>
                      {period==='custom' && rf && rt && <Check size={11} className="text-teal-500 flex-shrink-0"/>}
                    </button>
                    {showRangeCal && period === 'custom' && (
                      <CalDrop anchorRef={calBtnRef} value={rf===rt?rf:null} rFrom={rf!==rt?rf:null} rTo={rf!==rt?rt:null}
                        onDate={(d) => { if (d) { setRf(d); setRt(d); setShowRangeCal(false); setPeriodOpen(false); } }}
                        onRange={(f,t) => { if (f&&t) { setRf(f); setRt(t); setShowRangeCal(false); setPeriodOpen(false); } }}
                        onClose={() => setShowRangeCal(false)}/>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 flex-shrink-0"><X size={14}/></button>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="px-3 sm:px-4 py-2 flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap" style={{ borderBottom:`1px solid ${TL}` }}>
          {[
            { k:'summary', l:'Summary', icon:'⊞' },
            { k:'table',   l:'Table',   icon:'≡'  },
          ].map(v => (
            <button key={v.k} onClick={() => setView(v.k)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all
                ${view===v.k ? 'bg-violet-500 text-white border-violet-500' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600'}`}>
              <span>{v.icon}</span>{v.l}
            </button>
          ))}
          {data && (
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={dlCSV} className="px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 sm:gap-1.5">
                <Download size={11}/> CSV
              </button>
              <button onClick={() => setSOpen(v => !v)} className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1 sm:gap-1.5 transition-all ${sOpen?'bg-blue-500 text-white border-blue-500':'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100'}`}>
                <Share2 size={11}/> <span className="hidden sm:inline">Share</span>
              </button>
            </div>
          )}
        </div>

        {/* Share panel */}
        {sOpen && data && (
          <div className="mx-3 sm:mx-4 mt-2 rounded-xl p-3 space-y-2 flex-shrink-0" style={{ background:'rgba(20,184,166,0.04)', border:'1px solid rgba(20,184,166,0.18)' }}>
            {!sLink ? (
              <button onClick={genSLink} disabled={sLinking} className="w-full py-2 rounded-lg text-[12px] font-bold text-teal-600 bg-teal-50 border border-teal-200 hover:bg-teal-100 flex items-center justify-center gap-2">
                {sLinking ? <Loader2 size={12} className="animate-spin"/> : <Link2 size={12}/>} Generate Share Link
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white" style={{ border:`1px solid ${TL}` }}>
                  <p className="flex-1 text-[10px] font-mono text-teal-700 truncate">{sLink}</p>
                  <button onClick={cpLink}><Copy size={12} className="text-gray-400 hover:text-teal-600"/></button>
                </div>
                <div className="flex gap-2">
                  <button onClick={waLink} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 flex items-center justify-center gap-1.5"><MessageCircle size={13}/> WA</button>
                  <button onClick={emLink} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 flex items-center justify-center gap-1.5"><Mail size={13}/> Email</button>
                  <button onClick={cpLink} className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center justify-center gap-1.5 ${copied?'text-emerald-600 bg-emerald-50 border-emerald-200':'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100'}`}><Copy size={13}/>{copied?'Copied!':'Copy'}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONTENT AREA ── */}
        <div className="flex-1 overflow-auto p-3 sm:p-4" style={{ scrollbarWidth:'thin' }}>
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <Loader2 size={28} className="text-teal-400 animate-spin mx-auto"/>
                <p className="text-[12px] text-gray-400">Loading attendance data...</p>
              </div>
            </div>
          )}

          {!loading && period === 'custom' && (!rf || !rt) && (
            <div className="text-center py-16">
              <Calendar size={36} className="text-gray-200 mx-auto mb-3"/>
              <p className="text-sm text-gray-400">Select a date range from the period picker above</p>
            </div>
          )}

          {!loading && data && view === 'summary' && (
            <div className="space-y-4">
              {isAll && teamAggregate && (
                <div className="rounded-2xl p-3 sm:p-4" style={{ background:'linear-gradient(135deg,rgba(20,184,166,0.08),rgba(6,182,212,0.06))', border:'1px solid rgba(20,184,166,0.2)' }}>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Users size={14} className="text-teal-600"/>
                    <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Team Overview — {periodLabel}</p>
                    <span className="ml-auto text-[10px] text-gray-400">{targets.length} members · {data.dates.length} days</span>
                  </div>
                  <div className="flex items-stretch gap-0 rounded-xl overflow-hidden mb-2" style={{ border:`1px solid ${TL}` }}>
                    {[
                      { l:'Days',    v: data.dates.length * targets.length, c:'text-teal-700',    bg:'bg-[#F0FDFA]', sub: null },
                      { l:'Present', v: teamAggregate.present,              c:'text-emerald-600', bg:'bg-[#F0FDF4]', sub: '1'  },
                      { l:'Absent',  v: teamAggregate.absent,               c:'text-red-500',     bg:'bg-[#FFF5F5]', sub: '0'  },
                      { l:'Late',    v: teamAggregate.late,                 c:'text-amber-600',   bg:'bg-amber-50',  sub: null },
                      { l:'Leave',   v: teamAggregate.leave,                c:'text-violet-600',  bg:'bg-violet-50', sub: null },
                    ].map((s, i) => (
                      <div key={s.l} className={`flex-1 flex flex-col items-center justify-center px-1 sm:px-2 py-2 sm:py-2.5 ${s.bg}`}
                        style={{ borderRight: i < 4 ? `1px solid ${TL}` : undefined }}>
                        <div className="flex items-baseline gap-0.5">
                          <span className={`text-[14px] sm:text-[16px] font-bold ${s.c}`}>{s.v}</span>
                          {s.sub && <span className={`text-[9px] font-bold opacity-50 ${s.c}`}>{s.sub}</span>}
                        </div>
                        <span className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{s.l}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background:'rgba(255,255,255,0.7)', border:`1px solid ${TL}` }}>
                    <div className="flex items-center gap-1.5">
                      <Timer size={11} className="text-teal-600"/>
                      <span className="text-[11px] font-semibold text-gray-600">Working Hours</span>
                    </div>
                    <span className={`text-[13px] font-bold ${hoursColor(teamAggregate.totalMins).text}`}>{fmtHrs(teamAggregate.totalMins)}</span>
                  </div>
                </div>
              )}
              <div className={`grid gap-3 sm:gap-4 ${targets.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {targets.map(m => (
                  <MemberSummaryCard key={m.id} member={m} memberRecs={data.recs[m.id]} dates={data.dates}/>
                ))}
              </div>
            </div>
          )}

          {!loading && data && view === 'table' && (
            <div className="overflow-x-auto -mx-1" style={{ scrollbarWidth:'thin' }}>
              <table style={{ minWidth: Math.max(500, data.dates.length * 38 + 320) }}>
                <thead>
                  <tr className="bg-[#EEF2F7]" style={{ borderBottom:`1px solid ${TLB}` }}>
                    <th className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase text-left sticky left-0 bg-[#EEF2F7] z-10" style={{ borderRight:`1px solid ${TL}`, minWidth:120 }}>Name</th>
                    {data.dates.map(d => {
                      const dt = new Date(d+'T00:00:00');
                      return (
                        <th key={d} className="py-2 px-0.5 text-center" style={{ borderRight:`1px solid ${TL}`, minWidth:34 }}>
                          <p className="text-[8px] font-bold text-gray-400 uppercase">{['Su','Mo','Tu','We','Th','Fr','Sa'][dt.getDay()]}</p>
                          <p className="text-[11px] font-bold text-gray-700">{dt.getDate()}</p>
                        </th>
                      );
                    })}
                    {[
                      { h:'P',  title:'Present'    },
                      { h:'A',  title:'Absent'     },
                      { h:'L',  title:'Late'       },
                      { h:'LV', title:'Leave'      },
                      { h:'Tot',title:'Total Hours' },
                      { h:'Avg',title:'Avg Hours'   },
                      { h:'%',  title:'Attendance%' },
                    ].map((col, i) => (
                      <th key={col.h} title={col.title} className="py-2 px-1 text-[9px] font-bold text-gray-400 text-center whitespace-nowrap"
                        style={{ borderLeft:i===0?`1.5px solid ${TLB}`:undefined, minWidth: i>=4?44:24 }}>
                        {col.h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targets.map((m, ri) => {
                    const s = computeSummary(data.recs[m.id], data.dates);
                    const cells = data.dates.map(dt => {
                      const r = data.recs[m.id]?.[dt]; const st = r?.status||''; const cfg = statusCfg[st];
                      return { st, cfg, dt };
                    });
                    return (
                      <tr key={m.id} className={ri%2===0?'bg-white':'bg-gray-50/40'} style={{ borderBottom:`1px solid ${TL}` }}>
                        <td className="px-3 py-2 sticky left-0 bg-inherit z-10" style={{ borderRight:`1px solid ${TL}` }}>
                          <p className="text-[11px] font-semibold text-gray-800 truncate" style={{ maxWidth:110 }}>{m.name}</p>
                          {m.role && <p className="text-[9px] text-gray-400 truncate">{m.role}</p>}
                        </td>
                        {cells.map(({ st, cfg, dt }) => (
                          <td key={dt} className="py-1.5 px-0.5 text-center" style={{ borderRight:`1px solid ${TL}` }}>
                            {cfg ? <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[9px] font-bold ${cfg.bg} ${cfg.text}`}>{cfg.short}</span>
                                 : <span className="text-gray-200 text-[10px]">·</span>}
                          </td>
                        ))}
                        <td className="py-1.5 px-1 text-center" style={{ borderLeft:`1.5px solid ${TLB}` }}><span className="text-[10px] font-bold text-emerald-600">{s.present}</span></td>
                        <td className="py-1.5 px-1 text-center"><span className="text-[10px] font-bold text-red-500">{s.absent}</span></td>
                        <td className="py-1.5 px-1 text-center"><span className="text-[10px] font-bold text-amber-500">{s.late}</span></td>
                        <td className="py-1.5 px-1 text-center"><span className="text-[10px] font-bold text-violet-500">{s.leave}</span></td>
                        <td className="py-1.5 px-1 text-center"><span className={`text-[10px] font-bold ${hoursColor(s.totalMins).text}`}>{fmtHrs(s.totalMins)}</span></td>
                        <td className="py-1.5 px-1 text-center"><span className={`text-[10px] font-bold ${hoursColor(s.avgMins).text}`}>{s.avgMins!==null?fmtHrs(s.avgMins):'—'}</span></td>
                        <td className="py-1.5 px-1 text-center">
                          <span className={`text-[10px] font-bold ${s.attendancePct>=80?'text-emerald-600':s.attendancePct>=60?'text-amber-600':'text-red-600'}`}>{s.attendancePct}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS BUTTON + DROPDOWN — portal-based, viewport-aware
// ═══════════════════════════════════════════════════════════════════════════
const ReportsBtn = ({ members }) => {
  const [open,   setOpen]   = useState(false);
  const [target, setTarget] = useState(undefined);
  const [search, setSearch] = useState('');
  const [pos,    setPos]    = useState({ top: 0, left: 0, width: 224 });
  const dropRef = useRef(null);
  const btnRef  = useRef(null);

  const recalc = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw   = window.innerWidth;
    const w    = Math.min(224, vw - 16);
    let left   = rect.right - w;
    if (left < 8) left = 8;
    setPos({ top: rect.bottom + 6, left, width: w });
  };

  useEffect(() => {
    if (open) recalc();
  }, [open]);

  useEffect(() => {
    const onDown = (e) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onResize = () => { if (open) recalc(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const filtered = members.filter(m => m.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border bg-white text-gray-700 border-gray-200 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 shadow-sm transition-all"
      >
        <FileText size={14}/> Reports
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .15s' }}/>
      </button>

      {open && ReactDOM.createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top:    pos.top,
            left:   pos.left,
            width:  pos.width,
            zIndex: 9999,
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${TL}`,
            boxShadow: '0 16px 40px rgba(0,0,0,0.14)',
            overflow: 'hidden',
          }}
        >
          {/* All Members */}
          <div className="px-3 pt-3 pb-2">
            <button
              onClick={() => { setTarget(null); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-violet-50 transition-colors group border border-gray-200 hover:border-violet-300"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                <Users size={13} className="text-white"/>
              </div>
              <div className="text-left">
                <p className="text-[12px] font-bold text-gray-800 group-hover:text-violet-700">All Members</p>
                <p className="text-[10px] text-gray-400">{members.length} people</p>
              </div>
            </button>
          </div>

          {/* Individual */}
          <div style={{ borderTop: `1px solid ${TL}` }}>
            <div className="px-3 pt-2.5 pb-1">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Individual</p>
            </div>
            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: '#F5F7FA', border: `1px solid ${TL}` }}>
                <Search size={11} className="text-gray-400 flex-shrink-0"/>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search member..."
                  className="flex-1 bg-transparent text-[11px] text-gray-700 outline-none placeholder-gray-400"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: 'thin' }}>
              {filtered.length === 0 && (
                <p className="text-center text-[11px] text-gray-400 py-3">No results</p>
              )}
              {filtered.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setTarget(m); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors mb-0.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                    {m.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-[11px] font-semibold text-gray-800 truncate">{m.name}</p>
                    {m.role && <p className="text-[10px] text-gray-400 truncate">{m.role}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {target !== undefined && (
        <ReportModal member={target} members={members} onClose={() => setTarget(undefined)}/>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ATTENDANCE PAGE
// ═══════════════════════════════════════════════════════════════════════════
const Attendance = () => {
  const [members,    setMembers]    = useState([]);
  const [att,        setAtt]        = useState({});
  const attRef = useRef({});
  const [loading,    setLoading]    = useState(true);
  const [editModal,  setEditModal]  = useState(null);
  const [showLink,   setShowLink]   = useState(false);
  const [genLink,    setGenLink]    = useState('');
  const [genLinking, setGenLinking] = useState(false);
  const [saving,     setSaving]     = useState(false);

  const [showCal,    setShowCal]    = useState(false);
  const [filterDate, setFilterDate] = useState(todayYMD);
  const [rangeFrom,  setRangeFrom]  = useState(null);
  const [rangeTo,    setRangeTo]    = useState(null);
  const calRef = useRef(null);

  const hasRange   = rangeFrom && rangeTo;
  const activeDate = hasRange ? null : filterDate;

  const displayDates = useMemo(() => {
    if (hasRange) {
      const dates = [];
      let cur = new Date(rangeFrom+'T00:00:00'); const end = new Date(rangeTo+'T00:00:00');
      while (cur <= end) { if (cur.getDay()!==0 && cur.getDay()!==6) dates.push(toYMD(cur)); cur.setDate(cur.getDate()+1); }
      return dates;
    }
    return [filterDate];
  }, [filterDate, hasRange, rangeFrom, rangeTo]);

  const isViewingToday = !hasRange && filterDate === todayYMD;
  const calLabel = hasRange
    ? `${fmtShort(rangeFrom)} → ${fmtShort(rangeTo)}`
    : isViewingToday
      ? `Today · ${fmtTodayLabel(todayYMD)}`
      : fmtShort(filterDate);

  useEffect(() => {
    const u = onSnapshot(collection(db,'teamMembers'), s => {
      setMembers(s.docs.map(d => ({ id:d.id, ...d.data() }))); setLoading(false);
    }, e => { console.error(e); setLoading(false); });
    return u;
  }, []);

  useEffect(() => {
    if (!displayDates.length) return;
    const s = displayDates[0], e = displayDates[displayDates.length-1];
    const q = query(collection(db,'attendance'), where('date','>=',s), where('date','<=',e));
    const u = onSnapshot(q, snap => {
      const map = {};
      snap.forEach(d => { const it = d.data(); if (!map[it.date]) map[it.date]={}; map[it.date][it.memberId]=it; });
      attRef.current = map; setAtt(map);
    });
    return u;
  }, [displayDates.join(',')]);

  const getRec = (mId, date) => att[date]?.[mId] || null;

  const saveRec = async (member, date, fields) => {
    setSaving(true);
    try {
      const id  = `${date}_${member.id}`;
      const ex  = attRef.current[date]?.[member.id] || {};
      const merged = { ...ex, ...fields };
      const isEmpty = !merged.status && !merged.loginIn && !merged.breakOut && !merged.breakIn && !merged.officeOut;
      if (isEmpty) { await deleteDoc(doc(db,'attendance',id)); }
      else {
        await setDoc(doc(db,'attendance',id), {
          date, memberId:member.id, memberName:member.name, ...merged,
          markedAt: new Date().toISOString(), markedBy: merged.markedBy || 'admin',
        });
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleEditSave = async (form) => { await saveRec(editModal.member, editModal.date, form); setEditModal(null); };
  const handleEditDel  = async ()     => { await saveRec(editModal.member, editModal.date, {}); setEditModal(null); };

  const generateLink = async (date) => {
    setGenLinking(true);
    try {
      const id = genId();
      await setDoc(doc(db,'attendanceLinks',id), { date, createdAt:new Date().toISOString(), expiresAt:new Date(date+'T23:59:59').toISOString(), isActive:true, usedBy:[] });
      setGenLink(`${window.location.origin}/mark-attendance/${id}`);
    } catch (e) { console.error(e); }
    setGenLinking(false);
  };

  const todayStats = useMemo(() => {
    const a = att[todayYMD] || {};
    let p=0, ab=0, u=0;
    members.forEach(m => {
      const s = a[m.id]?.status;
      if (!s) u++;
      else if (s === 'Present' || s === 'Late') p++;
      else if (s === 'Absent') ab++;
      else p++;
    });
    return { p, ab, u };
  }, [att, members]);

  if (loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin"/>
    </div>
  );

  const isRange = displayDates.length > 1;

  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 max-w-[1800px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Attendance</h1>
            <p className="text-[11px] sm:text-[12px] text-gray-400 mt-0.5">{fmtFull(todayYMD)} · {members.length} members</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ReportsBtn members={members}/>
            <button onClick={() => { setGenLink(''); setShowLink(true); }}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-[12px] font-bold bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-sm hover:shadow-md transition-all">
              <Link2 size={14}/> <span className="hidden xs:inline">Generate</span> Link
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid-cols-1 grid sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { l:'Present Today', v:todayStats.p,  g:'from-emerald-400 to-teal-500', t:'text-emerald-600', I:UserCheck   },
            { l:'Absent Today',  v:todayStats.ab, g:'from-rose-400 to-red-500',      t:'text-red-600',     I:UserX       },
            { l:'Not Marked',    v:todayStats.u,  g:'from-slate-400 to-gray-500',    t:'text-gray-500',    I:AlertCircle },
          ].map(s => (
            <div key={s.l} className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm flex items-center gap-2 sm:gap-3" style={{ border:`1px solid ${TL}` }}>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${s.g} flex-shrink-0`}><s.I size={16} className="text-white"/></div>
              <div>
                <p className={`text-xl sm:text-2xl font-bold ${s.t}`}>{s.v}</p>
                <p className="text-[9px] sm:text-[11px] text-gray-500 font-medium leading-tight">{s.l}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Attendance Register */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border:`1px solid ${TL}` }}>
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-3.5 flex-wrap gap-2 sm:gap-3" style={{ borderBottom:`1px solid ${TL}` }}>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-teal-500"/>
              <h2 className="text-[12px] sm:text-sm font-bold text-gray-800 uppercase tracking-wider">Attendance Register</h2>
              {saving && <Loader2 size={13} className="text-teal-400 animate-spin ml-1"/>}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {(filterDate !== todayYMD || hasRange) && (
                <button onClick={() => { setFilterDate(todayYMD); setRangeFrom(null); setRangeTo(null); }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100">
                  <X size={10}/> Reset
                </button>
              )}
              <button ref={calRef} onClick={() => setShowCal(v => !v)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-[12px] font-semibold border transition-all
                  ${showCal||hasRange||(filterDate!==todayYMD) ? 'bg-teal-500 text-white border-teal-500 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50'}`}>
                <CalendarRange size={12}/>
                <span className="hidden sm:inline">{calLabel}</span>
                <span className="sm:hidden">{isViewingToday ? 'Today' : hasRange ? 'Range' : fmtShort(filterDate)}</span>
                <ChevronDown size={10} style={{ transform:showCal?'rotate(180deg)':'rotate(0)', transition:'transform .15s' }}/>
              </button>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="py-20 text-center"><Users size={36} className="text-gray-200 mx-auto mb-3"/><p className="text-sm text-gray-400">No team members yet</p></div>
          ) : isRange ? (
            <div className="overflow-x-auto" style={{ scrollbarWidth:'thin' }}>
              <table style={{ minWidth: Math.max(600, displayDates.length*150+180) }}>
                <thead>
                  <tr className="bg-[#EEF2F7]" style={{ borderBottom:`1px solid ${TLB}` }}>
                    <th className="py-3 px-3 sm:px-4 text-[10px] font-semibold text-gray-500 uppercase text-left sticky left-0 bg-[#EEF2F7] z-10" style={{ borderRight:`1px solid ${TL}`, minWidth:120 }}>Member</th>
                    {displayDates.map(d => {
                      const dt = new Date(d+'T00:00:00'); const iT = d===todayYMD;
                      return (
                        <th key={d} style={{ borderRight:`1px solid ${TL}`, minWidth:140 }} className={`py-2 text-center ${iT?'bg-teal-50/50':''}`}>
                          <p className={`text-[10px] font-bold uppercase px-2 flex items-center justify-center gap-1.5 ${iT?'text-teal-600':'text-gray-500'}`}>
                            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()]} {dt.getDate()} {MONTHS_S[dt.getMonth()]}
                            {iT && <span className="text-[8px] bg-teal-100 text-teal-600 px-1 py-0.5 rounded font-bold">TODAY</span>}
                          </p>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, mi) => (
                    <tr key={m.id} className={mi%2===0?'bg-white':'bg-gray-50/40'} style={{ borderBottom:`1px solid ${TL}` }}>
                      <td className="px-3 sm:px-4 py-3 sticky left-0 bg-inherit z-10" style={{ borderRight:`1px solid ${TL}` }}>
                        <p className="text-[12px] font-semibold text-gray-800 truncate">{m.name}</p>
                        {m.role && <p className="text-[10px] text-gray-400 truncate">{m.role}</p>}
                      </td>
                      {displayDates.map(date => {
                        const rec = att[date]?.[m.id]||null;
                        const w = rec ? calcWork(rec.loginIn, rec.breakOut, rec.breakIn, rec.officeOut) : null;
                        const hc = hoursColor(w);
                        return (
                          <td key={date} className="px-2 py-2" style={{ borderRight:`1px solid ${TL}` }}>
                            <div className="space-y-1">
                              <StatusCell status={rec?.status||''} reason={rec?.reason||''}
                                onChange={(s,r) => saveRec(m, date, { ...(rec||{}), status:s, reason:r||'' })}/>
                              {w!==null && (
                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${hc.bg} border ${hc.border}`}>
                                  <Timer size={9} className={hc.text}/>
                                  <span className={`text-[9px] font-bold ${hc.text}`}>{fmtMins(w)}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ scrollbarWidth:'none' }}>
              <table className="w-full" style={{ minWidth:800 }}>
                <colgroup>{Array.from({length:8}).map((_,i) => <col key={i} style={{width:'12.5%'}}/>)}</colgroup>
                <thead>
                  <tr className="bg-[#EEF2F7]" style={{ borderBottom:`1px solid ${TLB}` }}>
                    {[
                      { h:'Name',       I:Users        },
                      { h:'Status',     I:CheckCircle2 },
                      { h:'Login In',   I:LogIn        },
                      { h:'Break Out',  I:Coffee       },
                      { h:'Break In',   I:Coffee       },
                      { h:'Office Out', I:LogOut       },
                      { h:'Working Hrs',I:Timer        },
                      { h:'Edit',       I:Edit2        },
                    ].map(({ h, I }, i) => (
                      <th key={h} className={`py-3 px-2 sm:px-3 ${i === 0 ? 'text-left' : 'text-center'}`} style={{ borderRight:i<8?`1px solid ${TL}`:undefined }}>
                        <span className={`flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider ${i === 0 ? '' : 'justify-center'}`}><I size={10} className="flex-shrink-0"/>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, mi) => {
                    const rec = att[activeDate]?.[member.id]||null;
                    const w   = rec ? calcWork(rec.loginIn, rec.breakOut, rec.breakIn, rec.officeOut) : null;
                    const hc  = hoursColor(w);
                    return (
                      <tr key={member.id} className={mi%2===0?'bg-white':'bg-gray-50/40'} style={{ borderBottom:`1px solid ${TL}` }}>
                        <td className="px-2 sm:px-3 py-3" style={{ borderRight:`1px solid ${TL}` }}>
                          <p className="text-[12px] font-bold text-gray-800 truncate">{member.name}</p>
                          {member.role && <p className="text-[10px] text-gray-400 truncate">{member.role}</p>}
                        </td>
                        <td className="px-2 sm:px-3 py-3" style={{ borderRight:`1px solid ${TL}` }}>
                          <StatusCell status={rec?.status||''} reason={rec?.reason||''}
                            onChange={(s,r) => saveRec(member, activeDate, { ...(rec||{}), status:s, reason:r!==undefined?r:(rec?.reason||'') })}/>
                        </td>
                        {['loginIn','breakOut','breakIn','officeOut'].map(k => {
                          const isAbsent = rec?.status === 'Absent';
                          return (
                            <td key={k} className="px-1 py-3" style={{ borderRight:`1px solid ${TL}`, opacity: isAbsent ? 0.25 : 1, pointerEvents: isAbsent ? 'none' : 'auto', background: isAbsent ? '#fafafa' : undefined }}>
                              <TimeInput value={rec?.[k]||''} onChange={v => saveRec(member, activeDate, { ...(rec||{}), [k]:v })}/>
                            </td>
                          );
                        })}
                        <td className="px-2 sm:px-3 py-3 text-center" style={{ borderRight:`1px solid ${TL}` }}>
                          {rec?.status === 'Absent'
                            ? <span className="text-[13px] text-red-300 font-medium">—</span>
                            : <span className={`text-[14px] font-medium ${hc.text}`}>{fmtMins(w)}</span>
                          }
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button onClick={() => setEditModal({ member, date:activeDate })}
                            className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-gray-300 hover:text-teal-600 hover:bg-teal-50 border border-transparent hover:border-teal-200 transition-all">
                            <Edit2 size={13}/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCal && (
        <CalDrop anchorRef={calRef} value={filterDate} rFrom={rangeFrom} rTo={rangeTo}
          onDate={d => { setFilterDate(d||todayYMD); setRangeFrom(null); setRangeTo(null); setShowCal(false); }}
          onRange={(f,t) => { if (f&&t) { setRangeFrom(f); setRangeTo(t); setFilterDate(null); setShowCal(false); } }}
          onClose={() => setShowCal(false)}/>
      )}

      {editModal && (
        <EditModal rec={getRec(editModal.member.id, editModal.date)} member={editModal.member} date={editModal.date}
          onSave={handleEditSave} onDelete={handleEditDel} onClose={() => setEditModal(null)}/>
      )}

      {showLink && (
        <LinkModal onClose={() => setShowLink(false)} genLink={genLink} generating={genLinking} onGenerate={generateLink}/>
      )}
    </div>
  );
};

export default Attendance;