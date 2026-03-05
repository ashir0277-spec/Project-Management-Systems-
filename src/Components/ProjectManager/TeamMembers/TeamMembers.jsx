// ─────────────────────────────────────────────────────────────────────────────
//  TeamMembers.jsx
//  Add Member flow:
//    Step 1 → Basic info (required)
//    Step 2 → "Add details now?" YES → tabs  |  NO → save immediately
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
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  Info, Clock, ArrowRight, Zap
} from 'lucide-react';

const TL  = 'rgba(51,51,51,0.20)';
const TLB = 'rgba(51,51,51,0.30)';
const ROLES = [
  'Frontend Developer', 'Backend Developer', 'Flutter Developer',
  'UI/UX Designer', 'Project Manager', 'QA Engineer',
  'Marketing Manager', 'Content Writer', 'DevOps Engineer',
];
const PRIORITIES       = ['Low', 'Medium', 'High', 'Critical'];
const EMPLOYMENT_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Freelance'];
const PAYMENT_METHODS  = ['Bank Transfer', 'Cash', 'Cheque', 'JazzCash', 'EasyPaisa'];

const priorityCfg = {
  Low:      { badge: 'text-gray-500',  dot: 'bg-gray-400'  },
  Medium:   { badge: 'text-blue-600',  dot: 'bg-blue-500'  },
  High:     { badge: 'text-amber-600', dot: 'bg-amber-400' },
  Critical: { badge: 'text-red-500',   dot: 'bg-red-500'   },
};
const statusCfg = {
  Active:   { badge: 'text-emerald-600', dot: 'bg-emerald-500' },
  Away:     { badge: 'text-amber-600',   dot: 'bg-amber-400'   },
  Inactive: { badge: 'text-gray-500',    dot: 'bg-gray-400'    },
};
const taskStatusCfg = {
  'Pending':     { color: 'text-gray-500',    bg: 'bg-gray-100',   border: 'border-gray-200',    dot: 'bg-gray-400'    },
  'In Progress': { color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-400'   },
  'Done':        { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
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
const emptyMember = () => ({
  name: '', role: 'Frontend Developer', email: '', phone: '', status: 'Active',
  address: '', dob: '', cnic: '', emergencyContact: '',
  department: '', employeeId: '', joiningDate: '', employmentType: 'Full-Time',
  workLocation: '', manager: '', salary: '',
  bankName: '', accountNumber: '', accountTitle: '', iban: '',
  branchCode: '', branchName: '', paymentMethod: 'Bank Transfer',
  allowances: '', payCycle: 'Monthly', ntn: '',
});
const getCompletion = (m) => {
  const fields = [
    m.address, m.dob, m.cnic, m.emergencyContact,
    m.department, m.employeeId, m.joiningDate, m.workLocation, m.manager, m.salary,
    m.bankName, m.accountNumber, m.accountTitle, m.iban,
  ];
  const filled = fields.filter(f => f && String(f).trim() !== '').length;
  return Math.round((filled / fields.length) * 100);
};

// ─── Custom Dropdown ──────────────────────────────────────────────────────────
const CustomDropdown = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef   = useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, posLeft: null, posRight: null, arrowOffset: 16 });

  useEffect(() => {
    const h = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          buttonRef.current   && !buttonRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const vw = window.innerWidth, dropW = 210, PAD = 8;
      const over = rect.left + dropW > vw - PAD;
      setDropPos(over
        ? { top: rect.bottom + 6, posLeft: null, posRight: vw - rect.right, arrowOffset: Math.max(10, Math.min(dropW - Math.round(rect.width/2) - 5, dropW - 20)) }
        : { top: rect.bottom + 6, posLeft: rect.left, posRight: null, arrowOffset: Math.max(10, Math.round(rect.width/2) - 5) }
      );
    }
    setIsOpen(p => !p);
  };

  const selectedLabel = value === 'all'
    ? placeholder
    : options.find(o => (o.value ?? o) === value)?.label ?? value;
  const isActive = value !== 'all';

  return (
    <>
      <button ref={buttonRef} onClick={handleOpen}
        className={`flex items-center gap-2 pl-3 pr-2.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
          ${isActive ? 'bg-teal-50 text-teal-700 border-teal-300' : 'bg-white text-gray-700 hover:border-gray-300'}`}
        style={{ border: `1px solid ${isActive ? 'rgba(20,184,166,0.4)' : TL}` }}>
        <span className={isActive ? 'text-teal-600' : 'text-gray-500'}>{selectedLabel}</span>
        {isOpen ? <ChevronUp size={14} className={isActive ? 'text-teal-500' : 'text-gray-400'} />
                : <ChevronDown size={14} className={isActive ? 'text-teal-500' : 'text-gray-400'} />}
      </button>
      {isOpen && (
        <div ref={dropdownRef} onClick={e => e.stopPropagation()}
          className="fixed z-[9999] bg-white rounded-xl overflow-hidden"
          style={{
            top: dropPos.top,
            ...(dropPos.posLeft !== null ? { left: dropPos.posLeft } : { right: dropPos.posRight }),
            width: 210, maxWidth: 'calc(100vw - 16px)',
            border: `1px solid ${TL}`, boxShadow: '0 12px 36px rgba(0,0,0,0.13)',
          }}>
          <div className="absolute -top-[5px] w-2.5 h-2.5 bg-white rotate-45 border-l border-t border-gray-200"
            style={{ left: dropPos.arrowOffset }} />
          <div className="pt-2 pb-1.5">
            <button onClick={() => { onChange('all'); setIsOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors
                ${value === 'all' ? 'bg-teal-50 text-teal-600' : 'text-gray-600 hover:bg-gray-50'}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${value === 'all' ? 'bg-teal-400' : 'bg-gray-200'}`} />
              {placeholder}
              {value === 'all' && <CheckCircle2 size={12} className="ml-auto opacity-60 text-teal-500" />}
            </button>
            <div className="mx-3 my-1.5 border-t border-gray-100" />
            {options.map(opt => {
              const ov = opt.value ?? opt, ol = opt.label ?? opt;
              const isSel = value === ov;
              return (
                <button key={ov} onClick={() => { onChange(ov); setIsOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors
                    ${isSel ? 'bg-teal-50 text-teal-600' : 'text-gray-700 hover:bg-gray-50'}`}>
                  {opt.dot
                    ? <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />
                    : <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isSel ? 'bg-teal-400' : 'bg-gray-200'}`} />}
                  {ol}
                  {isSel && <CheckCircle2 size={12} className="ml-auto opacity-60 text-teal-500" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const mI    = 'w-full px-3.5 py-2.5 rounded-lg text-sm text-gray-800 bg-white placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all';
const mIopt = 'w-full px-3.5 py-2.5 rounded-lg text-sm text-gray-800 bg-gray-50 placeholder-gray-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10 focus:outline-none transition-all';
const mL    = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';
const mLopt = 'block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide';

const Field = ({ label, required, children }) => (
  <div>
    <label className={required ? mL : mLopt}>
      {label}
      {required && <span className="text-red-400 ml-0.5">*</span>}
      {!required && <span className="ml-1.5 text-[10px] font-normal text-gray-300 normal-case tracking-normal">(optional)</span>}
    </label>
    {children}
  </div>
);
const Row = ({ children }) => <div className="grid grid-cols-2 gap-3">{children}</div>;

// ─── ADD MEMBER MODAL ─────────────────────────────────────────────────────────
// step: 'basic' | 'choice' | 'details'
// detailTab: 'personal' | 'work' | 'bank'
const DETAIL_TABS = [
  { key: 'personal', label: ' Personal' },
  { key: 'work',     label: ' Work'     },
  { key: 'bank',     label: ' Bank'     },
];

const AddMemberModal = ({ data, onChange, onSave, onClose }) => {
  const [step,      setStep]      = useState('basic');   // basic | choice | details
  const [detailTab, setDetailTab] = useState('personal');
  const basicRef = useRef(null);

  const inp    = (f, t='text', ph='') => <input type={t} value={data[f]||''} onChange={e=>onChange(f,e.target.value)} placeholder={ph} className={mIopt} style={{border:`1px solid ${TL}`}} />;
  const inpReq = (f, t='text', ph='') => <input required type={t} value={data[f]||''} onChange={e=>onChange(f,e.target.value)} placeholder={ph} className={mI} style={{border:`1px solid ${TL}`}} />;
  const sel    = (f, opts, req=false) => (
    <select value={data[f]||opts[0]} onChange={e=>onChange(f,e.target.value)}
      className={req?mI:mIopt} style={{border:`1px solid ${TL}`}}>
      {opts.map(o=><option key={o}>{o}</option>)}
    </select>
  );

  const detailIdx = DETAIL_TABS.findIndex(t=>t.key===detailTab);

  // Step indicator dots
  const steps = ['basic','choice','details'];
  const stepIdx = steps.indexOf(step);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col" style={{ border:`1px solid ${TL}`, maxHeight:'92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom:`1px solid ${TL}` }}>
          <div>
            <h3 className="text-base font-bold text-gray-900">Add New Member</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {step==='basic'   && 'Enter basic information'}
              {step==='choice'  && 'Would you like to add more details now?'}
              {step==='details' && 'Fill optional details (can be skipped)'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xl flex-shrink-0">×</button>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-2 flex-shrink-0">
          {['Basic Info', 'Choose', 'Details'].map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all
                  ${i < stepIdx ? 'bg-teal-500 text-white' : i === stepIdx ? 'bg-teal-500 text-white ring-4 ring-teal-100' : 'bg-gray-100 text-gray-400'}`}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                <span className={`text-[11px] font-semibold hidden sm:block ${i === stepIdx ? 'text-teal-600' : i < stepIdx ? 'text-teal-400' : 'text-gray-300'}`}>{label}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${i < stepIdx ? 'bg-teal-400' : 'bg-gray-100'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── STEP 1: BASIC ── */}
        {step === 'basic' && (
          <form ref={basicRef} onSubmit={e => { e.preventDefault(); setStep('choice'); }}
            className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" style={{scrollbarWidth:'thin'}}>
              <Field label="Full Name" required>
                {inpReq('name','text','e.g. Ali Hassan')}
              </Field>
              <Row>
                <Field label="Role" required>{sel('role',ROLES,true)}</Field>
                <Field label="Status" required>{sel('status',['Active','Away','Inactive'],true)}</Field>
              </Row>
              <Field label="Email Address" required>
                {inpReq('email','email','ali@company.com')}
              </Field>
              <Field label="Phone Number" required>
                {inpReq('phone','tel','+92 300 0000000')}
              </Field>
            </div>
            <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{borderTop:`1px solid ${TL}`}}>
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-[#EEF2F7] hover:opacity-80"
                style={{border:`1px solid ${TL}`}}>Cancel</button>
              <button type="submit"
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow flex items-center justify-center gap-2">
                Next <ArrowRight size={15}/>
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 2: NOW / LATER CHOICE ── */}
        {step === 'choice' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-6 py-6 space-y-4 flex-1">

              {/* Member preview */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-teal-50 border border-teal-100">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-base font-bold flex-shrink-0">
                  {generateAvatar(data.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{data.name}</p>
                  <p className="text-xs text-gray-500 truncate">{data.role} · {data.email}</p>
                </div>
                <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${statusCfg[data.status]?.badge}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${statusCfg[data.status]?.dot}`}/>
                  {data.status}
                </span>
              </div>

              <p className="text-sm font-semibold text-gray-700 text-center">
                Member added ✓ — Do you want to fill additional details now?
              </p>

              {/* NOW option */}
              <button onClick={() => setStep('details')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-teal-400 bg-teal-50 hover:bg-teal-100 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-600 transition-colors">
                  <Zap size={18} className="text-white"/>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-teal-700">Add Details Now</p>
                  <p className="text-xs text-teal-500 mt-0.5">Fill Personal, Work & Bank info immediately</p>
                </div>
                <ArrowRight size={16} className="ml-auto text-teal-400 group-hover:text-teal-600 transition-colors"/>
              </button>

              {/* LATER option */}
              <button onClick={() => onSave(data)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-300 transition-colors">
                  <Clock size={18} className="text-gray-500"/>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-700">Do It Later</p>
                  <p className="text-xs text-gray-400 mt-0.5">Save with basic info only, complete profile later via Edit</p>
                </div>
                <CheckCircle2 size={16} className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors"/>
              </button>
            </div>

            <div className="px-6 pb-4 flex-shrink-0">
              <button onClick={() => setStep('basic')}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                ← Back to Basic Info
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: DETAILS (Personal / Work / Bank) ── */}
        {step === 'details' && (
          <div className="flex flex-col flex-1 min-h-0">

            {/* Sub-tabs */}
            <div className="flex border-b flex-shrink-0" style={{borderColor:TL}}>
              {DETAIL_TABS.map(tab => (
                <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                  className={`flex-1 py-2.5 text-[12px] font-semibold transition-all border-b-2
                    ${detailTab===tab.key
                      ? 'text-teal-600 border-teal-500 bg-teal-50/40'
                      : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Info note */}
            <div className="mx-6 mt-4 flex-shrink-0">
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
                <Info size={13} className="text-blue-400 flex-shrink-0"/>
                <p className="text-[11px] text-blue-600">All fields are optional — fill what's available now.</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5" style={{scrollbarWidth:'thin'}}>

              {/* Personal */}
              {detailTab === 'personal' && (
                <>
                  <Field label="Home Address">{inp('address','text','Street, City, Province')}</Field>
                  <Row>
                    <Field label="Date of Birth">{inp('dob','date')}</Field>
                    <Field label="CNIC">{inp('cnic','text','00000-0000000-0')}</Field>
                  </Row>
                  <Field label="Emergency Contact">{inp('emergencyContact','text','Name – +92 300 0000000')}</Field>
                </>
              )}

              {/* Work */}
              {detailTab === 'work' && (
                <>
                  <Row>
                    <Field label="Department">{inp('department','text','e.g. Engineering')}</Field>
                    <Field label="Employee ID">{inp('employeeId','text','EMP-001')}</Field>
                  </Row>
                  <Row>
                    <Field label="Joining Date">{inp('joiningDate','date')}</Field>
                    <Field label="Employment Type">{inp('employmentType')}</Field>
                  </Row>
                  <Row>
                    <Field label="Work Location">{inp('workLocation','text','Office / Remote')}</Field>
                    <Field label="Manager">{inp('manager','text','Manager name')}</Field>
                  </Row>
                  <Field label="Monthly Salary (PKR)">{inp('salary','number','0')}</Field>
                </>
              )}

              {/* Bank */}
              {detailTab === 'bank' && (
                <>
                  <Row>
                    <Field label="Bank Name">{inp('bankName','text','e.g. HBL, MCB')}</Field>
                    <Field label="Payment Method">{inp('paymentMethod')}</Field>
                  </Row>
                  <Field label="Account Title">{inp('accountTitle','text','Full name on account')}</Field>
                  <Field label="Account Number">{inp('accountNumber','text','0000000000000000')}</Field>
                  <Field label="IBAN">{inp('iban','text','PK00XXXX0000000000000000')}</Field>
                  <Row>
                    <Field label="Branch Code">{inp('branchCode','text','0000')}</Field>
                    <Field label="Branch Name">{inp('branchName','text','e.g. Gulberg')}</Field>
                  </Row>
                  <Row>
                    <Field label="Allowances (PKR)">{inp('allowances','number','0')}</Field>
                    <Field label="Pay Cycle">{inp('payCycle')}</Field>
                  </Row>
                  <Field label="Tax ID / NTN">{inp('ntn','text','NTN or Tax number')}</Field>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex-shrink-0 space-y-2" style={{borderTop:`1px solid ${TL}`}}>
              {/* Tab dots + prev/next */}
              <div className="flex items-center gap-2">
                {detailIdx > 0 && (
                  <button type="button" onClick={() => setDetailTab(DETAIL_TABS[detailIdx-1].key)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 flex-shrink-0">
                    ← Prev
                  </button>
                )}
                <div className="flex items-center gap-1.5 flex-1 justify-center">
                  {DETAIL_TABS.map(t=>(
                    <button key={t.key} type="button" onClick={()=>setDetailTab(t.key)}
                      className={`rounded-full transition-all ${detailTab===t.key?'w-5 h-2 bg-teal-500':'w-2 h-2 bg-gray-200 hover:bg-gray-300'}`}/>
                  ))}
                </div>
                {detailIdx < DETAIL_TABS.length - 1 && (
                  <button type="button" onClick={() => setDetailTab(DETAIL_TABS[detailIdx+1].key)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-200 hover:bg-teal-100 flex-shrink-0">
                    Next →
                  </button>
                )}
              </div>
              {/* Save */}
              <button onClick={() => onSave(data)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow">
                Save Member ✓
              </button>
              <button onClick={() => setStep('choice')}
                className="w-full py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                ← Back
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// ─── EDIT MEMBER MODAL ────────────────────────────────────────────────────────
const EDIT_TABS = [
  { key: 'basic',    label: ' Basic',    required: true  },
  { key: 'personal', label: ' Personal', required: false },
  { key: 'work',     label: ' Work',     required: false },
  { key: 'bank',     label: ' Bank',     required: false },
];

const EditMemberModal = ({ memberName, data, onChange, onSubmit, onClose, onDeleteClick }) => {
  const [activeTab, setActiveTab] = useState('basic');

  const inp    = (f,t='text',ph='') => <input type={t} value={data[f]||''} onChange={e=>onChange(f,e.target.value)} placeholder={ph} className={mIopt} style={{border:`1px solid ${TL}`}}/>;
  const inpReq = (f,t='text',ph='') => <input required type={t} value={data[f]||''} onChange={e=>onChange(f,e.target.value)} placeholder={ph} className={mI} style={{border:`1px solid ${TL}`}}/>;
  const sel    = (f,opts,req=false) => (
    <select value={data[f]||opts[0]} onChange={e=>onChange(f,e.target.value)}
      className={req?mI:mIopt} style={{border:`1px solid ${TL}`}}>
      {opts.map(o=><option key={o}>{o}</option>)}
    </select>
  );

  const completion = getCompletion(data);
  const tabIdx = EDIT_TABS.findIndex(t=>t.key===activeTab);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col" style={{border:`1px solid ${TL}`,maxHeight:'92vh'}}>

        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${TL}`}}>
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-base font-bold text-gray-900 truncate">Edit — {memberName}</h3>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all duration-500"
                  style={{width:`${completion}%`}}/>
              </div>
              <span className={`text-[11px] font-bold ${completion===100?'text-teal-500':completion>=50?'text-amber-500':'text-gray-400'}`}>
                {completion}% complete
              </span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xl flex-shrink-0">×</button>
        </div>

        <div className="flex border-b flex-shrink-0 overflow-x-auto" style={{borderColor:TL,scrollbarWidth:'none'}}>
          {EDIT_TABS.map(tab=>(
            <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-[11px] font-semibold transition-all border-b-2 whitespace-nowrap min-w-[80px]
                ${activeTab===tab.key
                  ?'text-teal-600 border-teal-500 bg-teal-50/40'
                  :'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'}`}>
              {tab.label}
              {!tab.required&&<span className="ml-1 text-[9px] text-gray-300 font-normal">opt</span>}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3.5" style={{scrollbarWidth:'thin'}}>

            {activeTab==='basic'&&(
              <>
                <Field label="Full Name" required>{inpReq('name','text','e.g. Ali Hassan')}</Field>
                <Row>
                  <Field label="Role" required>{sel('role',ROLES,true)}</Field>
                  <Field label="Status" required>{sel('status',['Active','Away','Inactive'],true)}</Field>
                </Row>
                <Field label="Email Address" required>{inpReq('email','email','ali@company.com')}</Field>
                <Field label="Phone Number" required>{inpReq('phone','tel','+92 300 0000000')}</Field>
              </>
            )}
            {activeTab==='personal'&&(
              <>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <Info size={13} className="text-blue-400 flex-shrink-0"/>
                  <p className="text-[11px] text-blue-600">All fields optional — fill what's available.</p>
                </div>
                <Field label="Home Address">{inp('address','text','Street, City, Province')}</Field>
                <Row>
                  <Field label="Date of Birth">{inp('dob','date')}</Field>
                  <Field label="CNIC">{inp('cnic','text','00000-0000000-0')}</Field>
                </Row>
                <Field label="Emergency Contact">{inp('emergencyContact','text','Name – +92 300 0000000')}</Field>
              </>
            )}
            {activeTab==='work'&&(
              <>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <Info size={13} className="text-blue-400 flex-shrink-0"/>
                  <p className="text-[11px] text-blue-600">All fields optional — fill what's available.</p>
                </div>
                <Row>
                  <Field label="Department">{inp('department','text','e.g. Engineering')}</Field>
                  <Field label="Employee ID">{inp('employeeId','text','EMP-001')}</Field>
                </Row>
                <Row>
                  <Field label="Joining Date">{inp('joiningDate','date')}</Field>
                  <Field label="Employment Type">{sel('employmentType',EMPLOYMENT_TYPES)}</Field>
                </Row>
                <Row>
                  <Field label="Work Location">{inp('workLocation','text','Office / Remote')}</Field>
                  <Field label="Manager">{inp('manager','text','Manager name')}</Field>
                </Row>
                <Field label="Monthly Salary (PKR)">{inp('salary','number','0')}</Field>
              </>
            )}
            {activeTab==='bank'&&(
              <>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <Info size={13} className="text-blue-400 flex-shrink-0"/>
                  <p className="text-[11px] text-blue-600">All fields optional — fill what's available.</p>
                </div>
                <Row>
                  <Field label="Bank Name">{inp('bankName','text','e.g. HBL, MCB')}</Field>
                  <Field label="Payment Method">{sel('paymentMethod',PAYMENT_METHODS)}</Field>
                </Row>
                <Field label="Account Title">{inp('accountTitle','text','Full name on account')}</Field>
                <Field label="Account Number">{inp('accountNumber','text','0000000000000000')}</Field>
                <Field label="IBAN">{inp('iban','text','PK00XXXX0000000000000000')}</Field>
                <Row>
                  <Field label="Branch Code">{inp('branchCode','text','0000')}</Field>
                  <Field label="Branch Name">{inp('branchName','text','e.g. Gulberg')}</Field>
                </Row>
                <Row>
                  <Field label="Allowances (PKR)">{inp('allowances','number','0')}</Field>
                  <Field label="Pay Cycle">{sel('payCycle',['Monthly','Bi-Monthly','Weekly'])}</Field>
                </Row>
                <Field label="Tax ID / NTN">{inp('ntn','text','NTN or Tax number')}</Field>
              </>
            )}
          </div>

          <div className="px-6 py-4 flex-shrink-0 space-y-3" style={{borderTop:`1px solid ${TL}`}}>
            <div className="flex items-center gap-2">
              {tabIdx>0&&(
                <button type="button" onClick={()=>setActiveTab(EDIT_TABS[tabIdx-1].key)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 bg-[#EEF2F7] hover:opacity-80 flex-shrink-0"
                  style={{border:`1px solid ${TL}`}}>← Prev</button>
              )}
              <div className="flex items-center gap-1.5 flex-1 justify-center">
                {EDIT_TABS.map(t=>(
                  <button key={t.key} type="button" onClick={()=>setActiveTab(t.key)}
                    className={`rounded-full transition-all ${activeTab===t.key?'w-5 h-2 bg-teal-500':'w-2 h-2 bg-gray-200 hover:bg-gray-300'}`}/>
                ))}
              </div>
              {tabIdx<EDIT_TABS.length-1&&(
                <button type="button" onClick={()=>setActiveTab(EDIT_TABS[tabIdx+1].key)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-200 hover:bg-teal-100 flex-shrink-0">
                  Next →
                </button>
              )}
              <button type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow flex-shrink-0">
                Save ✓
              </button>
            </div>
            <button type="button" onClick={onDeleteClick}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100">
              <Trash2 size={12}/> Remove this member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
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
  const [newTask,      setNewTask]      = useState({ title:'', description:'', priority:'Medium', dueDate:'', status:'Pending' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [openMenuId,    setOpenMenuId]    = useState(null);
  const [menuPos,       setMenuPos]       = useState({ top:0, right:0 });
  const menuRef = useRef(null);
  const [openTaskDropdown, setOpenTaskDropdown] = useState(null);
  const taskDropdownRef = useRef(null);
  const [newMember,  setNewMember]  = useState(emptyMember());
  const [editMember, setEditMember] = useState(emptyMember());
  const dragItem     = useRef(null);
  const dragOverItem = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  useEffect(() => {
    const q = query(collection(db,'teamMembers'), orderBy('createdAt','desc'));
    const unsub = onSnapshot(q, snap => {
      setMembers(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    }, err=>{ console.error(err); setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (selected) {
      const fresh = members.find(m=>m.id===selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [members]);

  useEffect(() => {
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => {
    const h = e => { if (taskDropdownRef.current && !taskDropdownRef.current.contains(e.target)) setOpenTaskDropdown(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = members.filter(m => {
    const s = searchTerm.toLowerCase();
    return (m.name?.toLowerCase().includes(s)||m.email?.toLowerCase().includes(s)||m.role?.toLowerCase().includes(s))
      && (filterRole==='all'||m.role===filterRole)
      && (filterStatus==='all'||m.status===filterStatus);
  });

  const handleDragStart = (e,idx)=>{ dragItem.current=idx; e.dataTransfer.effectAllowed='move'; setTimeout(()=>{if(e.target)e.target.style.opacity='0.4';},0); };
  const handleDragEnter = (e,idx)=>{ e.preventDefault(); dragOverItem.current=idx; setDragOverIdx(idx); };
  const handleDragOver  = (e,idx)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; dragOverItem.current=idx; setDragOverIdx(idx); };
  const handleDrop      = (e,idx)=>{ e.preventDefault(); setDragOverIdx(null); dragItem.current=null; dragOverItem.current=null; };
  const handleDragEnd   = e=>{ if(e.target)e.target.style.opacity='1'; dragItem.current=null; dragOverItem.current=null; setDragOverIdx(null); };

  // Save new member (called from AddMemberModal whether Now or Later)
  const handleSaveMember = async (data) => {
    try {
      await addDoc(collection(db,'teamMembers'), {
        name:data.name, role:data.role, email:data.email, phone:data.phone, status:data.status,
        address:data.address||'', dob:data.dob||'', cnic:data.cnic||'', emergencyContact:data.emergencyContact||'',
        department:data.department||'', employeeId:data.employeeId||'', joiningDate:data.joiningDate||'',
        employmentType:data.employmentType||'Full-Time', workLocation:data.workLocation||'',
        manager:data.manager||'', salary:data.salary?Number(data.salary):'',
        bankName:data.bankName||'', accountNumber:data.accountNumber||'', accountTitle:data.accountTitle||'',
        iban:data.iban||'', branchCode:data.branchCode||'', branchName:data.branchName||'',
        paymentMethod:data.paymentMethod||'Bank Transfer', allowances:data.allowances?Number(data.allowances):'',
        payCycle:data.payCycle||'Monthly', ntn:data.ntn||'',
        projects:0, avatar:generateAvatar(data.name), joinDate:getCurrentMonthYear(),
        tasks:[], createdAt:serverTimestamp(),
      });
      setNewMember(emptyMember());
      setShowAddMemberModal(false);
    } catch(err){ console.error(err); alert('Error adding member'); }
  };

  const handleUpdateSubmit = async e => {
    e.preventDefault();
    try {
      const d = editMember;
      await updateDoc(doc(db,'teamMembers',selected.id), {
        name:d.name, role:d.role, email:d.email, phone:d.phone, status:d.status,
        address:d.address||'', dob:d.dob||'', cnic:d.cnic||'', emergencyContact:d.emergencyContact||'',
        department:d.department||'', employeeId:d.employeeId||'', joiningDate:d.joiningDate||'',
        employmentType:d.employmentType||'Full-Time', workLocation:d.workLocation||'',
        manager:d.manager||'', salary:d.salary?Number(d.salary):'',
        bankName:d.bankName||'', accountNumber:d.accountNumber||'', accountTitle:d.accountTitle||'',
        iban:d.iban||'', branchCode:d.branchCode||'', branchName:d.branchName||'',
        paymentMethod:d.paymentMethod||'Bank Transfer', allowances:d.allowances?Number(d.allowances):'',
        payCycle:d.payCycle||'Monthly', ntn:d.ntn||'',
        avatar:generateAvatar(d.name),
      });
      setShowEditModal(false);
    } catch(err){ console.error(err); alert('Error updating'); }
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db,'teamMembers',deleteTarget.id));
      if(selected?.id===deleteTarget.id){ setSelected(null); setShowDrawer(false); }
      setDeleteTarget(null);
    } catch{ alert('Error deleting'); }
  };

  const addTask = async e => {
    e.preventDefault(); if(!selected) return;
    await updateDoc(doc(db,'teamMembers',selected.id), {
      tasks:[...(selected.tasks||[]),{id:`t${Date.now()}`,...newTask}],
      projects:(selected.projects||0)+1,
    });
    setNewTask({title:'',description:'',priority:'Medium',dueDate:'',status:'Pending'});
    setShowAddTask(false);
  };

  const cycleTaskStatus = async (memberId, taskId) => {
    const member = members.find(m=>m.id===memberId); if(!member) return;
    const cycle = {'Pending':'In Progress','In Progress':'Done','Done':'Pending'};
    await updateDoc(doc(db,'teamMembers',memberId), {
      tasks:(member.tasks||[]).map(t=>t.id===taskId?{...t,status:cycle[t.status]||'Pending'}:t)
    });
  };
  const setTaskStatus = async (memberId, taskId, newStatus) => {
    const member = members.find(m=>m.id===memberId); if(!member) return;
    await updateDoc(doc(db,'teamMembers',memberId), {
      tasks:(member.tasks||[]).map(t=>t.id===taskId?{...t,status:newStatus}:t)
    });
    setOpenTaskDropdown(null);
  };
  const deleteTask = async (memberId, taskId) => {
    const member = members.find(m=>m.id===memberId); if(!member) return;
    await updateDoc(doc(db,'teamMembers',memberId), {
      tasks:(member.tasks||[]).filter(t=>t.id!==taskId),
      projects:Math.max(0,(member.projects||1)-1),
    });
  };
  const getLatestTask = m => { const t=m.tasks||[]; if(!t.length) return null; return t.find(x=>x.status!=='Done')||t[t.length-1]; };

  const openEditModal = m => {
    setSelected(m);
    setEditMember({
      name:m.name||'', role:m.role||'Frontend Developer', email:m.email||'', phone:m.phone||'', status:m.status||'Active',
      address:m.address||'', dob:m.dob||'', cnic:m.cnic||'', emergencyContact:m.emergencyContact||'',
      department:m.department||'', employeeId:m.employeeId||'', joiningDate:m.joiningDate||'',
      employmentType:m.employmentType||'Full-Time', workLocation:m.workLocation||'', manager:m.manager||'', salary:m.salary||'',
      bankName:m.bankName||'', accountNumber:m.accountNumber||'', accountTitle:m.accountTitle||'',
      iban:m.iban||'', branchCode:m.branchCode||'', branchName:m.branchName||'',
      paymentMethod:m.paymentMethod||'Bank Transfer', allowances:m.allowances||'', payCycle:m.payCycle||'Monthly', ntn:m.ntn||'',
    });
    setShowEditModal(true);
  };

  const cols = [
    {label:'#',w:'44px'},{label:'Member',w:'200px'},{label:'Role',w:'160px'},
    {label:'Tasks',w:'70px'},{label:'Status',w:'110px'},{label:'Priority',w:'100px'},
    {label:'Task Status',w:'140px'},{label:'Description',w:'190px'},{label:'Due Date',w:'100px'},
    {label:'',w:'48px'},{label:'',w:'48px'},
  ];
  const roleOptions   = ROLES.map(r=>({value:r,label:r}));
  const statusOptions = [{value:'Active',label:'Active',dot:'bg-emerald-500'},{value:'Away',label:'Away',dot:'bg-amber-400'},{value:'Inactive',label:'Inactive',dot:'bg-gray-400'}];

  if (loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin mx-auto mb-4"/>
        <p className="text-gray-500 font-medium">Loading team members...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <div className="h-[15px]"/>

      {/* Filter bar */}
      <div className="px-4 md:px-8 pb-4 flex flex-wrap items-center gap-3 max-w-[1600px] mx-auto">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input type="text" placeholder="Search by name, email, role..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border text-sm text-gray-700 placeholder-gray-400 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all"
            style={{border:`1px solid ${TL}`}}/>
        </div>
        <CustomDropdown value={filterRole}   onChange={setFilterRole}   options={roleOptions}   placeholder="All Roles"/>
        <CustomDropdown value={filterStatus} onChange={setFilterStatus} options={statusOptions} placeholder="All Status"/>
        <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} member{filtered.length!==1?'s':''}</span>
      </div>

      {/* Table */}
      <div className="px-4 md:px-8 pb-8 max-w-[1600px] mx-auto">
        <div className="bg-white rounded-2xl shadow-sm w-full" style={{border:`1px solid ${TL}`,overflow:'hidden'}}>
          <div className="team-scroll-container" style={{overflowX:'auto',overflowY:'auto',maxHeight:'calc(100vh - 210px)',WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}>
            <style>{`.team-scroll-container::-webkit-scrollbar{height:6px;width:6px}.team-scroll-container::-webkit-scrollbar-track{background:rgba(238,242,247,0.9);border-radius:999px}.team-scroll-container::-webkit-scrollbar-thumb{background:rgba(20,184,166,0.55);border-radius:999px}.team-scroll-container::-webkit-scrollbar-thumb:hover{background:rgba(20,184,166,0.85)}`}</style>
            <table className="border-collapse" style={{tableLayout:'fixed',minWidth:'1210px',width:'100%'}}>
              <colgroup>{cols.map((c,i)=><col key={i} style={{width:c.w}}/>)}</colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EEF2F7]" style={{borderBottom:`2px solid ${TLB}`}}>
                  {cols.map((col,i)=>(
                    <th key={i} className="py-3.5 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider select-none whitespace-nowrap text-center"
                      style={{borderRight:i<cols.length-1?`1px solid ${TL}`:undefined}}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0&&(
                  <tr><td colSpan={cols.length} className="py-20 text-center">
                    <div className="text-4xl mb-3">👥</div>
                    <p className="text-gray-400 text-sm">No team members found.</p>
                  </td></tr>
                )}
                {filtered.map((member,idx)=>{
                  const latestTask = getLatestTask(member);
                  const taskCount  = (member.tasks||[]).length;
                  const isDragOver = dragOverIdx===idx && dragItem.current!==idx;
                  const sCfg  = statusCfg[member.status]||statusCfg.Active;
                  const pCfg  = priorityCfg[latestTask?.priority]||priorityCfg.Medium;
                  const tsCfg = taskStatusCfg[latestTask?.status]||taskStatusCfg['Pending'];
                  const dropKey    = `${member.id}__${latestTask?.id}`;
                  const isDropOpen = openTaskDropdown===dropKey;
                  const comp = getCompletion(member);

                  const tdStyle = ci=>({
                    height:'62px',padding:0,verticalAlign:'middle',
                    borderRight:ci<cols.length-1?`1px solid ${TL}`:undefined,
                    borderBottom:`1px solid ${TL}`,
                    outline:isDragOver?'2px solid #14b8a6':undefined,outlineOffset:'-2px',
                    position:ci===6?'relative':undefined,overflow:ci===6?'visible':undefined,
                  });
                  const inner = (j='flex-start')=>({display:'flex',alignItems:'center',justifyContent:j,height:'100%',padding:'0 12px',overflow:'hidden'});

                  return (
                    <tr key={member.id} draggable
                      onDragStart={e=>handleDragStart(e,idx)} onDragEnter={e=>handleDragEnter(e,idx)}
                      onDragOver={e=>handleDragOver(e,idx)} onDrop={e=>handleDrop(e,idx)} onDragEnd={handleDragEnd}
                      className={`${idx%2===0?'bg-white':''} transition-colors duration-100`}>
                      <td style={{...tdStyle(0),cursor:'grab'}}><div style={inner('center')}><span className="text-xs font-bold font-mono text-gray-300">{idx+1}</span></div></td>
                      <td style={tdStyle(1)}>
                        <div style={inner()}>
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="relative flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                                {member.avatar||generateAvatar(member.name)}
                              </div>
                              {comp<50&&<span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white" title={`Profile ${comp}% complete`}/>}
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-[14px] font-semibold text-gray-900 truncate">{member.name}</p>
                              <p className="text-[11px] text-gray-400 truncate">{member.email}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle(2)}><div style={inner()}><span className="text-[13px] text-gray-600 truncate">{member.role}</span></div></td>
                      <td style={tdStyle(3)}><div style={inner('center')}><span className={`text-[13px] font-bold font-mono ${taskCount>0?'text-teal-600':'text-gray-300'}`}>{taskCount}</span></div></td>
                      <td style={tdStyle(4)}>
                        <div style={inner('center')}>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${sCfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sCfg.dot}`}/>{member.status}
                          </span>
                        </div>
                      </td>
                      <td style={tdStyle(5)}>
                        <div style={inner('center')}>
                          {latestTask
                            ?<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${pCfg.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pCfg.dot}`}/>{latestTask.priority}
                            </span>
                            :<span className="text-gray-300 text-[12px]">—</span>}
                        </div>
                      </td>
                      <td style={tdStyle(6)}>
                        <div style={{...inner('center'),overflow:'visible'}}>
                          {latestTask?(
                            <div className="relative" ref={isDropOpen?taskDropdownRef:null}>
                              <button onClick={e=>{e.stopPropagation();setOpenTaskDropdown(isDropOpen?null:dropKey);}}
                                className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[12px] font-semibold border whitespace-nowrap transition-all hover:opacity-80 active:scale-95 ${tsCfg.bg} ${tsCfg.color} ${tsCfg.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tsCfg.dot}`}/>
                                {latestTask.status}
                                {isDropOpen?<ChevronUp size={10} className="opacity-50 ml-0.5"/>:<ChevronDown size={10} className="opacity-50 ml-0.5"/>}
                              </button>
                              {isDropOpen&&(
                                <div onClick={e=>e.stopPropagation()}
                                  className="absolute left-1/2 -translate-x-1/2 z-[9999] bg-white rounded-xl overflow-hidden"
                                  style={{top:'calc(100% + 8px)',minWidth:'156px',border:`1px solid ${TL}`,boxShadow:'0 10px 30px rgba(0,0,0,0.14)'}}>
                                  <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rotate-45 border-l border-t border-gray-200"/>
                                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-2.5 pb-1.5">Change Status</p>
                                  {TASK_STATUSES.map(s=>{
                                    const cfg=taskStatusCfg[s]; const isAct=latestTask.status===s;
                                    return(
                                      <button key={s} onClick={()=>setTaskStatus(member.id,latestTask.id,s)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium transition-colors ${isAct?`${cfg.bg} ${cfg.color}`:'text-gray-700 hover:bg-gray-50'}`}>
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`}/>{s}
                                        {isAct&&<CheckCircle2 size={12} className="ml-auto opacity-60"/>}
                                      </button>
                                    );
                                  })}
                                  <div className="h-1.5"/>
                                </div>
                              )}
                            </div>
                          ):<span className="text-gray-300 text-[12px]">—</span>}
                        </div>
                      </td>
                      <td style={tdStyle(7)}>
                        <div style={inner()}>
                          {latestTask
                            ?<div className="overflow-hidden"><p className="text-[12px] font-medium text-gray-700 truncate">{latestTask.title}</p>{latestTask.description&&<p className="text-[11px] text-gray-400 truncate">{latestTask.description}</p>}</div>
                            :<span className="text-gray-300 text-[12px]">No tasks</span>}
                        </div>
                      </td>
                      <td style={tdStyle(8)}><div style={inner('center')}><span className="text-[12px] font-mono text-gray-600 whitespace-nowrap">{latestTask?.dueDate||'—'}</span></div></td>
                      <td style={tdStyle(9)}>
                        <div className="flex items-center justify-center h-full">
                          <button onClick={()=>{setSelected(member);setShowDrawer(true);}} className="w-7 h-7 flex items-center justify-center rounded-lg text-teal-500 hover:bg-teal-50 transition-colors"><Eye size={15}/></button>
                        </div>
                      </td>
                      <td style={{...tdStyle(10),borderRight:undefined}}>
                        <div className="flex items-center justify-center h-full">
                          <button onClick={e=>{
                            e.stopPropagation();
                            if(openMenuId===member.id){setOpenMenuId(null);return;}
                            const rect=e.currentTarget.getBoundingClientRect();
                            setMenuPos({top:rect.bottom+6,right:window.innerWidth-rect.right});
                            setOpenMenuId(member.id);
                          }} className={`w-7 h-7 rounded-lg flex flex-col items-center justify-center gap-[3px] transition-all ${openMenuId===member.id?'bg-[#EEF2F7]':'hover:bg-[#EEF2F7]'}`}>
                            {[0,1,2].map(i=><span key={i} className={`w-1 h-1 rounded-full block ${openMenuId===member.id?'bg-gray-600':'bg-gray-300'}`}/>)}
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

      {/* 3-dot menu */}
      {openMenuId&&(
        <div ref={menuRef} onClick={e=>e.stopPropagation()}
          className="fixed z-[9999] bg-white rounded-xl overflow-hidden p-1"
          style={{top:menuPos.top,right:menuPos.right,minWidth:'165px',border:`1px solid ${TL}`,boxShadow:'0 10px 30px rgba(0,0,0,0.15)'}}>
          <button onClick={()=>{const m=members.find(x=>x.id===openMenuId);setOpenMenuId(null);if(m)openEditModal(m);}}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">✏️ Edit Member</button>
          <button onClick={()=>{const m=members.find(x=>x.id===openMenuId);setOpenMenuId(null);if(m)setDeleteTarget(m);}}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} strokeWidth={2}/> Delete Member</button>
        </div>
      )}

      {/* Detail Drawer */}
      {showDrawer&&selected&&(
        <div className="fixed inset-0 z-[100]" onClick={()=>{setShowDrawer(false);setShowAddTask(false);}}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"/>
          <div className="absolute right-0 top-0 bottom-0 bg-white flex flex-col shadow-2xl w-full sm:w-[520px]" style={{borderLeft:`1px solid ${TL}`}} onClick={e=>e.stopPropagation()}>
            <div className="flex items-start justify-between px-7 pt-7 pb-5 flex-shrink-0" style={{borderBottom:`1px solid ${TL}`}}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {selected.avatar||generateAvatar(selected.name)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{selected.name}</h2>
                  <p className="text-sm text-teal-600 font-medium mt-0.5">{selected.role}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusCfg[selected.status]?.badge||statusCfg.Active.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg[selected.status]?.dot||'bg-emerald-500'}`}/>{selected.status}
                    </span>
                    <span className="text-[11px] text-gray-400">Since {selected.joinDate}</span>
                  </div>
                </div>
              </div>
              <button onClick={()=>{setShowDrawer(false);setShowAddTask(false);}} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all text-xl">×</button>
            </div>

            {/* Completion banner */}
            {(()=>{
              const comp=getCompletion(selected);
              if(comp===100) return null;
              return(
                <div className="mx-7 mt-4 px-4 py-3 rounded-xl flex items-center gap-3"
                  style={{background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.2)'}}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-amber-600">Profile {comp}% complete</span>
                      <button onClick={()=>openEditModal(selected)} className="text-[11px] font-bold text-teal-600 hover:text-teal-700">+ Complete Profile</button>
                    </div>
                    <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all" style={{width:`${comp}%`}}/>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="px-7 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${TL}`,marginTop:getCompletion(selected)===100?0:12}}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Info</h3>
              <div className="grid grid-cols-2 gap-3">
                {[{label:'Email',value:selected.email},{label:'Phone',value:selected.phone},{label:'Projects',value:selected.projects||0},{label:'Tasks',value:(selected.tasks||[]).length}]
                  .map(({label,value})=>(
                    <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                      <p className="text-[11px] text-gray-400 font-medium mb-1">{label}</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{value||'—'}</p>
                    </div>
                  ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.department&&<span className="text-[11px] px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-100 font-medium"> {selected.department}</span>}
                {selected.workLocation&&<span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium"> {selected.workLocation}</span>}
                {selected.employmentType&&<span className="text-[11px] px-2.5 py-1 rounded-full bg-teal-50 text-teal-600 border border-teal-100 font-medium"> {selected.employmentType}</span>}
                {selected.salary&&<span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 font-medium"> PKR {selected.salary}</span>}
                {selected.joiningDate&&<span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-100 font-medium"> {selected.joiningDate}</span>}
                {selected.bankName&&<span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 font-medium">
                  
                   {selected.bankName}</span>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-5" style={{scrollbarWidth:'thin'}}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tasks ({(selected.tasks||[]).length})</h3>
                <button onClick={()=>setShowAddTask(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors">
                  <Plus size={12}/> Add Task
                </button>
              </div>
              {showAddTask&&(
                <form onSubmit={addTask} className="mb-4 p-4 rounded-xl bg-teal-50/60 border border-teal-200 space-y-3">
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider">New Task</p>
                  <input required value={newTask.title} onChange={e=>setNewTask(p=>({...p,title:e.target.value}))} placeholder="Task title *" className={mI} style={{border:`1px solid ${TL}`}}/>
                  <textarea value={newTask.description} onChange={e=>setNewTask(p=>({...p,description:e.target.value}))} placeholder="Description (optional)" rows={2} className={`${mI} resize-none`} style={{border:`1px solid ${TL}`}}/>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                      <select value={newTask.priority} onChange={e=>setNewTask(p=>({...p,priority:e.target.value}))} className={mI} style={{border:`1px solid ${TL}`}}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                      <select value={newTask.status} onChange={e=>setNewTask(p=>({...p,status:e.target.value}))} className={mI} style={{border:`1px solid ${TL}`}}><option>Pending</option><option>In Progress</option><option>Done</option></select></div>
                  </div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Due Date *</label>
                    <input required type="date" value={newTask.dueDate} onChange={e=>setNewTask(p=>({...p,dueDate:e.target.value}))} className={mI} style={{border:`1px solid ${TL}`}}/></div>
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>setShowAddTask(false)} className="flex-1 py-2.5 rounded-lg text-xs font-semibold text-gray-600 bg-white border hover:bg-gray-50" style={{border:`1px solid ${TL}`}}>Cancel</button>
                    <button type="submit" className="flex-1 py-2.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600">Add Task</button>
                  </div>
                </form>
              )}
              {(!selected.tasks||selected.tasks.length===0)&&!showAddTask&&(
                <div className="text-center py-12"><div className="text-3xl mb-2">📋</div><p className="text-sm text-gray-400">No tasks yet. Add one above.</p></div>
              )}
              <div className="space-y-2.5">
                {(selected.tasks||[]).map(task=>{
                  const pCfg=priorityCfg[task.priority]||priorityCfg.Medium;
                  return(
                    <div key={task.id} className="p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100/70 transition-colors group" style={{border:`1px solid ${TL}`}}>
                      <div className="flex items-start gap-3">
                        <button onClick={()=>cycleTaskStatus(selected.id,task.id)} className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110">{taskStatusIcon(task.status)}</button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={`text-[13px] font-semibold ${task.status==='Done'?'line-through text-gray-400':'text-gray-800'}`}>{task.title}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${pCfg.badge}`}><span className={`w-1 h-1 rounded-full ${pCfg.dot}`}/>{task.priority}</span>
                          </div>
                          {task.description&&<p className="text-[11px] text-gray-400 mt-0.5 truncate">{task.description}</p>}
                          <p className="text-[11px] text-gray-400 font-mono mt-1">📅 {task.dueDate||'—'}</p>
                        </div>
                        <button onClick={()=>deleteTask(selected.id,task.id)} className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0 mt-0.5"><Trash2 size={12}/></button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2.5 pl-7">
                        {TASK_STATUSES.map(s=>{
                          const cfg=taskStatusCfg[s]; const isAct=task.status===s;
                          return(<button key={s} onClick={()=>setTaskStatus(selected.id,task.id,s)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${isAct?`${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm`:'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50'}`}>
                            {s==='In Progress'?'In Prog.':s}
                          </button>);
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

      {/* Add Member Modal */}
      {showAddMemberModal&&(
        <AddMemberModal
          data={newMember}
          onChange={(f,v)=>setNewMember(p=>({...p,[f]:v}))}
          onSave={handleSaveMember}
          onClose={()=>{setShowAddMemberModal(false);setNewMember(emptyMember());}}
        />
      )}

      {/* Edit Member Modal */}
      {showEditModal&&selected&&(
        <EditMemberModal
          memberName={selected.name}
          data={editMember}
          onChange={(f,v)=>setEditMember(p=>({...p,[f]:v}))}
          onSubmit={handleUpdateSubmit}
          onClose={()=>setShowEditModal(false)}
          onDeleteClick={()=>{setShowEditModal(false);setDeleteTarget(selected);}}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget&&(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden" style={{border:`1px solid ${TL}`}}>
            <div className="h-1 bg-gradient-to-r from-red-400 to-red-500"/>
            <div className="p-7">
              <div className="w-[48px] h-[48px] rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-5"><Trash2 size={22} className="text-red-500" strokeWidth={1.8}/></div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Member?</h3>
              <p className="text-sm text-gray-500 mb-4">This will permanently remove the member and all their tasks.</p>
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-6">
                <span className="text-sm font-semibold text-red-600">"{deleteTarget.name}"</span>
                <span className="text-xs text-gray-400 ml-2">will be permanently deleted</span>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setDeleteTarget(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-[#EEF2F7] hover:bg-slate-200" style={{border:`1px solid ${TL}`}}>Cancel</button>
                <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-red-400 to-red-500 hover:opacity-90 shadow-lg shadow-red-100">Yes, Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamMembers;