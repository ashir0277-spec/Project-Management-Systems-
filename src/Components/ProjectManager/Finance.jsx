import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Plus, X, Users, Zap, ChevronDown, ChevronUp, TrendingUp,
  Wallet, Receipt, CheckCircle2, AlertCircle, Building2,
  User, RotateCcw, GripVertical, Columns, PlusCircle,
  MoreVertical, Trash2, CheckSquare, Square
} from 'lucide-react';

const TL  = 'rgba(51,51,51,0.12)';
const TLB = 'rgba(51,51,51,0.18)';
const DEFAULT_CATEGORIES = ['Salary','Receptionist','Electricity','Gas','Internet','Rent','Equipment','Other'];
const isSalaryType = (cat) => cat === 'Salary';

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

// ── Text-only category color (no bg/border) ───────────────────────────────────
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
  { key:'date',     label:'Date',                 width:120, visible:true, editable:true,  type:'date'   },
];
const SALARY_COLS = [
  { key:'totalSalary', label:'Monthly Salary', width:140, visible:true, editable:true,  type:'number'  },
  { key:'remaining',   label:'Remaining',      width:130, visible:true, editable:false, type:'computed'},
];

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
            {count === 1
              ? 'Are you sure you want to delete this entry?'
              : `Are you sure you want to delete ${count} entries?`}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-gray-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 mb-5">
        ⚠️ This action cannot be undone.
      </p>
      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
          Cancel
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 transition-all shadow-md">
          Delete {count > 1 ? `${count} Entries` : 'Entry'}
        </button>
      </div>
    </div>
  </div>
);

