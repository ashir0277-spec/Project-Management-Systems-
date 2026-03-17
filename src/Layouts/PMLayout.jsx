import React, { useState } from 'react';
import Sidebar from '../Components/SidebarAndTopbar/Sidebar';
import TopBar from '../Components/SidebarAndTopbar/Topbar';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../Components/firebase';
import { Copy, Mail, CheckCircle2, X } from 'lucide-react';
import { BsWhatsapp } from 'react-icons/bs';

const TL = 'rgba(51,51,51,0.20)';

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

const PMLayout = () => {
  const navigate = useNavigate();

  const [showAddMemberModal,  setShowAddMemberModal]  = useState(false);
  const [showAddClientModal,  setShowAddClientModal]  = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddPayoutModal,  setShowAddPayoutModal]  = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [sidebarOpen,         setSidebarOpen]         = useState(false);
  const [searchQuery,         setSearchQuery]         = useState('');

  // Invite state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink,      setInviteLink]      = useState('');
  const [inviteLoading,   setInviteLoading]   = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const location = useLocation();

  React.useEffect(() => { setSearchQuery(''); }, [location.pathname]);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar  = () => setSidebarOpen(false);

  const generateInvite = async () => {
    setInviteLoading(true);
    try {
      const token = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'invites', token), {
        token, used: false, createdAt: serverTimestamp()
      });
      setInviteLink(`${window.location.origin}/invite/${token}`);
      setShowInviteModal(true);
    } catch {
      alert('Failed to generate invite link.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopy = () => {
    copyToClipboard(inviteLink, () => {
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    });
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      <div className="flex-1 lg:ml-[280px] bg-[#080f25] overflow-hidden">
        <TopBar
          onNewMember={() => navigate('/team/add')}
          onNewClient={() => setShowAddClientModal(true)}
          onNewProject={() => setShowAddProjectModal(true)}
          onNewPayout={() => setShowAddPayoutModal(true)}
          onNewExpense={() => setShowAddExpenseModal(true)}
          onGenerateInvite={generateInvite}
          onToggleSidebar={toggleSidebar}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="">
          <Outlet
            context={{
              showAddMemberModal,  setShowAddMemberModal,
              showAddClientModal,  setShowAddClientModal,
              showAddProjectModal, setShowAddProjectModal,
              showAddPayoutModal,  setShowAddPayoutModal,
              showAddExpenseModal, setShowAddExpenseModal,
              searchQuery,
            }}
          />
        </main>
      </div>

      {/* ── Invite Link Modal ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 relative"
            onClick={e => e.stopPropagation()}
            style={{ border: `1px solid ${TL}` }}>

            {/* Copied toast */}
            {showCopiedToast && (
              <div className="absolute left-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg"
                style={{ transform: 'translateX(-50%)', top: '-40px', animation: 'fadeInOut 2s ease forwards' }}>
                Copied!
              </div>
            )}

            <style>{`@keyframes fadeInOut{0%{opacity:0;transform:translate(-50%,10px)}15%{opacity:1;transform:translate(-50%,0)}85%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-10px)}}`}</style>

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={20} className="text-teal-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Invite Link Generated</h3>
                  <p className="text-xs text-gray-400">One-time use link</p>
                </div>
              </div>
              <button onClick={() => setShowInviteModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-3">Share this link with the new member. It can only be used once.</p>

            {/* Link box */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 mb-4">
              <input type="text" value={inviteLink} readOnly
                className="flex-1 text-xs bg-transparent outline-none text-gray-700 font-mono min-w-0" />
              <button onClick={handleCopy}
                className="flex-shrink-0 p-1.5 rounded-lg text-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-colors">
                <Copy size={15} />
              </button>
            </div>

            {/* Share buttons */}
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

export default PMLayout;