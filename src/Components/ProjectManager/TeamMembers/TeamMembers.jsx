
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext, useNavigate, useParams } from 'react-router-dom';

import {
  collection, updateDoc, deleteDoc,getDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch, addDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Trash2, Search, Plus, Eye, AlertCircle,
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  Info, FileText, Image,
  MoreVertical,
  CheckSquare, Minus, Copy, Mail, Link2,
  Edit
} from 'lucide-react';
import { BsWhatsapp } from 'react-icons/bs';

const TL  = 'rgba(51,51,51,0.20)';
const TLB = 'rgba(51,51,51,0.30)';
const ROLES = [
  'Frontend Developer','Backend Developer','Flutter Developer',
  'UI/UX Designer','Project Manager','QA Engineer',
  'Marketing Manager','Content Writer','DevOps Engineer',
];
const PRIORITIES       = ['Low','Medium','High','Critical'];
const EMPLOYMENT_TYPES = ['Full-Time','Part-Time','Contract','Internship','Freelance'];
const PAYMENT_METHODS  = ['Bank Transfer','Cash','Cheque','JazzCash','EasyPaisa'];

const priorityCfg = {
  Low:      { badge:'text-gray-500',   dot:'bg-gray-400'  },
  Medium:   { badge:'text-blue-600',   dot:'bg-blue-500'  },
  High:     { badge:'text-amber-600',  dot:'bg-amber-400' },
  Critical: { badge:'text-red-500',    dot:'bg-red-500'   },
};
const statusCfg = {
  Active:   { badge:'text-emerald-600', dot:'bg-emerald-500' },
  Away:     { badge:'text-amber-600',   dot:'bg-amber-400'   },
  Inactive: { badge:'text-gray-500',    dot:'bg-gray-400'    },
};
const taskStatusCfg = {
  'Pending':     { color:'text-gray-500',    bg:'bg-gray-100',    border:'border-gray-200',    dot:'bg-gray-400'    },
  'In Progress': { color:'text-amber-600',   bg:'bg-amber-50',    border:'border-amber-200',   dot:'bg-amber-400'   },
  'Done':        { color:'text-emerald-600', bg:'bg-emerald-50',  border:'border-emerald-200', dot:'bg-emerald-500' },
};
const TASK_STATUSES = ['Pending','In Progress','Done'];

const taskStatusIcon = s => {
  if (s === 'Done')        return <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />;
  if (s === 'In Progress') return <AlertCircle  size={15} className="text-amber-400 flex-shrink-0"   />;
  return <Circle size={15} className="text-gray-300 flex-shrink-0" />;
};

const generateAvatar = name => {
  const w = (name || '').trim().split(' ');
  return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : (name || '??').substring(0, 2).toUpperCase();
};

const getCompletion = m => {
  const fields = [
    m.address, m.dob, m.cnic, m.emergencyContact,
    m.department, m.experience, m.joiningDate, m.workLocation,
    m.manager, m.salary, m.bankName, m.accountNumber, m.accountTitle, m.iban,
  ];
  const filled = fields.filter(f => f && String(f).trim() !== '').length;
  return Math.round((filled / fields.length) * 100);
};

