import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot,
  query,
  orderBy 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader } from 'lucide-react';

const TeamStatus = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Firebase real-time listener for team members
  useEffect(() => {
    const q = query(collection(db, 'teamMembers'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          initials: data.avatar || generateInitials(data.name),
          isOnline: data.status === 'Active',
          currentTask: 'No task assigned',
          tasksCompleted: data.tasks || 0,
          totalTasks: data.tasks || 0,
          gradient: getRandomGradient(),
          skills: data.skills || []
        };
      });
      setTeamMembers(membersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching team members: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Generate initials from name
  const generateInitials = (name) => {
    if (!name) return 'NA';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get random gradient
  const getRandomGradient = () => {
    const gradients = [
      'from-[#00d4ff] to-[#7c3aed]',
      'from-[#f59e0b] to-[#ef4444]',
      'from-[#10b981] to-[#059669]',
      'from-[#8b5cf6] to-[#6366f1]',
      'from-[#ec4899] to-[#db2777]',
      'from-[#06b6d4] to-[#0891b2]'
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  };

  // Filter team members
  const getFilteredMembers = () => {
    let filtered = [...teamMembers];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (m) =>
          m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.role?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus === 'Online') {
      filtered = filtered.filter((m) => m.isOnline);
    } else if (filterStatus === 'Offline') {
      filtered = filtered.filter((m) => !m.isOnline);
    }

    return filtered;
  };

  const filteredMembers = getFilteredMembers();
  const onlineCount = teamMembers.filter(m => m.isOnline).length;

  if (loading) {
    return (
      <div className="min-h-screen w-[40%] bg-gradient-to-br from-[#0a0e27] to-[#1a1f3a] py-10 px-4">
        <div className="w-full max-w-2xl mx-auto bg-[#1a1f3a] border border-[#1e293b] rounded-2xl p-7 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="text-6xl mb-4"><Loader/></div>
            <div className="text-2xl font-bold text-[#f8fafc]">Loading team...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen   py-10 px-4">
      <div className="w-full max-w-2xl mx-auto bg-[#1a1f3a] border border-[#1e293b] rounded-2xl p-7 transition-all hover:border-[rgba(0,212,255,0.3)]">
        
        {/* Member Profile Modal */}
        {selectedMember && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedMember(null)}
          >
            <div 
              className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#334155] rounded-2xl p-8 max-w-md w-full max-h-[calc(100vh-40px)] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Profile Header */}
              <div className="flex flex-col items-center mb-6">
                <div className={`w-24 h-24 rounded-xl bg-gradient-to-br ${selectedMember.gradient} flex items-center justify-center text-white text-3xl font-bold mb-4`}>
                  {selectedMember.initials}
                </div>
                <h2 className="text-2xl font-bold text-[#f8fafc] mb-1">{selectedMember.name}</h2>
                <p className="text-[#00d4ff] font-medium mb-2">{selectedMember.role}</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${selectedMember.isOnline ? 'bg-[#10b981]' : 'bg-[#f59e0b]'}`}></div>
                  <span className={`text-sm ${selectedMember.isOnline ? 'text-[#10b981]' : 'text-[#f59e0b]'}`}>
                    {selectedMember.status}
                  </span>
                </div>
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

                <div className="flex items-center gap-3 p-3 bg-[#0f172a] rounded-lg border border-[#334155]">
                  <svg className="w-5 h-5 text-[#00d4ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <div>
                    <p className="text-[#94a3b8] text-xs">Joined</p>
                    <p className="text-[#f8fafc] text-sm">{selectedMember.joinDate || 'N/A'}</p>
                  </div>
                </div>

                <div className="p-3 bg-[#0f172a] rounded-lg border border-[#334155]">
                  <p className="text-[#94a3b8] text-xs mb-2">Projects</p>
                  <p className="text-[#f8fafc] text-2xl font-bold">{selectedMember.projects || 0}</p>
                </div>

                <div className="p-3 bg-[#0f172a] rounded-lg border border-[#334155]">
                  <p className="text-[#94a3b8] text-xs mb-2">Tasks</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-[#0a0e27] rounded-full">
                      <div
                        className="h-full bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] rounded-full"
                        style={{ width: `${selectedMember.totalTasks > 0 ? (selectedMember.tasksCompleted / selectedMember.totalTasks) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-[#f8fafc] font-semibold">
                      {selectedMember.tasksCompleted}/{selectedMember.totalTasks}
                    </span>
                  </div>
                </div>

                {selectedMember.skills && selectedMember.skills.length > 0 && (
                  <div className="p-3 bg-[#0f172a] rounded-lg border border-[#334155]">
                    <p className="text-[#94a3b8] text-xs mb-2">Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedMember.skills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-1 bg-[rgba(0,212,255,0.15)] text-[#00d4ff] text-xs rounded-md">
                          {skill}
                        </span>
                      ))}
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
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#1e293b]">
          <div>
            <h2 className="text-xl font-bold text-[#f8fafc]">Team Status</h2>
            <p className="text-[0.85rem] text-[#94a3b8] mt-1">
              <span className="text-[#10b981] font-semibold">{onlineCount}</span> online · {teamMembers.length} total
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3  mb-6 ">
          <input
            type="text"
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1  px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-[#f8fafc]  text-sm focus:border-[#00d4ff] focus:outline-none"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-[#0f172a]  border border-[#334155] rounded-lg text-[#f8fafc] text-sm focus:border-[#00d4ff] focus:outline-none"
          >
            <option>All</option>
            <option>Online</option>
            <option>Offline</option>
          </select>
        </div>

        {/* Team Members List */}
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2" style={{scrollbarWidth:'none'}}>
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-[#94a3b8]">
              <div className="text-6xl mb-4">👥</div>
              <p className="text-lg font-semibold text-[#f8fafc] mb-2">No team members found</p>
              <p className="text-sm">Team members will appear here</p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div
                key={member.id}
                className="p-4 bg-[#141937] border border-[#1e293b] rounded-xl transition-all duration-300 hover:border-[#00d4ff] hover:translate-x-1 cursor-pointer"
                onClick={() => setSelectedMember(member)}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${member.gradient} flex items-center justify-center font-bold text-[1.1rem] text-white flex-shrink-0`}>
                    {member.initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-[#f8fafc] mb-1">
                          {member.name}
                        </div>
                        <div className="text-[0.85rem] text-[#94a3b8]">
                          {member.role}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2 text-[0.8rem]">
                        <div 
                          className={`w-2 h-2 rounded-full ${
                            member.isOnline ? 'bg-[#10b981]' : 'bg-[#f59e0b]'
                          } animate-[pulse_2s_ease_infinite]`}
                        ></div>
                        <span className={member.isOnline ? 'text-[#10b981]' : 'text-[#f59e0b]'}>
                          {member.status}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-[0.8rem] text-[#94a3b8]">
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <span>{member.projects || 0} Projects</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                        <span>{member.tasks || 0} Tasks</span>
                      </div>
                    </div>

                    {/* Task Progress */}
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 h-1 bg-[#0a0e27] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] rounded-full transition-all duration-500"
                          style={{ width: `${member.totalTasks > 0 ? (member.tasksCompleted / member.totalTasks) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <span className="text-[0.75rem] text-[#64748b] font-medium whitespace-nowrap">
                        {member.tasksCompleted}/{member.totalTasks}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamStatus;