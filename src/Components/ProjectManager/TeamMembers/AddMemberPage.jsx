// ─────────────────────────────────────────────────────────────────────────────
//  AddMemberPage.jsx  —  Full-page Add Member (route: /team/add)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, addDoc, serverTimestamp, setDoc, doc
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  ArrowLeft, ArrowRight, SkipForward,
  Upload, Plus, Trash2, Eye, X,
  File, FileText, FileImage, FileVideo,
  Music, Archive, Image,
  CheckSquare, Minus,
  Copy, Mail, Info,
  CheckCircle2,
} from 'lucide-react';
import { BsWhatsapp } from 'react-icons/bs';

// ─── Constants ────────────────────────────────────────────────────────────────
const TL = 'rgba(51,51,51,0.20)';

const ROLES = [
  'Frontend Developer', 'Backend Developer', 'Flutter Developer',
  'UI/UX Designer', 'Project Manager', 'QA Engineer',
  'Marketing Manager', 'Content Writer', 'DevOps Engineer',
];
const EMPLOYMENT_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Freelance'];
const PAYMENT_METHODS  = ['Bank Transfer', 'Cash', 'Cheque', 'JazzCash', 'EasyPaisa'];
const DOC_ACCEPT       = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar';
const MEDIA_ACCEPT     = 'image/*,video/*,audio/*';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateAvatar = name => {
  const w = (name || '').trim().split(' ');
  return w.length >= 2
    ? (w[0][0] + w[1][0]).toUpperCase()
    : (name || '??').substring(0, 2).toUpperCase();
};
const getCurrentMonthYear = () => {
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date();
  return `${m[d.getMonth()]} ${d.getFullYear()}`;
};
const emptyMember = () => ({
  name: '', role: 'Frontend Developer', email: '', phone: '', status: 'Active',
  address: '', dob: '', cnic: '', emergencyContact: '',
  department: '', experience: '', joiningDate: '', employmentType: 'Full-Time',
  workLocation: '', manager: '', salary: '',
  bankName: '', accountNumber: '', accountTitle: '', iban: '',
  paymentMethod: 'Bank Transfer', payCycle: 'Monthly',
});
const formatFileSize = bytes => {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
const isImageFile = f => f?.type?.startsWith('image/');
const isVideoFile = f => f?.type?.startsWith('video/');
const isAudioFile = f => f?.type?.startsWith('audio/');

const getDocIcon = (file, size = 18) => {
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  if (isImageFile(file))                return <FileImage size={size} className="text-violet-500" />;
  if (isVideoFile(file))                return <FileVideo size={size} className="text-blue-500" />;
  if (isAudioFile(file))                return <Music     size={size} className="text-pink-500" />;
  if (file.type === 'application/pdf')  return <FileText  size={size} className="text-red-500" />;
  if (['zip','rar','7z'].includes(ext)) return <Archive   size={size} className="text-amber-500" />;
  return <File size={size} className="text-teal-500" />;
};

const copyToClipboard = (text, onSuccess = () => {}) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => {});
  } else {
    const t = document.createElement('textarea');
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); onSuccess(); } catch {}
    document.body.removeChild(t);
  }
};

// ─── Shared form styles ───────────────────────────────────────────────────────
const mI    = 'w-full px-3.5 py-2.5 rounded-lg text-sm text-gray-800 bg-white placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all';
const mIopt = 'w-full px-3.5 py-2.5 rounded-lg text-sm text-gray-800 bg-gray-50 placeholder-gray-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10 focus:outline-none transition-all';
const mL    = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';
const mLopt = 'block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide';

const Field = ({ label, required, children }) => (
  <div>
    <label className={required ? mL : mLopt}>
      {label}
      {required  && <span className="text-red-400 ml-0.5">*</span>}
      {!required && <span className="ml-1.5 text-[10px] font-normal text-gray-300 normal-case tracking-normal">(optional)</span>}
    </label>
    {children}
  </div>
);
const Row = ({ children }) => <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;

