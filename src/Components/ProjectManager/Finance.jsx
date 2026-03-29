import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Plus, X, Users, Zap, ChevronDown, ChevronUp, TrendingUp,
  Wallet, Receipt, CheckCircle2, AlertCircle, Building2,
  User, RotateCcw, GripVertical, Columns, PlusCircle,
  MoreVertical, Trash2, CheckSquare, Square, Calendar, ChevronLeft, ChevronRight,
  CreditCard, Search
} from 'lucide-react';

const TL  = 'rgba(51,51,51,0.12)';
const TLB = 'rgba(51,51,51,0.18)';
const DEFAULT_CATEGORIES = ['Salary','Receptionist','Electricity','Gas','Internet','Rent','Equipment','Other'];
const isSalaryType = (cat) => cat === 'Salary';

// ── Date formatting helpers ───────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const formatDateLong = (dateStr) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`;
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${parseInt(d)} ${SHORT_MONTHS[parseInt(m) - 1]} ${y}`;
};

const formatMonthLabel = (monthStr) => {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
};

const categoryIcon = (cat) => {
  switch(cat){
    case 'Salary':       return <Users size={14}/>;
    case 'Receptionist': return <User size={14}/>;
    case 'Electricity':  return <Zap size={14}/>;
    case 'Gas':          return <Building2 size={14}/>;
    case 'Rent':         return <Building2 size={14}/>;
    case 'Internet':     return <Zap size={14}/>;
    case 'Equipment':    return <Receipt size={14}/>;
    case 'Other':        return <Receipt size={14}/>;
    default:             return null;
  }
};

const categoryColor = (cat) => {
  const map = {
    Salary:       'text-teal-600',
    Receptionist: 'text-violet-600',
    Electricity:  'text-amber-600',
    Gas:          'text-blue-600',
    Internet:     'text-cyan-600',
    Rent:         'text-rose-600',
    Equipment:    'text-indigo-600',
    Other:        'text-gray-500',
  };
  return map[cat] || 'text-purple-600';
};

const EMPTY_FORM = {
  category:'Salary', isCustomCat:false, newCatName:'', memberId:'',
  label:'', description:'', amount:'', totalSalary:'',
  date:new Date().toISOString().slice(0,10), note:''
};

const BASE_COLS = [
  { key:'category', label:'Category',             width:130, visible:true, editable:false, type:'badge'  },
  { key:'label',    label:'Description / Member', width:170, visible:true, editable:true,  type:'text'   },
  { key:'amount',   label:'Amount Paid',          width:130, visible:true, editable:true,  type:'number' },
  { key:'date',     label:'Date',                 width:150, visible:true, editable:true,  type:'date'   },
];
const SALARY_COLS = [
  { key:'totalSalary', label:'Monthly Salary', width:140, visible:true, editable:true,  type:'number'  },
  { key:'remaining',   label:'Remaining',      width:130, visible:true, editable:false, type:'computed'},
];

// ── Calendar Date Picker ──────────────────────────────────────────────────────
const CalendarPicker = ({ onClose, onApply, anchorRect }) => {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [mode,      setMode]      = useState('range');
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd,   setRangeEnd]   = useState(null);
  const [hoverDay,   setHoverDay]   = useState(null);
  const [selectedSingle, setSelectedSingle] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const getFixedStyle = () => {
    const W = 300;
    const MARGIN = 8;
    if (!anchorRect) {
      return { position:'fixed', top:80, right:MARGIN, width:W, maxWidth:`calc(100vw - ${MARGIN*2}px)`, zIndex:9999 };
    }
    const top = anchorRect.bottom + 6;
    let right = window.innerWidth - anchorRect.right;
    right = Math.max(MARGIN, right);
    const leftEdge = window.innerWidth - right - W;
    const style = { position:'fixed', top, width:W, maxWidth:`calc(100vw - ${MARGIN*2}px)`, zIndex:9999 };
    if (leftEdge < MARGIN) { style.left = MARGIN; } else { style.right = right; }
    return style;
  };

  const getDaysInMonth     = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();
  const toISO = (y, m, d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const isInRange = (y, m, d) => {
    if (!rangeStart) return false;
    const iso = toISO(y, m, d);
    const end = rangeEnd || hoverDay;
    if (!end) return false;
    const [s, e] = rangeStart < end ? [rangeStart, end] : [end, rangeStart];
    return iso > s && iso < e;
  };
  const isRangeStart     = (y, m, d) => toISO(y, m, d) === rangeStart;
  const isRangeEnd       = (y, m, d) => toISO(y, m, d) === (rangeEnd || hoverDay);
  const isSingleSelected = (y, m, d) => toISO(y, m, d) === selectedSingle;

  const handleDayClick = (y, m, d) => {
    if (mode === 'single') {
      setSelectedSingle(toISO(y, m, d));
    } else {
      if (!rangeStart || rangeEnd) {
        setRangeStart(toISO(y, m, d)); setRangeEnd(null);
      } else {
        const clicked = toISO(y, m, d);
        if (clicked < rangeStart) { setRangeEnd(rangeStart); setRangeStart(clicked); }
        else setRangeEnd(clicked);
      }
    }
  };

  const handleApply = () => {
    if (mode === 'single' && selectedSingle) {
      onApply({ type: 'single', date: selectedSingle });
    } else if (mode === 'range' && rangeStart && rangeEnd) {
      const [s, e] = rangeStart < rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
      onApply({ type: 'range', start: s, end: e });
    } else {
      onApply({ type: 'month', year: viewYear, month: viewMonth });
    }
  };

  const handleClear = () => {
    setRangeStart(null); setRangeEnd(null); setSelectedSingle(null);
    onApply({ type: 'all' });
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const days     = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const yearRange = Array.from({length: 20}, (_, i) => today.getFullYear() - 10 + i);

  const getLabel = () => {
    if (mode === 'single' && selectedSingle) return formatDateShort(selectedSingle);
    if (mode === 'range' && rangeStart && rangeEnd) return `${formatDateShort(rangeStart)} → ${formatDateShort(rangeEnd)}`;
    return `${SHORT_MONTHS[viewMonth]} ${viewYear}`;
  };

  return (
    <div ref={ref} className="bg-white rounded-2xl shadow-2xl"
      style={{ ...getFixedStyle(), border:`1px solid ${TL}` }}>
      <div className="flex items-center gap-1 p-3 pb-2">
        {['range','single'].map(m => (
          <button key={m}
            onClick={() => { setMode(m); setRangeStart(null); setRangeEnd(null); setSelectedSingle(null); }}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${mode === m ? 'bg-teal-500 text-white' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}>
            {m === 'range' ? 'Date Range' : 'Single Day'}
          </button>
        ))}
      </div>
      <div className="px-3 pb-1">
        <div className="flex items-center justify-between mb-2 gap-1">
          <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0">
            <ChevronLeft size={14}/>
          </button>
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            <span className="text-[13px] font-bold text-gray-800">{MONTHS[viewMonth]}</span>
            <div className="relative">
              <select value={viewYear} onChange={e => setViewYear(Number(e.target.value))}
                className="appearance-none bg-teal-50 border border-teal-200 rounded-lg pl-2 pr-5 py-0.5 text-[12px] font-semibold text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-200 cursor-pointer">
                {yearRange.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-teal-500 pointer-events-none"/>
            </div>
          </div>
          <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0">
            <ChevronRight size={14}/>
          </button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({length: firstDay}).map((_, i) => <div key={`e${i}`}/>)}
          {Array.from({length: days}).map((_, i) => {
            const d = i + 1;
            const iso = toISO(viewYear, viewMonth, d);
            const isStart  = isRangeStart(viewYear, viewMonth, d);
            const isEnd    = isRangeEnd(viewYear, viewMonth, d);
            const inRange  = isInRange(viewYear, viewMonth, d);
            const isSingle = isSingleSelected(viewYear, viewMonth, d);
            const isToday  = iso === today.toISOString().slice(0,10);
            const highlighted = isStart || isEnd || isSingle;
            return (
              <button key={d}
                onClick={() => handleDayClick(viewYear, viewMonth, d)}
                onMouseEnter={() => { if (mode === 'range' && rangeStart && !rangeEnd) setHoverDay(iso); }}
                onMouseLeave={() => setHoverDay(null)}
                className={`h-8 text-[12px] font-semibold rounded-lg transition-all
                  ${highlighted ? 'bg-teal-500 text-white' : inRange ? 'bg-teal-50 text-teal-700' : 'text-gray-700 hover:bg-gray-100'}
                  ${isToday && !highlighted ? 'ring-1 ring-teal-400' : ''}`}>
                {d}
              </button>
            );
          })}
        </div>
      </div>
      {mode === 'range' && rangeStart && !rangeEnd && (
        <p className="text-[10px] text-teal-600 font-medium text-center px-3 pb-1 pt-1">Now select end date</p>
      )}
      {getLabel() && (
        <div className="mx-3 mb-2 mt-1 px-3 py-2 rounded-xl bg-teal-50 border border-teal-100">
          <p className="text-[11px] font-semibold text-teal-700 text-center">{getLabel()}</p>
        </div>
      )}
      <div className="flex gap-2 p-3 pt-0">
        <button onClick={handleClear} className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">Clear</button>
        <button onClick={handleApply} className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 transition-all shadow-sm">Apply</button>
      </div>
    </div>
  );
};

// ── Confirm Delete Modal ──────────────────────────────────────────────────────
const ConfirmDeleteModal = ({ count, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    style={{background:'rgba(0,0,0,0.5)',backdropFilter:'blur(6px)'}}
    onClick={e=>{ if(e.target===e.currentTarget) onCancel(); }}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" style={{border:`1px solid ${TL}`}}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
          <Trash2 size={18} className="text-rose-500"/>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Confirm Delete</h3>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {count === 1 ? 'Are you sure you want to delete this entry?' : `Are you sure you want to delete ${count} entries?`}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-gray-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 mb-5">
        ⚠️ This action cannot be undone.
      </p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
        <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 transition-all shadow-md">
          Delete {count > 1 ? `${count} Entries` : 'Entry'}
        </button>
      </div>
    </div>
  </div>
);

// ── PAY REMAINING MODAL ───────────────────────────────────────────────────────
// UPDATED: Full Payment / Custom Amount toggle
const PayRemainingModal = ({ data, onClose, onSuccess }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [payMode,  setPayMode]  = useState('full');   // 'full' | 'custom'
  const [date,     setDate]     = useState(today);
  const [note,     setNote]     = useState('');
  const [customAmt,setCustomAmt]= useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const payAmount = payMode === 'full' ? data.remaining : Number(customAmt) || 0;

  const handleConfirm = async () => {
    if (!date) { setError('Please select a date.'); return; }
    if (payMode === 'custom') {
      if (!customAmt || isNaN(Number(customAmt)) || Number(customAmt) <= 0) {
        setError('Please enter a valid amount.'); return;
      }
      if (Number(customAmt) > data.remaining) {
        setError(`Amount cannot exceed remaining balance of PKR ${data.remaining.toLocaleString()}.`); return;
      }
    }
    setSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'finance'), {
        category:    'Salary',
        memberId:    data.member.id,
        memberName:  data.member.name,
        label:       data.member.name,
        description: note.trim() || null,
        amount:      payAmount,
        totalSalary: data.totalSalary,
        date,
        note:        note.trim(),
        createdAt:   serverTimestamp(),
      });
      onSuccess();
      onClose();
    } catch(e) {
      setError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)'}}
      onClick={e => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" style={{border:`1px solid ${TL}`}}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{borderBottom:`1px solid ${TL}`}}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
              <CreditCard size={16} className="text-white"/>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Pay Remaining Salary</h2>
              <p className="text-[11px] text-gray-400">{data.member.name} — {formatMonthLabel(data.latestMonth)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={14}/>
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Payment Mode Toggle ── */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-2">Payment Type</label>
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => { setPayMode('full'); setCustomAmt(''); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold transition-all ${
                  payMode === 'full'
                    ? 'bg-white shadow-sm text-teal-600 border border-teal-200'
                    : 'text-gray-400 hover:text-gray-600'
                }`}>
                <CheckCircle2 size={13}/>
                Full Payment
              </button>
              <button
                onClick={() => { setPayMode('custom'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold transition-all ${
                  payMode === 'custom'
                    ? 'bg-white shadow-sm text-amber-600 border border-amber-200'
                    : 'text-gray-400 hover:text-gray-600'
                }`}>
                <CreditCard size={13}/>
                Custom Amount
              </button>
            </div>
          </div>

          {/* Summary box */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-3">Payment Summary</p>
            {[
              { label: 'Member',         val: data.member.name },
              { label: 'Month',          val: formatMonthLabel(data.latestMonth) },
              { label: 'Monthly Salary', val: `PKR ${data.totalSalary.toLocaleString()}` },
              { label: 'Already Paid',   val: `PKR ${(data.totalSalary - data.remaining).toLocaleString()}` },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500 font-medium">{label}</span>
                <span className="text-[12px] text-gray-800 font-semibold">{val}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2" style={{borderTop:'1px solid rgba(217,119,6,0.2)'}}>
              <span className="text-[12px] font-bold text-amber-700">
                {payMode === 'full' ? 'Amount to Pay' : 'Max Remaining'}
              </span>
              <span className="text-[15px] font-bold text-amber-700">PKR {data.remaining.toLocaleString()}</span>
            </div>
          </div>

          {/* Custom amount input — only shown in custom mode */}
          {payMode === 'custom' && (
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Amount to Pay (PKR)
                <span className="normal-case font-normal text-gray-400 ml-1">— max PKR {data.remaining.toLocaleString()}</span>
              </label>
              <input
                type="number"
                value={customAmt}
                onChange={e => setCustomAmt(e.target.value)}
                placeholder={`e.g. ${Math.round(data.remaining / 2).toLocaleString()}`}
                max={data.remaining}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
              {customAmt && Number(customAmt) > 0 && Number(customAmt) <= data.remaining && (
                <p className="text-[11px] text-teal-600 mt-1 font-medium">
                  After payment, remaining: PKR {(data.remaining - Number(customAmt)).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Date picker */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Payment Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              Note <span className="normal-case font-normal text-gray-300">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Remaining salary for March..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle size={13} className="text-red-500 flex-shrink-0"/>
              <p className="text-[12px] text-red-600 font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={saving || (payMode === 'custom' && (!customAmt || Number(customAmt) <= 0))}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 shadow-md flex items-center justify-center gap-2 ${
              payMode === 'full'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
            }`}>
            <CheckCircle2 size={14}/>
            {saving ? 'Saving...' : `Pay PKR ${payAmount > 0 ? payAmount.toLocaleString() : '—'}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Inline editable cell ──────────────────────────────────────────────────────
const EditableCell = ({ value, type, onSave, displayValue }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value ?? '');
  const inputRef              = useRef(null);

  useEffect(()=>{ if(editing && inputRef.current) inputRef.current.focus(); },[editing]);

  const commit = () => {
    setEditing(false);
    if(String(val) !== String(value)) onSave(val);
  };
  const handleKey = (e) => {
    if(e.key==='Enter') commit();
    if(e.key==='Escape'){ setVal(value??''); setEditing(false); }
  };

  if(!editing) return (
    <div onClick={()=>{ setVal(value??''); setEditing(true); }}
      className="group cursor-pointer min-h-[22px] px-1 rounded hover:bg-teal-50 hover:ring-1 hover:ring-teal-300 transition-all"
      title="Click to edit">
      <span className="text-[12px] text-gray-800">{displayValue !== undefined ? displayValue : (value || <span className="text-gray-300 italic">—</span>)}</span>
    </div>
  );
  if(type==='date') return (
    <input ref={inputRef} type="date" value={val}
      onChange={e=>setVal(e.target.value)} onBlur={commit} onKeyDown={handleKey}
      className="w-full text-[12px] border border-teal-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white"/>
  );
  if(type==='number') return (
    <input ref={inputRef} type="number" value={val}
      onChange={e=>setVal(e.target.value)} onBlur={commit} onKeyDown={handleKey}
      className="w-full text-[12px] border border-teal-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white"/>
  );
  return (
    <input ref={inputRef} type="text" value={val}
      onChange={e=>setVal(e.target.value)} onBlur={commit} onKeyDown={handleKey}
      className="w-full text-[12px] border border-teal-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white"/>
  );
};

// ── Member Month Status (shown inside Add Payment Modal) ──────────────────────
const MemberMonthStatus = ({ memberId, selectedMonth, entries }) => {
  if (!memberId || !entries) return null;
  const monthEntries = entries.filter(e =>
    e.memberId === memberId && e.category === 'Salary' &&
    e.date && e.date.slice(0, 7) === selectedMonth
  );
  const latestTotal = (
    monthEntries.find(e => e.totalSalary) ||
    [...entries].filter(e => e.memberId === memberId && e.category === 'Salary' && e.totalSalary)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
  )?.totalSalary || null;

  const monthPaid      = monthEntries.reduce((s, e) => s + (e.amount || 0), 0);
  const monthRemaining = latestTotal !== null ? Math.max(0, latestTotal - monthPaid) : null;
  const isPaid         = monthRemaining !== null && monthRemaining <= 0;
  const monthLabel     = formatMonthLabel(selectedMonth);
  if (monthEntries.length === 0 && latestTotal === null) return null;

  return (
    <div className={`rounded-xl px-3 py-2.5 border mt-1 ${isPaid ? 'bg-teal-50 border-teal-200' : 'bg-amber-50 border-amber-200'}`}>
      <p className="text-[11px] font-bold text-gray-600 mb-2 flex items-center gap-1.5">
        <Calendar size={10} className={isPaid ? 'text-teal-500' : 'text-amber-500'}/>
        {monthLabel} — Salary Record
      </p>
      {monthEntries.length === 0 ? (
        <p className="text-[11px] text-amber-600 font-semibold">No payment recorded this month yet</p>
      ) : (
        <div className="space-y-1 mb-2">
          {monthEntries.map((e, i) => (
            <div key={e.id || i} className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">{formatDateShort(e.date)}</span>
              <span className="text-[11px] font-semibold text-gray-700">PKR {(e.amount || 0).toLocaleString()}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1" style={{borderTop:'1px solid rgba(0,0,0,0.08)'}}>
            <span className="text-[10px] font-bold text-gray-500">Total Paid</span>
            <span className="text-[11px] font-bold text-gray-800">PKR {monthPaid.toLocaleString()}</span>
          </div>
        </div>
      )}
      {latestTotal !== null && (
        <div className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${isPaid ? 'bg-teal-100' : 'bg-amber-100'}`}>
          <span className={`text-[11px] font-bold ${isPaid ? 'text-teal-700' : 'text-amber-700'}`}>
            {isPaid ? '✓ Fully Paid' : 'Remaining'}
          </span>
          {!isPaid && monthRemaining !== null && (
            <span className="text-[12px] font-bold text-amber-700">PKR {monthRemaining.toLocaleString()}</span>
          )}
        </div>
      )}
    </div>
  );
};

