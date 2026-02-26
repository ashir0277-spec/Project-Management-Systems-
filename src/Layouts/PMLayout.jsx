import React, { useState } from 'react';
import Sidebar from '../Components/SidebarAndTopbar/Sidebar';
import TopBar from '../Components/SidebarAndTopbar/Topbar';
import { Outlet, useLocation } from 'react-router-dom';

const PMLayout = () => {
  const [showAddMemberModal,  setShowAddMemberModal]  = useState(false);
  const [showAddClientModal,  setShowAddClientModal]  = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddPayoutModal,  setShowAddPayoutModal]  = useState(false);
  const [sidebarOpen,         setSidebarOpen]         = useState(false);
  const [searchQuery,         setSearchQuery]         = useState('');

  const location = useLocation();

  React.useEffect(() => { setSearchQuery(''); }, [location.pathname]);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar  = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      <div className="flex-1 lg:ml-[280px] bg-[#080f25] overflow-hidden">
        <TopBar
          onNewMember={() => setShowAddMemberModal(true)}
          onNewClient={() => setShowAddClientModal(true)}
          onNewProject={() => setShowAddProjectModal(true)}
          onNewPayout={() => setShowAddPayoutModal(true)}
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
              searchQuery,
            }}
          />
        </main>
      </div>
    </div>
  );
};

export default PMLayout;