// ─── Lightbox ─────────────────────────────────────────────────────────────────
const Lightbox = ({ src, name, onClose }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90" onClick={onClose}>
    <button onClick={onClose}
      className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all z-10">
      <X size={18} />
    </button>
    <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
      <img src={src} alt={name} className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl" />
      <p className="text-white/60 text-[12px] font-medium">{name}</p>
    </div>
  </div>
);

// ─── Documents Tab ────────────────────────────────────────────────────────────
const DocumentsTab = ({ documents, onAdd, onRemove }) => {
  const [isDragging,  setIsDragging]  = useState(false);
  const [selected,    setSelected]    = useState(new Set());
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);
  const dragCounter  = useRef(0);
  const urlCache     = useRef({});

  useEffect(() => {
    const stop = e => { e.preventDefault(); e.stopPropagation(); };
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => { window.removeEventListener('dragover', stop); window.removeEventListener('drop', stop); };
  }, []);

  const getUrl = useCallback((file, i) => {
    if (!urlCache.current[i]) urlCache.current[i] = URL.createObjectURL(file);
    return urlCache.current[i];
  }, []);

  useEffect(() => {
    Object.keys(urlCache.current).forEach(k => {
      if (parseInt(k) >= documents.length) {
        URL.revokeObjectURL(urlCache.current[k]);
        delete urlCache.current[k];
      }
    });
  }, [documents.length]);

  const handleDrop = useCallback(e => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current = 0; setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(f => onAdd(f));
  }, [onAdd]);

  const toggleSelect = i => setSelected(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const allSelected  = documents.length > 0 && selected.size === documents.length;
  const someSelected = selected.size > 0 && !allSelected;
  const deleteSelected = () => { [...selected].sort((a,b)=>b-a).forEach(i=>onRemove(i)); setSelected(new Set()); };

  const openFile = (file, i) => {
    if (isImageFile(file)) {
      setPreviewFile({ url: getUrl(file, i), name: file.name });
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  return (
    <>
      {previewFile && <Lightbox src={previewFile.url} name={previewFile.name} onClose={() => setPreviewFile(null)} />}
      <div className="space-y-3">
        <div
          onDrop={handleDrop}
          onDragEnter={e => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; setIsDragging(true); }}
          onDragOver={e  => { e.preventDefault(); e.stopPropagation(); }}
          onDragLeave={e => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (!dragCounter.current) setIsDragging(false); }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
            flex flex-col items-center justify-center py-6 gap-2
            ${isDragging ? 'border-teal-400 bg-teal-50/60 scale-[1.01]' : 'border-gray-200 bg-gray-50/40 hover:border-teal-300 hover:bg-teal-50/20'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDragging ? 'bg-teal-100' : 'bg-white border border-gray-200'}`}>
            <Upload size={18} className={isDragging ? 'text-teal-500' : 'text-gray-400'} />
          </div>
          <div className="text-center">
            <p className={`text-[13px] font-semibold ${isDragging ? 'text-teal-600' : 'text-gray-600'}`}>
              {isDragging ? 'Drop files here!' : 'Drag & drop documents'}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">or click to browse</p>
          </div>
          <div className="flex gap-1 flex-wrap justify-center px-4">
            {['PDF','DOC','XLS','PPT','TXT','ZIP'].map(ext => (
              <span key={ext} className="text-[10px] font-semibold text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded">{ext}</span>
            ))}
          </div>
          <button type="button" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-lg bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center shadow transition-colors">
            <Plus size={14} />
          </button>
          <input ref={fileInputRef} type="file" multiple accept={DOC_ACCEPT} className="hidden"
            onChange={e => { Array.from(e.target.files).forEach(f => onAdd(f)); e.target.value = ''; }} />
        </div>

        {documents.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <button type="button" onClick={() => allSelected ? setSelected(new Set()) : setSelected(new Set(documents.map((_,i)=>i)))}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700 transition-colors">
              <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all
                ${allSelected ? 'bg-teal-500 border-teal-500' : someSelected ? 'bg-teal-100 border-teal-400' : 'border-gray-300 bg-white'}`}>
                {allSelected  && <CheckSquare size={10} className="text-white" />}
                {someSelected && <Minus size={9} className="text-teal-600" />}
              </div>
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <>
                  <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">{selected.size} selected</span>
                  <button type="button" onClick={deleteSelected}
                    className="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-colors">
                    <Trash2 size={11} /> Delete
                  </button>
                </>
              )}
              <span className="text-[11px] text-gray-400">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {documents.length > 0 && (
          <div className="space-y-1.5">
            {documents.map((file, i) => {
              const isSel = selected.has(i);
              return (
                <div key={i} onClick={() => toggleSelect(i)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all
                    ${isSel ? 'bg-teal-50 border border-teal-300 shadow-sm' : 'bg-white border hover:border-teal-200 hover:bg-teal-50/20'}`}
                  style={isSel ? {} : { border:`1px solid ${TL}` }}>
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${isSel ? 'bg-teal-500 border-teal-500' : 'border-gray-300'}`}
                    onClick={e => { e.stopPropagation(); toggleSelect(i); }}>
                    {isSel && <CheckSquare size={10} className="text-white" />}
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">{getDocIcon(file)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{file.name}</p>
                    <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => openFile(file, i)}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-teal-500 hover:bg-teal-50 transition-all">
                      <Eye size={13} />
                    </button>
                    <button type="button" onClick={() => { onRemove(i); setSelected(p => { const n = new Set(p); n.delete(i); return n; }); }}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

// ─── Media Tab ────────────────────────────────────────────────────────────────
const MediaTab = ({ media, onAdd, onRemove }) => {
  const [selected,  setSelected] = useState(new Set());
  const [lightbox,  setLightbox] = useState(null);
  const mediaInputRef = useRef(null);
  const urlCache      = useRef({});

  const getUrl = useCallback((file, i) => {
    if (!urlCache.current[i]) urlCache.current[i] = URL.createObjectURL(file);
    return urlCache.current[i];
  }, []);

  useEffect(() => {
    Object.keys(urlCache.current).forEach(k => {
      if (parseInt(k) >= media.length) { URL.revokeObjectURL(urlCache.current[k]); delete urlCache.current[k]; }
    });
  }, [media.length]);

  const toggleSelect   = i => setSelected(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const allSelected    = media.length > 0 && selected.size === media.length;
  const someSelected   = selected.size > 0 && !allSelected;
  const deleteSelected = () => { [...selected].sort((a,b)=>b-a).forEach(i=>onRemove(i)); setSelected(new Set()); };

  const openMedia = (file, i) => {
    if (isImageFile(file)) { setLightbox({ url: getUrl(file, i), name: file.name }); }
    else {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const getMediaIcon = file => {
    if (isVideoFile(file)) return <FileVideo size={20} className="text-blue-400" />;
    if (isAudioFile(file)) return <Music     size={20} className="text-pink-400" />;
    return <Image size={20} className="text-violet-400" />;
  };

  return (
    <>
      {lightbox && <Lightbox src={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {media.length > 0 && (
              <button type="button" onClick={() => allSelected ? setSelected(new Set()) : setSelected(new Set(media.map((_,i)=>i)))}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700 transition-colors">
                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all
                  ${allSelected ? 'bg-teal-500 border-teal-500' : someSelected ? 'bg-teal-100 border-teal-400' : 'border-gray-300 bg-white'}`}>
                  {allSelected  && <CheckSquare size={10} className="text-white" />}
                  {someSelected && <Minus size={9} className="text-teal-600" />}
                </div>
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
            {selected.size > 0 && (
              <>
                <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">{selected.size} selected</span>
                <button type="button" onClick={deleteSelected}
                  className="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-colors">
                  <Trash2 size={11} /> Delete
                </button>
              </>
            )}
          </div>
          <button type="button" onClick={() => mediaInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-sm transition-all active:scale-95">
            <Plus size={13} /> Add Media
          </button>
          <input ref={mediaInputRef} type="file" multiple accept={MEDIA_ACCEPT} className="hidden"
            onChange={e => { Array.from(e.target.files).forEach(f => onAdd(f)); e.target.value = ''; }} />
        </div>

        {media.length === 0 && (
          <div onClick={() => mediaInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 hover:border-teal-300 hover:bg-teal-50/30 cursor-pointer transition-all py-10 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <Image size={22} className="text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-semibold text-gray-500">No media added yet</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Click <strong>Add Media</strong> or tap here</p>
            </div>
          </div>
        )}

        {media.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {media.map((file, i) => {
              const isSel = selected.has(i);
              const isImg = isImageFile(file);
              const previewUrl = isImg ? getUrl(file, i) : null;
              return (
                <div key={i}
                  className={`relative group aspect-square rounded-xl overflow-hidden cursor-pointer transition-all duration-150
                    ${isSel ? 'ring-2 ring-teal-500 ring-offset-2' : 'hover:ring-2 hover:ring-teal-300 hover:ring-offset-1'}`}
                  style={{ background: '#f3f4f6' }}>
                  {isImg && previewUrl
                    ? <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" onClick={() => setLightbox({ url: previewUrl, name: file.name })} />
                    : <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-50" onClick={() => openMedia(file, i)}>
                        {getMediaIcon(file)}
                        <span className="text-[9px] font-bold text-gray-400 uppercase">{file.name.split('.').pop()}</span>
                      </div>
                  }
                  <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded flex items-center justify-center border-2 transition-all z-10
                    ${isSel ? 'bg-teal-500 border-teal-500 opacity-100' : 'bg-white/80 border-white opacity-0 group-hover:opacity-100'}`}
                    onClick={e => { e.stopPropagation(); toggleSelect(i); }}>
                    {isSel && <CheckSquare size={11} className="text-white" />}
                  </div>
                  <button type="button" onClick={() => { onRemove(i); setSelected(p => { const n = new Set(p); n.delete(i); return n; }); }}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600">
                    <X size={10} />
                  </button>
                  <div className={`absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent transition-opacity ${isSel ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <p className="text-[9px] text-white font-semibold truncate">{file.name}</p>
                    <p className="text-[8px] text-white/60">{formatFileSize(file.size)}</p>
                  </div>
                  {isSel && <div className="absolute inset-0 bg-teal-500/10 pointer-events-none" />}
                </div>
              );
            })}
            <button type="button" onClick={() => mediaInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-teal-300 hover:bg-teal-50/30 flex flex-col items-center justify-center gap-1.5 transition-all group">
              <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 group-hover:border-teal-300 group-hover:bg-teal-50 flex items-center justify-center transition-all">
                <Plus size={16} className="text-gray-400 group-hover:text-teal-500" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 group-hover:text-teal-500 transition-colors">Add More</span>
            </button>
          </div>
        )}
        {media.length > 0 && (
          <p className="text-[11px] text-gray-400 text-right">{media.length} file{media.length !== 1 ? 's' : ''} total</p>
        )}
      </div>
    </>
  );
};

// ─── Tab definitions ──────────────────────────────────────────────────────────
const DETAIL_TABS = [
  { key: 'personal',  label: 'Personal' },
  { key: 'work',      label: 'Work'     },
  { key: 'bank',      label: 'Bank'     },
  { key: 'documents', label: 'Docs'     },
  { key: 'media',     label: 'Media'    },
];

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const AddMemberPage = () => {
  const navigate = useNavigate();

  const [step,      setStep]      = useState('basic');
  const [detailTab, setDetailTab] = useState('personal');
  const [data,      setData]      = useState(emptyMember());
  const [documents, setDocuments] = useState([]);
  const [media,     setMedia]     = useState([]);
  const [saving,    setSaving]    = useState(false);

  const [inviteLink,      setInviteLink]      = useState('');
  const [inviteLoading,   setInviteLoading]   = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const onChange = (field, value) => setData(p => ({ ...p, [field]: value }));

  const inp    = (f, t = 'text', ph = '') =>
    <input type={t} value={data[f] || ''} onChange={e => onChange(f, e.target.value)}
      placeholder={ph} className={mIopt} style={{ border: `1px solid ${TL}` }} />;
  const inpReq = (f, t = 'text', ph = '') =>
    <input required type={t} value={data[f] || ''} onChange={e => onChange(f, e.target.value)}
      placeholder={ph} className={mI} style={{ border: `1px solid ${TL}` }} />;
  const sel = (f, opts, req = false) => (
    <select value={data[f] || opts[0]} onChange={e => onChange(f, e.target.value)}
      className={req ? mI : mIopt} style={{ border: `1px solid ${TL}` }}>
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  );

  const detailIdx = DETAIL_TABS.findIndex(t => t.key === detailTab);
  const isLastTab = detailIdx === DETAIL_TABS.length - 1;
  const stepIdx   = ['basic', 'details'].indexOf(step);

  const handleSave = async () => {
    if (!data.name || !data.email || !data.phone) {
      alert('Please fill required fields: Name, Email, Phone');
      setStep('basic');
      return;
    }
    setSaving(true);
    try {
      const docsMeta  = documents.map(f => ({ name: f.name, size: f.size, type: f.type }));
      const mediaMeta = media.map(f     => ({ name: f.name, size: f.size, type: f.type }));
      await addDoc(collection(db, 'teamMembers'), {
        ...data, documents: docsMeta, media: mediaMeta,
        projects: 0, avatar: generateAvatar(data.name),
        joinDate: getCurrentMonthYear(), tasks: [],
        order: Date.now(), createdAt: serverTimestamp(),
      });
      navigate(-1);
    } catch (err) {
      console.error(err);
      alert('Error saving member. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const generateInvite = async () => {
    setInviteLoading(true);
    try {
      const token = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'invites', token), { token, used: false, createdAt: serverTimestamp() });
      setInviteLink(`${window.location.origin}/invite/${token}`);
      setShowInviteModal(true);
    } catch { alert('Failed to generate invite link.'); }
    finally  { setInviteLoading(false); }
  };

  const handleCopy = () => {
    copyToClipboard(inviteLink, () => {
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    });
  };

  const handleSkip = () => isLastTab ? handleSave() : setDetailTab(DETAIL_TABS[detailIdx + 1].key);

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#EEF2F7] flex flex-col">
      <style>{`
        @keyframes fadeInOut {
          0%   { opacity:0; transform:translate(-50%,10px);  }
          15%  { opacity:1; transform:translate(-50%,0);     }
          85%  { opacity:1; transform:translate(-50%,0);     }
          100% { opacity:0; transform:translate(-50%,-10px); }
        }
        .toast-anim { animation: fadeInOut 2s ease forwards; }
        .mod-scroll::-webkit-scrollbar { display:none; }
        .form-scroll::-webkit-scrollbar { width:4px; }
        .form-scroll::-webkit-scrollbar-thumb { background:rgba(20,184,166,0.4); border-radius:99px; }
      `}</style>

      {/* ── Inner nav bar (inside page, below TopBar) ─────────────────────── */}
      <div className="flex-shrink-0 bg-white px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4"
        style={{ borderBottom: `1px solid ${TL}` }}>

        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors group flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
            <ArrowLeft size={16} className="text-gray-600" />
          </div>
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="h-6 w-px bg-gray-200 flex-shrink-0" />

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate">Add New Member</h1>
          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 hidden sm:block">
            {step === 'basic' ? 'Enter required basic information' : 'Optional details — skip anytime'}
          </p>
        </div>

        {/* Step indicators */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {['Basic Info', 'Details'].map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold transition-all flex-shrink-0
                  ${i < stepIdx ? 'bg-teal-500 text-white'
                    : i === stepIdx ? 'bg-teal-500 text-white ring-4 ring-teal-100'
                    : 'bg-gray-100 text-gray-400'}`}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] sm:text-[11px] font-semibold hidden sm:block
                  ${i === stepIdx ? 'text-teal-600' : i < stepIdx ? 'text-teal-400' : 'text-gray-300'}`}>
                  {label}
                </span>
              </div>
              {i < 1 && <div className={`w-4 sm:w-8 h-0.5 rounded-full transition-all flex-shrink-0 ${i < stepIdx ? 'bg-teal-400' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Page Body ──────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 sm:px-8 py-5 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm w-full flex flex-col"
          style={{ border: `1px solid ${TL}` }}>

          {/* ════════ STEP 1 — Basic Info ════════ */}
          {step === 'basic' && (
            <form onSubmit={e => { e.preventDefault(); setStep('details'); }} className="flex flex-col flex-1">
              <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-4">

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-teal-50 border border-teal-100">
                  <Info size={14} className="text-teal-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-teal-700 font-medium">
                    Fill required fields below, then add optional details in the next step.
                  </p>
                </div>

                <Field label="Full Name" required>{inpReq('name', 'text', 'e.g. Ali Hassan')}</Field>

                <Row>
                  <Field label="Role"   required>{sel('role',   ROLES,                       true)}</Field>
                  <Field label="Status" required>{sel('status', ['Active','Away','Inactive'], true)}</Field>
                </Row>

                <Field label="Email Address" required>{inpReq('email', 'email', 'ali@company.com')}</Field>
                <Field label="Phone Number"  required>{inpReq('phone', 'tel',   '+92 300 0000000')}</Field>
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-6 py-4 flex gap-3"
                style={{ borderTop: `1px solid ${TL}` }}>
                <button type="button" onClick={() => navigate(-1)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-[#EEF2F7] hover:opacity-80 transition-opacity"
                  style={{ border: `1px solid ${TL}` }}>
                  Cancel
                </button>
                <button type="button" onClick={generateInvite} disabled={inviteLoading}
                  className="flex-1  rounded-xl text-sm font-semibold text-teal-600 bg-teal-50 border border-teal-200 hover:bg-teal-100 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 whitespace-nowrap px-2">
                  {inviteLoading ? 'Generating...' : '🔗 Generate Link'}
                </button>
                <button type="submit"
                  className="flex-1 py- rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow flex items-center justify-center gap-2 transition-all">
                  Next <ArrowRight size={15} />
                </button>
              </div>
            </form>
          )}

          {/* ════════ STEP 2 — Details ════════ */}
          {step === 'details' && (
            <div className="flex flex-col flex-1">

              {/* Sub-tabs */}
              <div className="mod-scroll flex border-b overflow-x-auto flex-shrink-0" style={{ borderColor: TL, scrollbarWidth: 'none' }}>
                {DETAIL_TABS.map(tab => {
                  const badge =
                    (tab.key === 'documents' && documents.length > 0) ||
                    (tab.key === 'media'     && media.length     > 0);
                  return (
                    <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                      className={`flex-1 py-3 text-[11px] font-semibold transition-all border-b-2 whitespace-nowrap relative min-w-[56px]
                        ${detailTab === tab.key
                          ? 'text-teal-600 border-teal-500 bg-teal-50/40'
                          : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'}`}>
                      {tab.label}
                      {badge && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-teal-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="px-4 sm:px-6 py-5 space-y-3.5">

                {detailTab === 'personal' && (<>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <Info size={13} className="text-blue-400 flex-shrink-0" />
                    <p className="text-[11px] text-blue-600">All fields optional.</p>
                  </div>
                  <Field label="Home Address">{inp('address', 'text', 'Street, City, Province')}</Field>
                  <Row>
                    <Field label="Date of Birth">{inp('dob', 'date')}</Field>
                    <Field label="CNIC">{inp('cnic', 'text', '00000-0000000-0')}</Field>
                  </Row>
                  <Field label="Emergency Contact">{inp('emergencyContact', 'text', 'Name – +92 300 0000000')}</Field>
                </>)}

                {detailTab === 'work' && (<>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <Info size={13} className="text-blue-400 flex-shrink-0" />
                    <p className="text-[11px] text-blue-600">All fields optional.</p>
                  </div>
                  <Row>
                    <Field label="Department">{inp('department', 'text', 'e.g. Engineering')}</Field>
                    <Field label="Experience">{inp('experience', 'text', 'e.g. 2 years')}</Field>
                  </Row>
                  <Row>
                    <Field label="Joining Date">{inp('joiningDate', 'date')}</Field>
                    <Field label="Employment Type">{sel('employmentType', EMPLOYMENT_TYPES)}</Field>
                  </Row>
                  <Row>
                    <Field label="Work Location">{inp('workLocation', 'text', 'Office / Remote')}</Field>
                    <Field label="Manager">{inp('manager', 'text', 'Manager name')}</Field>
                  </Row>
                  <Field label="Monthly Salary (PKR)">{inp('salary', 'number', '0')}</Field>
                </>)}

                {detailTab === 'bank' && (<>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <Info size={13} className="text-blue-400 flex-shrink-0" />
                    <p className="text-[11px] text-blue-600">All fields optional.</p>
                  </div>
                  <Row>
                    <Field label="Bank Name">{inp('bankName', 'text', 'e.g. HBL, MCB')}</Field>
                    <Field label="Payment Method">{sel('paymentMethod', PAYMENT_METHODS)}</Field>
                  </Row>
                  <Field label="Account Holder Name">{inp('accountTitle', 'text', 'Full name on account')}</Field>
                  <Field label="Account Number">{inp('accountNumber', 'text', '0000000000000000')}</Field>
                  <Field label="IBAN">{inp('iban', 'text', 'PK00XXXX0000000000000000')}</Field>
                </>)}

                {detailTab === 'documents' && (
                  <DocumentsTab
                    documents={documents}
                    onAdd={f  => setDocuments(p => [...p, f])}
                    onRemove={i => setDocuments(p => p.filter((_,idx) => idx !== i))}
                  />
                )}

                {detailTab === 'media' && (
                  <MediaTab
                    media={media}
                    onAdd={f  => setMedia(p => [...p, f])}
                    onRemove={i => setMedia(p => p.filter((_,idx) => idx !== i))}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-6 py-4 space-y-2.5" style={{ borderTop: `1px solid ${TL}` }}>
                {/* Dot nav */}
                <div className="flex items-center gap-2">
                  {detailIdx > 0 && (
                    <button type="button" onClick={() => setDetailTab(DETAIL_TABS[detailIdx - 1].key)}
                      className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 flex-shrink-0">
                      ← Prev
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 flex-1 justify-center">
                    {DETAIL_TABS.map(t => (
                      <button key={t.key} type="button" onClick={() => setDetailTab(t.key)}
                        className={`rounded-full transition-all ${detailTab === t.key ? 'w-5 h-2 bg-teal-500' : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'}`} />
                    ))}
                  </div>
                  {!isLastTab && (
                    <button type="button" onClick={() => setDetailTab(DETAIL_TABS[detailIdx + 1].key)}
                      className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-200 hover:bg-teal-100 flex-shrink-0">
                      Next →
                    </button>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 sm:gap-2.5">
                  <button type="button" onClick={handleSkip}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-500 bg-[#EEF2F7] hover:bg-gray-200 flex items-center justify-center gap-1.5 transition-colors"
                    style={{ border: `1px solid ${TL}` }}>
                    <SkipForward size={14} />
                    <span className="hidden sm:inline">{isLastTab ? 'Skip & Save' : 'Skip'}</span>
                    <span className="sm:hidden">Skip</span>
                  </button>
                  <button type="button" onClick={handleSave} disabled={saving}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow disabled:opacity-60 transition-all">
                    {saving ? 'Saving...' : 'Save Member ✓'}
                  </button>
                </div>

                <button type="button" onClick={() => setStep('basic')}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                  ← Back to Basic Info
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Invite Modal ──────────────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 relative"
            onClick={e => e.stopPropagation()} style={{ border: `1px solid ${TL}` }}>
            {showCopiedToast && (
              <div className="absolute left-1/2 toast-anim bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg"
                style={{ transform: 'translateX(-50%)', top: '-40px' }}>
                Copied!
              </div>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={20} className="text-teal-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Invite Link Generated</h3>
                <p className="text-xs text-gray-400">One-time use link</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-3">Share this link. It can only be used once.</p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 mb-4">
              <input type="text" value={inviteLink} readOnly
                className="flex-1 text-xs bg-transparent outline-none text-gray-700 font-mono min-w-0" />
              <button onClick={handleCopy}
                className="flex-shrink-0 p-1.5 rounded-lg text-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-colors">
                <Copy size={15} />
              </button>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <a href={`mailto:?subject=Team Invitation&body=Please complete your profile: ${encodeURIComponent(inviteLink)}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 text-xs font-semibold transition-colors">
                <Mail size={14} /> Email
              </a>
              <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Team invite: ${inviteLink}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 text-xs font-semibold transition-colors">
                <BsWhatsapp size={15} /> WhatsApp
              </a>
              <button onClick={() => setShowInviteModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 text-xs font-semibold transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddMemberPage;