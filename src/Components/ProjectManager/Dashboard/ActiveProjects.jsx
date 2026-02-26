import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot,
  query,
  orderBy 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader } from 'lucide-react';

const ActiveProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  // Firebase real-time listener
  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProjects(projectsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching projects: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter and Sort Projects
  const getFilteredProjects = () => {
    let filtered = [...projects];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.client?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== 'All') {
      filtered = filtered.filter((p) => p.status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'progress':
          return (b.progress || 0) - (a.progress || 0);
        case 'deadline':
          return new Date(a.deadline || 0) - new Date(b.deadline || 0);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredProjects = getFilteredProjects();

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'Active': 'bg-[rgba(16,185,129,0.15)] text-[#10b981]',
      'In Review': 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]',
      'Urgent': 'bg-[rgba(239,68,68,0.15)] text-[#ef4444]',
      'Completed': 'bg-[rgba(59,130,246,0.15)] text-[#3b82f6]',
      'On Hold': 'bg-[rgba(148,163,184,0.15)] text-[#94a3b8]'
    };
    return colors[status] || colors['Active'];
  };

  if (loading) {
    return (
      <div className=" bg-[#1a1f3a] border  mt-10 border-[#1e293b] rounded-2xl p-7 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-6xl mb-4"><Loader/></div>
          <div className="text-2xl font-bold text-[#f8fafc]">Loading projects...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[60%] bg-[#1a1f3a] border mx-auto mt-10 border-[#1e293b] rounded-2xl p-7 transition-all hover:border-[rgba(0,212,255,0.3)]">
      
      {/* Member Profile Modal */}
      {selectedMember && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#334155] rounded-2xl p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Profile Header */}
            <div className="flex flex-col items-center mb-6">
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${selectedMember.gradient || 'from-[#00d4ff] to-[#7c3aed]'} flex items-center justify-center text-white text-3xl font-bold mb-4`}>
                {selectedMember.name}
              </div>
              <h2 className="text-2xl font-bold text-[#f8fafc] mb-1">{selectedMember.fullName}</h2>
              <p className="text-[#00d4ff] font-medium">{selectedMember.role}</p>
            </div>

            {/* Profile Details */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 p-3 bg-[#0f172a] rounded-lg border border-[#334155]">
                <svg className="w-5 h-5 text-[#00d4ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <div>
                  <p className="text-[#94a3b8] text-xs">Email</p>
                  <p className="text-[#f8fafc] text-sm">{selectedMember.email || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-[#0f172a] rounded-lg border border-[#334155]">
                <svg className="w-5 h-5 text-[#00d4ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                <div>
                  <p className="text-[#94a3b8] text-xs">Phone</p>
                  <p className="text-[#f8fafc] text-sm">{selectedMember.phone || 'N/A'}</p>
                </div>
              </div>

              {selectedMember.tasksCompleted !== undefined && (
                <div className="flex items-center gap-3 p-3 bg-[#0f172a] rounded-lg border border-[#334155]">
                  <svg className="w-5 h-5 text-[#00d4ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div>
                    <p className="text-[#94a3b8] text-xs">Tasks Completed</p>
                    <p className="text-[#f8fafc] text-sm font-semibold">{selectedMember.tasksCompleted}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Button */}
            <button 
              onClick={() => setSelectedMember(null)}
              className="w-full px-4 py-2 bg-[#334155] text-[#94a3b8] font-medium rounded-lg hover:bg-[#475569] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between pb-4 mb-6 border-b border-[#1e293b] gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#f8fafc]">Active Projects</h2>
          <p className="text-[0.85rem] text-[#94a3b8] mt-1">Track all ongoing projects</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#00d4ff] text-[0.9rem] font-medium">
            Total: {filteredProjects.length}
          </span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search projects or clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-[#f8fafc] focus:border-[#00d4ff] focus:outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-[#f8fafc] focus:border-[#00d4ff] focus:outline-none"
        >
          <option>All</option>
          <option>Active</option>
          <option>In Review</option>
          <option>Urgent</option>
          <option>Completed</option>
          <option>On Hold</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-[#f8fafc] focus:border-[#00d4ff] focus:outline-none"
        >
          <option value="name">Sort by Name</option>
          <option value="progress">Sort by Progress</option>
          <option value="deadline">Sort by Deadline</option>
        </select>
      </div>

      {/* Projects List */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2" style={{scrollbarWidth:'none'}}>
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 text-[#94a3b8]">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-lg font-semibold text-[#f8fafc] mb-2">No projects found</p>
            <p className="text-sm">Projects created will appear here</p>
          </div>
        ) : (
          filteredProjects.map((project) => (
            <div
              key={project.id}
              className="p-5 bg-[#141937] border border-[#1e293b] rounded-xl cursor-pointer transition-all duration-300 hover:translate-x-1 hover:border-[#00d4ff] hover:bg-[rgba(0,212,255,0.05)]"
              onClick={() => setSelectedProject(selectedProject?.id === project.id ? null : project)}
            >
              {/* Project Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="text-[1.1rem] font-semibold text-[#f8fafc] mb-2">
                    {project.name}
                  </div>
                  <div className="text-[0.85rem] text-[#94a3b8]">
                    Client: {project.client}
                  </div>
                </div>
                <span className={`px-3.5 py-1.5 rounded-md text-[0.75rem] font-semibold uppercase tracking-wider ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>

              {/* Meta Info */}
              <div className="flex items-center gap-6 mb-4 text-[0.85rem] text-[#94a3b8]">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <span>Deadline: {project.deadline}</span>
                </div>
                {project.teamMembers && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                    </svg>
                    <span>{project.teamMembers?.length || 0} Members</span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-2">
                <div className="w-full h-1.5 bg-[#0a0e27] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] rounded-full transition-all duration-500"
                    style={{ width: `${project.progress || 0}%` }}
                  ></div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[0.8rem] text-[#64748b] mb-4">
                <span>Progress</span>
                <span className="font-semibold">{project.progress || 0}%</span>
              </div>

              {/* Team Avatars */}
              {project.teamMembers && project.teamMembers.length > 0 && (
                <div className="flex items-center">
                  <div className="flex items-center">
                    {project.teamMembers.slice(0, 5).map((member, idx) => (
                      <div
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMember(member);
                        }}
                        className={`w-8 h-8 rounded-full bg-gradient-to-br ${member.gradient || 'from-[#00d4ff] to-[#7c3aed]'} border-2 border-[#1a1f3a] flex items-center justify-center text-[0.75rem] font-semibold text-white transition-all hover:-translate-y-1 hover:scale-110 hover:z-10 cursor-pointer ${
                          idx > 0 ? '-ml-2.5' : ''
                        }`}
                        title={member.fullName || member.name}
                      >
                        {member.name}
                      </div>
                    ))}
                    {project.teamMembers.length > 5 && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ec4899] to-[#db2777] border-2 border-[#1a1f3a] flex items-center justify-center text-[0.75rem] font-semibold text-white -ml-2.5">
                        +{project.teamMembers.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Expanded Details */}
              {selectedProject?.id === project.id && (
                <div className="mt-4 pt-4 border-t border-[#1e293b] space-y-3">
                  <div className="text-sm text-[#94a3b8]">
                    <p className="mb-2"><span className="font-semibold text-[#f8fafc]">Description:</span></p>
                    <p className="text-[#cbd5e1]">{project.description || 'No description available'}</p>
                  </div>
                  
                  {project.budget && (
                    <div className="text-sm">
                      <span className="text-[#94a3b8]">Budget: </span>
                      <span className="text-[#00d4ff] font-semibold">{project.budget}</span>
                    </div>
                  )}
                  
                  {project.category && (
                    <div className="text-sm">
                      <span className="text-[#94a3b8]">Category: </span>
                      <span className="text-[#f8fafc] font-semibold">{project.category}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActiveProjects;