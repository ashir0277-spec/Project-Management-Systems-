import React, { useState } from 'react';
import Sidebar from '../Components/SidebarAndTopbar/Sidebar';
import TopBar from '../Components/SidebarAndTopbar/Topbar';
import { Outlet } from 'react-router-dom';

const PMLayout = () => {
  const [showAddMemberModal, setShowAddMemberModal]   = useState(false);
  const [showAddClientModal, setShowAddClientModal]   = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [sidebarOpen, setSidebarOpen]                 = useState(false);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar  = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main content */}
      <div className="flex-1 lg:ml-[280px] bg-[#080f25] overflow-hidden">
        <TopBar
          onNewMember={() => setShowAddMemberModal(true)}
          onNewClient={() => setShowAddClientModal(true)}
          onNewProject={() => setShowAddProjectModal(true)}
          onToggleSidebar={toggleSidebar}
        />

        <main className="pt[96px]">
          <Outlet
            context={{
              showAddMemberModal,
              setShowAddMemberModal,
              showAddClientModal,
              setShowAddClientModal,
              showAddProjectModal,
              setShowAddProjectModal,
            }}
          />
        </main>
      </div>
    </div>
  );
};

export default PMLayout;