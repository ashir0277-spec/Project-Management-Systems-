import React from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Menu } from 'lucide-react';

const TopBar = ({ onToggleSidebar, onNewClient, onNewProject, onNewMember, onNewPayout, searchValue, onSearchChange }) => {
  const location = useLocation();
  const isTeamMembers = location.pathname.includes('team');
  const isClients     = location.pathname.includes('clients');
  const isProjects    = location.pathname.includes('projects');
  const isPayout      = location.pathname.includes('payout');
  const isSettings    = location.pathname.includes('settings');
  const isDashboard   = !isTeamMembers && !isClients && !isProjects && !isPayout && !isSettings;

  const pageTitle =
    isTeamMembers ? 'Team Members' :
    isClients     ? 'Clients'      :
    isProjects    ? 'Projects'     :
    isPayout      ? 'Payout'       :
    isSettings    ? 'Settings'     : 'Dashboard';

  const pageSubtitle =
    isTeamMembers ? 'View, add and manage your team members' :
    isClients     ? 'Manage your client relationships and documents' :
    isProjects    ? 'Track and manage all your projects' :
    isPayout      ? 'Manage payouts and transactions' :
    isSettings    ? 'Configure your workspace settings' :
    "Welcome back! Here's what's happening with your projects today.";

  return (
    <>
      <header className="fixed top-0 left-0 lg:left-[280px] right-0 z-50 bg-gray-50 border-b-2 border-gray-400">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4">

          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg bg-gray-100 hover:bg-[#243044] transition-colors text-black hover:text-white flex-shrink-0"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-base sm:text-xl font-semibold text-black leading-tight">{pageTitle}</h1>
              <p className="hidden sm:block text-[#64748b] text-xs sm:text-sm font-medium mt-0.5">{pageSubtitle}</p>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">

            {isProjects && (
              <button onClick={onNewProject}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-white font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 transition-all shadow-lg text-xs sm:text-sm whitespace-nowrap">
                <Plus size={15} /><span>New Project</span>
              </button>
            )}

            {isClients && (
              <button onClick={onNewClient}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-white font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 transition-all shadow-lg text-xs sm:text-sm whitespace-nowrap">
                <Plus size={15} /><span>New Client</span>
              </button>
            )}

            {isTeamMembers && (
              <button onClick={onNewMember}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-white font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 transition-all shadow-lg text-xs sm:text-sm whitespace-nowrap">
                <Plus size={15} /><span>Add Member</span>
              </button>
            )}

            {/* ── Payout page: Add Client btn ── */}
            {isPayout && (
              <button onClick={onNewPayout}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-white font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 transition-all shadow-lg text-xs sm:text-sm whitespace-nowrap">
                <Plus size={15} /><span>Add Client</span>
              </button>
            )}

            {/* Search — sirf Dashboard pe */}
            {isDashboard && (
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-[#475569]"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search projects, tasks..."
                  value={searchValue || ''}
                  onChange={e => onSearchChange && onSearchChange(e.target.value)}
                  className="w-[170px] sm:w-[200px] md:w-[260px] lg:w-[300px] pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-black text-sm placeholder-black focus:outline-none focus:border-[#31BBD0] focus:shadow-[0_0_0_3px_rgba(49,187,208,0.1)] transition-all"
                />
                {searchValue && (
                  <button onClick={() => onSearchChange && onSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-lg leading-none">
                    ×
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      </header>

      {/* Spacer */}
      <div className="h-[60px] sm:h-[73px]" />
    </>
  );
};

export default TopBar;