// ── Add Payment Modal 

const AddPaymentModal = ({ members, entries, onClose, onAdd, customCategories, onAddCustomCategory, formData, setFormData }) => {
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const { category, isCustomCat, newCatName, memberId, label, description, amount, totalSalary, date, note } = formData;
  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const isSalary = category === 'Salary' && !isCustomCat;
  const finalCategory = isCustomCat ? newCatName.trim() : category;
  const selectedMonth = date ? date.slice(0, 7) : new Date().toISOString().slice(0, 7);

  // ── AUTO FILL SALARY AS NUMBER WHEN MEMBER IS SELECTED ──
  useEffect(() => {
    if (isSalary && memberId) {
      const selectedMember = members.find(m => m.id === memberId);
      if (selectedMember?.salary) {
        const memberSalary = Number(selectedMember.salary);
        // Only fill if current totalSalary is empty or zero
        if (!totalSalary || totalSalary === 0) {
          set('totalSalary', memberSalary);
        }
      }
    }
  }, [memberId, isSalary, members]); // totalSalary not in deps to avoid loops

  const handleReset = () => {
    setFormData({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    if (isCustomCat && !newCatName.trim()) { setError('Please enter a custom category name.'); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError('Please enter a valid amount.'); return; }
    if (isSalary && !memberId) { setError('Please select a team member.'); return; }
    if (!isSalary && !label.trim()) { setError('Please enter a label/description.'); return; }

    setSaving(true);
    try {
      const member = isSalary ? members.find(m => m.id === memberId) : null;
      if (isCustomCat && newCatName.trim()) onAddCustomCategory(newCatName.trim());

      await addDoc(collection(db, 'finance'), {
        category: finalCategory,
        memberId: member?.id || null,
        memberName: member?.name || null,
        label: isSalary ? (member?.name || '') : label.trim(),
        description: description.trim() || null,
        amount: Number(amount),
        totalSalary: isSalary && totalSalary ? Number(totalSalary) : null,
        date,
        note: note.trim(),
        createdAt: serverTimestamp(),
      });

      setFormData({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
      onAdd();
      onClose();
    } catch (e) {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ border: `1px solid ${TL}` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${TL}` }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center">
              <Plus size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Add New Entry</h2>
              <p className="text-[11px] text-gray-400">Fill in the expense details below</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 bg-gray-100 hover:bg-rose-50 hover:text-rose-500 border border-gray-200 hover:border-rose-200 transition-all">
              <RotateCcw size={11} /> Reset
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-2 max-h-[80vh] overflow-y-auto">

          {/* Category */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Category</label>
            <div className="relative">
              <select value={isCustomCat ? '__custom__' : category}
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    set('isCustomCat', true);
                    set('newCatName', '');
                  } else {
                    set('isCustomCat', false);
                    set('category', e.target.value);
                  }
                }}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all">
                <option value="__custom__">+ Add Custom Category</option>
                <option disabled>──────────────</option>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Custom Category */}
          {isCustomCat && (
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Custom Category Name</label>
              <input type="text" value={newCatName} onChange={e => set('newCatName', e.target.value)} placeholder="e.g. Marketing..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all" />
            </div>
          )}

          {/* Team Member (Salary only) */}
          {isSalary && (
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Team Member</label>
              <div className="relative">
                <select value={memberId} onChange={e => set('memberId', e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all">
                  <option value="">Select member...</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {memberId && <MemberMonthStatus memberId={memberId} selectedMonth={selectedMonth} entries={entries} />}
            </div>
          )}

          {/* Label (Non-salary) */}
          {!isSalary && (
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Label</label>
              <input type="text" value={label} onChange={e => set('label', e.target.value)}
                placeholder={`e.g. ${finalCategory === 'Electricity' ? 'May 2025 bill' : finalCategory === 'Gas' ? 'June gas bill' : 'Details...'}`}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all" />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              Description <span className="text-gray-300 normal-case font-normal">(optional)</span>
            </label>
            <input type="text" value={description} onChange={e => set('description', e.target.value)} placeholder="Add more details..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all" />
          </div>

          {/* Monthly Salary (Auto-filled, read-only when member selected) */}
          {isSalary && (
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Total / Monthly Salary (PKR)</label>
              <input
                type="number"
                value={totalSalary || ''}
                onChange={e => set('totalSalary', e.target.value)}
                placeholder="e.g. 50000"
                readOnly={memberId ? true : false}
                className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all ${memberId ? 'cursor-not-allowed opacity-80' : ''}`}
              />
              {/* {memberId && totalSalary && (
                <p className="text-[10px] text-teal-600 mt-1">✓ Auto-filled from member profile (read-only)</p>
              )} */}
            </div>
          )}

          {/* Amount Paid */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              {isSalary ? 'Amount Paid (PKR)' : 'Amount (PKR)'}
            </label>
            <input type="number" value={amount} onChange={e => set('amount', e.target.value)} placeholder="e.g. 25000"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all" />
            {isSalary && totalSalary && amount && Number(totalSalary) > Number(amount) && (
              <p className="text-[11px] text-amber-600 mt-1 font-medium">
                Remaining: PKR {(Number(totalSalary) - Number(amount)).toLocaleString()}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Date</label>
            <input type="date" value={date} onChange={e => set('date', e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all" />
          </div>

          {/* Note */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              Note <span className="normal-case font-normal text-gray-300">(optional)</span>
            </label>
            <textarea value={note} onChange={e => set('note', e.target.value)} placeholder="Any additional notes..." rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all resize-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
              <p className="text-[12px] text-red-600 font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-60 shadow-md">
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Salary Card ───────────────────────────────────────────────────────────────
const SalaryCard = ({ member, entries, onPayRemaining }) => {
  const allMemberEntries = entries.filter(e => e.memberId === member.id && e.category === 'Salary');

  const latestEntry = [...allMemberEntries].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  const latestMonth = latestEntry?.date?.slice(0, 7) || new Date().toISOString().slice(0, 7);

  const currentMonthEntries = allMemberEntries.filter(e => e.date && e.date.slice(0, 7) === latestMonth);
  const totalPaid = currentMonthEntries.reduce((s, e) => s + (e.amount || 0), 0);

  const totalSalary =
    Math.max(0, ...currentMonthEntries.map(e => e.totalSalary || 0)) ||
    latestEntry?.totalSalary ||
    null;

  const remaining = totalSalary ? Math.max(0, totalSalary - totalPaid) : null;
  const pct       = totalSalary ? Math.min(100, Math.round((totalPaid / totalSalary) * 100)) : null;
  const isPending = remaining !== null && remaining > 0;

  const monthLabel = formatMonthLabel(latestMonth);

  return (
    <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col gap-3" style={{border:`1px solid ${TL}`}}>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {member.name?.charAt(0)?.toUpperCase()||'?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] sm:text-[13px] font-bold text-gray-800 truncate">{member.name}</p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 truncate">{member.role||member.designation||'Team Member'}</p>
        </div>
        {isPending && (
          <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 whitespace-nowrap flex-shrink-0">Pending</span>
        )}
        {!isPending && remaining !== null && (
          <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-200 flex items-center gap-1 whitespace-nowrap flex-shrink-0">
            <CheckCircle2 size={9}/> Paid
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 -mt-1">
        <Calendar size={10} className="text-gray-400"/>
        <span className="text-[10px] text-gray-400 font-medium">{monthLabel}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {[
          { label:'Total',     val: totalSalary ? `${(totalSalary/1000).toFixed(0)}k` : '—',                                         cls:'teal'    },
          { label:'Paid',      val: `${(totalPaid/1000).toFixed(0)}k`,                                                                cls:'emerald' },
          { label:'Remaining', val: remaining !== null ? `${(Math.max(0,remaining)/1000).toFixed(0)}k` : '—', cls: isPending ? 'amber' : 'gray' },
        ].map(({label,val,cls}) => (
          <div key={label} className={`rounded-xl p-1.5 sm:p-2 text-center border bg-${cls}-50 border-${cls}-200`}>
            <p className={`text-[11px] sm:text-[13px] font-bold text-${cls}-600 leading-tight`}>{val}</p>
            <p className="text-[9px] text-gray-400 font-medium mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {pct !== null && (
        <div>
          <div className="h-1.5 rounded-full bg-[#EEF2F7] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all" style={{width:`${pct}%`}}/>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-right font-medium">{pct}% paid</p>
        </div>
      )}

      {currentMonthEntries.length > 0 && (
        <div className="space-y-1.5 pt-1" style={{borderTop:`1px solid ${TL}`}}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">This Month's Payments</p>
          {currentMonthEntries.slice(0, 3).map((e, i) => (
            <div key={e.id||i} className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0"/>
                <span className="text-[10px] sm:text-[11px] text-gray-500 truncate">{formatDateShort(e.date)}</span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-800 whitespace-nowrap flex-shrink-0">
                PKR {(e.amount||0).toLocaleString()}
              </span>
            </div>
          ))}
          {currentMonthEntries.length > 3 && (
            <p className="text-[10px] text-gray-400 text-center">+{currentMonthEntries.length-3} more</p>
          )}
        </div>
      )}

      {isPending && totalSalary && (
        <button
          onClick={() => onPayRemaining({ member, remaining, totalSalary, latestMonth })}
          className="w-full mt-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm active:scale-[0.98]">
          <CreditCard size={13}/>
          Pay Remaining — PKR {remaining.toLocaleString()}
        </button>
      )}
    </div>
  );
};

// ── Add Column Modal ──────────────────────────────────────────────────────────
const AddColumnModal = ({ onClose, onAdd }) => {
  const [colLabel, setColLabel] = useState('');
  const [colType,  setColType]  = useState('text');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)'}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" style={{border:`1px solid ${TL}`}}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-gray-800">Add Custom Column</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={14}/></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Column Name</label>
            <input type="text" value={colLabel} onChange={e=>setColLabel(e.target.value)} placeholder="e.g. Invoice No, Status..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"/>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Column Type</label>
            <div className="relative">
              <select value={colType} onChange={e=>setColType(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
          <button
            onClick={()=>{ if(!colLabel.trim()) return; onAdd({ key:`custom_${Date.now()}`, label:colLabel.trim(), type:colType, width:140, visible:true, editable:true, custom:true }); onClose(); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 transition-all shadow-md">
            Add Column
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Per-row 3-dot menu ────────────────────────────────────────────────────────
const RowMenu = ({ onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    const h=(e)=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);
  return (
    <div ref={ref} className="relative flex items-center justify-center">
      <button onClick={e=>{ e.stopPropagation(); setOpen(p=>!p); }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
        title="Row actions">
        <MoreVertical size={13}/>
      </button>
      {open&&(
        <div className="absolute right-0 top-7 z-40 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[130px]"
          onClick={e=>e.stopPropagation()}>
          <button onClick={()=>{ setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-rose-500 hover:bg-rose-50 transition-colors">
            <Trash2 size={12}/> Delete Row
          </button>
        </div>
      )}
    </div>
  );
};

// ── Date filter helpers ───────────────────────────────────────────────────────
const getDateFilterLabel = (dateFilter) => {
  if (!dateFilter || dateFilter.type === 'all') return null;
  if (dateFilter.type === 'single') return formatDateShort(dateFilter.date);
  if (dateFilter.type === 'range')  return `${formatDateShort(dateFilter.start)} → ${formatDateShort(dateFilter.end)}`;
  if (dateFilter.type === 'month')  return `${SHORT_MONTHS[dateFilter.month]} ${dateFilter.year}`;
  return null;
};

const applyDateFilter = (entries, dateFilter) => {
  if (!dateFilter || dateFilter.type === 'all') return entries;
  return entries.filter(e => {
    if (!e.date) return false;
    if (dateFilter.type === 'single') return e.date === dateFilter.date;
    if (dateFilter.type === 'range')  return e.date >= dateFilter.start && e.date <= dateFilter.end;
    if (dateFilter.type === 'month') {
      const [y, m] = e.date.split('-');
      return parseInt(y) === dateFilter.year && parseInt(m) - 1 === dateFilter.month;
    }
    return true;
  });
};

// ── Excel-like Transactions Table ─────────────────────────────────────────────
const TransactionsTable = ({ entries, allCategories, filterCat, setFilterCat, members, onDeleteEntry, dateFilter, setDateFilter }) => {
  const [showCalendar,       setShowCalendar]       = useState(false);
  const [calendarAnchorRect, setCalendarAnchorRect] = useState(null);
  const [searchQuery,        setSearchQuery]        = useState('');   // ← NEW
  const calendarBtnRef = useRef(null);

  const dateFilteredEntries = useMemo(() => applyDateFilter(entries, dateFilter), [entries, dateFilter]);

  // ── Search filter (runs after date + category filter) ──────────────────────
  const filteredEntries = useMemo(()=>{
    let rows = [...dateFilteredEntries].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    if (filterCat !== 'All') rows = rows.filter(e => e.category === filterCat);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(e =>
        (e.label       || '').toLowerCase().includes(q) ||
        (e.category    || '').toLowerCase().includes(q) ||
        (e.memberName  || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.note        || '').toLowerCase().includes(q) ||
        String(e.amount || '').includes(q)
      );
    }
    return rows;
  },[dateFilteredEntries, filterCat, searchQuery]);

  const showSalaryCols = filterCat==='Salary';
  const buildCols = useCallback(()=>{
    const cols = BASE_COLS.map(c=>({...c}));
    if(showSalaryCols){
      const di = cols.findIndex(c=>c.key==='date');
      SALARY_COLS.forEach((sc,i)=>cols.splice(di+i,0,{...sc}));
    }
    return cols;
  },[showSalaryCols]);

  const [cols,         setCols]         = useState(buildCols);
  const [colWidths,    setColWidths]    = useState({});
  const [hiddenCols,   setHiddenCols]   = useState({});
  const [colOrder,     setColOrder]     = useState(null);
  const [rowOrder,     setRowOrder]     = useState(null);
  const [showColMenu,  setShowColMenu]  = useState(false);
  const [showAddCol,   setShowAddCol]   = useState(false);
  const [showDotsMenu, setShowDotsMenu] = useState(false);
  const [dragCol,      setDragCol]      = useState(null);
  const [dragRow,      setDragRow]      = useState(null);
  const [dragOverCol,  setDragOverCol]  = useState(null);
  const [dragOverRow,  setDragOverRow]  = useState(null);
  const [saving,       setSaving]       = useState({});
  const [selectMode,   setSelectMode]   = useState(false);
  const [selected,     setSelected]     = useState(new Set());
  const [confirmDelete,setConfirmDelete]= useState(null);

  const resizingRef = useRef(null);
  const colMenuRef  = useRef(null);
  const dotsMenuRef = useRef(null);

  useEffect(()=>{ const nc=buildCols(); setCols(prev=>{ const cc=prev.filter(c=>c.custom); return [...nc,...cc]; }); setColOrder(null); },[buildCols]);
  useEffect(()=>{ setRowOrder(null); },[filteredEntries.length]);
  useEffect(()=>{
    const h=(e)=>{ if(colMenuRef.current&&!colMenuRef.current.contains(e.target)) setShowColMenu(false); };
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);
  useEffect(()=>{
    const h=(e)=>{ if(dotsMenuRef.current&&!dotsMenuRef.current.contains(e.target)) setShowDotsMenu(false); };
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);

  const orderedCols = useMemo(()=>{
    if(!colOrder) return cols;
    const map=Object.fromEntries(cols.map(c=>[c.key,c]));
    const result=colOrder.map(k=>map[k]).filter(Boolean);
    cols.forEach(c=>{ if(!colOrder.includes(c.key)) result.push(c); });
    return result;
  },[cols,colOrder]);

  const visibleCols   = orderedCols.filter(c=>!hiddenCols[c.key]);
  const displayedRows = useMemo(()=>{
    if(!rowOrder) return filteredEntries;
    return rowOrder.map(id=>filteredEntries.find(e=>e.id===id)).filter(Boolean);
  },[filteredEntries,rowOrder]);

  const startResize=(e,key)=>{
    e.preventDefault(); e.stopPropagation();
    const startX=e.clientX, startW=colWidths[key]||(cols.find(c=>c.key===key)?.width||130);
    resizingRef.current={key,startX,startW};
    const onMove=(ev)=>{ const nw=Math.max(60,resizingRef.current.startW+(ev.clientX-resizingRef.current.startX)); setColWidths(p=>({...p,[resizingRef.current.key]:nw})); };
    const onUp=()=>{ resizingRef.current=null; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
  };

  const onColDragStart=(e,key)=>{ setDragCol(key); e.dataTransfer.effectAllowed='move'; };
  const onColDragOver=(e,key)=>{ e.preventDefault(); setDragOverCol(key); };
  const onColDrop=(e,key)=>{
    e.preventDefault();
    if(!dragCol||dragCol===key) return;
    const vKeys=visibleCols.map(c=>c.key);
    const from=vKeys.indexOf(dragCol), to=vKeys.indexOf(key);
    vKeys.splice(from,1); vKeys.splice(to,0,dragCol);
    const full=orderedCols.map(c=>c.key);
    const newFull=[...vKeys];
    full.forEach(k=>{ if(!newFull.includes(k)) newFull.push(k); });
    setColOrder(newFull); setDragCol(null); setDragOverCol(null);
  };

  const onRowDragStart=(e,id)=>{ setDragRow(id); e.dataTransfer.effectAllowed='move'; };
  const onRowDragOver=(e,id)=>{ e.preventDefault(); setDragOverRow(id); };
  const onRowDrop=(e,id)=>{
    e.preventDefault();
    if(!dragRow||dragRow===id) return;
    const order=displayedRows.map(r=>r.id);
    const from=order.indexOf(dragRow), to=order.indexOf(id);
    order.splice(from,1); order.splice(to,0,dragRow);
    setRowOrder(order); setDragRow(null); setDragOverRow(null);
  };

  const handleCellSave=async(entryId,field,rawVal)=>{
    setSaving(p=>({...p,[`${entryId}_${field}`]:true}));
    try {
      let val=rawVal;
      if(field==='amount'||field==='totalSalary') val=Number(rawVal)||0;
      await updateDoc(doc(db,'finance',entryId),{[field]:val});
    } catch(e){ console.error(e); }
    finally{ setSaving(p=>({...p,[`${entryId}_${field}`]:false})); }
  };

  const requestDeleteSingle = (id) => setConfirmDelete(`single:${id}`);
  const requestDeleteBulk   = ()    => setConfirmDelete('bulk');

  const handleConfirmDelete = async () => {
    if(!confirmDelete) return;
    if(confirmDelete==='bulk'){
      await Promise.all([...selected].map(id=>onDeleteEntry(id)));
      setSelected(new Set()); setSelectMode(false);
    } else {
      await onDeleteEntry(confirmDelete.replace('single:',''));
    }
    setConfirmDelete(null);
  };

  const allSelected = displayedRows.length>0 && displayedRows.every(r=>selected.has(r.id));
  const toggleAll   = () => allSelected ? setSelected(new Set()) : setSelected(new Set(displayedRows.map(r=>r.id)));
  const toggleRow   = (id) => setSelected(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  const addCustomCol = (col) => setCols(p=>[...p,col]);
  const tabTotal = useMemo(()=>filteredEntries.reduce((s,e)=>s+(e.amount||0),0),[filteredEntries]);
  const tabLabel = filterCat==='All'?'Grand Total':`${filterCat} Total`;

  const dateFilterLabel = getDateFilterLabel(dateFilter);
  const isDateFiltered  = dateFilter && dateFilter.type !== 'all';

  const handleCalendarToggle = () => {
    if (!showCalendar) setCalendarAnchorRect(calendarBtnRef.current?.getBoundingClientRect() ?? null);
    setShowCalendar(p => !p);
  };

  const renderCell=(entry,col)=>{
    const isSal=isSalaryType(entry.category);

    if(col.key==='category') return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-1 ${categoryColor(entry.category)}`}>
        {categoryIcon(entry.category)}
        <span className="truncate max-w-[90px]">{entry.category}</span>
      </span>
    );

    if(col.key==='remaining'){
      const entryMonth = entry.date ? entry.date.slice(0, 7) : null;
      if (!isSal || !entryMonth) return <span className="text-[11px] text-gray-300">—</span>;

      const memberMonthEntries = entries.filter(e =>
        e.memberId === entry.memberId &&
        e.category === 'Salary' &&
        e.date && e.date.slice(0, 7) === entryMonth
      );
      const monthPaid = memberMonthEntries.reduce((s, e) => s + (e.amount || 0), 0);
      const monthTotalSalary = Math.max(0, ...memberMonthEntries.map(e => e.totalSalary || 0)) || null;
      const rem = monthTotalSalary !== null ? Math.max(0, monthTotalSalary - monthPaid) : null;

      return rem === null
        ? <span className="text-[11px] text-gray-300">—</span>
        : (
          <span className={`text-[12px] font-semibold ${rem > 0 ? 'text-amber-600' : 'text-teal-600'}`}>
            {rem > 0 ? `PKR ${rem.toLocaleString()}` : '✓ Paid'}
          </span>
        );
    }

    if(col.key==='totalSalary'&&!isSal) return <span className="text-[11px] text-gray-300">—</span>;

    if(col.editable){
      const fieldMap={label:'label',amount:'amount',date:'date',totalSalary:'totalSalary'};
      const field=col.custom?col.key:(fieldMap[col.key]||col.key);
      const rawVal=entry[field]??'';
      const isSaving=saving[`${entry.id}_${field}`];
      const displayVal = col.type === 'date' ? formatDateLong(rawVal) : undefined;
      const editVal    = col.type === 'date' ? rawVal : (col.key==='amount'||col.key==='totalSalary')?(rawVal?`PKR ${Number(rawVal).toLocaleString()}`:'') : rawVal;
      return (
        <div className="relative">
          {isSaving&&<span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-teal-400 animate-pulse"/>}
          <EditableCell
            value={editVal}
            displayValue={displayVal}
            type={col.type}
            onSave={v=>{ let sv=v; if(col.key==='amount'||col.key==='totalSalary') sv=v.replace(/[^0-9.]/g,''); handleCellSave(entry.id,field,sv); }}
          />
        </div>
      );
    }
    return <span className="text-[12px] text-gray-500">{entry[col.key]||'—'}</span>;
  };

  const checkW = selectMode ? 36 : 0;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{border:`1px solid ${TL}`}}>
        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap" style={{borderBottom:`1px solid ${TL}`}}>
          {/* Left: title + bulk delete */}
          <div className="flex items-center gap-2 flex-wrap">
            <TrendingUp size={15} className="text-teal-500"/>
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">All Transactions</h2>
            <span className="text-xs text-gray-400 ml-1">{filteredEntries.length} entries</span>
            {selectMode && selected.size>0 && (
              <button onClick={requestDeleteBulk}
                className="flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-white bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 border border-rose-400 transition-all shadow-sm">
                <Trash2 size={11}/> Delete {selected.size} Selected
              </button>
            )}
          </div>

          {/* Right: search + filters + tools */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* ── SEARCH BAR ── */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                className="pl-7 pr-7 py-1.5 rounded-xl text-[11px] font-medium bg-gray-50 border border-gray-200 text-gray-700 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all w-[160px] focus:w-[200px]"
                style={{transition:'width 0.2s ease'}}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all">
                  <X size={9}/>
                </button>
              )}
            </div>

            {/* Category filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {['All',...allCategories].map(cat=>(
                <button key={cat} onClick={()=>setFilterCat(cat)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${filterCat===cat?'bg-teal-500 text-white border-teal-500':'text-gray-500 bg-gray-50 border-gray-200 hover:border-teal-300 hover:text-teal-600'}`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Date filter */}
            <div>
              <button ref={calendarBtnRef} onClick={handleCalendarToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${isDateFiltered?'bg-teal-500 text-white border-teal-500':'text-gray-600 bg-gray-50 border-gray-200 hover:border-teal-300 hover:text-teal-600'}`}
                title="Filter by date">
                <Calendar size={12}/>
                <span className="hidden sm:inline">{isDateFiltered ? dateFilterLabel : 'Date'}</span>
                {isDateFiltered && (
                  <span onClick={e=>{ e.stopPropagation(); setDateFilter(null); }}
                    className="ml-0.5 w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors cursor-pointer" title="Clear date filter">
                    <X size={9} className="text-white"/>
                  </span>
                )}
              </button>
              {showCalendar && (
                <CalendarPicker
                  anchorRect={calendarAnchorRect}
                  onClose={() => setShowCalendar(false)}
                  onApply={(f) => { setDateFilter(f.type === 'all' ? null : f); setShowCalendar(false); }}
                />
              )}
            </div>

            {/* Add Column */}
            <button onClick={()=>setShowAddCol(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border text-teal-600 bg-teal-50 border-teal-200 hover:bg-teal-100 transition-all">
              <PlusCircle size={12}/> Add Column
            </button>

            {/* Column visibility */}
            <div className="relative" ref={colMenuRef}>
              <button onClick={()=>setShowColMenu(p=>!p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border text-gray-600 bg-gray-50 border-gray-200 hover:border-teal-300 hover:text-teal-600 transition-all">
                <Columns size={12}/> Columns
              </button>
              {showColMenu&&(
                <div className="absolute right-0 top-9 z-30 bg-white rounded-xl shadow-xl border border-gray-200 p-3 min-w-[190px]">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Show / Hide Columns</p>
                  {orderedCols.map(col=>(
                    <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:text-teal-600 transition-colors">
                      <input type="checkbox" checked={!hiddenCols[col.key]} onChange={()=>setHiddenCols(p=>({...p,[col.key]:!p[col.key]}))} className="accent-teal-500"/>
                      <span className="text-[12px] text-gray-700">{col.label}</span>
                      {col.custom&&<span className="text-[9px] text-gray-400 ml-auto">custom</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Dots menu (select mode) */}
            <div className="relative" ref={dotsMenuRef}>
              <button onClick={()=>setShowDotsMenu(p=>!p)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-all">
                <MoreVertical size={14}/>
              </button>
              {showDotsMenu&&(
                <div className="absolute right-0 top-9 z-30 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[170px]">
                  {!selectMode ? (
                    <button onClick={()=>{ setSelectMode(true); setSelected(new Set(displayedRows.map(r=>r.id))); setShowDotsMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-teal-50 hover:text-teal-600 transition-colors">
                      <CheckSquare size={13}/> Select All
                    </button>
                  ) : (
                    <>
                      <button onClick={()=>{ toggleAll(); setShowDotsMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-teal-50 hover:text-teal-600 transition-colors">
                        {allSelected ? <Square size={13}/> : <CheckSquare size={13}/>}
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                      <div style={{height:1,background:TL,margin:'4px 12px'}}/>
                      <button onClick={()=>{ setSelectMode(false); setSelected(new Set()); setShowDotsMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                        <X size={13}/> Exit Select Mode
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active filter banners */}
        {(isDateFiltered || searchQuery) && (
          <div className="px-5 py-2 flex items-center gap-3 flex-wrap" style={{borderBottom:`1px solid ${TL}`, background:'#f0fdf9'}}>
            {isDateFiltered && (
              <div className="flex items-center gap-1.5">
                <Calendar size={12} className="text-teal-500"/>
                <span className="text-[11px] font-semibold text-teal-700">Date: {dateFilterLabel}</span>
                <button onClick={() => setDateFilter(null)}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-teal-400 hover:text-teal-700 hover:bg-teal-100 transition-colors">
                  <X size={9}/>
                </button>
              </div>
            )}
            {searchQuery && (
              <div className="flex items-center gap-1.5">
                <Search size={12} className="text-teal-500"/>
                <span className="text-[11px] font-semibold text-teal-700">Search: "{searchQuery}"</span>
                <button onClick={() => setSearchQuery('')}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-teal-400 hover:text-teal-700 hover:bg-teal-100 transition-colors">
                  <X size={9}/>
                </button>
              </div>
            )}
            <span className="ml-auto text-[11px] text-teal-500 font-medium">{filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {filteredEntries.length===0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">{searchQuery ? '' : ''}</div>
            <p className="text-sm text-gray-400 font-medium">
              {searchQuery ? `No results for "${searchQuery}"` : isDateFiltered ? 'No entries for selected date range' : 'No entries yet'}
            </p>
            <p className="text-xs text-gray-300 mt-1">
              {searchQuery ? 'Try a different search term' : isDateFiltered ? 'Try a different date or clear the filter' : 'Click "Add Expense" in the top bar'}
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full" style={{tableLayout:'fixed', minWidth:32+checkW+40+visibleCols.reduce((s,c)=>s+(colWidths[c.key]||c.width),0)}}>
              <colgroup>
                <col style={{width:32}}/>
                {selectMode&&<col style={{width:checkW}}/>}
                {visibleCols.map(c=><col key={c.key} style={{width:colWidths[c.key]||c.width}}/>)}
                <col style={{width:40}}/>
              </colgroup>
              <thead>
                <tr className="bg-[#EEF2F7]" style={{borderBottom:`1px solid ${TLB}`}}>
                  <th style={{borderRight:`1px solid ${TL}`,width:32}}/>
                  {selectMode&&(
                    <th style={{borderRight:`1px solid ${TL}`,width:checkW}} className="py-2.5 px-2">
                      <button onClick={toggleAll} className="flex items-center justify-center w-full">
                        {allSelected ? <CheckSquare size={14} className="text-teal-500"/> : <Square size={14} className="text-gray-400"/>}
                      </button>
                    </th>
                  )}
                  {visibleCols.map((col)=>(
                    <th key={col.key}
                      draggable onDragStart={e=>onColDragStart(e,col.key)} onDragOver={e=>onColDragOver(e,col.key)}
                      onDrop={e=>onColDrop(e,col.key)} onDragEnd={()=>{setDragCol(null);setDragOverCol(null);}}
                      className={`py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-left select-none cursor-grab relative transition-colors ${dragOverCol===col.key?'bg-teal-50':''}`}
                      style={{borderRight:`1px solid ${TL}`}}>
                      <span className="flex items-center gap-1">
                        <GripVertical size={10} className="text-gray-300 flex-shrink-0"/>
                        {col.label}
                        {col.custom&&<span className="ml-1 text-[8px] bg-purple-100 text-purple-500 px-1 rounded">custom</span>}
                      </span>
                      <span onMouseDown={e=>startResize(e,col.key)}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-teal-300 transition-colors" style={{zIndex:2}}/>
                    </th>
                  ))}
                  <th style={{width:40}}/>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((entry,idx)=>(
                  <tr key={entry.id}
                    draggable={!selectMode}
                    onDragStart={e=>!selectMode&&onRowDragStart(e,entry.id)}
                    onDragOver={e=>!selectMode&&onRowDragOver(e,entry.id)}
                    onDrop={e=>!selectMode&&onRowDrop(e,entry.id)}
                    onDragEnd={()=>{setDragRow(null);setDragOverRow(null);}}
                    className={`transition-colors ${selected.has(entry.id)?'bg-rose-50/70':dragOverRow===entry.id?'bg-teal-50/60':idx%2===0?'bg-white':'bg-gray-50/40'}`}
                    style={{borderBottom:`1px solid ${TL}`}}>
                    <td className="px-2 py-3 cursor-grab" style={{borderRight:`1px solid ${TL}`,width:32}}>
                      <GripVertical size={13} className="text-gray-300 mx-auto"/>
                    </td>
                    {selectMode&&(
                      <td className="px-2 py-3" style={{borderRight:`1px solid ${TL}`,width:checkW}}>
                        <button onClick={()=>toggleRow(entry.id)} className="flex items-center justify-center w-full">
                          {selected.has(entry.id) ? <CheckSquare size={14} className="text-rose-500"/> : <Square size={14} className="text-gray-300 hover:text-gray-500"/>}
                        </button>
                      </td>
                    )}
                    {visibleCols.map((col)=>(
                      <td key={col.key} className="px-3 py-2.5"
                        style={{borderRight:`1px solid ${TL}`,overflow:'hidden',maxWidth:colWidths[col.key]||col.width}}>
                        {renderCell(entry,col)}
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-center" style={{width:40}}>
                      <RowMenu onDelete={()=>requestDeleteSingle(entry.id)}/>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{borderTop:`2px solid ${TLB}`,background:'#EEF2F7'}}>
                  <td style={{borderRight:`1px solid ${TL}`}}/>
                  {selectMode&&<td style={{borderRight:`1px solid ${TL}`}}/>}
                  <td colSpan={Math.max(1,visibleCols.findIndex(c=>c.key==='amount'))} className="px-3 py-3">
                    <span className="text-[12px] font-bold text-gray-700 uppercase tracking-wider">{tabLabel}</span>
                  </td>
                  <td className="px-3 py-3" style={{borderLeft:`1px solid ${TL}`}}>
                    <span className="text-[13px] font-bold text-rose-600">PKR {tabTotal.toLocaleString()}</span>
                  </td>
                  <td colSpan={Math.max(1,visibleCols.length-visibleCols.findIndex(c=>c.key==='amount')-1)} className="px-3 py-3" style={{borderLeft:`1px solid ${TL}`}}>
                    <span className="text-[11px] text-gray-400">{filteredEntries.length} {filterCat==='All'?'total':filterCat.toLowerCase()} entries</span>
                  </td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      {showAddCol&&<AddColumnModal onClose={()=>setShowAddCol(false)} onAdd={addCustomCol}/>}
      {confirmDelete&&(
        <ConfirmDeleteModal
          count={confirmDelete==='bulk'?selected.size:1}
          onConfirm={handleConfirmDelete}
          onCancel={()=>setConfirmDelete(null)}
        />
      )}
    </>
  );
};

// ── Main Finance Page ─────────────────────────────────────────────────────────
const Finance = () => {
  const { showAddExpenseModal, setShowAddExpenseModal } = useOutletContext()||{};
  const [entries,          setEntries]          = useState([]);
  const [members,          setMembers]          = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [filterCat,        setFilterCat]        = useState('All');
  const [dateFilter,       setDateFilter]       = useState(null);
  const [refresh,          setRefresh]          = useState(0);
  const [customCategories, setCustomCategories] = useState([]);
  const [showSalaryCards,  setShowSalaryCards]  = useState(false);
  const [formData,         setFormData]         = useState({...EMPTY_FORM, date:new Date().toISOString().slice(0,10)});
  const [payRemainingData, setPayRemainingData] = useState(null);

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  useEffect(()=>{
    const s={finance:false,members:false};
    const done=()=>{ if(s.finance&&s.members) setLoading(false); };
    const u1=onSnapshot(collection(db,'finance'),
      snap=>{ setEntries(snap.docs.map(d=>({id:d.id,...d.data()}))); s.finance=true; done(); },
      err=>{ console.error(err); s.finance=true; done(); });
    const u2=onSnapshot(collection(db,'teamMembers'),
      snap=>{ setMembers(snap.docs.map(d=>({id:d.id,...d.data()}))); s.members=true; done(); },
      err=>{ console.error(err); s.members=true; done(); });
    return ()=>{ u1(); u2(); };
  },[refresh]);

  const handleDeleteEntry = async (id) => {
    try { await deleteDoc(doc(db,'finance',id)); }
    catch(e){ console.error('Delete failed:',e); }
  };

  const filteredByDate = useMemo(() => applyDateFilter(entries, dateFilter), [entries, dateFilter]);

  const totalSpent  = useMemo(()=>filteredByDate.reduce((s,e)=>s+(e.amount||0),0),[filteredByDate]);
  const salaryTotal = useMemo(()=>filteredByDate.filter(e=>e.category==='Salary').reduce((s,e)=>s+(e.amount||0),0),[filteredByDate]);
  const billsTotal  = useMemo(()=>filteredByDate.filter(e=>['Electricity','Gas','Internet','Rent'].includes(e.category)).reduce((s,e)=>s+(e.amount||0),0),[filteredByDate]);
  const otherTotal  = useMemo(()=>filteredByDate.filter(e=>!['Salary','Electricity','Gas','Internet','Rent'].includes(e.category)).reduce((s,e)=>s+(e.amount||0),0),[filteredByDate]);

  const salaryMembers = useMemo(()=>members.filter(m=>entries.some(e=>e.memberId===m.id&&e.category==='Salary')),[members,entries]);

  const activeDateLabel = getDateFilterLabel(dateFilter);

  if(loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {label:'Total Spent',    value:totalSpent,  icon:<Wallet size={18}/>,  grad:'from-rose-400 to-red-500',     sub:`${filteredByDate.length} entries`},
            {label:'Salaries Paid',  value:salaryTotal, icon:<Users size={18}/>,   grad:'from-teal-400 to-cyan-500',    sub:`${salaryMembers.length} members`},
            {label:'Bills & Rent',   value:billsTotal,  icon:<Zap size={18}/>,     grad:'from-amber-400 to-orange-500', sub:'Electricity, gas, etc.'},
            {label:'Other Expenses', value:otherTotal,  icon:<Receipt size={18}/>, grad:'from-violet-400 to-purple-500',sub:'Misc & equipment'},
          ].map(({label,value,icon,grad,sub})=>(
            <div key={label} className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3" style={{border:`1px solid ${TL}`}}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${grad}`}>
                <span className="text-white">{icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value>=1000?`${(value/1000).toFixed(1)}k`:value.toLocaleString()}</p>
                <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
                {activeDateLabel
                  ? <p className="text-[11px] mt-1 font-semibold text-teal-500 flex items-center gap-1"><Calendar size={10}/>{activeDateLabel}</p>
                  : <p className="text-[11px] mt-1 text-gray-400">{sub}</p>
                }
              </div>
            </div>
          ))}
        </div>

        {/* Salary Cards */}
        {salaryMembers.length>0&&(
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{border:`1px solid ${TL}`}}>
            <button onClick={()=>setShowSalaryCards(p=>!p)}
              className="w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 hover:bg-gray-50 transition-colors"
              style={{borderBottom:showSalaryCards?`1px solid ${TL}`:'none'}}>
              <div className="flex items-center gap-2 min-w-0">
                <Users size={14} className="text-teal-500 flex-shrink-0"/>
                <h2 className="text-[11px] sm:text-sm font-bold text-gray-700 uppercase tracking-wider truncate">Team Salary Overview</h2>
                <span className="text-[10px] sm:text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">{salaryMembers.length} members</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ml-2">
                <span className="text-[10px] sm:text-[11px] text-gray-400">{showSalaryCards?'Hide':'Show'}</span>
                {showSalaryCards?<ChevronUp size={14} className="text-gray-400"/>:<ChevronDown size={14} className="text-gray-400"/>}
              </div>
            </button>
            {showSalaryCards&&(
              <div className="p-3 sm:p-4 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {salaryMembers.map(m=>(
                  <SalaryCard
                    key={m.id}
                    member={m}
                    entries={entries}
                    onPayRemaining={setPayRemainingData}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <TransactionsTable
          entries={entries}
          allCategories={allCategories}
          filterCat={filterCat}
          setFilterCat={setFilterCat}
          members={members}
          onDeleteEntry={handleDeleteEntry}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
        />
      </div>

      {/* Add Payment Modal */}
      {showAddExpenseModal&&(
        <AddPaymentModal
          members={members}
          entries={entries}
          onClose={()=>setShowAddExpenseModal(false)}
          onAdd={()=>setRefresh(r=>r+1)}
          customCategories={customCategories}
          onAddCustomCategory={name=>{ if(![...DEFAULT_CATEGORIES,...customCategories].includes(name)) setCustomCategories(p=>[...p,name]); }}
          formData={formData}
          setFormData={setFormData}
        />
      )}

      {/* Pay Remaining Modal */}
      {payRemainingData && (
        <PayRemainingModal
          data={payRemainingData}
          onClose={() => setPayRemainingData(null)}
          onSuccess={() => setRefresh(r => r + 1)}
        />
      )}
    </div>
  );
};

export default Finance;