// ── Inline editable cell ──────────────────────────────────────────────────────
const EditableCell = ({ value, type, onSave }) => {
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
      <span className="text-[12px] text-gray-800">{value || <span className="text-gray-300 italic">—</span>}</span>
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

// ── Add Payment Modal ─────────────────────────────────────────────────────────
const AddPaymentModal = ({ members, onClose, onAdd, customCategories, onAddCustomCategory, formData, setFormData }) => {
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const { category, isCustomCat, newCatName, memberId, label, description, amount, totalSalary, date, note } = formData;
  const set = (k,v) => setFormData(p=>({...p,[k]:v}));
  const isSalary = category === 'Salary' && !isCustomCat;
  const finalCategory = isCustomCat ? newCatName.trim() : category;
  const handleReset = () => { setFormData({...EMPTY_FORM, date:new Date().toISOString().slice(0,10)}); setError(''); };

  const handleSubmit = async () => {
    setError('');
    if(isCustomCat && !newCatName.trim()){ setError('Please enter a custom category name.'); return; }
    if(!amount || isNaN(Number(amount)) || Number(amount)<=0){ setError('Please enter a valid amount.'); return; }
    if(isSalary && !memberId){ setError('Please select a team member.'); return; }
    if(!isSalary && !label.trim()){ setError('Please enter a label/description.'); return; }
    setSaving(true);
    try {
      const member = isSalary ? members.find(m=>m.id===memberId) : null;
      if(isCustomCat && newCatName.trim()) onAddCustomCategory(newCatName.trim());
      await addDoc(collection(db,'finance'),{
        category: finalCategory,
        memberId: member?.id||null, memberName: member?.name||null,
        label: isSalary ? (member?.name||'') : label.trim(),
        description: description.trim()||null,
        amount: Number(amount),
        totalSalary: isSalary && totalSalary ? Number(totalSalary) : null,
        date, note: note.trim(), createdAt: serverTimestamp(),
      });
      setFormData({...EMPTY_FORM, date:new Date().toISOString().slice(0,10)});
      onAdd(); onClose();
    } catch(e){ setError('Failed to save. Try again.'); }
    finally{ setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.45)',backdropFilter:'blur(4px)'}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{border:`1px solid ${TL}`}}>
        <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:`1px solid ${TL}`}}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center">
              <Plus size={16} className="text-white"/>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Add New Entry</h2>
              <p className="text-[11px] text-gray-400">Fill in the expense details below</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 bg-gray-100 hover:bg-rose-50 hover:text-rose-500 border border-gray-200 hover:border-rose-200 transition-all">
              <RotateCcw size={11}/> Reset
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={14}/>
            </button>
          </div>
        </div>
        <div className="p-6 space-y-2 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Category</label>
            <div className="relative">
              <select value={isCustomCat?'__custom__':category}
                onChange={e=>{ if(e.target.value==='__custom__'){set('isCustomCat',true);set('newCatName','');}else{set('isCustomCat',false);set('category',e.target.value);} }}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all">
                <option value="__custom__">+ Add Custom Category</option>
                <option disabled>──────────────</option>
                {allCategories.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            </div>
          </div>
          {isCustomCat&&(
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Custom Category Name</label>
              <input type="text" value={newCatName} onChange={e=>set('newCatName',e.target.value)} placeholder="e.g. Marketing..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"/>
            </div>
          )}
          {isSalary&&(
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Team Member</label>
              <div className="relative">
                <select value={memberId} onChange={e=>set('memberId',e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all">
                  <option value="">Select member...</option>
                  {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
              </div>
            </div>
          )}
          {!isSalary&&(
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Label</label>
              <input type="text" value={label} onChange={e=>set('label',e.target.value)}
                placeholder={`e.g. ${finalCategory==='Electricity'?'May 2025 bill':finalCategory==='Gas'?'June gas bill':'Details...'}`}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"/>
            </div>
          )}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              Description <span className="text-gray-300 normal-case font-normal">(optional)</span>
            </label>
            <input type="text" value={description} onChange={e=>set('description',e.target.value)} placeholder="Add more details..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"/>
          </div>
          {isSalary&&(
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Total / Monthly Salary (PKR)</label>
              <input type="number" value={totalSalary} onChange={e=>set('totalSalary',e.target.value)} placeholder="e.g. 50000"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"/>
            </div>
          )}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">{isSalary?'Amount Paid (PKR)':'Amount (PKR)'}</label>
            <input type="number" value={amount} onChange={e=>set('amount',e.target.value)} placeholder="e.g. 25000"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"/>
            {isSalary&&totalSalary&&amount&&Number(totalSalary)>Number(amount)&&(
              <p className="text-[11px] text-amber-600 mt-1 font-medium">Remaining: PKR {(Number(totalSalary)-Number(amount)).toLocaleString()}</p>
            )}
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Date</label>
            <input type="date" value={date} onChange={e=>set('date',e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"/>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              Note <span className="text-gray-300 normal-case font-normal">(optional)</span>
            </label>
            <textarea value={note} onChange={e=>set('note',e.target.value)} placeholder="Any additional notes..." rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all resize-none"/>
          </div>
          {error&&(
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle size={13} className="text-red-500 flex-shrink-0"/>
              <p className="text-[12px] text-red-600 font-medium">{error}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-60 shadow-md">
            {saving?'Saving...':'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Salary Card ───────────────────────────────────────────────────────────────
const SalaryCard = ({ member, entries }) => {
  const memberEntries = entries.filter(e=>e.memberId===member.id&&e.category==='Salary');
  const totalPaid   = memberEntries.reduce((s,e)=>s+(e.amount||0),0);
  const latestEntry = [...memberEntries].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  const totalSalary = latestEntry?.totalSalary||null;
  const remaining   = totalSalary?totalSalary-totalPaid:null;
  const pct         = totalSalary?Math.min(100,Math.round((totalPaid/totalSalary)*100)):null;
  return (
    <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col gap-3" style={{border:`1px solid ${TL}`}}>

      {/* ── Header row ── */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {member.name?.charAt(0)?.toUpperCase()||'?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] sm:text-[13px] font-bold text-gray-800 truncate">{member.name}</p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 truncate">{member.role||member.designation||'Team Member'}</p>
        </div>
        {remaining!==null&&remaining>0&&(
          <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 whitespace-nowrap flex-shrink-0">
            Pending
          </span>
        )}
        {remaining!==null&&remaining<=0&&(
          <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-200 flex items-center gap-1 whitespace-nowrap flex-shrink-0">
            <CheckCircle2 size={9}/> Paid
          </span>
        )}
      </div>

      {/* ── Stats: 3 equal cols, compact on mobile ── */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {[
          {label:'Total',     val:totalSalary?`${(totalSalary/1000).toFixed(0)}k`:'—',                                cls:'teal'},
          {label:'Paid',      val:`${(totalPaid/1000).toFixed(0)}k`,                                                   cls:'emerald'},
          {label:'Remaining', val:remaining!==null?`${(Math.max(0,remaining)/1000).toFixed(0)}k`:'—', cls:remaining!==null&&remaining>0?'amber':'gray'},
        ].map(({label,val,cls})=>(
          <div key={label} className={`rounded-xl p-1.5 sm:p-2 text-center border bg-${cls}-50 border-${cls}-200`}>
            <p className={`text-[11px] sm:text-[13px] font-bold text-${cls}-600 leading-tight`}>{val}</p>
            <p className="text-[9px] text-gray-400 font-medium mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Progress bar ── */}
      {pct!==null&&(
        <div>
          <div className="h-1.5 rounded-full bg-[#EEF2F7] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all" style={{width:`${pct}%`}}/>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-right font-medium">{pct}% paid</p>
        </div>
      )}

      {/* ── Payment history ── */}
      {memberEntries.length>0&&(
        <div className="space-y-1.5 pt-1" style={{borderTop:`1px solid ${TL}`}}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Payment History</p>
          {memberEntries.slice(0,3).map((e,i)=>(
            <div key={e.id||i} className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0"/>
                <span className="text-[10px] sm:text-[11px] text-gray-500 truncate">{e.date||'—'}</span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-800 whitespace-nowrap flex-shrink-0">
                PKR {(e.amount||0).toLocaleString()}
              </span>
            </div>
          ))}
          {memberEntries.length>3&&<p className="text-[10px] text-gray-400 text-center">+{memberEntries.length-3} more</p>}
        </div>
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
      <button
        onClick={e=>{ e.stopPropagation(); setOpen(p=>!p); }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
        title="Row actions">
        <MoreVertical size={13}/>
      </button>
      {open&&(
        <div className="absolute right-0 top-7 z-40 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[130px]"
          onClick={e=>e.stopPropagation()}>
          <button
            onClick={()=>{ setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-rose-500 hover:bg-rose-50 transition-colors">
            <Trash2 size={12}/> Delete Row
          </button>
        </div>
      )}
    </div>
  );
};

// ── Excel-like Transactions Table ─────────────────────────────────────────────
const TransactionsTable = ({ entries, allCategories, filterCat, setFilterCat, members, onDeleteEntry }) => {
  const filteredEntries = useMemo(()=>{
    const sorted = [...entries].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    return filterCat==='All'?sorted:sorted.filter(e=>e.category===filterCat);
  },[entries,filterCat]);

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

  // ── Selection & delete state ─────────────────────────────────────────────────
  const [selectMode,   setSelectMode]   = useState(false);
  const [selected,     setSelected]     = useState(new Set());
  const [confirmDelete,setConfirmDelete]= useState(null); // null | 'bulk' | 'single:{id}'

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

  // ── Delete logic ─────────────────────────────────────────────────────────────
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

  // ── Select logic ─────────────────────────────────────────────────────────────
  const allSelected = displayedRows.length>0 && displayedRows.every(r=>selected.has(r.id));
  const toggleAll   = () => allSelected ? setSelected(new Set()) : setSelected(new Set(displayedRows.map(r=>r.id)));
  const toggleRow   = (id) => setSelected(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  const addCustomCol = (col) => setCols(p=>[...p,col]);
  const tabTotal = useMemo(()=>filteredEntries.reduce((s,e)=>s+(e.amount||0),0),[filteredEntries]);
  const tabLabel = filterCat==='All'?'Grand Total':`${filterCat} Total`;

  const renderCell=(entry,col)=>{
    const isSal=isSalaryType(entry.category);
    if(col.key==='category') return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-1 ${categoryColor(entry.category)}`}>
        {categoryIcon(entry.category)}
        <span className="truncate max-w-[90px]">{entry.category}</span>
      </span>
    );
    if(col.key==='remaining'){
      const rem=isSal&&entry.totalSalary?Math.max(0,entry.totalSalary-entry.amount):null;
      return rem===null
        ? <span className="text-[11px] text-gray-300">—</span>
        : <span className={`text-[12px] font-semibold ${rem>0?'text-amber-600':'text-teal-600'}`}>{rem>0?`PKR ${rem.toLocaleString()}`:'✓ Paid'}</span>;
    }
    if(col.key==='totalSalary'&&!isSal) return <span className="text-[11px] text-gray-300">—</span>;
    if(col.editable){
      const fieldMap={label:'label',amount:'amount',date:'date',totalSalary:'totalSalary'};
      const field=col.custom?col.key:(fieldMap[col.key]||col.key);
      const rawVal=entry[field]??'';
      const isSaving=saving[`${entry.id}_${field}`];
      return (
        <div className="relative">
          {isSaving&&<span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-teal-400 animate-pulse"/>}
          <EditableCell
            value={col.key==='amount'||col.key==='totalSalary'?(rawVal?`PKR ${Number(rawVal).toLocaleString()}`:''):rawVal}
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

        {/* ── Toolbar ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap" style={{borderBottom:`1px solid ${TL}`}}>
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

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {['All',...allCategories].map(cat=>(
                <button key={cat} onClick={()=>setFilterCat(cat)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${filterCat===cat?'bg-teal-500 text-white border-teal-500':'text-gray-500 bg-gray-50 border-gray-200 hover:border-teal-300 hover:text-teal-600'}`}>
                  {cat}
                </button>
              ))}
            </div>
            {/* Add column */}
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

            {/* ── 3-dot menu: Select All / Deselect All / Exit ── */}
            <div className="relative" ref={dotsMenuRef}>
              <button onClick={()=>setShowDotsMenu(p=>!p)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-all">
                <MoreVertical size={14}/>
              </button>
              {showDotsMenu&&(
                <div className="absolute right-0 top-9 z-30 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[170px]">
                  {!selectMode ? (
                    <button
                      onClick={()=>{ setSelectMode(true); setSelected(new Set(displayedRows.map(r=>r.id))); setShowDotsMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-teal-50 hover:text-teal-600 transition-colors">
                      <CheckSquare size={13}/> Select All
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={()=>{ toggleAll(); setShowDotsMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-teal-50 hover:text-teal-600 transition-colors">
                        {allSelected ? <Square size={13}/> : <CheckSquare size={13}/>}
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                      <div style={{height:1,background:TL,margin:'4px 12px'}}/>
                      <button
                        onClick={()=>{ setSelectMode(false); setSelected(new Set()); setShowDotsMenu(false); }}
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

        

        {filteredEntries.length===0?(
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">💸</div>
            <p className="text-sm text-gray-400 font-medium">No entries yet</p>
            <p className="text-xs text-gray-300 mt-1">Click "Add Expense" in the top bar</p>
          </div>
        ):(
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
                        {allSelected
                          ? <CheckSquare size={14} className="text-teal-500"/>
                          : <Square size={14} className="text-gray-400"/>}
                      </button>
                    </th>
                  )}
                  {visibleCols.map((col)=>(
                    <th key={col.key}
                      draggable
                      onDragStart={e=>onColDragStart(e,col.key)}
                      onDragOver={e=>onColDragOver(e,col.key)}
                      onDrop={e=>onColDrop(e,col.key)}
                      onDragEnd={()=>{setDragCol(null);setDragOverCol(null);}}
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
                    className={`transition-colors ${
                      selected.has(entry.id)
                        ? 'bg-rose-50/70'
                        : dragOverRow===entry.id
                          ? 'bg-teal-50/60'
                          : idx%2===0?'bg-white':'bg-gray-50/40'
                    }`}
                    style={{borderBottom:`1px solid ${TL}`}}>
                    {/* drag handle */}
                    <td className="px-2 py-3 cursor-grab" style={{borderRight:`1px solid ${TL}`,width:32}}>
                      <GripVertical size={13} className="text-gray-300 mx-auto"/>
                    </td>
                    {/* checkbox */}
                    {selectMode&&(
                      <td className="px-2 py-3" style={{borderRight:`1px solid ${TL}`,width:checkW}}>
                        <button onClick={()=>toggleRow(entry.id)} className="flex items-center justify-center w-full">
                          {selected.has(entry.id)
                            ? <CheckSquare size={14} className="text-rose-500"/>
                            : <Square size={14} className="text-gray-300 hover:text-gray-500"/>}
                        </button>
                      </td>
                    )}
                    {visibleCols.map((col)=>(
                      <td key={col.key} className="px-3 py-2.5"
                        style={{borderRight:`1px solid ${TL}`,overflow:'hidden',maxWidth:colWidths[col.key]||col.width}}>
                        {renderCell(entry,col)}
                      </td>
                    ))}
                    {/* per-row 3-dot delete */}
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
  const [refresh,          setRefresh]          = useState(0);
  const [customCategories, setCustomCategories] = useState([]);
  const [showSalaryCards,  setShowSalaryCards]  = useState(false);
  const [formData,         setFormData]         = useState({...EMPTY_FORM, date:new Date().toISOString().slice(0,10)});

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

  const totalSpent    = useMemo(()=>entries.reduce((s,e)=>s+(e.amount||0),0),[entries]);
  const salaryTotal   = useMemo(()=>entries.filter(e=>e.category==='Salary').reduce((s,e)=>s+(e.amount||0),0),[entries]);
  const billsTotal    = useMemo(()=>entries.filter(e=>['Electricity','Gas','Internet','Rent'].includes(e.category)).reduce((s,e)=>s+(e.amount||0),0),[entries]);
  const otherTotal    = useMemo(()=>entries.filter(e=>!['Salary','Electricity','Gas','Internet','Rent'].includes(e.category)).reduce((s,e)=>s+(e.amount||0),0),[entries]);
  const salaryMembers = useMemo(()=>members.filter(m=>entries.some(e=>e.memberId===m.id&&e.category==='Salary')),[members,entries]);

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
            {label:'Total Spent',    value:totalSpent,  icon:<Wallet size={18}/>,  grad:'from-rose-400 to-red-500',     sub:`${entries.length} entries`},
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
                <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
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
                {salaryMembers.map(m=><SalaryCard key={m.id} member={m} entries={entries}/>)}
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
        />
      </div>

      {showAddExpenseModal&&(
        <AddPaymentModal
          members={members}
          onClose={()=>setShowAddExpenseModal(false)}
          onAdd={()=>setRefresh(r=>r+1)}
          customCategories={customCategories}
          onAddCustomCategory={name=>{ if(![...DEFAULT_CATEGORIES,...customCategories].includes(name)) setCustomCategories(p=>[...p,name]); }}
          formData={formData}
          setFormData={setFormData}
        />
      )}
    </div>
  );
};

export default Finance;