const formatFileSize = bytes => {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const isImageFile = f => f?.type?.startsWith('image/');
const isVideoFile = f => f?.type?.startsWith('video/');
const isAudioFile = f => f?.type?.startsWith('audio/');
const DOC_ACCEPT   = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar';
const MEDIA_ACCEPT = 'image/*,video/*,audio/*';

import {
  File, FileImage, FileVideo, Music, Archive, Upload, X,
  SkipForward, ArrowRight,
} from 'lucide-react';

const getDocIcon = (file, size = 18) => {
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  if (isImageFile(file))               return <FileImage size={size} className="text-violet-500" />;
  if (isVideoFile(file))               return <FileVideo size={size} className="text-blue-500"   />;
  if (isAudioFile(file))               return <Music     size={size} className="text-pink-500"   />;
  if (file.type === 'application/pdf') return <FileText  size={size} className="text-red-500"    />;
  if (['zip','rar','7z'].includes(ext))return <Archive   size={size} className="text-amber-500"  />;
  return <File size={size} className="text-teal-500" />;
};

const emptyMember = () => ({
  name:'', role:'Frontend Developer', email:'', phone:'', status:'Active',
  address:'', dob:'', cnic:'', emergencyContact:'',
  department:'', experience:'', joiningDate:'', employmentType:'Full-Time',
  workLocation:'', manager:'', salary:'',
  bankName:'', accountNumber:'', accountTitle:'', iban:'',
  paymentMethod:'Bank Transfer', payCycle:'Monthly',
});

const getCurrentMonthYear = () => {
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(); return `${m[d.getMonth()]} ${d.getFullYear()}`;
};

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

// ─── 3-dot context menu ───────────────────────────────────────────────────────
const ThreeDotMenu = ({ items, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button onClick={e => { e.stopPropagation(); setOpen(p => !p); }}
        className={`w-6 h-6 rounded-md flex items-center justify-center transition-all
          ${open ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}>
        <MoreVertical size={13} />
      </button>
      {open && (
        <div className={`absolute z-[9999] bg-white rounded-xl shadow-xl overflow-hidden
          ${align === 'right' ? 'right-0' : 'left-0'} top-7`}
          style={{ minWidth:'150px', border:`1px solid ${TL}`, boxShadow:'0 8px 30px rgba(0,0,0,0.15)' }}>
          {items.map((item, i) => (
            <button key={i} onClick={() => { item.action(); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium transition-colors
                ${item.danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── EDIT DOCUMENTS TAB ───────────────────────────────────────────────────────
const EditDocumentsTab = ({ existingDocs, newDocs, onRemoveExisting, onAddNew, onRemoveNew }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const urlCache = useRef({});

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

  const handleDrop = useCallback(e => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current = 0; setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(f => onAddNew(f));
  }, [onAddNew]);

  const handleFileSelect = e => {
    Array.from(e.target.files).forEach(f => onAddNew(f));
    e.target.value = '';
  };

  const openNewFile = (file, i) => {
    if (isImageFile(file)) {
      setPreviewFile({ url: getUrl(file, i), name: file.name });
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const totalCount = existingDocs.length + newDocs.length;

  return (
    <>
      {previewFile && <Lightbox src={previewFile.url} name={previewFile.name} onClose={() => setPreviewFile(null)} />}
      <div className="space-y-3">
        <div
          onDrop={handleDrop}
          onDragEnter={e => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
          onDragOver={e => e.preventDefault()}
          onDragLeave={e => { dragCounter.current--; if (!dragCounter.current) setIsDragging(false); }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
            flex flex-col items-center justify-center py-5 gap-2
            ${isDragging ? 'border-teal-400 bg-teal-50/60 scale-[1.01]' : 'border-gray-200 bg-gray-50/40 hover:border-teal-300 hover:bg-teal-50/20'}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDragging ? 'bg-teal-100' : 'bg-white border border-gray-200'}`}>
            <Upload size={16} className={isDragging ? 'text-teal-500' : 'text-gray-400'} />
          </div>
          <div className="text-center">
            <p className={`text-[13px] font-semibold ${isDragging ? 'text-teal-600' : 'text-gray-600'}`}>
              {isDragging ? 'Drop files here!' : 'Add new documents'}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">drag & drop or click to browse</p>
          </div>
          <button type="button" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-lg bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center shadow transition-colors">
            <Plus size={14} />
          </button>
          <input ref={fileInputRef} type="file" multiple accept={DOC_ACCEPT} className="hidden" onChange={handleFileSelect} />
        </div>

        {totalCount > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-gray-500">{totalCount} file{totalCount !== 1 ? 's' : ''} total</span>
            {newDocs.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-200 font-semibold">
                {newDocs.length} new
              </span>
            )}
          </div>
        )}

        {existingDocs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">Saved Files</p>
            {existingDocs.map((file, i) => (
              <div key={`existing-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white transition-all" style={{ border: `1px solid ${TL}` }}>
                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">{getDocIcon(file)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-gray-800 truncate">{file.name}</p>
                  <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
                </div>
                <button type="button" onClick={() => onRemoveExisting(i)}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {newDocs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-teal-500 uppercase tracking-wider px-1">New Uploads</p>
            {newDocs.map((file, i) => (
              <div key={`new-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-teal-50/40 transition-all" style={{ border: 'rgba(20,184,166,0.25) 1px solid' }}>
                <div className="w-8 h-8 rounded-lg bg-white border border-teal-100 flex items-center justify-center flex-shrink-0">{getDocIcon(file)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-gray-800 truncate">{file.name}</p>
                  <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => openNewFile(file, i)}
                    className="w-6 h-6 flex items-center justify-center rounded text-teal-400 hover:bg-teal-100 transition-all flex-shrink-0">
                    <Eye size={12} />
                  </button>
                  <button type="button" onClick={() => onRemoveNew(i)}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

// ─── EDIT MEDIA TAB ───────────────────────────────────────────────────────────
const EditMediaTab = ({ existingMedia, newMedia, onRemoveExisting, onAddNew, onRemoveNew }) => {
  const [lightbox, setLightbox] = useState(null);
  const mediaInputRef = useRef(null);
  const urlCache = useRef({});

  const getUrl = useCallback((file, i) => {
    if (!urlCache.current[i]) urlCache.current[i] = URL.createObjectURL(file);
    return urlCache.current[i];
  }, []);

  const handleFileSelect = e => {
    Array.from(e.target.files).forEach(f => onAddNew(f));
    e.target.value = '';
  };

  const getMetaIcon = (file, size = 18) => {
    if (file.type?.startsWith('image/')) return <FileImage size={size} className="text-violet-500" />;
    if (file.type?.startsWith('video/')) return <FileVideo size={size} className="text-blue-500"   />;
    if (file.type?.startsWith('audio/')) return <Music     size={size} className="text-pink-500"   />;
    return <Image size={size} className="text-gray-400" />;
  };

  const totalCount = existingMedia.length + newMedia.length;

  return (
    <>
      {lightbox && <Lightbox src={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500 font-medium">
            {totalCount} file{totalCount !== 1 ? 's' : ''}
            {newMedia.length > 0 && <span className="ml-2 text-teal-500 font-semibold">({newMedia.length} new)</span>}
          </span>
          <button type="button" onClick={() => mediaInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-sm transition-all active:scale-95">
            <Plus size={13} /> Add Media
          </button>
          <input ref={mediaInputRef} type="file" multiple accept={MEDIA_ACCEPT} className="hidden" onChange={handleFileSelect} />
        </div>

        {totalCount === 0 && (
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

        {existingMedia.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">Saved Media</p>
            <div className="grid grid-cols-3 gap-2">
              {existingMedia.map((file, i) => (
                <div key={`emeta-${i}`} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                    {getMetaIcon(file, 20)}
                    <span className="text-[9px] font-bold text-gray-400 uppercase px-2 text-center truncate w-full">{file.name.split('.').pop()}</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[8px] text-white font-semibold truncate">{file.name}</p>
                  </div>
                  <button type="button" onClick={() => onRemoveExisting(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {newMedia.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-teal-500 uppercase tracking-wider px-1">New Uploads</p>
            <div className="grid grid-cols-3 gap-2">
              {newMedia.map((file, i) => {
                const isImg = isImageFile(file);
                const url   = isImg ? getUrl(file, i) : null;
                return (
                  <div key={`newmedia-${i}`}
                    className="relative group aspect-square rounded-xl overflow-hidden ring-2 ring-teal-400 ring-offset-1"
                    style={{ background: '#f3f4f6' }}>
                    {isImg && url
                      ? <img src={url} alt={file.name} className="w-full h-full object-cover" onClick={() => setLightbox({ url, name: file.name })} />
                      : <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-teal-50">
                          {getMetaIcon(file, 20)}
                          <span className="text-[9px] font-bold text-teal-400 uppercase">{file.name.split('.').pop()}</span>
                        </div>
                    }
                    <button type="button" onClick={() => onRemoveNew(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
              <button type="button" onClick={() => mediaInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/40 hover:border-teal-400 hover:bg-teal-50 flex flex-col items-center justify-center gap-1.5 transition-all group">
                <Plus size={16} className="text-teal-400 group-hover:text-teal-600" />
                <span className="text-[9px] font-semibold text-teal-400">Add More</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ─── CustomDropdown ───────────────────────────────────────────────────────────
const CustomDropdown = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef   = useRef(null);
  const [dropPos, setDropPos] = useState({ top:0, posLeft:null, posRight:null, arrowOffset:16 });

  useEffect(() => {
    const h = e => {
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
        ? { top:rect.bottom+6, posLeft:null, posRight:vw-rect.right, arrowOffset:Math.max(10,Math.min(dropW-Math.round(rect.width/2)-5,dropW-20)) }
        : { top:rect.bottom+6, posLeft:rect.left, posRight:null, arrowOffset:Math.max(10,Math.round(rect.width/2)-5) }
      );
    }
    setIsOpen(p => !p);
  };

  const selectedLabel = value === 'all' ? placeholder : options.find(o => (o.value ?? o) === value)?.label ?? value;
  const isActive = value !== 'all';

  return (
    <>
      <button ref={buttonRef} onClick={handleOpen}
        className={`flex items-center gap-2 pl-3 pr-2.5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
          ${isActive ? 'bg-teal-50 text-teal-700 border-teal-300' : 'bg-white text-gray-700 hover:border-gray-300'}`}
        style={{ border:`1px solid ${isActive ? 'rgba(20,184,166,0.4)' : TL}` }}>
        <span className={isActive ? 'text-teal-600' : 'text-gray-500'}>{selectedLabel}</span>
        {isOpen ? <ChevronUp  size={14} className={isActive ? 'text-teal-500' : 'text-gray-400'} />
                : <ChevronDown size={14} className={isActive ? 'text-teal-500' : 'text-gray-400'} />}
      </button>
      {isOpen && (
        <div ref={dropdownRef} onClick={e => e.stopPropagation()}
          className="fixed z-[9999] bg-white rounded-xl overflow-hidden"
          style={{ top:dropPos.top, ...(dropPos.posLeft !== null ? { left:dropPos.posLeft } : { right:dropPos.posRight }),
            width:210, maxWidth:'calc(100vw - 16px)', border:`1px solid ${TL}`, boxShadow:'0 12px 36px rgba(0,0,0,0.13)' }}>
          <div className="absolute -top-[5px] w-2.5 h-2.5 bg-white rotate-45 border-l border-t border-gray-200" style={{ left:dropPos.arrowOffset }} />
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
              const ov = opt.value ?? opt, ol = opt.label ?? opt, isSel = value === ov;
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
const Row = ({ children }) => <div className="grid grid-cols-2 gap-3">{children}</div>;

// ─── EDIT MEMBER MODAL ────────────────────────────────────────────────────────
const EDIT_TABS = [
  { key:'basic',    label:'Basic',    required:true  },
  { key:'personal', label:'Personal', required:false },
  { key:'work',     label:'Work',     required:false },
  { key:'bank',     label:'Bank',     required:false },
  { key:'documents',label:'Docs',     required:false },
  { key:'media',    label:'Media',    required:false },
];

const EditMemberModal = ({
  memberName, data, onChange, onSubmit, onClose, onDeleteClick,
  existingDocs, existingMedia,
  onRemoveExistingDoc, onRemoveExistingMedia,
  newDocs, newMedia,
  onAddNewDoc, onAddNewMedia,
  onRemoveNewDoc, onRemoveNewMedia,
}) => {
  const [activeTab, setActiveTab] = useState('basic');

  const inp    = (f, t = 'text', ph = '') =>
    <input type={t} value={data[f] || ''} onChange={e => onChange(f, e.target.value)}
      placeholder={ph} className={mIopt} style={{ border:`1px solid ${TL}` }} />;
  const inpReq = (f, t = 'text', ph = '') =>
    <input required type={t} value={data[f] || ''} onChange={e => onChange(f, e.target.value)}
      placeholder={ph} className={mI} style={{ border:`1px solid ${TL}` }} />;
  const sel = (f, opts, req = false) => (
    <select value={data[f] || opts[0]} onChange={e => onChange(f, e.target.value)}
      className={req ? mI : mIopt} style={{ border:`1px solid ${TL}` }}>
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  );

  const completion = getCompletion(data);
  const tabIdx = EDIT_TABS.findIndex(t => t.key === activeTab);
  const docsCount  = existingDocs.length + newDocs.length;
  const mediaCount = existingMedia.length + newMedia.length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col"
        style={{ border:`1px solid ${TL}`, maxHeight:'92vh' }}>

        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom:`1px solid ${TL}` }}>
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-base font-bold text-gray-900 truncate">Edit — {memberName}</h3>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all duration-500"
                  style={{ width:`${completion}%` }} />
              </div>
              <span className={`text-[11px] font-bold ${completion === 100 ? 'text-teal-500' : completion >= 50 ? 'text-amber-500' : 'text-gray-400'}`}>
                {completion}% complete
              </span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-xl flex-shrink-0">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b flex-shrink-0 overflow-x-auto" style={{ borderColor:TL, scrollbarWidth:'none' }}>
          <style>{`.edit-tabs::-webkit-scrollbar{display:none}`}</style>
          <div className="edit-tabs flex w-full" style={{ scrollbarWidth:'none' }}>
            {EDIT_TABS.map(tab => {
              const badge = (tab.key === 'documents' && docsCount > 0) || (tab.key === 'media' && mediaCount > 0);
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2.5 text-[11px] font-semibold transition-all border-b-2 whitespace-nowrap min-w-[60px] relative
                    ${activeTab === tab.key ? 'text-teal-600 border-teal-500 bg-teal-50/40' : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'}`}>
                  {tab.label}
                  {!tab.required && tab.key !== 'documents' && tab.key !== 'media' &&
                    <span className="ml-0.5 text-[9px] text-gray-300 font-normal">opt</span>}
                  {badge && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-teal-400" />}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3.5" style={{ scrollbarWidth:'thin' }}>

            {activeTab === 'basic' && (<>
              <Field label="Full Name" required>{inpReq('name','text','e.g. Ali Hassan')}</Field>
              <Row>
                <Field label="Role"   required>{sel('role',   ROLES,                       true)}</Field>
                <Field label="Status" required>{sel('status', ['Active','Away','Inactive'], true)}</Field>
              </Row>
              <Field label="Email Address" required>{inpReq('email','email','ali@company.com')}</Field>
              <Field label="Phone Number"  required>{inpReq('phone','tel','+92 300 0000000')}</Field>
            </>)}

            {activeTab === 'personal' && (<>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Info size={13} className="text-blue-400 flex-shrink-0" />
                <p className="text-[11px] text-blue-600">All fields optional.</p>
              </div>
              <Field label="Home Address">{inp('address','text','Street, City, Province')}</Field>
              <Row>
                <Field label="Date of Birth">{inp('dob','date')}</Field>
                <Field label="CNIC">{inp('cnic','text','00000-0000000-0')}</Field>
              </Row>
              <Field label="Emergency Contact">{inp('emergencyContact','text','Name - +92 300 0000000')}</Field>
            </>)}

            {activeTab === 'work' && (<>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Info size={13} className="text-blue-400 flex-shrink-0" />
                <p className="text-[11px] text-blue-600">All fields optional.</p>
              </div>
              <Row>
                <Field label="Department">{inp('department','text','e.g. Engineering')}</Field>
                <Field label="Experience">{inp('experience','text','e.g. 2 years')}</Field>
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
            </>)}

            {activeTab === 'bank' && (<>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Info size={13} className="text-blue-400 flex-shrink-0" />
                <p className="text-[11px] text-blue-600">All fields optional.</p>
              </div>
              <Row>
                <Field label="Bank Name">{inp('bankName','text','e.g. HBL, MCB')}</Field>
                <Field label="Payment Method">{sel('paymentMethod',PAYMENT_METHODS)}</Field>
              </Row>
              <Field label="Account Holder Name">{inp('accountTitle','text','Full name on account')}</Field>
              <Field label="Account Number">{inp('accountNumber','text','0000000000000000')}</Field>
              <Field label="IBAN">{inp('iban','text','PK00XXXX0000000000000000')}</Field>
            </>)}

            {activeTab === 'documents' && (
              <EditDocumentsTab
                existingDocs={existingDocs} newDocs={newDocs}
                onRemoveExisting={onRemoveExistingDoc} onAddNew={onAddNewDoc} onRemoveNew={onRemoveNewDoc}
              />
            )}

            {activeTab === 'media' && (
              <EditMediaTab
                existingMedia={existingMedia} newMedia={newMedia}
                onRemoveExisting={onRemoveExistingMedia} onAddNew={onAddNewMedia} onRemoveNew={onRemoveNewMedia}
              />
            )}
          </div>

          <div className="px-6 py-4 flex-shrink-0 space-y-3" style={{ borderTop:`1px solid ${TL}` }}>
            <div className="flex items-center gap-2">
              {tabIdx > 0 && (
                <button type="button" onClick={() => setActiveTab(EDIT_TABS[tabIdx - 1].key)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 bg-[#EEF2F7] hover:opacity-80 flex-shrink-0"
                  style={{ border:`1px solid ${TL}` }}>← Prev</button>
              )}
              <div className="flex items-center gap-1.5 flex-1 justify-center">
                {EDIT_TABS.map(t => (
                  <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
                    className={`rounded-full transition-all ${activeTab === t.key ? 'w-5 h-2 bg-teal-500' : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'}`} />
                ))}
              </div>
              {tabIdx < EDIT_TABS.length - 1 && (
                <button type="button" onClick={() => setActiveTab(EDIT_TABS[tabIdx + 1].key)}
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
              <Trash2 size={12} /> Remove this member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
//  MAIN COMPONENT
// =============================================================================
const TeamMembers = () => {
  const navigate = useNavigate();

  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [filterRole,    setFilterRole]    = useState('all');
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [selected,      setSelected]      = useState(null);
  const [showDrawer,    setShowDrawer]    = useState(false);
  const [showAddTask,   setShowAddTask]   = useState(false);
  const [newTask,       setNewTask]       = useState({ title:'', description:'', priority:'Medium', dueDate:'', status:'Pending' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [openMenuId,    setOpenMenuId]    = useState(null);
  const [menuPos,       setMenuPos]       = useState({ top:0, left:0 });
  const menuRef         = useRef(null);
  const taskDropdownRef = useRef(null);
  const [editMember, setEditMember] = useState(emptyMember());

  const baseColumns = [
    { id:'index',       label:'#',           width:'3%',   minPx:36,  accessor:(m,idx)=>idx+1,                     editable:false },
    { id:'member',      label:'Member',       width:'15%',  minPx:160, accessor:m=>m.name,                          editable:true, field:'name'   },
    { id:'role',        label:'Role',         width:'13%',  minPx:120, accessor:m=>m.role,                          editable:true, field:'role'   },
    { id:'tasks',       label:'Tasks',        width:'8%',   minPx:48,  accessor:m=>(m.tasks||[]).length,            editable:false },
    { id:'status',      label:'Status',       width:'8%',   minPx:90,  accessor:m=>m.status,                        editable:true, field:'status' },
    { id:'priority',    label:'Priority',     width:'8%',   minPx:85,  accessor:m=>getLatestTask(m)?.priority||'—', editable:false },
    { id:'taskStatus',  label:'Task Status',  width:'10%',  minPx:100, accessor:m=>getLatestTask(m)?.status||'—',   editable:false },
    { id:'description', label:'Description',  width:'18%',  minPx:140, accessor:m=>getLatestTask(m)?.title||'',     editable:false },
    { id:'dueDate',     label:'Due Date',     width:'9%',   minPx:85,  accessor:m=>getLatestTask(m)?.dueDate||'—',  editable:false },
    { id:'view',        label:'',             width:'4%',   minPx:40,  accessor:()=>null,                           editable:false },
    { id:'menu',        label:'',             width:'4%',   minPx:40,  accessor:()=>null,                           editable:false },
  ];

  const [columns]      = useState(baseColumns);
  const [columnOrder,  setColumnOrder]  = useState(baseColumns.map(c => c.id));
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(baseColumns.map(c => [c.id, c.minPx])));
  const [editingCell,  setEditingCell]  = useState(null);

  const dragRow    = useRef(null);
  const dragOverRow = useRef(null);
  const dragCol    = useRef(null);
  const dragOverCol = useRef(null);
  const resizing   = useRef(null);

  const centeredCols = ['index','tasks','status','priority','taskStatus','description','dueDate','view','menu'];

  useEffect(() => {
    const q = query(collection(db, 'teamMembers'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setMembers(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (members.length === 0) return;
    const needOrder = members.filter(m => typeof m.order !== 'number');
    if (needOrder.length === 0) return;
    const batch = writeBatch(db);
    members.forEach((m, idx) => { if (typeof m.order !== 'number') batch.update(doc(db,'teamMembers',m.id), { order:idx }); });
    batch.commit().catch(console.error);
  }, [members]);

  useEffect(() => {
    if (selected) {
      const fresh = members.find(m => m.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [members]);

  const getLatestTask = m => {
    const tasks = m.tasks || [];
    if (!tasks.length) return null;
    return tasks.find(x => x.status !== 'Done') || tasks[tasks.length - 1];
  };

  const filtered = members.filter(m => {
    const s = searchTerm.toLowerCase();
    return (m.name?.toLowerCase().includes(s) || m.email?.toLowerCase().includes(s) || m.role?.toLowerCase().includes(s))
      && (filterRole   === 'all' || m.role   === filterRole)
      && (filterStatus === 'all' || m.status === filterStatus);
  });

  const handleColDragStart = (e, colId) => { e.dataTransfer.effectAllowed = 'move'; dragCol.current = colId; };
  const handleColDragOver  = (e, colId) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; dragOverCol.current = colId; };
  const handleColDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = dragCol.current;
    if (!sourceId || sourceId === targetId) { dragCol.current = null; dragOverCol.current = null; return; }
    setColumnOrder(prev => {
      const n = [...prev];
      const si = n.indexOf(sourceId), ti = n.indexOf(targetId);
      n.splice(si,1); n.splice(ti,0,sourceId);
      return n;
    });
    dragCol.current = null; dragOverCol.current = null;
  };

  const handleResizeStart = (e, colId) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startWidth = columnWidths[colId];
    resizing.current = { colId, startX, startWidth };
    const onMouseMove = me => {
      if (!resizing.current) return;
      const dx = me.clientX - resizing.current.startX;
      setColumnWidths(p => ({ ...p, [colId]: Math.max(40, resizing.current.startWidth + dx) }));
    };
    const onMouseUp = () => {
      resizing.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  };

  const handleRowDragStart = (e, idx) => { e.dataTransfer.effectAllowed='move'; dragRow.current=idx; setTimeout(()=>{ if(e.target)e.target.style.opacity='0.4'; },0); };
  const handleRowDragOver  = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; dragOverRow.current=idx; };
  const handleRowDrop = async (e, targetIdx) => {
    e.preventDefault();
    const sourceIdx = dragRow.current;
    if (sourceIdx === null || sourceIdx === targetIdx) { dragRow.current=null; dragOverRow.current=null; return; }
    const reordered = [...members];
    const [moved] = reordered.splice(sourceIdx,1);
    reordered.splice(targetIdx,0,moved);
    setMembers(reordered);
    const batch = writeBatch(db);
    reordered.forEach((member, newOrder) => {
      if (member.order !== newOrder) batch.update(doc(db,'teamMembers',member.id), { order:newOrder });
    });
    await batch.commit();
    dragRow.current=null; dragOverRow.current=null;
  };
  const handleRowDragEnd = e => { if(e.target) e.target.style.opacity='1'; dragRow.current=null; dragOverRow.current=null; };

  const startEditing = (member, col, value) => {
    if (!col.editable) return;
    setEditingCell({ rowId:member.id, colId:col.id, value, field:col.field });
  };
  const saveEdit = async (memberId, field, newValue) => {
    if (!field) return;
    try { await updateDoc(doc(db,'teamMembers',memberId), { [field]:newValue }); }
    catch (err) { console.error(err); }
    finally { setEditingCell(null); }
  };

  const [editExistingDocs,  setEditExistingDocs]  = useState([]);
  const [editExistingMedia, setEditExistingMedia] = useState([]);
  const [editNewDocs,       setEditNewDocs]       = useState([]);
  const [editNewMedia,      setEditNewMedia]      = useState([]);

  const handleUpdateSubmit = async e => {
    e.preventDefault();
    try {
      const d = editMember;
      const finalDocs  = [...editExistingDocs,  ...editNewDocs.map(f  => ({ name:f.name, size:f.size, type:f.type }))];
      const finalMedia = [...editExistingMedia, ...editNewMedia.map(f => ({ name:f.name, size:f.size, type:f.type }))];
      await updateDoc(doc(db,'teamMembers',selected.id), {
        name:d.name, role:d.role, email:d.email, phone:d.phone, status:d.status,
        address:d.address||'', dob:d.dob||'', cnic:d.cnic||'', emergencyContact:d.emergencyContact||'',
        department:d.department||'', experience:d.experience||'', joiningDate:d.joiningDate||'',
        employmentType:d.employmentType||'Full-Time', workLocation:d.workLocation||'',
        manager:d.manager||'', salary:d.salary?Number(d.salary):'',
        bankName:d.bankName||'', accountNumber:d.accountNumber||'', accountTitle:d.accountTitle||'',
        iban:d.iban||'', paymentMethod:d.paymentMethod||'Bank Transfer', payCycle:d.payCycle||'Monthly',
        avatar:generateAvatar(d.name),
        documents: finalDocs,
        media:     finalMedia,
      });
      setShowEditModal(false);
    } catch (err) { console.error(err); alert('Error updating'); }
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db,'teamMembers',deleteTarget.id));
      if (selected?.id === deleteTarget.id) { setSelected(null); setShowDrawer(false); }
      setDeleteTarget(null);
    } catch { alert('Error deleting'); }
  };

  const addTask = async e => {
    e.preventDefault(); if (!selected) return;
    await updateDoc(doc(db,'teamMembers',selected.id), {
      tasks: [...(selected.tasks||[]), { id:`t${Date.now()}`, ...newTask }],
      projects: (selected.projects||0)+1,
    });
    setNewTask({ title:'', description:'', priority:'Medium', dueDate:'', status:'Pending' });
    setShowAddTask(false);
  };

  const cycleTaskStatus = async (memberId, taskId) => {
    const member = members.find(m => m.id === memberId); if (!member) return;
    const cycle  = { 'Pending':'In Progress', 'In Progress':'Done', 'Done':'Pending' };
    await updateDoc(doc(db,'teamMembers',memberId), {
      tasks: (member.tasks||[]).map(t => t.id===taskId ? { ...t, status:cycle[t.status]||'Pending' } : t),
    });
  };

  const setTaskStatus = async (memberId, taskId, newStatus) => {
    const member = members.find(m => m.id === memberId); if (!member) return;
    await updateDoc(doc(db,'teamMembers',memberId), {
      tasks: (member.tasks||[]).map(t => t.id===taskId ? { ...t, status:newStatus } : t),
    });
  };

  const deleteTask = async (memberId, taskId) => {
    const member = members.find(m => m.id === memberId); if (!member) return;
    await updateDoc(doc(db,'teamMembers',memberId), {
      tasks: (member.tasks||[]).filter(t => t.id!==taskId),
      projects: Math.max(0,(member.projects||1)-1),
    });
  };

  const openEditModal = m => {
    setSelected(m);
    setEditMember({
      name:m.name||'', role:m.role||'Frontend Developer', email:m.email||'', phone:m.phone||'', status:m.status||'Active',
      address:m.address||'', dob:m.dob||'', cnic:m.cnic||'', emergencyContact:m.emergencyContact||'',
      department:m.department||'', experience:m.experience||'', joiningDate:m.joiningDate||'',
      employmentType:m.employmentType||'Full-Time', workLocation:m.workLocation||'', manager:m.manager||'', salary:m.salary||'',
      bankName:m.bankName||'', accountNumber:m.accountNumber||'', accountTitle:m.accountTitle||'',
      iban:m.iban||'', paymentMethod:m.paymentMethod||'Bank Transfer', payCycle:m.payCycle||'Monthly',
    });
    setEditExistingDocs(m.documents||[]);
    setEditExistingMedia(m.media||[]);
    setEditNewDocs([]);
    setEditNewMedia([]);
    setShowEditModal(true);
  };

  // ── shared menu trigger used in both mobile cards and desktop table ──
  const triggerMenu = (e, memberId) => {
    e.stopPropagation();
    if (openMenuId === memberId) { setOpenMenuId(null); return; }
    const rect  = e.currentTarget.getBoundingClientRect();
    const menuW = 170, vw = window.innerWidth;
    const leftPos = rect.right - menuW;
    setMenuPos({ top: rect.bottom + 6, left: Math.max(8, Math.min(leftPos, vw - menuW - 8)) });
    setOpenMenuId(memberId);
  };

  const renderTableCell = (member, col, rowIdx) => {
    const value     = col.accessor(member, rowIdx);
    const isEditing = editingCell && editingCell.rowId===member.id && editingCell.colId===col.id;

    if (isEditing) {
      return (
        <input type="text" defaultValue={value} autoFocus
          onBlur={e    => saveEdit(member.id, col.field, e.target.value)}
          onKeyDown={e => { if (e.key==='Enter') e.target.blur(); }}
          className="w-full px-2 py-1 border border-teal-500 rounded text-sm focus:outline-none"
          style={{ background:'white' }}
          onClick={e => e.stopPropagation()} />
      );
    }

    if (col.id==='member') {
      const comp = getCompletion(member);
      return (
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
              {member.avatar || generateAvatar(member.name)}
            </div>
            {comp < 50 && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white" title={`Profile ${comp}% complete`} />}
          </div>
          <div className="overflow-hidden">
            <p className="text-[14px] font-semibold text-gray-900 truncate">{member.name}</p>
            <p className="text-[11px] text-gray-400 truncate">{member.email}</p>
          </div>
        </div>
      );
    }
    if (col.id==='status') {
      const sCfg = statusCfg[member.status]||statusCfg.Active;
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${sCfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />{member.status}
        </span>
      );
    }
    if (col.id==='priority') {
      const task = getLatestTask(member);
      if (!task) return <span className="text-gray-300 text-[12px]">—</span>;
      const pCfg = priorityCfg[task.priority]||priorityCfg.Medium;
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${pCfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />{task.priority}
        </span>
      );
    }
    if (col.id==='taskStatus') {
      const task = getLatestTask(member);
      if (!task) return <span className="text-gray-300 text-[12px]">—</span>;
      const tsCfg = taskStatusCfg[task.status]||taskStatusCfg.Pending;
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${tsCfg.bg} ${tsCfg.color} ${tsCfg.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${tsCfg.dot}`} />{task.status}
        </span>
      );
    }
    if (col.id==='description') {
      const task = getLatestTask(member);
      if (!task) return <span className="text-gray-300 text-[12px]">No tasks</span>;
      return (
        <div className="overflow-hidden">
          <p className="text-[12px] font-medium text-gray-700 truncate">{task.title}</p>
          {task.description && <p className="text-[11px] text-gray-400 truncate">{task.description}</p>}
        </div>
      );
    }
    if (col.id==='dueDate') {
      const task = getLatestTask(member);
      return <span className="text-[12px] font-mono text-gray-600 whitespace-nowrap">{task?.dueDate||'—'}</span>;
    }
    if (col.id==='tasks') {
      const count = (member.tasks||[]).length;
      return <span className={`text-[13px] font-bold font-mono ${count>0?'text-teal-600':'text-gray-300'}`}>{count}</span>;
    }
    if (col.id==='view') {
      return (
        <button onClick={() => { setSelected(member); setShowDrawer(true); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-teal-500 hover:bg-teal-50 transition-colors">
          <Eye size={15} />
        </button>
      );
    }
    if (col.id==='menu') {
      return (
        <button
          onClick={e => triggerMenu(e, member.id)}
          className={`w-7 h-7 rounded-lg flex flex-col items-center justify-center gap-[3px] transition-all ${openMenuId===member.id?'bg-[#EEF2F7]':'hover:bg-[#EEF2F7]'}`}
        >
          {[0,1,2].map(i => <span key={i} className={`w-1 h-1 rounded-full block ${openMenuId===member.id?'bg-gray-600':'bg-gray-300'}`} />)}
        </button>
      );
    }
    return <span className="text-[13px] text-gray-600 truncate">{value}</span>;
  };

  useEffect(() => {
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Loading team members...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <div className="h-[15px]" />

      {/* ── Search / Filter bar ── */}
      <div className="px-4 md:px-8 pb-4 flex flex-wrap items-center gap-3 max-w-[1600px] mx-auto">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by name, email, role..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border text-sm text-gray-700 placeholder-gray-400 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all"
            style={{ border:`1px solid ${TL}` }} />
        </div>
        <CustomDropdown value={filterRole}   onChange={setFilterRole}   options={ROLES.map(r=>({value:r,label:r}))} placeholder="All Roles" />
        <CustomDropdown value={filterStatus} onChange={setFilterStatus} options={[
          { value:'Active',   label:'Active',   dot:'bg-emerald-500' },
          { value:'Away',     label:'Away',     dot:'bg-amber-400'   },
          { value:'Inactive', label:'Inactive', dot:'bg-gray-400'    },
        ]} placeholder="All Status" />
        <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} member{filtered.length!==1?'s':''}</span>
      </div>

      <div className="px-4 md:px-8 pb-8 max-w-[1600px] mx-auto">

        {/* ══════════════════════════════════════════════════════
            MOBILE CARD VIEW  —  visible only on small screens
        ══════════════════════════════════════════════════════ */}
        <div className="block md:hidden space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl" style={{ border:`1px solid ${TL}` }}>
              <div className="text-4xl mb-3">👥</div>
              <p className="text-gray-400 text-sm">No team members found.</p>
            </div>
          )}
          {filtered.map(member => {
            const task  = getLatestTask(member);
            const sCfg  = statusCfg[member.status]  || statusCfg.Active;
            const pCfg  = task ? (priorityCfg[task.priority]  || priorityCfg.Medium)    : null;
            const tsCfg = task ? (taskStatusCfg[task.status]  || taskStatusCfg.Pending) : null;
            const comp  = getCompletion(member);
            return (
              <div key={member.id} className="bg-white rounded-2xl p-4 shadow-sm" style={{ border:`1px solid ${TL}` }}>

                {/* ── Header: avatar · name · actions ── */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                      {member.avatar || generateAvatar(member.name)}
                    </div>
                    {comp < 50 && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white"
                        title={`Profile ${comp}% complete`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-900 truncate">{member.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setSelected(member); setShowDrawer(true); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-teal-500 hover:bg-teal-50 transition-colors">
                      <Eye size={15} />
                    </button>
                    <button onClick={e => triggerMenu(e, member.id)}
                      className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center gap-[3px] transition-all
                        ${openMenuId === member.id ? 'bg-[#EEF2F7]' : 'hover:bg-[#EEF2F7]'}`}>
                      {[0,1,2].map(i => (
                        <span key={i} className={`w-1 h-1 rounded-full block ${openMenuId === member.id ? 'bg-gray-600' : 'bg-gray-300'}`} />
                      ))}
                    </button>
                  </div>
                </div>

                {/* ── Role · Status · Task count badges ── */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full truncate max-w-[150px]">
                    {member.role}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${sCfg.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />{member.status}
                  </span>
                  <span className="text-[11px] font-bold text-teal-600 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                    {(member.tasks||[]).length} task{(member.tasks||[]).length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* ── Latest task card ── */}
                {task ? (
                  <div className="rounded-xl p-3 bg-gray-50" style={{ border:`1px solid ${TL}` }}>
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      {pCfg && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${pCfg.badge}`}>
                          <span className={`w-1 h-1 rounded-full ${pCfg.dot}`}/>{task.priority}
                        </span>
                      )}
                      {tsCfg && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${tsCfg.bg} ${tsCfg.color} ${tsCfg.border}`}>
                          <span className={`w-1 h-1 rounded-full ${tsCfg.dot}`}/>{task.status}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap ml-auto">📅 {task.dueDate}</span>
                      )}
                    </div>
                    <p className="text-[12px] font-semibold text-gray-700 truncate">{task.title}</p>
                    {task.description && <p className="text-[11px] text-gray-400 truncate mt-0.5">{task.description}</p>}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-300 text-center py-1">No tasks assigned</p>
                )}
              </div>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════
            DESKTOP TABLE VIEW  —  hidden on small screens
        ══════════════════════════════════════════════════════ */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm w-full" style={{ border:`1px solid ${TL}`, overflow:'hidden' }}>
          <div className="team-scroll-container"
            style={{ overflowX:'auto', overflowY:'auto', maxHeight:'calc(100vh - 210px)', WebkitOverflowScrolling:'touch' }}>
            <style>{`.team-scroll-container::-webkit-scrollbar{height:6px;width:6px}.team-scroll-container::-webkit-scrollbar-track{background:rgba(238,242,247,0.9);border-radius:999px}.team-scroll-container::-webkit-scrollbar-thumb{background:rgba(20,184,166,0.55);border-radius:999px}.team-scroll-container::-webkit-scrollbar-thumb:hover{background:rgba(20,184,166,0.85)}`}</style>
            <table className="border-collapse" style={{ tableLayout:'fixed', width:'100%', minWidth:'820px' }}>
              <colgroup>
                {columnOrder.map(colId => {
                  const col = columns.find(c => c.id===colId);
                  return <col key={colId} style={{ width: col ? col.width : 'auto' }} />;
                })}
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EEF2F7]" style={{ borderBottom:`2px solid ${TLB}` }}>
                  {columnOrder.map((colId, idx) => {
                    const col = columns.find(c => c.id===colId);
                    if (!col) return null;
                    return (
                      <th key={col.id} draggable
                        onDragStart={e => handleColDragStart(e, col.id)}
                        onDragOver={e  => handleColDragOver(e,  col.id)}
                        onDrop={e      => handleColDrop(e,      col.id)}
                        className="py-3.5 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider select-none whitespace-nowrap text-center relative"
                        style={{ borderRight:idx<columnOrder.length-1?`1px solid ${TL}`:undefined, width:col.width, cursor:'grab' }}>
                        {col.label}
                        <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-teal-300"
                          onMouseDown={e => handleResizeStart(e, col.id)}
                          onClick={e => e.stopPropagation()} />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={columnOrder.length} className="py-20 text-center">
                      <div className="text-4xl mb-3">👥</div>
                      <p className="text-gray-400 text-sm">No team members found.</p>
                    </td>
                  </tr>
                )}
                {filtered.map((member, idx) => {
                  const originalIdx = members.findIndex(m => m.id===member.id);
                  const isDragOver  = dragOverRow.current===originalIdx && dragRow.current!==originalIdx;
                  return (
                    <tr key={member.id} draggable
                      onDragStart={e  => handleRowDragStart(e, originalIdx)}
                      onDragEnter={e  => handleRowDragOver(e,  originalIdx)}
                      onDragOver={e   => handleRowDragOver(e,  originalIdx)}
                      onDrop={e       => handleRowDrop(e,      originalIdx)}
                      onDragEnd={handleRowDragEnd}
                      className={`${idx%2===0?'bg-white':''} transition-colors duration-100`}
                      style={{ outline:isDragOver?'2px solid #14b8a6':undefined, outlineOffset:'-2px' }}>
                      {columnOrder.map((colId, cellIdx) => {
                        const col = columns.find(c => c.id===colId);
                        return (
                          <td key={colId}
                            onDoubleClick={() => startEditing(member, col, col.accessor(member, idx))}
                            style={{ height:'62px', padding:0, verticalAlign:'middle',
                              borderRight:cellIdx<columnOrder.length-1?`1px solid ${TL}`:undefined,
                              borderBottom:`1px solid ${TL}` }}>
                            <div className={`flex items-center h-full px-3 overflow-hidden ${centeredCols.includes(colId)?'justify-center':''}`}>
                              {renderTableCell(member, col, idx)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>{/* end desktop table */}

      </div>

      {/* ── FIXED portal context menu ── */}
      {openMenuId && (
        <div ref={menuRef} onClick={e => e.stopPropagation()}
          className="fixed z-[9999] bg-white rounded-xl overflow-hidden p-1"
          style={{ top:menuPos.top, left:menuPos.left, minWidth:'165px', border:`1px solid ${TL}`, boxShadow:'0 10px 30px rgba(0,0,0,0.15)' }}>
          <button onClick={() => { const m=members.find(x=>x.id===openMenuId); setOpenMenuId(null); if(m) openEditModal(m); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Edit size={16}/> Edit Member
          </button>
          <button onClick={() => { const m=members.find(x=>x.id===openMenuId); setOpenMenuId(null); if(m) setDeleteTarget(m); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} strokeWidth={2} /> Delete Member
          </button>
        </div>
      )}

      {showDrawer && selected && (
        <div className="fixed inset-0 z-[100]" onClick={() => { setShowDrawer(false); setShowAddTask(false); }}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
          <div className="absolute right-0 top-0 bottom-0 bg-white flex flex-col shadow-2xl w-full sm:w-[520px]"
            style={{ borderLeft:`1px solid ${TL}` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-7 pt-7 pb-5 flex-shrink-0" style={{ borderBottom:`1px solid ${TL}` }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {selected.avatar||generateAvatar(selected.name)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{selected.name}</h2>
                  <p className="text-sm text-teal-600 font-medium mt-0.5">{selected.role}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusCfg[selected.status]?.badge||statusCfg.Active.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg[selected.status]?.dot||'bg-emerald-500'}`} />{selected.status}
                    </span>
                    <span className="text-[11px] text-gray-400">Since {selected.joinDate}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => { setShowDrawer(false); setShowAddTask(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all text-xl">×</button>
            </div>

            {(() => {
              const comp = getCompletion(selected);
              if (comp === 100) return null;
              return (
                <div className="mx-7 mt-4 px-4 py-3 rounded-xl flex items-center gap-3"
                  style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-amber-600">Profile {comp}% complete</span>
                      <button onClick={() => openEditModal(selected)} className="text-[11px] font-bold text-teal-600 hover:text-teal-700">+ Complete Profile</button>
                    </div>
                    <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all" style={{ width:`${comp}%` }} />
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="px-7 py-4 flex-shrink-0" style={{ borderBottom:`1px solid ${TL}`, marginTop:getCompletion(selected)===100?0:12 }}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Info</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label:'Email',    value:selected.email },
                  { label:'Phone',    value:selected.phone },
                  { label:'Projects', value:selected.projects||0 },
                  { label:'Tasks',    value:(selected.tasks||[]).length },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <p className="text-[11px] text-gray-400 font-medium mb-1">{label}</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{value||'—'}</p>
                  </div>
                ))}
              </div>
              {((selected.documents||[]).length>0||(selected.media||[]).length>0) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selected.documents||[]).length>0&&(
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-teal-50 text-teal-600 border border-teal-100 font-medium">
                      <FileText size={10}/> {selected.documents.length} doc{selected.documents.length!==1?'s':''}
                    </span>
                  )}
                  {(selected.media||[]).length>0&&(
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-100 font-medium">
                      <Image size={10}/> {selected.media.length} media
                    </span>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.department    && <span className="text-[11px] px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-100 font-medium">{selected.department}</span>}
                {selected.workLocation  && <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">{selected.workLocation}</span>}
                {selected.employmentType&& <span className="text-[11px] px-2.5 py-1 rounded-full bg-teal-50 text-teal-600 border border-teal-100 font-medium">{selected.employmentType}</span>}
                {selected.salary        && <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 font-medium">PKR {selected.salary}</span>}
                {selected.joiningDate   && <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-100 font-medium">{selected.joiningDate}</span>}
                {selected.bankName      && <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 font-medium">{selected.bankName}</span>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-5" style={{ scrollbarWidth:'thin' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tasks ({(selected.tasks||[]).length})</h3>
                <button onClick={() => setShowAddTask(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors">
                  <Plus size={12} /> Add Task
                </button>
              </div>

              {showAddTask && (
                <form onSubmit={addTask} className="mb-4 p-4 rounded-xl bg-teal-50/60 border border-teal-200 space-y-3">
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider">New Task</p>
                  <input required value={newTask.title} onChange={e=>setNewTask(p=>({...p,title:e.target.value}))}
                    placeholder="Task title *" className={mI} style={{ border:`1px solid ${TL}` }}/>
                  <textarea value={newTask.description} onChange={e=>setNewTask(p=>({...p,description:e.target.value}))}
                    placeholder="Description (optional)" rows={2} className={`${mI} resize-none`} style={{ border:`1px solid ${TL}` }}/>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                      <select value={newTask.priority} onChange={e=>setNewTask(p=>({...p,priority:e.target.value}))}
                        className={mI} style={{ border:`1px solid ${TL}` }}>
                        {PRIORITIES.map(p=><option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                      <select value={newTask.status} onChange={e=>setNewTask(p=>({...p,status:e.target.value}))}
                        className={mI} style={{ border:`1px solid ${TL}` }}>
                        <option>Pending</option><option>In Progress</option><option>Done</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date *</label>
                    <input required type="date" value={newTask.dueDate} onChange={e=>setNewTask(p=>({...p,dueDate:e.target.value}))}
                      className={mI} style={{ border:`1px solid ${TL}` }}/>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>setShowAddTask(false)}
                      className="flex-1 py-2.5 rounded-lg text-xs font-semibold text-gray-600 bg-white border hover:bg-gray-50" style={{ border:`1px solid ${TL}` }}>
                      Cancel
                    </button>
                    <button type="submit"
                      className="flex-1 py-2.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600">
                      Add Task
                    </button>
                  </div>
                </form>
              )}

              {(!selected.tasks||selected.tasks.length===0)&&!showAddTask&&(
                <div className="text-center py-12"><div className="text-3xl mb-2">📋</div><p className="text-sm text-gray-400">No tasks yet. Add one above.</p></div>
              )}

              <div className="space-y-2.5">
                {(selected.tasks||[]).map(task => {
                  const pCfg = priorityCfg[task.priority]||priorityCfg.Medium;
                  return (
                    <div key={task.id} className="p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100/70 transition-colors group" style={{ border:`1px solid ${TL}` }}>
                      <div className="flex items-start gap-3">
                        <button onClick={()=>cycleTaskStatus(selected.id,task.id)} className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110">
                          {taskStatusIcon(task.status)}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={`text-[13px] font-semibold ${task.status==='Done'?'line-through text-gray-400':'text-gray-800'}`}>{task.title}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${pCfg.badge}`}>
                              <span className={`w-1 h-1 rounded-full ${pCfg.dot}`}/>{task.priority}
                            </span>
                          </div>
                          {task.description&&<p className="text-[11px] text-gray-400 mt-0.5 truncate">{task.description}</p>}
                          <p className="text-[11px] text-gray-400 font-mono mt-1">📅 {task.dueDate||'—'}</p>
                        </div>
                        <button onClick={()=>deleteTask(selected.id,task.id)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0 mt-0.5">
                          <Trash2 size={12}/>
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2.5 pl-7">
                        {TASK_STATUSES.map(s => {
                          const cfg=taskStatusCfg[s]; const isAct=task.status===s;
                          return (
                            <button key={s} onClick={()=>setTaskStatus(selected.id,task.id,s)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all
                                ${isAct?`${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm`:'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50'}`}>
                              {s==='In Progress'?'In Prog.':s}
                            </button>
                          );
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

      {showEditModal && selected && (
        <EditMemberModal
          memberName={selected.name}
          data={editMember}
          onChange={(f,v)=>setEditMember(p=>({...p,[f]:v}))}
          onSubmit={handleUpdateSubmit}
          onClose={()=>setShowEditModal(false)}
          onDeleteClick={()=>{ setShowEditModal(false); setDeleteTarget(selected); }}
          existingDocs={editExistingDocs}
          existingMedia={editExistingMedia}
          newDocs={editNewDocs}
          newMedia={editNewMedia}
          onRemoveExistingDoc={i=>setEditExistingDocs(p=>p.filter((_,idx)=>idx!==i))}
          onRemoveExistingMedia={i=>setEditExistingMedia(p=>p.filter((_,idx)=>idx!==i))}
          onAddNewDoc={f=>setEditNewDocs(p=>[...p,f])}
          onAddNewMedia={f=>setEditNewMedia(p=>[...p,f])}
          onRemoveNewDoc={i=>setEditNewDocs(p=>p.filter((_,idx)=>idx!==i))}
          onRemoveNewMedia={i=>setEditNewMedia(p=>p.filter((_,idx)=>idx!==i))}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden" style={{ border:`1px solid ${TL}` }}>
            <div className="h-1 bg-gradient-to-r from-red-400 to-red-500" />
            <div className="p-7">
              <div className="w-[48px] h-[48px] rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-5">
                <Trash2 size={22} className="text-red-500" strokeWidth={1.8} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Member?</h3>
              <p className="text-sm text-gray-500 mb-4">This will permanently remove the member and all their tasks.</p>
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-6">
                <span className="text-sm font-semibold text-red-600">"{deleteTarget.name}"</span>
                <span className="text-xs text-gray-400 ml-2">will be permanently deleted</span>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setDeleteTarget(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-[#EEF2F7] hover:bg-slate-200"
                  style={{ border:`1px solid ${TL}` }}>Cancel</button>
                <button onClick={confirmDelete}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-red-400 to-red-500 hover:opacity-90 shadow-lg shadow-red-100">
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── INVITE PAGE ──

// ─── Invite Docs Tab ──
const InviteDocsTab = ({ docs, onAdd, onRemove }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    const stop = e => { e.preventDefault(); e.stopPropagation(); };
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => { window.removeEventListener('dragover', stop); window.removeEventListener('drop', stop); };
  }, []);

  const handleDrop = e => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current = 0; setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(f => onAdd(f));
  };
  const handleSelect = e => { Array.from(e.target.files).forEach(f => onAdd(f)); e.target.value = ''; };

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragEnter={e => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
        onDragOver={e => e.preventDefault()}
        onDragLeave={e => { dragCounter.current--; if (!dragCounter.current) setIsDragging(false); }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
          flex flex-col items-center justify-center py-6 gap-2
          ${isDragging ? 'border-teal-400 bg-teal-50/60' : 'border-gray-200 bg-gray-50/40 hover:border-teal-300 hover:bg-teal-50/20'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDragging ? 'bg-teal-100' : 'bg-white border border-gray-200'}`}>
          <Upload size={16} className={isDragging ? 'text-teal-500' : 'text-gray-400'} />
        </div>
        <p className={`text-[13px] font-semibold ${isDragging ? 'text-teal-600' : 'text-gray-600'}`}>
          {isDragging ? 'Drop files here!' : 'Upload Documents'}
        </p>
        <p className="text-[11px] text-gray-400">drag & drop or click to browse</p>
        <input ref={fileInputRef} type="file" multiple accept={DOC_ACCEPT} className="hidden" onChange={handleSelect} />
      </div>
      {docs.length > 0 && (
        <div className="space-y-1.5">
          {docs.map((file, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white" style={{ border:`1px solid ${TL}` }}>
              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">{getDocIcon(file)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 truncate">{file.name}</p>
                <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
              </div>
              <button type="button" onClick={() => onRemove(i)}
                className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {docs.length === 0 && (
        <p className="text-center text-[12px] text-gray-400 py-2">No documents uploaded yet</p>
      )}
    </div>
  );
};

// ─── Invite Media Tab ─
const InviteMediaTab = ({ media, onAdd, onRemove }) => {
  const [lightbox, setLightbox] = useState(null);
  const mediaInputRef = useRef(null);
  const urlCache = useRef({});

  const getUrl = useCallback((file, i) => {
    if (!urlCache.current[i]) urlCache.current[i] = URL.createObjectURL(file);
    return urlCache.current[i];
  }, []);

  const handleSelect = e => { Array.from(e.target.files).forEach(f => onAdd(f)); e.target.value = ''; };

  return (
    <>
      {lightbox && <Lightbox src={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500 font-medium">{media.length} file{media.length !== 1 ? 's' : ''}</span>
          <button type="button" onClick={() => mediaInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-sm transition-all">
            <Plus size={13} /> Add Media
          </button>
          <input ref={mediaInputRef} type="file" multiple accept={MEDIA_ACCEPT} className="hidden" onChange={handleSelect} />
        </div>
        {media.length === 0 && (
          <div onClick={() => mediaInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 hover:border-teal-300 cursor-pointer transition-all py-10 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <Image size={22} className="text-gray-300" />
            </div>
            <p className="text-[13px] font-semibold text-gray-500">No media added yet</p>
          </div>
        )}
        {media.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {media.map((file, i) => {
              const isImg = isImageFile(file);
              const url = isImg ? getUrl(file, i) : null;
              return (
                <div key={i} className="relative group aspect-square rounded-xl overflow-hidden ring-2 ring-teal-400 ring-offset-1" style={{ background:'#f3f4f6' }}>
                  {isImg && url
                    ? <img src={url} alt={file.name} className="w-full h-full object-cover" onClick={() => setLightbox({ url, name: file.name })} />
                    : <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-teal-50">
                        <FileImage size={20} className="text-teal-400" />
                        <span className="text-[9px] font-bold text-teal-400 uppercase">{file.name.split('.').pop()}</span>
                      </div>
                  }
                  <button type="button" onClick={() => onRemove(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={10} />
                  </button>
                </div>
              );
            })}
            <button type="button" onClick={() => mediaInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/40 hover:border-teal-400 flex flex-col items-center justify-center gap-1.5 transition-all">
              <Plus size={16} className="text-teal-400" />
              <span className="text-[9px] font-semibold text-teal-400">Add More</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
};


// ─── INVITE PAGE COMPONENT ──
// TeamMembers.jsx
// NOTE: Replace the InvitePage export at the bottom of your existing TeamMembers.jsx
// with the new InvitePage below. Keep everything else exactly the same.
// 
// ─── FIND AND REPLACE ───────────────────────────────────────────────────────
// Find:   export const InvitePage = () => {
// Replace with the new InvitePage component below
// ────────────────────────────────────────────────────────────────────────────

// ─── INVITE PAGE COMPONENT ────────────────────────────────────────────────────
export const InvitePage = () => {
  const { token } = useParams();
  const [invite,       setInvite]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [step,         setStep]         = useState('form');
  const [submitting,   setSubmitting]   = useState(false);
  const [errors,       setErrors]       = useState({});
  const [documents,    setDocuments]    = useState([]);
  const [media,        setMedia]        = useState([]);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [cnicFront,    setCnicFront]    = useState(null);
  const [cnicBack,     setCnicBack]     = useState(null);
  const [openSections, setOpenSections] = useState({ basic:true, personal:false, work:false, bank:false, files:false });
  const [formData, setFormData] = useState({
    name:'', email:'', phone:'', role:ROLES[0], status:'Active',
    address:'', dob:'', cnic:'', emergencyContact:'',
    department:'', experience:'', joiningDate:'', employmentType:'Full-Time',
    workLocation:'', manager:'', salary:'',
    bankName:'', accountNumber:'', accountTitle:'', iban:'',
    paymentMethod:'Bank Transfer', payCycle:'Monthly',
  });

  const toggleSection = key => setOpenSections(p => ({...p, [key]:!p[key]}));
  const ch = (f,v) => { setFormData(p=>({...p,[f]:v})); if(errors[f]) setErrors(p=>({...p,[f]:null})); };

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const snap = await getDoc(doc(db,'invites',token));
        if(!snap.exists())        setError('Invalid invite link.');
        else if(snap.data().used) setError('This invite has already been used.');
        else setInvite({ id:snap.id, ...snap.data() });
      } catch { setError('Something went wrong.'); }
      finally  { setLoading(false); }
    };
    fetchInvite();
  }, [token]);

  const handleSubmit = async () => {
    const errs = {};
    if(!formData.name?.trim())  errs.name  = 'Full name is required';
    if(!formData.email?.trim()) errs.email = 'Email is required';
    if(!formData.phone?.trim()) errs.phone = 'Phone is required';
    if(Object.keys(errs).length){
      setErrors(errs);
      setOpenSections(p=>({...p,basic:true}));
      window.scrollTo({top:0,behavior:'smooth'});
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db,'teamMembers'), {
        ...formData,
        documents:    documents.map(f=>({name:f.name,size:f.size,type:f.type})),
        media:        media.map(f=>({name:f.name,size:f.size,type:f.type})),
        profilePhoto: profilePhoto?{name:profilePhoto.name,size:profilePhoto.size,type:profilePhoto.type}:null,
        cnicFront:    cnicFront   ?{name:cnicFront.name,   size:cnicFront.size,   type:cnicFront.type   }:null,
        cnicBack:     cnicBack    ?{name:cnicBack.name,    size:cnicBack.size,    type:cnicBack.type    }:null,
        projects:0, avatar:generateAvatar(formData.name),
        joinDate:getCurrentMonthYear(), tasks:[], order:0,
        createdAt:serverTimestamp(),
      });
      await updateDoc(doc(db,'invites',invite.id), { used:true });
      setStep('success');
    } catch { alert('Error. Please try again.'); }
    finally  { setSubmitting(false); }
  };

  // ── Loading ──
  if(loading) return (
    <div style={{minHeight:'100svh',background:'#f0f4f8',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,borderRadius:'50%',border:'3px solid rgba(13,148,136,0.2)',borderTopColor:'#0d9488',animation:'spin 0.8s linear infinite',margin:'0 auto'}}/>
        <p style={{marginTop:14,color:'#64748b',fontWeight:500,fontSize:13}}>Loading invitation...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Error ──
  if(error) return (
    <div style={{minHeight:'100svh',background:'#f0f4f8',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:20,padding:'40px 32px',maxWidth:400,width:'100%',textAlign:'center',border:`1px solid ${TL}`,boxShadow:'0 8px 32px rgba(0,0,0,0.08)'}}>
        <div style={{width:56,height:56,borderRadius:'50%',background:'#fef2f2',border:'1px solid #fecaca',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <AlertCircle size={24} style={{color:'#ef4444'}}/>
        </div>
        <h3 style={{fontSize:17,fontWeight:700,color:'#111827',marginBottom:8}}>Invite Error</h3>
        <p style={{fontSize:13,color:'#6b7280',lineHeight:1.6}}>{error}</p>
      </div>
    </div>
  );

  // ── Success ──
  if(step==='success') return (
    <div style={{minHeight:'100svh',background:'linear-gradient(135deg,#e0f2fe,#f0fdfa,#ecfdf5)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:20,padding:'48px 36px',maxWidth:440,width:'100%',textAlign:'center',border:`1px solid ${TL}`,boxShadow:'0 20px 60px rgba(0,0,0,0.10)'}}>
        <div style={{width:72,height:72,borderRadius:'50%',background:'linear-gradient(135deg,#14b8a6,#06b6d4)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',boxShadow:'0 8px 24px rgba(20,184,166,0.35)'}}>
          <CheckCircle2 size={32} style={{color:'#fff'}}/>
        </div>
        <h3 style={{fontSize:22,fontWeight:800,color:'#111827',marginBottom:10}}>Welcome to the team! 🎉</h3>
        <p style={{fontSize:14,color:'#6b7280',lineHeight:1.7}}>Your profile has been saved successfully. You can now close this page.</p>
      </div>
    </div>
  );

  // ── Shared input styles ──
  const iBase = {width:'100%',padding:'12px 16px',borderRadius:12,fontSize:14,color:'#1f2937',outline:'none',transition:'all 0.2s',boxSizing:'border-box'};
  const iReq  = {...iBase,background:'#fff'};
  const iOpt  = {...iBase,background:'#f9fafb'};

  const inp  = (f,t='text',ph='') => (
    <input type={t} value={formData[f]||''} onChange={e=>ch(f,e.target.value)} placeholder={ph}
      style={{...iOpt, border:`1px solid ${errors[f]?'#f87171':TL}`}}/>
  );
  const inpR = (f,t='text',ph='') => (
    <input type={t} value={formData[f]||''} onChange={e=>ch(f,e.target.value)} placeholder={ph}
      style={{...iReq, border:`1px solid ${errors[f]?'#f87171':TL}`}}/>
  );
  const sel  = (f,opts) => (
    <select value={formData[f]||opts[0]} onChange={e=>ch(f,e.target.value)}
      style={{...iOpt, border:`1px solid ${TL}`, appearance:'none', cursor:'pointer'}}>
      {opts.map(o=><option key={o}>{o}</option>)}
    </select>
  );

  const IField = ({label, required, error, children}) => (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      <label style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:required?'#374151':'#9ca3af'}}>
        {label}
        {required  && <span style={{color:'#f87171',marginLeft:2}}>*</span>}
        {!required && <span style={{fontSize:10,fontWeight:400,textTransform:'none',letterSpacing:'normal',color:'#d1d5db',marginLeft:6}}>(optional)</span>}
      </label>
      {children}
      {error && <p style={{fontSize:11,color:'#ef4444',margin:0}}>{error}</p>}
    </div>
  );

  const IRow2 = ({children}) => (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16}}>
      {children}
    </div>
  );

  // ── Collapsible Section ──
  const ISection = ({skey, title, subtitle, icon, children}) => {
    const open = openSections[skey];
    return (
      <div style={{background:'#fff',borderRadius:16,border:`1px solid ${TL}`,overflow:'hidden'}}>
        <button type="button" onClick={()=>toggleSection(skey)}
          style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px',background:'transparent',border:'none',cursor:'pointer',textAlign:'left'}}
          onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:40,height:40,borderRadius:12,background:'linear-gradient(135deg,#14b8a6,#06b6d4)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',flexShrink:0}}>
              {icon}
            </div>
            <div>
              <p style={{fontSize:14,fontWeight:700,color:'#111827',margin:0}}>{title}</p>
              {subtitle&&<p style={{fontSize:12,color:'#9ca3af',margin:'3px 0 0'}}>{subtitle}</p>}
            </div>
          </div>
          <div style={{color:'#9ca3af',flexShrink:0}}>
            {open ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
          </div>
        </button>
        {open && (
          <div style={{padding:'0 24px 28px',borderTop:`1px solid ${TL}`}}>
            <div style={{display:'flex',flexDirection:'column',gap:20,paddingTop:24}}>
              {children}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Image upload box ──
  const ImgBox = ({label, sublabel, icon, file, onUpload, onRemove}) => {
    const inputRef = useRef(null);
    const [preview, setPreview] = useState(null);
    const [lb, setLb] = useState(false);
    useEffect(()=>{
      if(!file){setPreview(null);return;}
      if(file instanceof File){const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);}
    },[file]);
    return (
      <>
        {lb&&preview&&<Lightbox src={preview} name={label} onClose={()=>setLb(false)}/>}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#6b7280',margin:0}}>{label}</p>
          {!file ? (
            <div onClick={()=>inputRef.current?.click()}
              style={{border:'2px dashed #e5e7eb',borderRadius:12,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,padding:'28px 16px',transition:'all 0.2s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#14b8a6';e.currentTarget.style.background='rgba(20,184,166,0.04)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.background='transparent';}}>
              <div style={{width:44,height:44,borderRadius:12,background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center'}}>{icon}</div>
              <div style={{textAlign:'center'}}>
                <p style={{fontSize:12,fontWeight:600,color:'#6b7280',margin:0}}>{sublabel}</p>
                <p style={{fontSize:11,color:'#d1d5db',margin:'4px 0 0'}}>Click to browse</p>
              </div>
              <input ref={inputRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{if(e.target.files[0])onUpload(e.target.files[0]);e.target.value='';}}/>
            </div>
          ) : (
            <div style={{position:'relative',borderRadius:12,overflow:'hidden',border:'2px solid #14b8a6',aspectRatio:'16/9'}}
              className="group">
              {preview
                ? <img src={preview} alt={label} style={{width:'100%',height:'100%',objectFit:'cover',cursor:'pointer'}} onClick={()=>setLb(true)}/>
                : <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,background:'rgba(20,184,166,0.05)'}}>
                    <CheckCircle2 size={20} color="#14b8a6"/>
                    <p style={{fontSize:11,fontWeight:600,color:'#14b8a6',textAlign:'center',padding:'0 8px'}}>{file.name}</p>
                  </div>
              }
              <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',opacity:0,transition:'opacity 0.2s',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}
                onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                onMouseLeave={e=>e.currentTarget.style.opacity='0'}>
                {preview&&<button type="button" onClick={()=>setLb(true)} style={{width:36,height:36,borderRadius:8,background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}><Eye size={15}/></button>}
                <button type="button" onClick={onRemove} style={{width:36,height:36,borderRadius:8,background:'rgba(239,68,68,0.8)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}><Trash2 size={15}/></button>
              </div>
              <span style={{position:'absolute',top:8,left:8,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:6,background:'#14b8a6',color:'#fff'}}>✓</span>
            </div>
          )}
        </div>
      </>
    );
  };

  const ic = {color:'#fff'};

  return (
    <div style={{minHeight:'100svh',background:'linear-gradient(135deg,#e0f2fe 0%,#f0fdfa 50%,#ecfdf5 100%)'}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:640px){.invite-grid-2{grid-template-columns:1fr!important}.invite-grid-3{grid-template-columns:1fr 1fr!important}}
        @media(max-width:400px){.invite-grid-3{grid-template-columns:1fr!important}}
      `}</style>

      {/* ── Header ── */}
      <div style={{background:'linear-gradient(135deg,#0f766e,#0891b2)',padding:'20px 5%',position:'sticky',top:0,zIndex:10,boxShadow:'0 4px 20px rgba(0,0,0,0.15)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:40,height:40,borderRadius:12,background:'rgba(255,255,255,0.18)',display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid rgba(255,255,255,0.25)',flexShrink:0}}>
              <CheckCircle2 size={20} style={{color:'#fff'}}/>
            </div>
            <div>
              <h1 style={{fontSize:16,fontWeight:800,color:'#fff',margin:0,letterSpacing:'-0.02em'}}>Complete Your Profile</h1>
              <p style={{fontSize:11,color:'rgba(255,255,255,0.7)',margin:'2px 0 0'}}>You've been invited to join the team</p>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            style={{padding:'10px 22px',borderRadius:12,background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.35)',cursor:'pointer',fontSize:13,fontWeight:700,color:'#fff',backdropFilter:'blur(4px)',transition:'all 0.2s',opacity:submitting?0.6:1,whiteSpace:'nowrap',flexShrink:0}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.3)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.2)'}>
            {submitting?'Saving...':'✓ Submit & Join'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{padding:'28px 5% 60px'}}>

        {/* Error banner */}
        {Object.keys(errors).length>0 && (
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 18px',borderRadius:12,background:'#fef2f2',border:'1px solid #fecaca',marginBottom:20}}>
            <span style={{fontSize:13,fontWeight:600,color:'#ef4444'}}> Please fill required fields highlighted below</span>
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:16}}>

          {/* 1 Basic */}
          <ISection skey="basic" title="Basic Information" subtitle="Required — your name, role and contact" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ic}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}>
            <IField label="Full Name" required error={errors.name}>{inpR('name','text','e.g. Ali Hassan')}</IField>
            <IRow2>
              <IField label="Role" required>{sel('role',ROLES)}</IField>
              <IField label="Status" required>{sel('status',['Active','Away','Inactive'])}</IField>
            </IRow2>
            <IField label="Email Address" required error={errors.email}>{inpR('email','email','ali@company.com')}</IField>
            <IField label="Phone Number" required error={errors.phone}>{inpR('phone','tel','+92 300 0000000')}</IField>
          </ISection>

          {/* 2 Personal */}
          <ISection skey="personal" title="Personal Details" subtitle="Address, DOB, CNIC and emergency contact" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ic}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}>
            <IField label="Home Address">{inp('address','text','Street, City, Province')}</IField>
            <IRow2>
              <IField label="Date of Birth">{inp('dob','date')}</IField>
              <IField label="CNIC Number">{inp('cnic','text','00000-0000000-0')}</IField>
            </IRow2>
            <IField label="Emergency Contact">{inp('emergencyContact','text','Name – +92 300 0000000')}</IField>
          </ISection>

          {/* 3 Work */}
          <ISection skey="work" title="Work Information" subtitle="Department, salary, joining date and more" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ic}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>}>
            <IRow2>
              <IField label="Department">{inp('department','text','e.g. Engineering')}</IField>
              <IField label="Experience">{inp('experience','text','e.g. 2 years')}</IField>
            </IRow2>
            <IRow2>
              <IField label="Joining Date">{inp('joiningDate','date')}</IField>
              <IField label="Employment Type">{sel('employmentType',EMPLOYMENT_TYPES)}</IField>
            </IRow2>
            <IRow2>
              <IField label="Work Location">{inp('workLocation','text','Office / Remote')}</IField>
              <IField label="Manager">{inp('manager','text','Manager name')}</IField>
            </IRow2>
            <IField label="Monthly Salary (PKR)">{inp('salary','number','0')}</IField>
          </ISection>

          {/* 4 Bank */}
          <ISection skey="bank" title="Bank Details" subtitle="Payment method and account information" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ic}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}>
            <IRow2>
              <IField label="Bank Name">{inp('bankName','text','e.g. HBL, MCB')}</IField>
              <IField label="Payment Method">{sel('paymentMethod',PAYMENT_METHODS)}</IField>
            </IRow2>
            <IField label="Account Holder Name">{inp('accountTitle','text','Full name on account')}</IField>
            <IField label="Account Number">{inp('accountNumber','text','0000000000000000')}</IField>
            <IField label="IBAN">{inp('iban','text','PK00XXXX0000000000000000')}</IField>
          </ISection>

          {/* 5 Files */}
          <ISection skey="files" title="Identity, Documents & Media" subtitle="Profile photo, CNIC, documents and media files" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ic}><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="16" x2="12" y2="16"/></svg>}>

            {/* Identity photos */}
            <div>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#6b7280',margin:'0 0 14px'}}>Profile &amp; Identity Photos</p>
              <div className="invite-grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                <ImgBox label="Profile Photo"  sublabel="Upload profile photo"  icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} file={profilePhoto} onUpload={f=>setProfilePhoto(f)} onRemove={()=>setProfilePhoto(null)}/>
                <ImgBox label="CNIC Front"     sublabel="Front side of CNIC"    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} file={cnicFront} onUpload={f=>setCnicFront(f)} onRemove={()=>setCnicFront(null)}/>
                <ImgBox label="CNIC Back"      sublabel="Back side of CNIC"     icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} file={cnicBack}  onUpload={f=>setCnicBack(f)}  onRemove={()=>setCnicBack(null)}/>
              </div>
            </div>

            <div style={{height:1,background:'rgba(51,51,51,0.08)'}}/>

            {/* Documents */}
            <div>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#6b7280',margin:'0 0 14px'}}>Documents</p>
              <InviteDocsTab docs={documents} onAdd={f=>setDocuments(p=>[...p,f])} onRemove={i=>setDocuments(p=>p.filter((_,idx)=>idx!==i))}/>
            </div>

            <div style={{height:1,background:'rgba(51,51,51,0.08)'}}/>

            {/* Other Media */}
            <div>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#6b7280',margin:'0 0 14px'}}>Other Media</p>
              <InviteMediaTab media={media} onAdd={f=>setMedia(p=>[...p,f])} onRemove={i=>setMedia(p=>p.filter((_,idx)=>idx!==i))}/>
            </div>

          </ISection>

          {/* Submit button bottom */}
          <button onClick={handleSubmit} disabled={submitting}
            style={{width:'100%',padding:'16px',borderRadius:14,background:'linear-gradient(135deg,#14b8a6,#06b6d4)',border:'none',cursor:'pointer',fontSize:15,fontWeight:800,color:'#fff',boxShadow:'0 6px 20px rgba(20,184,166,0.4)',opacity:submitting?0.6:1,transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}
            onMouseEnter={e=>!submitting&&(e.currentTarget.style.boxShadow='0 8px 28px rgba(20,184,166,0.55)')}
            onMouseLeave={e=>e.currentTarget.style.boxShadow='0 6px 20px rgba(20,184,166,0.4)'}>
            <CheckCircle2 size={18}/>
            {submitting?'Saving your profile...':'✓ Submit & Join Team'}
          </button>

        </div>
      </div>
    </div>
  );
};

export default TeamMembers;