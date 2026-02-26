import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase';
import {
  Edit, Plus, Table, ArrowLeft, Image, FileText, Link2,
  Trash2, X, FolderPlus, Upload, AlertCircle,
  MoreVertical, ExternalLink, CheckSquare, Square, Folder, Search,
  Loader, Pencil,
  Loader2,
  FolderArchive
} from 'lucide-react';
import { GoFileMedia } from 'react-icons/go';
import { SiGoogledocs } from 'react-icons/si';
import { LiaGrinSquintTears, LiaLinkSolid } from 'react-icons/lia';
import { PiLinkSimpleLight } from 'react-icons/pi';

const MEDIA_TYPES = ['jpg','jpeg','png','gif','webp','svg','mp4','mov','avi','mkv'];
const DOC_TYPES   = ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','zip','rar'];

const Clients = () => {
  const { showAddClientModal, setShowAddClientModal } = useOutletContext();

  const [clientsList, setClientsList]         = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm]           = useState('');
  const [loading, setLoading]                 = useState(true);

  const [showEditModal, setShowEditModal]     = useState(false);
  const [selectedClient, setSelectedClient]   = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [editClient, setEditClient] = useState({ name:'', contact:'', email:'', phone:'', industry:'', status:'', revenue:'', projects:0 });
  const [newClient, setNewClient]   = useState({ name:'', contact:'', email:'', phone:'', industry:'Technology', status:'Active', revenue:'' });

  const [showMediaPage, setShowMediaPage]     = useState(false);
  const [mediaTab, setMediaTab]               = useState('media');
  const [currentFolder, setCurrentFolder]     = useState(null);
  const [dragActive, setDragActive]           = useState(false);
  const [uploading, setUploading]             = useState(false);
  const [showAddLinkModal, setShowAddLinkModal]           = useState(false);
  const [showAddTextModal, setShowAddTextModal]           = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showWrongTypeMsg, setShowWrongTypeMsg]           = useState('');
  const [linkData, setLinkData]   = useState({ name:'', url:'' });
  const [textData, setTextData]   = useState({ name:'', content:'' });
  const [folderName, setFolderName] = useState('');
  const [selectMode, setSelectMode]       = useState(false);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [openMenuId, setOpenMenuId]       = useState(null);
  const [viewTextFile, setViewTextFile]   = useState(null);
  const [deleteProgress, setDeleteProgress] = useState(null);
  const [confirmDialog, setConfirmDialog]   = useState(null);

  const [showEditFileModal, setShowEditFileModal] = useState(false);
  const [editFileData, setEditFileData]           = useState(null);
  const [editFileName, setEditFileName]           = useState('');
  const [editFileContent, setEditFileContent]     = useState('');
  const [savingFile, setSavingFile]               = useState(false);

  const industries = ['Technology','Consulting','Marketing','Design','Finance','Healthcare','Education','Real Estate','Manufacturing','Retail'];

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClientsList(data);
      if (selectedClientId) {
        const updated = data.find(c => c.id === selectedClientId);
        if (updated) setSelectedClient(updated);
      }
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return () => unsub();
  }, [selectedClientId]);

  useEffect(() => {
    if (!searchTerm.trim()) { setFilteredClients(clientsList); return; }
    const term = searchTerm.toLowerCase();
    setFilteredClients(clientsList.filter(c =>
      c.name?.toLowerCase().includes(term) ||
      c.contact?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.industry?.toLowerCase().includes(term)
    ));
  }, [searchTerm, clientsList]);

  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    setSelectMode(false);
    setSelectedFiles(new Set());
    setOpenMenuId(null);
  }, [mediaTab, currentFolder]);

  const getCurrentDate      = () => new Date().toISOString().split('T')[0];
  const getCurrentMonthYear = () => {
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = new Date();
    return `${m[d.getMonth()]} ${d.getFullYear()}`;
  };
  const formatFileSize = bytes => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1)+' KB';
    return (bytes/(1024*1024)).toFixed(1)+' MB';
  };
  const getFileIcon = type => {
    const t = (type||'').toLowerCase();
    if (['jpg','jpeg','png','gif','webp','svg'].includes(t)) return '🖼️';
    if (['mp4','mov','avi','mkv'].includes(t)) return '🎬';
    if (t==='pdf') return '📄';
    if (['doc','docx'].includes(t)) return '📝';
    if (['xls','xlsx'].includes(t)) return '📊';
    if (['ppt','pptx'].includes(t)) return '📊';
    if (t==='link') return '🔗';
    if (t==='text') return '📋';
    if (['zip','rar'].includes(t)) return '📦';
    return '📎';
  };

  const getFilesInCurrentView = () => {
    if (!selectedClient?.files) return [];
    const allFiles = currentFolder
      ? (selectedClient.files.folders||[]).find(f=>f.id===currentFolder.id)?.files || []
      : (selectedClient.files.root||[]);
    if (mediaTab === 'media') return allFiles.filter(f => MEDIA_TYPES.includes((f.type||'').toLowerCase()));
    if (mediaTab === 'docs')  return allFiles.filter(f => DOC_TYPES.includes((f.type||'').toLowerCase()) || f.type === 'text');
    if (mediaTab === 'links') return allFiles.filter(f => f.type === 'link');
    return allFiles;
  };
  const getAllFolders = () => selectedClient?.files?.folders || [];

  const toggleFileSelect = (fileId) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      next.has(fileId) ? next.delete(fileId) : next.add(fileId);
      return next;
    });
  };
  const toggleSelectAll = (files) => {
    if (selectedFiles.size === files.length) setSelectedFiles(new Set());
    else setSelectedFiles(new Set(files.map(f => f.id)));
  };

  const openEditFile = (file, e) => {
    e.stopPropagation();
    setOpenMenuId(null);
    setEditFileData(file);
    setEditFileName(file.name);
    setEditFileContent(file.content || '');
    setShowEditFileModal(true);
  };

  const handleSaveEditFile = async () => {
    if (!editFileName.trim()) return;
    setSavingFile(true);
    try {
      const updatedFiles = {
        folders: JSON.parse(JSON.stringify(selectedClient.files?.folders || [])),
        root:    JSON.parse(JSON.stringify(selectedClient.files?.root    || [])),
      };
      const applyEdit = (fileList) => fileList.map(f => {
        if (f.id !== editFileData.id) return f;
        const updated = { ...f, name: editFileName.trim() };
        if (f.type === 'text') updated.content = editFileContent;
        return updated;
      });
      if (currentFolder) {
        const folder = updatedFiles.folders.find(f => f.id === currentFolder.id);
        if (folder) folder.files = applyEdit(folder.files);
      } else {
        updatedFiles.root = applyEdit(updatedFiles.root);
      }
      await updateDoc(doc(db, 'clients', selectedClientId), { files: updatedFiles });
      setShowEditFileModal(false);
      setEditFileData(null);
    } catch (err) {
      alert('Error saving changes');
      console.error(err);
    }
    setSavingFile(false);
  };

  const handleAddSubmit = async e => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'clients'), {
        ...newClient, projects: 0,
        revenue: newClient.revenue.startsWith('$') ? newClient.revenue : `$${newClient.revenue}`,
        since: getCurrentMonthYear(),
        files: { folders:[], root:[] },
        createdAt: serverTimestamp()
      });
      setNewClient({ name:'',contact:'',email:'',phone:'',industry:'Technology',status:'Active',revenue:'' });
      setShowAddClientModal(false);
    } catch(err) { alert('Error adding client'); console.error(err); }
  };

  const openEdit = (client, e) => {
    e.stopPropagation();
    setSelectedClient(client); setSelectedClientId(client.id);
    setEditClient({ name:client.name, contact:client.contact, email:client.email, phone:client.phone, industry:client.industry, status:client.status, revenue:(client.revenue||'').replace('$',''), projects:client.projects||0 });
    setShowEditModal(true);
  };

  const handleUpdateSubmit = async e => {
    e.preventDefault();
    try {
      await updateDoc(doc(db,'clients',selectedClientId), {
        ...editClient,
        revenue: editClient.revenue.startsWith('$') ? editClient.revenue : `$${editClient.revenue}`,
        projects: parseInt(editClient.projects)||0
      });
      setShowEditModal(false);
    } catch(err) { alert('Error updating client'); }
  };

  const handleDeleteClient = async (client, e) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${client.name}?`)) return;
    try {
      const promises = [];
      (client.files?.root||[]).forEach(f => f.storagePath && promises.push(deleteObject(ref(storage,f.storagePath)).catch(()=>{})));
      (client.files?.folders||[]).forEach(folder => (folder.files||[]).forEach(f => f.storagePath && promises.push(deleteObject(ref(storage,f.storagePath)).catch(()=>{}))));
      await Promise.all(promises);
      await deleteDoc(doc(db,'clients',client.id));
    } catch(err) { alert('Error deleting client'); }
  };

  const openMediaManager = (client, e) => {
    e.stopPropagation();
    setSelectedClient(client); setSelectedClientId(client.id);
    setCurrentFolder(null); setMediaTab('media'); setShowMediaPage(true);
    setSelectMode(false); setSelectedFiles(new Set());
  };

  const handleFiles = async files => {
    if (!files?.length || !storage || !selectedClientId) return;
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (mediaTab === 'media' && !MEDIA_TYPES.includes(ext)) {
        setShowWrongTypeMsg(`"${file.name}" media file nahi hai!`);
        setTimeout(() => setShowWrongTypeMsg(''), 4000); return;
      }
      if (mediaTab === 'docs' && !DOC_TYPES.includes(ext)) {
        setShowWrongTypeMsg(`"${file.name}" document nahi hai!`);
        setTimeout(() => setShowWrongTypeMsg(''), 4000); return;
      }
    }
    setUploading(true);
    try {
      const updatedFiles = {
        folders: JSON.parse(JSON.stringify(selectedClient.files?.folders||[])),
        root:    JSON.parse(JSON.stringify(selectedClient.files?.root||[]))
      };
      for (const file of files) {
        const ts = Date.now(), rid = Math.floor(Math.random()*10000);
        const storagePath = `clients/${selectedClientId}/files/${ts}_${rid}_${file.name}`;
        await uploadBytes(ref(storage, storagePath), file);
        const url = await getDownloadURL(ref(storage, storagePath));
        const newFile = { id:`file${ts}_${rid}`, name:file.name, size:formatFileSize(file.size), type:file.name.split('.').pop().toLowerCase(), uploadedOn:getCurrentDate(), url, storagePath };
        if (currentFolder) { const folder = updatedFiles.folders.find(f=>f.id===currentFolder.id); if (folder) folder.files.push(newFile); }
        else { updatedFiles.root.push(newFile); }
      }
      await updateDoc(doc(db,'clients',selectedClientId),{files:updatedFiles});
    } catch(err) { alert(`Upload error: ${err.message}`); }
    setUploading(false);
  };

  const handleAddLink = async () => {
    if (!linkData.name.trim()||!linkData.url.trim()) return;
    try {
      const updatedFiles = { folders: JSON.parse(JSON.stringify(selectedClient.files?.folders||[])), root: JSON.parse(JSON.stringify(selectedClient.files?.root||[])) };
      const newLink = { id:`link${Date.now()}`, name:linkData.name, size:'Link', type:'link', uploadedOn:getCurrentDate(), link:linkData.url };
      if (currentFolder) { const folder = updatedFiles.folders.find(f=>f.id===currentFolder.id); if (folder) folder.files.push(newLink); }
      else { updatedFiles.root.push(newLink); }
      await updateDoc(doc(db,'clients',selectedClientId),{files:updatedFiles});
      setLinkData({name:'',url:''}); setShowAddLinkModal(false);
    } catch(err) { alert('Error adding link'); }
  };

  const handleAddText = async () => {
    if (!textData.name.trim()||!textData.content.trim()) return;
    try {
      const updatedFiles = { folders: JSON.parse(JSON.stringify(selectedClient.files?.folders||[])), root: JSON.parse(JSON.stringify(selectedClient.files?.root||[])) };
      const newEntry = { id:`text${Date.now()}`, name:textData.name, size:'Text', type:'text', uploadedOn:getCurrentDate(), content:textData.content };
      if (currentFolder) { const folder = updatedFiles.folders.find(f=>f.id===currentFolder.id); if (folder) folder.files.push(newEntry); }
      else { updatedFiles.root.push(newEntry); }
      await updateDoc(doc(db,'clients',selectedClientId),{files:updatedFiles});
      setTextData({name:'',content:''}); setShowAddTextModal(false);
    } catch(err) { alert('Error saving text'); }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    try {
      const updatedFiles = { folders: [...(selectedClient.files?.folders||[]), { id:`f${Date.now()}`, name:folderName, files:[] }], root: selectedClient.files?.root||[] };
      await updateDoc(doc(db,'clients',selectedClientId),{files:updatedFiles});
      setFolderName(''); setShowCreateFolderModal(false);
    } catch(err) { alert('Error creating folder'); }
  };

  const askConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });

  const handleDeleteFile = (fileId) => {
    askConfirm('Are you sure you want to delete this file?', async () => {
      setDeleteProgress({ label: 'Deleting file...', pct: 20 });
      try {
        const updatedFiles = { folders: JSON.parse(JSON.stringify(selectedClient.files?.folders||[])), root: JSON.parse(JSON.stringify(selectedClient.files?.root||[])) };
        let fileToDelete;
        if (currentFolder) { const folder = updatedFiles.folders.find(f=>f.id===currentFolder.id); fileToDelete = folder.files.find(f=>f.id===fileId); folder.files = folder.files.filter(f=>f.id!==fileId); }
        else { fileToDelete = updatedFiles.root.find(f=>f.id===fileId); updatedFiles.root = updatedFiles.root.filter(f=>f.id!==fileId); }
        setDeleteProgress({ label: 'Removing from storage...', pct: 50 });
        if (fileToDelete?.storagePath) await deleteObject(ref(storage,fileToDelete.storagePath)).catch(()=>{});
        setDeleteProgress({ label: 'Saving changes...', pct: 80 });
        await updateDoc(doc(db,'clients',selectedClientId),{files:updatedFiles});
        setDeleteProgress({ label: 'Done!', pct: 100 });
        setTimeout(() => setDeleteProgress(null), 800);
      } catch(err) { setDeleteProgress(null); alert('Error deleting file'); }
    });
  };

  const handleDeleteSelected = () => {
    if (!selectedFiles.size) return;
    askConfirm(`Are you sure you want to delete ${selectedFiles.size} selected file(s)?`, async () => {
      setDeleteProgress({ label: 'Preparing deletion...', pct: 10 });
      try {
        const updatedFiles = { folders: JSON.parse(JSON.stringify(selectedClient.files?.folders||[])), root: JSON.parse(JSON.stringify(selectedClient.files?.root||[])) };
        const ids = Array.from(selectedFiles);
        const storagePromises = [];
        if (currentFolder) {
          const folder = updatedFiles.folders.find(f=>f.id===currentFolder.id);
          ids.forEach(id => { const f = folder.files.find(fi=>fi.id===id); if (f?.storagePath) storagePromises.push(deleteObject(ref(storage,f.storagePath)).catch(()=>{})); });
          folder.files = folder.files.filter(f=>!ids.includes(f.id));
        } else {
          ids.forEach(id => { const f = updatedFiles.root.find(fi=>fi.id===id); if (f?.storagePath) storagePromises.push(deleteObject(ref(storage,f.storagePath)).catch(()=>{})); });
          updatedFiles.root = updatedFiles.root.filter(f=>!ids.includes(f.id));
        }
        setDeleteProgress({ label: `Deleting ${ids.length} files...`, pct: 50 });
        await Promise.all(storagePromises);
        setDeleteProgress({ label: 'Saving changes...', pct: 80 });
        await updateDoc(doc(db,'clients',selectedClientId),{files:updatedFiles});
        setDeleteProgress({ label: 'Done!', pct: 100 });
        setTimeout(() => setDeleteProgress(null), 800);
        setSelectedFiles(new Set()); setSelectMode(false);
      } catch(err) { setDeleteProgress(null); alert('Error deleting files'); }
    });
  };

  const handleDeleteFolder = (folderId, folderName) => {
    askConfirm(`Delete folder "${folderName}" and all its contents?`, async () => {
      setDeleteProgress({ label: 'Preparing folder deletion...', pct: 10 });
      try {
        const updatedFiles = { folders: JSON.parse(JSON.stringify(selectedClient.files?.folders||[])), root: selectedClient.files?.root||[] };
        const folder = updatedFiles.folders.find(f=>f.id===folderId);
        const filesToDelete = (folder?.files||[]).filter(f=>f.storagePath);
        if (filesToDelete.length > 0) {
          setDeleteProgress({ label: `Deleting ${filesToDelete.length} file(s)...`, pct: 40 });
          await Promise.all(filesToDelete.map(f=>deleteObject(ref(storage,f.storagePath)).catch(()=>{})));
        }
        setDeleteProgress({ label: 'Removing folder...', pct: 75 });
        updatedFiles.folders = updatedFiles.folders.filter(f=>f.id!==folderId);
        await updateDoc(doc(db,'clients',selectedClientId),{files:updatedFiles});
        setDeleteProgress({ label: 'Done!', pct: 100 });
        setTimeout(() => setDeleteProgress(null), 800);
        if (currentFolder?.id===folderId) setCurrentFolder(null);
      } catch(err) { setDeleteProgress(null); alert('Error deleting folder'); }
    });
  };

  const handleDrag = e => {
    e.preventDefault(); e.stopPropagation();
    if (mediaTab === 'links' || mediaTab === 'folders') return;
    setDragActive(e.type==='dragenter'||e.type==='dragover');
  };
  const handleDrop = e => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (mediaTab==='links' || mediaTab==='folders') return;
    const dropped = Array.from(e.dataTransfer.files||[]);
    if (dropped.length) handleFiles(dropped);
  };

  const inputCls = "w-full px-4 py-3 bg-[#F8FAFC] border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all";

  if (loading) return (
    <div className="p-8 min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="text-center"><div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin mx-auto mb-4"></div><div className="text-lg font-semibold text-gray-600">Loading clients...</div></div>
    </div>
  );

  // ════════════════════════════════════════════════
  // MEDIA MANAGER PAGE
  // ════════════════════════════════════════════════
  if (showMediaPage && selectedClient) {
    const files = getFilesInCurrentView();
    const allSelected = files.length > 0 && selectedFiles.size === files.length;
    const folders = getAllFolders();

    return (
      <div className="min-h-screen bg-[#EEF2F7] flex flex-col"
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>

        {dragActive && (
          <div className="fixed inset-0 bg-teal-500/10 border-4 border-dashed border-teal-400 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-center"><div className="text-6xl mb-3">📤</div><div className="text-2xl font-bold text-teal-500">Drop to Upload</div></div>
          </div>
        )}

        {/* ── Media Manager Header ── */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-3 md:py-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={()=>{ setShowMediaPage(false); setCurrentFolder(null); setSelectMode(false); setSelectedFiles(new Set()); }}
              className="flex items-center gap-2 text-gray-500 hover:text-teal-600 transition-colors font-medium text-sm flex-shrink-0">
              <ArrowLeft size={20}/> Back
            </button>
            <div className="w-px h-6 bg-gray-100 hidden sm:block"/>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-xl font-bold text-gray-900 truncate">{selectedClient.name}</h1>
              {currentFolder && <p className="text-xs text-gray-500">📂 {currentFolder.name}</p>}
            </div>
            {selectMode && selectedFiles.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 whitespace-nowrap">{selectedFiles.size} selected</span>
                <button onClick={handleDeleteSelected} className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-400 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-500/30 transition-all">
                  <Trash2 size={13}/> Delete
                </button>
                <button onClick={()=>{ setSelectMode(false); setSelectedFiles(new Set()); }} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition-all font-medium">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {showWrongTypeMsg && (
          <div className="mx-4 md:mx-8 mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5"/>
            <div><p className="text-red-400 font-semibold text-sm">Galat File Type!</p><p className="text-red-300 text-sm mt-0.5">{showWrongTypeMsg}</p></div>
            <button onClick={()=>setShowWrongTypeMsg('')} className="ml-auto text-red-400 hover:text-red-300"><X size={16}/></button>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ── Tabs + Actions row ── */}
          <div className="px-4 md:px-8 pt-4 md:pt-6 pb-3 md:pb-4">
            {/* Tabs — horizontally scrollable on mobile */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 flex-shrink-0"
                style={{ scrollbarWidth: 'none' }}>
                <style>{`.tabs-scroll::-webkit-scrollbar{display:none}`}</style>
                {[
                  { id:'media',   label:'Media',   icon:<Image size={15}/> },
                  { id:'docs',    label:'Docs',    icon:<FileText size={15}/> },
                  { id:'links',   label:'Links',   icon:<Link2 size={15}/> },
                  { id:'folders', label:'Folders', icon:<Folder size={15}/> },
                ].map(t=>(
                  <button key={t.id} onClick={()=>{ setMediaTab(t.id); setCurrentFolder(null); }}
                    className={`flex items-center gap-1.5 px-3 md:px-5 py-2 md:py-2.5 rounded-lg font-semibold text-xs md:text-sm transition-all whitespace-nowrap flex-shrink-0
                      ${mediaTab===t.id ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg' : 'bg-white text-gray-500 hover:text-gray-900'}`}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                {mediaTab === 'media' && (
                  <>
                    {files.length > 0 && (
                      <button onClick={()=>{ setSelectMode(true); toggleSelectAll(files); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 rounded-lg text-xs md:text-sm transition-all whitespace-nowrap">
                        {allSelected ? <CheckSquare size={14} className="text-teal-500"/> : <Square size={14}/>} Select All
                      </button>
                    )}
                    <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs md:text-sm font-semibold cursor-pointer transition-all whitespace-nowrap ${uploading ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500' : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:opacity-90'}`}>
                      {uploading ? <>⏳ Uploading...</> : <><Plus size={14}/> Add Media</>}
                      <input type="file" multiple className="hidden" disabled={uploading} accept="image/*,video/*" onChange={e=>handleFiles(Array.from(e.target.files))}/>
                    </label>
                  </>
                )}
                {mediaTab === 'docs' && (
                  <>
                    <button onClick={()=>setShowAddTextModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs md:text-sm font-semibold bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-all whitespace-nowrap">
                      <Plus size={14}/> Add Text
                    </button>
                    <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs md:text-sm font-semibold cursor-pointer transition-all whitespace-nowrap ${uploading ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500' : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:opacity-90'}`}>
                      {uploading ? <>⏳ Uploading...</> : <><Upload size={14}/> Upload Doc</>}
                      <input type="file" multiple className="hidden" disabled={uploading} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" onChange={e=>handleFiles(Array.from(e.target.files))}/>
                    </label>
                  </>
                )}
                {mediaTab === 'links' && (
                  <button onClick={()=>setShowAddLinkModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg text-xs md:text-sm font-semibold hover:opacity-90 transition-all whitespace-nowrap">
                    <Link2 size={14}/> Add Link
                  </button>
                )}
                {mediaTab === 'folders' && (
                  <button onClick={()=>setShowCreateFolderModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg text-xs md:text-sm font-semibold hover:opacity-90 transition-all whitespace-nowrap">
                    <FolderPlus size={14}/> New Folder
                  </button>
                )}
              </div>
            </div>
          </div>

          {currentFolder && mediaTab !== 'folders' && (
            <div className="px-4 md:px-8 pb-3 flex items-center gap-2 text-sm">
              <button onClick={()=>setCurrentFolder(null)} className="text-teal-600 hover:underline font-medium">🏠 Root</button>
              <span className="text-gray-400">/</span>
              <span className="text-gray-900">{currentFolder.name}</span>
            </div>
          )}

          <div className="flex-1 px-4 md:px-8 pb-8 overflow-y-auto">
            {mediaTab === 'media' && (
              files.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                  {files.map(file => {
                    const isImg = ['jpg','jpeg','png','gif','webp','svg'].includes((file.type||'').toLowerCase());
                    const isSelected = selectedFiles.has(file.id);
                    return (
                      <div key={file.id}
                        className={`group relative bg-white border rounded-xl overflow-hidden transition-all cursor-pointer shadow-sm ${isSelected ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-gray-200 hover:border-teal-400 hover:shadow-md'}`}
                        onClick={()=>{ if(selectMode) toggleFileSelect(file.id); }}>
                        {isImg
                          ? <img src={file.url} alt={file.name} className="w-full h-28 md:h-36 object-cover"/>
                          : <div className="w-full h-28 md:h-36 flex items-center justify-center bg-[#EEF2F7] text-5xl">🎬</div>}
                        <div className={`absolute top-2 left-2 z-10 transition-opacity ${selectMode || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          onClick={e=>{ e.stopPropagation(); setSelectMode(true); toggleFileSelect(file.id); }}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-teal-500 border-teal-500' : 'bg-white/70 border-gray-300 hover:border-teal-500'}`}>
                            {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        </div>
                        <div className={`absolute top-2 right-2 z-10 transition-opacity ${openMenuId===file.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={e=>e.stopPropagation()}>
                          <button onClick={e=>{ e.stopPropagation(); setOpenMenuId(openMenuId===file.id ? null : file.id); }}
                            className="p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80"><MoreVertical size={14}/></button>
                          {openMenuId === file.id && (
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden min-w-[140px]">
                              <button onClick={()=>{ window.open(file.url,'_blank'); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-100"><ExternalLink size={13}/> Open</button>
                              <button onClick={()=>{ handleDeleteFile(file.id); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-50"><Trash2 size={13}/> Delete</button>
                            </div>
                          )}
                        </div>
                        <div className="p-2 md:p-3">
                          <p className="text-gray-900 text-xs font-medium truncate">{file.name}</p>
                          <p className="text-gray-400 text-xs mt-0.5">{file.size}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="text-5xl text-black mb-4"><GoFileMedia/></div>
                  <p className="text-xl font-semibold text-gray-500 mb-2">No media files yet</p>
                  <p className="text-gray-400 text-sm">Click "+ Add Media" to upload images or videos</p>
                </div>
              )
            )}

            {mediaTab === 'docs' && (
              files.length > 0 ? (
                <div className="space-y-2">
                  {files.map(file => (
                    <div key={file.id}
                      className="group relative flex items-center gap-3 md:gap-4 bg-white border border-gray-200 rounded-xl p-3 md:p-4 hover:border-teal-400 hover:shadow-sm transition-all cursor-pointer"
                      onClick={()=>{ if(file.type==='text') setViewTextFile(file); else if(file.url) window.open(file.url,'_blank'); }}>
                      <div className="text-2xl md:text-3xl flex-shrink-0">{getFileIcon(file.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-semibold text-sm truncate">{file.name}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{file.type !== 'text' ? `${file.size} · ` : ''}📅 {file.uploadedOn}</p>
                      </div>
                      <div className="flex-shrink-0 relative" onClick={e=>e.stopPropagation()}>
                        <button onClick={e=>{ e.stopPropagation(); setOpenMenuId(openMenuId===file.id ? null : file.id); }}
                          className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100">
                          <MoreVertical size={16}/>
                        </button>
                        {openMenuId === file.id && (
                          <div className="absolute right-0 top-8 bg-[#EEF2F7] border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden min-w-[150px]">
                            <button onClick={e=>openEditFile(file, e)} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-900 hover:bg-white transition-colors">
                              <Pencil size={13} className="text-teal-500"/> Edit
                            </button>
                            <div className="border-t border-gray-200"/>
                            <button onClick={()=>{ handleDeleteFile(file.id); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-50 transition-colors">
                              <Trash2 size={13}/> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="text-5xl text-black mb-4"><SiGoogledocs/></div>
                  <p className="text-xl font-semibold text-gray-500 mb-2">No documents yet</p>
                  <p className="text-gray-400 text-sm">Upload documents or add text/credentials</p>
                </div>
              )
            )}

            {mediaTab === 'links' && (
              files.length > 0 ? (
                <div className="space-y-2">
                  {files.map(file => (
                    <div key={file.id} className="group relative flex items-start gap-3 md:gap-4 bg-white border border-gray-200 rounded-xl p-3 md:p-4 hover:border-teal-400 hover:shadow-sm transition-all">
                      <div className="text-2xl md:text-3xl flex-shrink-0">🔗</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-semibold text-sm truncate">{file.name}</p>
                        <div className="flex flex-wrap gap-2 text-xs mt-0.5">
                          <span className="text-teal-500 truncate max-w-[200px] md:max-w-xs">{file.link}</span>
                          <span className="text-gray-400">📅 {file.uploadedOn}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 relative" onClick={e=>e.stopPropagation()}>
                        <button onClick={e=>{ e.stopPropagation(); setOpenMenuId(openMenuId===file.id ? null : file.id); }}
                          className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100"><MoreVertical size={16}/></button>
                        {openMenuId === file.id && (
                          <div className="absolute right-0 top-8 bg-[#EEF2F7] border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden min-w-[140px]">
                            <button onClick={()=>{ window.open(file.link,'_blank'); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-100"><ExternalLink size={13}/> Open</button>
                            <button onClick={()=>{ handleDeleteFile(file.id); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-50"><Trash2 size={13}/> Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="text-5xl text-black mb-4"><PiLinkSimpleLight/></div>
                  <p className="text-xl font-semibold text-gray-500 mb-2">No links yet</p>
                  <p className="text-gray-400 text-sm">Click "Add Link" to save your first link</p>
                </div>
              )
            )}

            {mediaTab === 'folders' && (
              folders.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                  {folders.map(folder => (
                    <div key={folder.id}
                      className="group bg-white border border-gray-200 rounded-2xl p-4 md:p-5 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer"
                      onClick={()=>{ setCurrentFolder(folder); setMediaTab('media'); }}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="text-3xl md:text-4xl">📁</div>
                        <div className="relative" onClick={e=>e.stopPropagation()}>
                          <button onClick={e=>{ e.stopPropagation(); setOpenMenuId(openMenuId===folder.id ? null : folder.id); }}
                            className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-all"><MoreVertical size={15}/></button>
                          {openMenuId === folder.id && (
                            <div className="absolute right-0 top-8 bg-[#EEF2F7] border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden min-w-[140px]">
                              <button onClick={()=>{ handleDeleteFolder(folder.id, folder.name); setOpenMenuId(null); }}
                                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-50"><Trash2 size={13}/> Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-900 font-semibold text-sm group-hover:text-teal-600 transition-colors">{folder.name}</p>
                      <p className="text-gray-400 text-xs mt-1">{(folder.files||[]).length} items</p>
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-gray-400 text-xs">
                          {(folder.files||[]).filter(f=>MEDIA_TYPES.includes((f.type||'').toLowerCase())).length} media &nbsp;·&nbsp;
                          {(folder.files||[]).filter(f=>DOC_TYPES.includes((f.type||'').toLowerCase())||f.type==='text').length} docs &nbsp;·&nbsp;
                          {(folder.files||[]).filter(f=>f.type==='link').length} links
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="text-5xl text-black mb-4"><FolderPlus/></div>
                  <p className="text-xl font-semibold text-gray-500 mb-2">No folders yet</p>
                  <p className="text-gray-400 text-sm">Click "New Folder" to create your first folder</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* ── Modals (unchanged) ── */}
        {showEditFileModal && editFileData && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#EEF2F7] border border-gray-200 flex items-center justify-center text-xl">{getFileIcon(editFileData.type)}</div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Edit File</h3>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">{editFileData.type === 'text' ? 'Text / Credentials' : editFileData.type.toUpperCase()} file</p>
                  </div>
                </div>
                <button onClick={()=>{ setShowEditFileModal(false); setEditFileData(null); }} className="text-gray-500 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-gray-900 font-semibold mb-2 text-sm">{editFileData.type === 'text' ? 'Title *' : 'File Name *'}</label>
                  <input value={editFileName} onChange={e => setEditFileName(e.target.value)} autoFocus placeholder={editFileData.type === 'text' ? 'e.g. AWS Credentials' : 'File name'} className={inputCls}/>
                </div>
                {editFileData.type === 'text' && (
                  <div>
                    <label className="block text-gray-900 font-semibold mb-2 text-sm">Content *</label>
                    <textarea value={editFileContent} onChange={e => setEditFileContent(e.target.value)} rows={7} placeholder={"Username: admin\nPassword: abc123"} className={`${inputCls} resize-none font-mono text-sm leading-relaxed`}/>
                    <p className="text-gray-400 text-xs mt-1.5">{editFileContent.length} characters</p>
                  </div>
                )}
                {editFileData.type !== 'text' && (
                  <div className="bg-[#EEF2F7] border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
                    <AlertCircle size={15} className="text-gray-400 flex-shrink-0"/>
                    <p className="text-gray-400 text-xs">Only the display name can be changed for uploaded files.</p>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Uploaded: {editFileData.uploadedOn}</span>
                  {editFileData.size && editFileData.size !== 'Text' && <span>Size: {editFileData.size}</span>}
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button type="button" onClick={()=>{ setShowEditFileModal(false); setEditFileData(null); }} className="flex-1 px-4 py-3 bg-gray-100 text-gray-500 font-semibold rounded-lg hover:bg-gray-200">Cancel</button>
                <button onClick={handleSaveEditFile} disabled={!editFileName.trim() || (editFileData.type === 'text' && !editFileContent.trim()) || savingFile}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {savingFile ? <><Loader size={15} className="animate-spin"/> Saving...</> : <><Pencil size={15}/> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {viewTextFile && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div><h3 className="text-xl font-bold text-gray-900">{viewTextFile.name}</h3><p className="text-xs text-gray-500 mt-0.5">📅 {viewTextFile.uploadedOn}</p></div>
                <button onClick={()=>setViewTextFile(null)} className="text-gray-500 hover:text-gray-900"><X size={20}/></button>
              </div>
              <div className="p-6">
                <pre className="text-gray-900 text-sm whitespace-pre-wrap font-mono bg-[#EEF2F7] border border-gray-200 rounded-xl p-4 max-h-80 overflow-y-auto leading-relaxed">{viewTextFile.content}</pre>
                <div className="flex gap-3 mt-4">
                  <button onClick={()=>setViewTextFile(null)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-500 rounded-lg text-sm font-semibold hover:bg-gray-200">Close</button>
                  <button onClick={()=>{ openEditFile(viewTextFile, { stopPropagation:()=>{} }); setViewTextFile(null); }}
                    className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg text-sm font-semibold">
                    <Pencil size={13}/> Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAddLinkModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Add Link</h3>
                <button onClick={()=>{setShowAddLinkModal(false);setLinkData({name:'',url:''});}} className="text-gray-500 hover:text-gray-900"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Name *</label>
                  <input value={linkData.name} onChange={e=>setLinkData({...linkData,name:e.target.value})} placeholder="e.g. Figma Design" className={inputCls} autoFocus/></div>
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">URL *</label>
                  <input type="url" value={linkData.url} onChange={e=>setLinkData({...linkData,url:e.target.value})} placeholder="https://..." className={inputCls}/></div>
                <div className="flex gap-3 pt-2">
                  <button onClick={()=>{setShowAddLinkModal(false);setLinkData({name:'',url:''});}} className="flex-1 px-4 py-3 bg-gray-100 text-gray-500 rounded-lg font-semibold hover:bg-gray-200">Cancel</button>
                  <button onClick={handleAddLink} disabled={!linkData.name.trim()||!linkData.url.trim()} className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-semibold disabled:opacity-50">Add Link</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAddTextModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div><h3 className="text-xl font-bold text-gray-900">Add Text / Credentials</h3><p className="text-xs text-gray-500 mt-0.5">Passwords, notes, API keys, etc.</p></div>
                <button onClick={()=>{setShowAddTextModal(false);setTextData({name:'',content:''});}} className="text-gray-500 hover:text-gray-900"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Title *</label>
                  <input value={textData.name} onChange={e=>setTextData({...textData,name:e.target.value})} placeholder="e.g. AWS Credentials" className={inputCls} autoFocus/></div>
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Content *</label>
                  <textarea value={textData.content} onChange={e=>setTextData({...textData,content:e.target.value})} placeholder={"Username: admin\nPassword: abc123"} rows={6} className={`${inputCls} resize-none font-mono text-sm`}/></div>
                <div className="flex gap-3 pt-2">
                  <button onClick={()=>{setShowAddTextModal(false);setTextData({name:'',content:''});}} className="flex-1 px-4 py-3 bg-gray-100 text-gray-500 rounded-lg font-semibold hover:bg-gray-200">Cancel</button>
                  <button onClick={handleAddText} disabled={!textData.name.trim()||!textData.content.trim()} className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-semibold disabled:opacity-50">Save</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCreateFolderModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">New Folder</h3>
                <button onClick={()=>{setShowCreateFolderModal(false);setFolderName('');}} className="text-gray-500 hover:text-gray-900"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                <input value={folderName} onChange={e=>setFolderName(e.target.value)} placeholder="Folder name" className={inputCls} autoFocus onKeyDown={e=>e.key==='Enter'&&handleCreateFolder()}/>
                <div className="flex gap-3">
                  <button onClick={()=>{setShowCreateFolderModal(false);setFolderName('');}} className="flex-1 px-4 py-3 bg-gray-100 text-gray-500 rounded-lg font-semibold hover:bg-gray-200">Cancel</button>
                  <button onClick={handleCreateFolder} disabled={!folderName.trim()} className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-semibold disabled:opacity-50">Create</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {confirmDialog && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl border border-gray-200 w-full max-w-sm shadow-2xl">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"><Trash2 size={18} className="text-red-400"/></div>
                  <h3 className="text-lg font-bold text-gray-900">Confirm Delete</h3>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">{confirmDialog.message}</p>
                <div className="flex gap-3">
                  <button onClick={()=>setConfirmDialog(null)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-500 rounded-lg font-semibold hover:bg-gray-200 text-sm">Cancel</button>
                  <button onClick={()=>{ const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 text-sm">Delete</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {deleteProgress && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl border border-gray-200 w-full max-w-sm shadow-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"><Trash2 size={18} className="text-red-400"/></div>
                <div>
                  <p className="text-gray-900 font-semibold text-sm">{deleteProgress.label}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{deleteProgress.pct}% complete</p>
                </div>
              </div>
              <div className="w-full bg-[#EEF2F7] rounded-full h-2.5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width:`${deleteProgress.pct}%`, background: deleteProgress.pct===100 ? 'linear-gradient(to right,#14b8a6,#06b6d4)' : 'linear-gradient(to right,#ef4444,#f97316)' }}/>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // MAIN CLIENTS PAGE — RESPONSIVE
  // ════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 min-h-screen bg-[#EEF2F7]">

      {/* Search bar — full width on mobile */}
      <div className="w-full md:w-1/2 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
        <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
          placeholder="Search by name, contact, email, or industry..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all text-sm"/>
      </div>

      {/* Table card with horizontal scroll */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="clients-scroll"
          style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(20,184,166,0.6) rgba(238,242,247,0.9)',
          }}>
          <style>{`
            .clients-scroll::-webkit-scrollbar { height: 6px; }
            .clients-scroll::-webkit-scrollbar-track { background: rgba(238,242,247,0.9); border-radius: 999px; }
            .clients-scroll::-webkit-scrollbar-thumb { background: rgba(20,184,166,0.55); border-radius: 999px; }
            .clients-scroll::-webkit-scrollbar-thumb:hover { background: rgba(20,184,166,0.85); }
          `}</style>
          <table className="w-full" style={{ minWidth: '700px' }}>
            <thead className="bg-[#EEF2F7] border-b border-gray-200">
              <tr>
                {['Client Name','Contact','Industry','Revenue','Status','Actions'].map(h => (
                  <th key={h} className="px-4 md:px-6 py-4 text-left text-gray-500 text-xs font-semibold uppercase tracking-wider border-r border-black/20 last:border-r-0 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client=>(
                <tr key={client.id} className="border-b border-gray-200 hover:bg-teal-50/30 transition-all">
                  <td className="px-4 md:px-6 py-4 border-r border-black/20">
                    <div className="text-gray-900 font-semibold text-sm">{client.name}</div>
                    <div className="text-gray-500 text-xs">Since {client.since}</div>
                  </td>
                  <td className="px-4 md:px-6 py-4 border-r border-black/20">
                    <div className="text-gray-900 text-sm">{client.contact}</div>
                    <div className="text-gray-500 text-xs">{client.email}</div>
                  </td>
                  <td className="px-4 md:px-6 py-4 text-gray-900 text-sm border-r border-black/20 whitespace-nowrap">{client.industry}</td>
                  <td className="px-4 md:px-6 py-4 text-teal-600 font-bold font-mono text-sm border-r border-black/20 whitespace-nowrap">{client.revenue}</td>
                  <td className="px-4 md:px-6 py-4 border-r border-black/20">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${client.status==='Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : client.status==='Inactive' ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={e=>openEdit(client,e)} className="flex items-center gap-1.5 px-2.5 py-2 bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 rounded-lg text-sm font-medium transition-all">
                        <Edit size={14}/>
                      </button>
                      <button onClick={e=>openMediaManager(client,e)} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white rounded-lg text-xs font-semibold transition-all whitespace-nowrap">
                        View More
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length===0 && (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">{searchTerm ? 'No clients match your search.' : 'No clients yet.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD CLIENT MODAL */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-5 md:p-6 flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Add New Client</h2>
              <button onClick={()=>setShowAddClientModal(false)} className="text-gray-500 hover:text-gray-900"><X size={22}/></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-5 md:p-6 space-y-4 md:space-y-5">
              <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Company Name *</label>
                <input value={newClient.name} onChange={e=>setNewClient({...newClient,name:e.target.value})} required placeholder="e.g. Acme Inc." className={inputCls}/></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Contact Person Name *</label>
                  <input value={newClient.contact} onChange={e=>setNewClient({...newClient,contact:e.target.value})} required placeholder="Full name" className={inputCls}/></div>
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Contact Person Number *</label>
                  <input type="tel" value={newClient.phone} onChange={e=>setNewClient({...newClient,phone:e.target.value})} required placeholder="+1 555 000 0000" className={inputCls}/></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Email *</label>
                  <input type="email" value={newClient.email} onChange={e=>setNewClient({...newClient,email:e.target.value})} required placeholder="contact@company.com" className={inputCls}/></div>
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Industry *</label>
                  <select value={newClient.industry} onChange={e=>setNewClient({...newClient,industry:e.target.value})} className={inputCls}>
                    {industries.map(i=><option key={i}>{i}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Revenue *</label>
                  <input value={newClient.revenue} onChange={e=>setNewClient({...newClient,revenue:e.target.value})} required placeholder="$45,000" className={inputCls}/></div>
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Status *</label>
                  <select value={newClient.status} onChange={e=>setNewClient({...newClient,status:e.target.value})} className={inputCls}>
                    <option>Active</option><option>Pending</option><option>Inactive</option></select></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowAddClientModal(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-500 font-semibold rounded-lg hover:bg-gray-200">Cancel</button>
                <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg">Add Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CLIENT MODAL */}
      {showEditModal && selectedClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-5 md:p-6 flex items-center justify-between">
              <div><h2 className="text-xl md:text-2xl font-bold text-gray-900">Edit Client</h2><p className="text-gray-500 text-sm mt-0.5">{selectedClient.name}</p></div>
              <button onClick={()=>setShowEditModal(false)} className="text-gray-500 hover:text-gray-900"><X size={22}/></button>
            </div>
            <form onSubmit={handleUpdateSubmit} className="p-5 md:p-6 space-y-4 md:space-y-5">
              <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Company Name *</label>
                <input value={editClient.name} onChange={e=>setEditClient({...editClient,name:e.target.value})} required className={inputCls}/></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Contact Person Name *</label>
                  <input value={editClient.contact} onChange={e=>setEditClient({...editClient,contact:e.target.value})} required className={inputCls}/></div>
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Contact Person Number *</label>
                  <input type="tel" value={editClient.phone} onChange={e=>setEditClient({...editClient,phone:e.target.value})} required className={inputCls}/></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Email *</label>
                  <input type="email" value={editClient.email} onChange={e=>setEditClient({...editClient,email:e.target.value})} required className={inputCls}/></div>
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Industry *</label>
                  <select value={editClient.industry} onChange={e=>setEditClient({...editClient,industry:e.target.value})} className={inputCls}>
                    {industries.map(i=><option key={i}>{i}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Revenue *</label>
                  <input value={editClient.revenue} onChange={e=>setEditClient({...editClient,revenue:e.target.value})} required className={inputCls}/></div>
                <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Status *</label>
                  <select value={editClient.status} onChange={e=>setEditClient({...editClient,status:e.target.value})} className={inputCls}>
                    <option>Active</option><option>Pending</option><option>Inactive</option></select></div>
              </div>
              <div><label className="block text-gray-900 font-semibold mb-2 text-sm">Active Projects</label>
                <input type="number" min="0" value={editClient.projects} onChange={e=>setEditClient({...editClient,projects:e.target.value})} className={inputCls}/></div>
              <div className="pt-2 border-t border-gray-200">
                <button type="button" onClick={e=>{ setShowEditModal(false); handleDeleteClient(selectedClient,e); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-300">
                  <Trash2 size={15}/> Remove Client
                </button>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setShowEditModal(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-500 font-semibold rounded-lg hover:bg-gray-200">Cancel</button>
                <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-semibold rounded-lg">Update Client</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;