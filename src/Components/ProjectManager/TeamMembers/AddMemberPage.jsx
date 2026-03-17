import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  ArrowLeft, Upload, Plus, Trash2, Eye, X,
  File, FileText, FileImage, FileVideo, Music, Archive, Image,
  CheckSquare, Minus, User, CreditCard, CheckCircle2,
  ChevronDown, ChevronUp,
} from 'lucide-react';

const TL = 'rgba(51,51,51,0.20)';

const identityGridCSS = `
  .identity-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  @media (max-width: 768px) {
    .identity-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 480px) {
    .identity-grid {
      grid-template-columns: 1fr;
    }
  }
`;

const ROLES = ['Frontend Developer','Backend Developer','Flutter Developer','UI/UX Designer','Project Manager','QA Engineer','Marketing Manager','Content Writer','DevOps Engineer'];
const EMPLOYMENT_TYPES = ['Full-Time','Part-Time','Contract','Internship','Freelance'];
const PAYMENT_METHODS  = ['Bank Transfer','Cash','Cheque','JazzCash','EasyPaisa'];
const DOC_ACCEPT   = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar';
const MEDIA_ACCEPT = 'image/*,video/*,audio/*';

const generateAvatar = name => {
  const w = (name||'').trim().split(' ');
  return w.length >= 2 ? (w[0][0]+w[1][0]).toUpperCase() : (name||'??').substring(0,2).toUpperCase();
};
const getCurrentMonthYear = () => {
  const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d=new Date(); return `${m[d.getMonth()]} ${d.getFullYear()}`;
};
const emptyMember = () => ({
  name:'', role:'Frontend Developer', email:'', phone:'', status:'Active',
  address:'', dob:'', cnic:'', emergencyContact:'',
  department:'', experience:'', joiningDate:'', employmentType:'Full-Time',
  workLocation:'', manager:'', salary:'',
  bankName:'', accountNumber:'', accountTitle:'', iban:'',
  paymentMethod:'Bank Transfer', payCycle:'Monthly',
});
const formatFileSize = bytes => {
  if(!bytes) return '0 B';
  const k=1024, sizes=['B','KB','MB','GB'];
  const i=Math.floor(Math.log(bytes)/Math.log(k));
  return parseFloat((bytes/Math.pow(k,i)).toFixed(1))+' '+sizes[i];
};
const isImageFile = f => f?.type?.startsWith('image/');
const isVideoFile = f => f?.type?.startsWith('video/');
const isAudioFile = f => f?.type?.startsWith('audio/');

const getDocIcon = (file, size=18) => {
  const ext=(file.name||'').split('.').pop()?.toLowerCase();
  if(isImageFile(file))                return <FileImage size={size} className="text-violet-500"/>;
  if(isVideoFile(file))                return <FileVideo size={size} className="text-blue-500"/>;
  if(isAudioFile(file))                return <Music size={size} className="text-pink-500"/>;
  if(file.type==='application/pdf')    return <FileText size={size} className="text-red-500"/>;
  if(['zip','rar','7z'].includes(ext)) return <Archive size={size} className="text-amber-500"/>;
  return <File size={size} className="text-teal-500"/>;
};

// ── Shared input styles ───────────────────────────────────────────────────────
const inputBase = 'w-full px-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all';
const inputReq  = `${inputBase} bg-white border focus:border-teal-500 focus:ring-teal-500/20`;
const inputOpt  = `${inputBase} bg-gray-50 border focus:border-teal-400 focus:ring-teal-500/10`;

// ── Field wrapper ─────────────────────────────────────────────────────────────
const Field = ({ label, required, error, children }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
    <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color: required ? '#374151' : '#9ca3af' }}>
      {label}
      {required  && <span style={{ color:'#f87171', marginLeft:2 }}>*</span>}
      {!required && <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:'normal', color:'#d1d5db', marginLeft:6 }}>(optional)</span>}
    </label>
    {children}
    {error && <p style={{ fontSize:11, color:'#ef4444', marginTop:2 }}>{error}</p>}
  </div>
);

// ── Two column row ────────────────────────────────────────────────────────────
const Row2 = ({ children }) => (
  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
    {children}
  </div>
);

// ── Section card ──────────────────────────────────────────────────────────────
const Section = ({ title, subtitle, icon, children, defaultOpen=true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${TL}`, overflow:'hidden' }}>
      {/* Header */}
      <button type="button" onClick={()=>setOpen(p=>!p)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}
        onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#14b8a6,#06b6d4)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', flexShrink:0 }}>
            {icon}
          </div>
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:'#111827', margin:0 }}>{title}</p>
            {subtitle && <p style={{ fontSize:12, color:'#9ca3af', margin:'3px 0 0' }}>{subtitle}</p>}
          </div>
        </div>
        <div style={{ color:'#9ca3af', flexShrink:0 }}>
          {open ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div style={{ padding:'0 28px 32px', borderTop:`1px solid ${TL}` }}>
          <div style={{ display:'flex', flexDirection:'column', gap:28, paddingTop:28 }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Lightbox ──────────────────────────────────────────────────────────────────
const Lightbox = ({ src, name, onClose }) => (
  <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.92)' }} onClick={onClose}>
    <button onClick={onClose} style={{ position:'absolute', top:16, right:16, width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
      <X size={18}/>
    </button>
    <div style={{ maxWidth:'90vw', maxHeight:'90vh', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }} onClick={e=>e.stopPropagation()}>
      <img src={src} alt={name} style={{ maxWidth:'100%', maxHeight:'80vh', borderRadius:12, objectFit:'contain' }}/>
      <p style={{ color:'rgba(255,255,255,0.5)', fontSize:12 }}>{name}</p>
    </div>
  </div>
);

// ── Image Upload Box ──────────────────────────────────────────────────────────
const ImageUploadBox = ({ label, sublabel, icon, file, onUpload, onRemove }) => {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if(!file){ setPreview(null); return; }
    if(file instanceof File){
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  return (
    <>
      {lightbox && preview && <Lightbox src={preview} name={label} onClose={()=>setLightbox(false)}/>}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#6b7280', margin:0 }}>{label}</p>
        {!file ? (
          <div onClick={()=>inputRef.current?.click()}
            style={{ border:'2px dashed #e5e7eb', borderRadius:12, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'28px 16px', transition:'all 0.2s' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor='#14b8a6'; e.currentTarget.style.background='rgba(20,184,166,0.04)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.background='transparent'; }}>
            <div style={{ width:44, height:44, borderRadius:12, background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:12, fontWeight:600, color:'#6b7280', margin:0 }}>{sublabel}</p>
              <p style={{ fontSize:11, color:'#d1d5db', margin:'4px 0 0' }}>Click to browse</p>
            </div>
            <input ref={inputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ if(e.target.files[0]) onUpload(e.target.files[0]); e.target.value=''; }}/>
          </div>
        ) : (
          <div style={{ position:'relative', borderRadius:12, overflow:'hidden', border:'2px solid #14b8a6', aspectRatio:'16/9' }}
            className="group">
            {preview
              ? <img src={preview} alt={label} style={{ width:'100%', height:'100%', objectFit:'cover', cursor:'pointer' }} onClick={()=>setLightbox(true)}/>
              : <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, background:'rgba(20,184,166,0.05)' }}>
                  <CheckCircle2 size={20} color="#14b8a6"/>
                  <p style={{ fontSize:11, fontWeight:600, color:'#14b8a6', textAlign:'center', padding:'0 8px' }}>{file.name}</p>
                </div>
            }
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)', opacity:0, transition:'opacity 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
              onMouseEnter={e=>e.currentTarget.style.opacity='1'}
              onMouseLeave={e=>e.currentTarget.style.opacity='0'}>
              {preview && (
                <button type="button" onClick={()=>setLightbox(true)}
                  style={{ width:36, height:36, borderRadius:8, background:'rgba(255,255,255,0.2)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
                  <Eye size={15}/>
                </button>
              )}
              <button type="button" onClick={onRemove}
                style={{ width:36, height:36, borderRadius:8, background:'rgba(239,68,68,0.8)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
                <Trash2 size={15}/>
              </button>
            </div>
            <span style={{ position:'absolute', top:8, left:8, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6, background:'#14b8a6', color:'#fff' }}>✓ Uploaded</span>
          </div>
        )}
      </div>
    </>
  );
};

// ── Documents Uploader ────────────────────────────────────────────────────────
const DocumentsUploader = ({ documents, onAdd, onRemove }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const urlCache = useRef({});

  useEffect(() => {
    const stop = e=>{ e.preventDefault(); e.stopPropagation(); };
    window.addEventListener('dragover',stop); window.addEventListener('drop',stop);
    return ()=>{ window.removeEventListener('dragover',stop); window.removeEventListener('drop',stop); };
  },[]);

  const getUrl = useCallback((file,i)=>{ if(!urlCache.current[i]) urlCache.current[i]=URL.createObjectURL(file); return urlCache.current[i]; },[]);
  const toggleSelect = i => setSelected(p=>{ const n=new Set(p); n.has(i)?n.delete(i):n.add(i); return n; });
  const allSelected  = documents.length>0 && selected.size===documents.length;
  const someSelected = selected.size>0 && !allSelected;
  const deleteSelected = ()=>{ [...selected].sort((a,b)=>b-a).forEach(i=>onRemove(i)); setSelected(new Set()); };

  const openFile = (file,i) => {
    if(isImageFile(file)){ setPreviewFile({url:getUrl(file,i),name:file.name}); return; }
    const url=URL.createObjectURL(file);
    const a=document.createElement('a'); a.href=url; a.download=file.name; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  return (
    <>
      {previewFile && <Lightbox src={previewFile.url} name={previewFile.name} onClose={()=>setPreviewFile(null)}/>}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {/* Drop zone */}
        <div
          onDrop={e=>{ e.preventDefault(); e.stopPropagation(); dragCounter.current=0; setIsDragging(false); Array.from(e.dataTransfer.files).forEach(f=>onAdd(f)); }}
          onDragEnter={e=>{ e.preventDefault(); e.stopPropagation(); dragCounter.current++; setIsDragging(true); }}
          onDragOver={e=>{ e.preventDefault(); e.stopPropagation(); }}
          onDragLeave={e=>{ e.preventDefault(); e.stopPropagation(); dragCounter.current--; if(!dragCounter.current) setIsDragging(false); }}
          onClick={()=>fileInputRef.current?.click()}
          style={{ border:`2px dashed ${isDragging?'#14b8a6':'#e5e7eb'}`, borderRadius:12, cursor:'pointer', background:isDragging?'rgba(20,184,166,0.06)':'rgba(249,250,251,0.6)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'28px 16px', transition:'all 0.2s', position:'relative' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:isDragging?'rgba(20,184,166,0.15)':'#fff', border:`1px solid ${isDragging?'rgba(20,184,166,0.3)':'#e5e7eb'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Upload size={18} color={isDragging?'#14b8a6':'#9ca3af'}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:13, fontWeight:600, color:isDragging?'#14b8a6':'#6b7280', margin:0 }}>{isDragging?'Drop files here!':'Drag & drop or click to browse'}</p>
            <p style={{ fontSize:11, color:'#9ca3af', margin:'4px 0 0' }}>PDF, DOC, XLS, PPT, TXT, ZIP supported</p>
          </div>
          <button type="button" onClick={e=>{ e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{ position:'absolute', bottom:10, right:10, width:30, height:30, borderRadius:8, background:'#14b8a6', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:'0 2px 8px rgba(20,184,166,0.4)' }}>
            <Plus size={15}/>
          </button>
          <input ref={fileInputRef} type="file" multiple accept={DOC_ACCEPT} style={{ display:'none' }}
            onChange={e=>{ Array.from(e.target.files).forEach(f=>onAdd(f)); e.target.value=''; }}/>
        </div>

        {/* File list */}
        {documents.length>0 && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px' }}>
              <button type="button" onClick={()=>allSelected?setSelected(new Set()):setSelected(new Set(documents.map((_,i)=>i)))}
                style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', fontSize:11, fontWeight:600, color:'#6b7280' }}>
                <div style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${allSelected?'#14b8a6':someSelected?'#14b8a6':'#d1d5db'}`, background:allSelected?'#14b8a6':someSelected?'rgba(20,184,166,0.15)':'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {allSelected&&<CheckSquare size={10} color="#fff"/>}
                  {someSelected&&<Minus size={9} color="#14b8a6"/>}
                </div>
                {allSelected?'Deselect All':'Select All'}
              </button>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {selected.size>0 && (
                  <>
                    <span style={{ fontSize:11, fontWeight:600, color:'#14b8a6', background:'rgba(20,184,166,0.1)', border:'1px solid rgba(20,184,166,0.3)', padding:'2px 10px', borderRadius:99 }}>{selected.size} selected</span>
                    <button type="button" onClick={deleteSelected}
                      style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#ef4444', background:'#fef2f2', border:'1px solid #fecaca', padding:'4px 10px', borderRadius:8, cursor:'pointer' }}>
                      <Trash2 size={11}/> Delete
                    </button>
                  </>
                )}
                <span style={{ fontSize:11, color:'#9ca3af' }}>{documents.length} file{documents.length!==1?'s':''}</span>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {documents.map((file,i)=>{
                const isSel=selected.has(i);
                return (
                  <div key={i} onClick={()=>toggleSelect(i)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, cursor:'pointer', border:`1px solid ${isSel?'#14b8a6':'rgba(51,51,51,0.15)'}`, background:isSel?'rgba(20,184,166,0.05)':'#fff', transition:'all 0.15s' }}>
                    <div style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${isSel?'#14b8a6':'#d1d5db'}`, background:isSel?'#14b8a6':'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
                      onClick={e=>{ e.stopPropagation(); toggleSelect(i); }}>
                      {isSel&&<CheckSquare size={10} color="#fff"/>}
                    </div>
                    <div style={{ width:36, height:36, borderRadius:10, background:'#f9fafb', border:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {getDocIcon(file)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:'#1f2937', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</p>
                      <p style={{ fontSize:11, color:'#9ca3af', margin:'2px 0 0' }}>{formatFileSize(file.size)}</p>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }} onClick={e=>e.stopPropagation()}>
                      <button type="button" onClick={()=>openFile(file,i)}
                        style={{ width:28, height:28, borderRadius:8, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af' }}>
                        <Eye size={14}/>
                      </button>
                      <button type="button" onClick={()=>{ onRemove(i); setSelected(p=>{ const n=new Set(p); n.delete(i); return n; }); }}
                        style={{ width:28, height:28, borderRadius:8, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#d1d5db' }}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
};

// ── Media Grid ────────────────────────────────────────────────────────────────
const MediaGrid = ({ media, onAdd, onRemove }) => {
  const [lightbox, setLightbox] = useState(null);
  const mediaInputRef = useRef(null);
  const urlCache = useRef({});
  const getUrl = useCallback((file,i)=>{ if(!urlCache.current[i]) urlCache.current[i]=URL.createObjectURL(file); return urlCache.current[i]; },[]);

  return (
    <>
      {lightbox&&<Lightbox src={lightbox.url} name={lightbox.name} onClose={()=>setLightbox(null)}/>}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p style={{ fontSize:12, color:'#9ca3af', margin:0 }}>{media.length} file{media.length!==1?'s':''}</p>
          <button type="button" onClick={()=>mediaInputRef.current?.click()}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, background:'linear-gradient(135deg,#14b8a6,#06b6d4)', border:'none', cursor:'pointer', fontSize:12, fontWeight:700, color:'#fff', boxShadow:'0 2px 8px rgba(20,184,166,0.35)' }}>
            <Plus size={14}/> Add Media
          </button>
          <input ref={mediaInputRef} type="file" multiple accept={MEDIA_ACCEPT} style={{ display:'none' }}
            onChange={e=>{ Array.from(e.target.files).forEach(f=>onAdd(f)); e.target.value=''; }}/>
        </div>

        {media.length===0 ? (
          <div onClick={()=>mediaInputRef.current?.click()}
            style={{ border:'2px dashed #e5e7eb', borderRadius:12, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'36px 16px', transition:'all 0.2s' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor='#14b8a6'; e.currentTarget.style.background='rgba(20,184,166,0.03)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.background='transparent'; }}>
            <div style={{ width:44, height:44, borderRadius:12, background:'#f9fafb', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Image size={20} color="#d1d5db"/>
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:13, fontWeight:600, color:'#9ca3af', margin:0 }}>No media added yet</p>
              <p style={{ fontSize:11, color:'#d1d5db', margin:'4px 0 0' }}>Click to add images, videos or audio</p>
            </div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {media.map((file,i)=>{
              const isImg=isImageFile(file);
              const url=isImg?getUrl(file,i):null;
              return (
                <div key={i} style={{ position:'relative', borderRadius:12, overflow:'hidden', aspectRatio:'1/1', background:'#f3f4f6' }}
                  className="group">
                  {isImg&&url
                    ? <img src={url} alt={file.name} style={{ width:'100%', height:'100%', objectFit:'cover', cursor:'pointer' }} onClick={()=>setLightbox({url,name:file.name})}/>
                    : <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, background:'#f9fafb' }}>
                        <FileImage size={22} color="#a78bfa"/>
                        <span style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>{file.name.split('.').pop()}</span>
                      </div>
                  }
                  <button type="button" onClick={()=>onRemove(i)}
                    className="opacity-0 group-hover:opacity-100"
                    style={{ position:'absolute', top:6, right:6, width:22, height:22, borderRadius:6, background:'#ef4444', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', transition:'opacity 0.2s' }}>
                    <X size={11}/>
                  </button>
                </div>
              );
            })}
            <button type="button" onClick={()=>mediaInputRef.current?.click()}
              style={{ aspectRatio:'1/1', borderRadius:12, border:'2px dashed #e5e7eb', background:'#fafafa', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.2s' }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor='#14b8a6'; e.currentTarget.style.background='rgba(20,184,166,0.04)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.background='#fafafa'; }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#fff', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Plus size={16} color="#9ca3af"/>
              </div>
              <span style={{ fontSize:11, fontWeight:600, color:'#9ca3af' }}>Add More</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
const AddMemberPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(emptyMember());
  const [documents,    setDocuments]    = useState([]);
  const [media,        setMedia]        = useState([]);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [cnicFront,    setCnicFront]    = useState(null);
  const [cnicBack,     setCnicBack]     = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [errors,       setErrors]       = useState({});

  const set = (f,v) => { setData(p=>({...p,[f]:v})); if(errors[f]) setErrors(p=>({...p,[f]:null})); };

  const inp  = (f,t='text',ph='') => (
    <input type={t} value={data[f]||''} onChange={e=>set(f,e.target.value)} placeholder={ph}
      className={inputOpt} style={{ border:`1px solid ${errors[f]?'#f87171':TL}` }}/>
  );
  const inpR = (f,t='text',ph='') => (
    <input type={t} value={data[f]||''} onChange={e=>set(f,e.target.value)} placeholder={ph}
      className={inputReq} style={{ border:`1px solid ${errors[f]?'#f87171':TL}` }}/>
  );
  const sel  = (f,opts,req=false) => (
    <select value={data[f]||opts[0]} onChange={e=>set(f,e.target.value)}
      className={req?inputReq:inputOpt} style={{ border:`1px solid ${TL}` }}>
      {opts.map(o=><option key={o}>{o}</option>)}
    </select>
  );

  const handleSave = async () => {
    const errs = {};
    if(!data.name?.trim())  errs.name  = 'Full name is required';
    if(!data.email?.trim()) errs.email = 'Email is required';
    if(!data.phone?.trim()) errs.phone = 'Phone is required';
    if(Object.keys(errs).length){ setErrors(errs); window.scrollTo({top:0,behavior:'smooth'}); return; }
    setSaving(true);
    try {
      await addDoc(collection(db,'teamMembers'),{
        ...data,
        documents:    documents.map(f=>({name:f.name,size:f.size,type:f.type})),
        media:        media.map(f=>({name:f.name,size:f.size,type:f.type})),
        profilePhoto: profilePhoto?{name:profilePhoto.name,size:profilePhoto.size,type:profilePhoto.type}:null,
        cnicFront:    cnicFront   ?{name:cnicFront.name,   size:cnicFront.size,   type:cnicFront.type   }:null,
        cnicBack:     cnicBack    ?{name:cnicBack.name,    size:cnicBack.size,    type:cnicBack.type    }:null,
        projects:0, avatar:generateAvatar(data.name),
        joinDate:getCurrentMonthYear(), tasks:[],
        order:Date.now(), createdAt:serverTimestamp(),
      });
      navigate(-1);
    } catch(err){ console.error(err); alert('Error saving. Please try again.'); }
    finally{ setSaving(false); }
  };

  const iconStyle = { color:'#fff' };

  return (
    <div style={{ minHeight:'100vh', background:'#EEF2F7' }}>
      <style>{identityGridCSS}</style>

      {/* ── Sticky Top Nav ── */}
      <div style={{ position:'sticky', top:0, zIndex:10, background:'#fff', borderBottom:`1px solid ${TL}`, padding:'16px 5%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>navigate(-1)}
            style={{ display:'flex', alignItems:'center', gap:8, background:'#f3f4f6', border:'none', borderRadius:10, padding:'8px 14px', cursor:'pointer', fontSize:13, fontWeight:600, color:'#6b7280', transition:'all 0.2s' }}
            onMouseEnter={e=>e.currentTarget.style.background='#e5e7eb'}
            onMouseLeave={e=>e.currentTarget.style.background='#f3f4f6'}>
            <ArrowLeft size={15} color="#374151"/> Back
          </button>
          <div style={{ width:1, height:20, background:'#e5e7eb' }}/>
          <div>
            <p style={{ fontSize:15, fontWeight:800, color:'#111827', margin:0 }}>Add New Member</p>
            <p style={{ fontSize:11, color:'#9ca3af', margin:'2px 0 0' }}>Fill in all sections — only Basic Info is required</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 24px', borderRadius:12, background:'linear-gradient(135deg,#14b8a6,#06b6d4)', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, color:'#fff', boxShadow:'0 4px 14px rgba(20,184,166,0.4)', opacity:saving?0.6:1, transition:'all 0.2s', whiteSpace:'nowrap' }}>
          {saving ? 'Saving...' : '✓ Save Member'}
        </button>
      </div>

      {/* ── Page Body — 80% width, 10% padding each side ── */}
      <div style={{ padding:'28px 10% 60px' }}>

        {/* Error banner */}
        {Object.keys(errors).length>0 && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 18px', borderRadius:12, background:'#fef2f2', border:'1px solid #fecaca', marginBottom:20 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#ef4444' }}>⚠ Please fill required fields highlighted below</span>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* 1 — Basic Info */}
          <Section title="Basic Information" subtitle="Required — Name, role, email and phone" icon={<User size={18} style={iconStyle}/>} defaultOpen={true}>
            <Field label="Full Name" required error={errors.name}>{inpR('name','text','e.g. Ali Hassan')}</Field>
            <Row2>
              <Field label="Role" required>{sel('role',ROLES,true)}</Field>
              <Field label="Status" required>{sel('status',['Active','Away','Inactive'],true)}</Field>
            </Row2>
            <Field label="Email Address" required error={errors.email}>{inpR('email','email','ali@company.com')}</Field>
            <Field label="Phone Number" required error={errors.phone}>{inpR('phone','tel','+92 300 0000000')}</Field>
          </Section>

          {/* 2 — Personal */}
          <Section title="Personal Details" subtitle="Address, DOB, CNIC and emergency contact" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} defaultOpen={false}>
            <Field label="Home Address">{inp('address','text','Street, City, Province')}</Field>
            <Row2>
              <Field label="Date of Birth">{inp('dob','date')}</Field>
              <Field label="CNIC Number">{inp('cnic','text','00000-0000000-0')}</Field>
            </Row2>
            <Field label="Emergency Contact">{inp('emergencyContact','text','Name – +92 300 0000000')}</Field>
          </Section>

          {/* 3 — Work */}
          <Section title="Work Information" subtitle="Department, salary, joining date and more" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>} defaultOpen={false}>
            <Row2>
              <Field label="Department">{inp('department','text','e.g. Engineering')}</Field>
              <Field label="Experience">{inp('experience','text','e.g. 2 years')}</Field>
            </Row2>
            <Row2>
              <Field label="Joining Date">{inp('joiningDate','date')}</Field>
              <Field label="Employment Type">{sel('employmentType',EMPLOYMENT_TYPES)}</Field>
            </Row2>
            <Row2>
              <Field label="Work Location">{inp('workLocation','text','Office / Remote')}</Field>
              <Field label="Manager">{inp('manager','text','Manager name')}</Field>
            </Row2>
            <Field label="Monthly Salary (PKR)">{inp('salary','number','0')}</Field>
          </Section>

          {/* 4 — Bank */}
          <Section title="Bank Details" subtitle="Payment method and account information" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} defaultOpen={false}>
            <Row2>
              <Field label="Bank Name">{inp('bankName','text','e.g. HBL, MCB')}</Field>
              <Field label="Payment Method">{sel('paymentMethod',PAYMENT_METHODS)}</Field>
            </Row2>
            <Field label="Account Holder Name">{inp('accountTitle','text','Full name on account')}</Field>
            <Field label="Account Number">{inp('accountNumber','text','0000000000000000')}</Field>
            <Field label="IBAN">{inp('iban','text','PK00XXXX0000000000000000')}</Field>
          </Section>

          {/* 5 — Identity */}
          {/* 5 — Identity, Documents & Media — combined */}
          <Section title="Identity, Documents & Media" subtitle="Profile photo, CNIC, documents and other files" icon={<CreditCard size={18} style={iconStyle}/>} defaultOpen={false}>

            {/* ── Profile & CNIC ── */}
            <div>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#9ca3af',margin:'0 0 12px'}}>
                Profile &amp; Identity Photos
              </p>
              <div className="identity-grid">
                <ImageUploadBox label="Profile Photo" sublabel="Upload profile photo" icon={<User size={20} color="#9ca3af"/>} file={profilePhoto} onUpload={f=>setProfilePhoto(f)} onRemove={()=>setProfilePhoto(null)}/>
                <ImageUploadBox label="CNIC Front" sublabel="Front side of CNIC" icon={<CreditCard size={20} color="#9ca3af"/>} file={cnicFront} onUpload={f=>setCnicFront(f)} onRemove={()=>setCnicFront(null)}/>
                <ImageUploadBox label="CNIC Back" sublabel="Back side of CNIC" icon={<CreditCard size={20} color="#9ca3af"/>} file={cnicBack} onUpload={f=>setCnicBack(f)} onRemove={()=>setCnicBack(null)}/>
              </div>
            </div>

            {/* ── Divider ── */}
            <div style={{height:1,background:'rgba(51,51,51,0.10)',margin:'4px 0'}}/>

            {/* ── Documents ── */}
            <div>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#9ca3af',margin:'0 0 12px'}}>
                Documents
              </p>
              <DocumentsUploader documents={documents} onAdd={f=>setDocuments(p=>[...p,f])} onRemove={i=>setDocuments(p=>p.filter((_,idx)=>idx!==i))}/>
            </div>

            {/* ── Divider ── */}
            <div style={{height:1,background:'rgba(51,51,51,0.10)',margin:'4px 0'}}/>

            {/* ── Other Media ── */}
            <div>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#9ca3af',margin:'0 0 12px'}}>
                Other Media
              </p>
              <MediaGrid media={media} onAdd={f=>setMedia(p=>[...p,f])} onRemove={i=>setMedia(p=>p.filter((_,idx)=>idx!==i))}/>
            </div>

          </Section>

          {/* Bottom buttons */}
          <div style={{ display:'flex', gap:12, paddingTop:8 }}>
            <button type="button" onClick={()=>navigate(-1)}
              style={{ flex:1, padding:'14px', borderRadius:12, background:'#fff', border:`1px solid ${TL}`, cursor:'pointer', fontSize:14, fontWeight:600, color:'#6b7280', transition:'all 0.2s' }}
              onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
              onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              style={{ flex:1, padding:'14px', borderRadius:12, background:'linear-gradient(135deg,#14b8a6,#06b6d4)', border:'none', cursor:'pointer', fontSize:14, fontWeight:700, color:'#fff', boxShadow:'0 4px 14px rgba(20,184,166,0.4)', opacity:saving?0.6:1, transition:'all 0.2s' }}>
              {saving?'Saving...':'✓ Save Member'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AddMemberPage;