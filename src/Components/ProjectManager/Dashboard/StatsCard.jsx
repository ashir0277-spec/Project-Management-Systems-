// StatsGrid.jsx - FIXED VERSION

import { useState, useEffect } from "react";
import { VscProject } from "react-icons/vsc";
import { FiUsers } from "react-icons/fi";
import { FaClockRotateLeft } from "react-icons/fa6";
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';

// StatsCard Component
const StatsCard = ({ title, value, change, changeText, emoji, emojiColor, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="relative bg-[#1a1f3a] border border-[#1e293b] rounded-2xl p-7 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(0,212,255,0.15)] hover:border-[#00d4ff] group cursor-pointer"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex items-center justify-between mb-4">
        <span className="text-[#94a3b8] text-sm font-medium">{title}</span>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${emojiColor}15`, color: emojiColor }}
        >
          {emoji}
        </div>
      </div>

      <div className="text-3xl font-bold mb-2 font-mono text-[#f8fafc]">
        {value}
      </div>

      <div className="flex items-center gap-2 text-sm font-medium">
        {change && (
          <span className={`${change.includes('↑') ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            {change}
          </span>
        )}
        <span className="text-[#64748b]">{changeText}</span>
      </div>
    </div>
  );
};

// StatsGrid Component with Firebase
const StatsGrid = () => {
  const [selectedStat, setSelectedStat] = useState(null);
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedDeadline, setSelectedDeadline] = useState(null);
  const [selectedPerformer, setSelectedPerformer] = useState(null);
  const [statsData, setStatsData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper functions
  const isRecent = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  };

  const isPending = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  const getDaysUntil = (dateString) => {
    if (!dateString) return 999;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

 
  const calculateProjectBreakdown = (projects) => {
    const inDev = projects.filter(p => p.status === "In Development");
    const inReview = projects.filter(p => p.status === "In Review");
    const testing = projects.filter(p => p.status === "Testing Phase");

    return [
      { 
        label: "In Development", 
        count: inDev.length, 
        color: "#00d4ff", 
        projects: inDev 
      },
      { 
        label: "In Review", 
        count: inReview.length, 
        color: "#7c3aed", 
        projects: inReview 
      },
      { 
        label: "Testing Phase", 
        count: testing.length, 
        color: "#10b981", 
        projects: testing 
      }
    ];
  };

  
  const calculateMemberBreakdown = (members) => {
    const developers = members.filter(m => m.roleCategory === "Developers");
    const designers = members.filter(m => m.roleCategory === "Designers");
    const qa = members.filter(m => m.roleCategory === "QA Engineers");
    const devops = members.filter(m => m.roleCategory === "DevOps");
    const pm = members.filter(m => m.roleCategory === "Product Managers");

    return [
      { 
        label: "Developers", 
        count: developers.length, 
        color: "#00d4ff", 
        members: developers 
      },
      { 
        label: "Designers", 
        count: designers.length, 
        color: "#7c3aed", 
        members: designers
      },
      { 
        label: "QA Engineers", 
        count: qa.length, 
        color: "#10b981", 
        members: qa 
      },
      { 
        label: "DevOps", 
        count: devops.length, 
        color: "#f59e0b", 
        members: devops 
      },
      { 
        label: "Product Managers", 
        count: pm.length, 
        color: "#ec4899", 
        members: pm 
      }
    ];
  };

  
  const calculateDeadlineBreakdown = (deadlines) => {
    const pending = deadlines.filter(d => isPending(d.dueDate));
    const critical = pending.filter(d => getDaysUntil(d.dueDate) <= 2);
    const important = pending.filter(d => getDaysUntil(d.dueDate) > 2 && getDaysUntil(d.dueDate) <= 5);
    const normal = pending.filter(d => getDaysUntil(d.dueDate) > 5 && getDaysUntil(d.dueDate) <= 7);

    return [
      { 
        label: "Critical (1-2 days)", 
        count: critical.length, 
        color: "#ef4444", 
        tasks: critical 
      },
      { 
        label: "Important (3-5 days)", 
        count: important.length, 
        color: "#f59e0b", 
        tasks: important 
      },
      { 
        label: "Normal (6-7 days)", 
        count: normal.length, 
        color: "#10b981", 
        tasks: normal 
      }
    ];
  };

  const calculateCompletionRate = (completion) => {
    if (!completion || completion.length === 0) return 87;
    return completion[0].rate || 87;
  };

  const calculateCompletionBreakdown = (completion) => {
    if (!completion || completion.length === 0) return [];
    return completion[0].breakdown || [];
  };

  // Fetch data from Firebase
  useEffect(() => {
    const fetchStatsData = async () => {
      try {
        setLoading(true);
        
        // Fetch all collections
        const [projectsSnap, membersSnap, deadlinesSnap, completionSnap] = await Promise.all([
          getDocs(collection(db, 'projects')),
          getDocs(collection(db, 'teamMembers')),
          getDocs(collection(db, 'deadlines')),
          getDocs(collection(db, 'completionStats'))
        ]);

        // Process projects data
        const projects = [];
        projectsSnap.forEach(doc => {
          projects.push({ id: doc.id, ...doc.data() });
        });

        // Process team members data
        const members = [];
        membersSnap.forEach(doc => {
          members.push({ id: doc.id, ...doc.data() });
        });

        // Process deadlines data
        const deadlines = [];
        deadlinesSnap.forEach(doc => {
          deadlines.push({ id: doc.id, ...doc.data() });
        });

        // Process completion stats
        const completion = [];
        completionSnap.forEach(doc => {
          completion.push({ id: doc.id, ...doc.data() });
        });

        // Calculate pending deadlines
        const pendingDeadlines = deadlines.filter(d => isPending(d.dueDate));
        const recentMembers = members.filter(m => isRecent(m.joinDate));

        // Format data for display
        const formattedStats = [
          {
            id: 1,
            title: "Active Projects",
            value: projects.length.toString(),
            change: "↑ 2.5%",
            changeText: "from last month",
            emoji: <VscProject />,
            emojiColor: "#00d4ff",
            details: {
              description: "Total number of projects currently in progress",
              breakdown: calculateProjectBreakdown(projects), // YEH PROPERLY CALL HOGA
              recentProjects: projects.slice(0, 4)
            }
          },
          {
            id: 2,
            title: "Team Members",
            value: members.length.toString(),
            change: `↑ ${recentMembers.length} new`,
            changeText: "this month",
            emoji: <FiUsers className="text-2xl" />,
            emojiColor: "#7c3aed",
            details: {
              description: "Total team members across all departments",
              breakdown: calculateMemberBreakdown(members), // YEH PROPERLY CALL HOGA
              recentAdditions: recentMembers.slice(0, 4)
            }
          },
          {
            id: 3,
            title: "Pending Deadlines",
            value: pendingDeadlines.length.toString(),
            change: "",
            changeText: "Within 7 days",
            emoji: <FaClockRotateLeft />,
            emojiColor: "#f59e0b",
            details: {
              description: "Projects and tasks approaching their deadlines",
              breakdown: calculateDeadlineBreakdown(deadlines), // YEH PROPERLY CALL HOGA
              upcomingDeadlines: pendingDeadlines.slice(0, 5)
            }
          },
          {
            id: 4,
            title: "Completion Rate",
            value: calculateCompletionRate(completion) + "%",
            change: "↑ 5.2%",
            changeText: "from last month",
            emoji: <span className="text-2xl">✓</span>,
            emojiColor: "#10b981",
            details: {
              description: "Overall project completion and success rate",
              breakdown: calculateCompletionBreakdown(completion),
              monthlyTrend: completion[0]?.monthlyTrend || [],
              topPerformers: completion[0]?.topPerformers || []
            }
          }
        ];

        setStatsData(formattedStats);
      } catch (error) {
        console.error("Error fetching stats:", error);
        // Fallback to default data if Firebase fails
        setStatsData(getDefaultStatsData());
      } finally {
        setLoading(false);
      }
    };

    fetchStatsData();
  }, []);

  // Default data fallback
  const getDefaultStatsData = () => {
    return [
      {
        id: 1,
        title: "Active Projects",
        value: "12",
        change: "↑ 2.5%",
        changeText: "from last month",
        emoji: <VscProject />,
        emojiColor: "#00d4ff",
        details: {
          description: "Total number of projects currently in progress",
          breakdown: [
            { label: "In Development", count: 7, color: "#00d4ff", projects: [] },
            { label: "In Review", count: 3, color: "#7c3aed", projects: [] },
            { label: "Testing Phase", count: 2, color: "#10b981", projects: [] }
          ],
          recentProjects: []
        }
      },
      {
        id: 2,
        title: "Team Members",
        value: "28",
        change: "↑ 4 new",
        changeText: "this month",
        emoji: <FiUsers className="text-2xl" />,
        emojiColor: "#7c3aed",
        details: {
          description: "Total team members across all departments",
          breakdown: [],
          recentAdditions: []
        }
      },
      {
        id: 3,
        title: "Pending Deadlines",
        value: "5",
        change: "",
        changeText: "Within 7 days",
        emoji: <FaClockRotateLeft />,
        emojiColor: "#f59e0b",
        details: {
          description: "Projects and tasks approaching their deadlines",
          breakdown: [],
          upcomingDeadlines: []
        }
      },
      {
        id: 4,
        title: "Completion Rate",
        value: "87%",
        change: "↑ 5.2%",
        changeText: "from last month",
        emoji: <span className="text-2xl">✓</span>,
        emojiColor: "#10b981",
        details: {
          description: "Overall project completion and success rate",
          breakdown: [],
          monthlyTrend: [],
          topPerformers: []
        }
      }
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#00d4ff]"></div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {statsData.map((stat) => (
          <StatsCard 
            key={stat.id} 
            {...stat} 
            onClick={() => setSelectedStat(stat)}
          />
        ))}
      </div>

      {/* Main Details Modal */}
      {selectedStat && !selectedBreakdown && !selectedProject && !selectedDeadline && !selectedPerformer && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedStat(null)}
        >
          <div 
            className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#334155] rounded-2xl p-8 max-w-2xl w-full max-h-[calc(100vh-40px)] overflow-y-auto" style={{scrollbarWidth:'none'}}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: `${selectedStat.emojiColor}15`, color: selectedStat.emojiColor }}
                >
                  {selectedStat.emoji}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#f8fafc] mb-1">{selectedStat.title}</h2>
                  <p className="text-[#94a3b8] text-sm">{selectedStat.details.description}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStat(null)}
                className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Main Value Display */}
            <div className="bg-[#0f172a] border border-[#334155] rounded-xl p-6 mb-6">
              <div className="text-center">
                <div className="text-5xl font-bold font-mono text-[#f8fafc] mb-2">
                  {selectedStat.value}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm font-medium">
                  {selectedStat.change && (
                    <span className={`${selectedStat.change.includes('↑') ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {selectedStat.change}
                    </span>
                  )}
                  <span className="text-[#64748b]">{selectedStat.changeText}</span>
                </div>
              </div>
            </div>

            {/* Breakdown Section - Clickable */}
            {selectedStat.details.breakdown && selectedStat.details.breakdown.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Breakdown</h3>
                <div className="space-y-3">
                  {selectedStat.details.breakdown.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="bg-[#0f172a] border border-[#334155] rounded-lg p-4 cursor-pointer hover:border-[#00d4ff] transition-all"
                      onClick={() => setSelectedBreakdown(item)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[#f8fafc] text-sm font-medium">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#f8fafc] font-bold">{item.count}{selectedStat.id === 4 ? '%' : ''}</span>
                          <svg className="w-4 h-4 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                          </svg>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-[#0a0e27] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${selectedStat.id === 4 ? item.count : (item.count / parseInt(selectedStat.value)) * 100}%`,
                            backgroundColor: item.color
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Projects - Clickable */}
            {selectedStat.details.recentProjects && selectedStat.details.recentProjects.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">
                  {selectedStat.id === 1 ? "Recent Projects" : "Recent Additions"}
                </h3>
                <div className="space-y-2">
                  {selectedStat.details.recentProjects.map((project, idx) => (
                    <div 
                      key={idx}
                      className="bg-[#0f172a] border border-[#334155] rounded-lg p-4 cursor-pointer hover:border-[#00d4ff] transition-all"
                      onClick={() => setSelectedProject(project)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]"></div>
                          <span className="text-[#f8fafc] text-sm font-medium">{project.name}</span>
                        </div>
                        <svg className="w-4 h-4 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Additions - Team Members - Clickable */}
            {selectedStat.details.recentAdditions && selectedStat.details.recentAdditions.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Recent Additions</h3>
                <div className="space-y-2">
                  {selectedStat.details.recentAdditions.map((member, idx) => (
                    <div 
                      key={idx}
                      className="bg-[#0f172a] border border-[#334155] rounded-lg p-4 cursor-pointer hover:border-[#7c3aed] transition-all"
                      onClick={() => setSelectedProject(member)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]"></div>
                          <span className="text-[#f8fafc] text-sm font-medium">{member.name} - {member.role}</span>
                        </div>
                        <svg className="w-4 h-4 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Deadlines - Clickable */}
            {selectedStat.details.upcomingDeadlines && selectedStat.details.upcomingDeadlines.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Upcoming Deadlines</h3>
                <div className="space-y-2">
                  {selectedStat.details.upcomingDeadlines.map((deadline, idx) => (
                    <div 
                      key={idx} 
                      className="bg-[#0f172a] border border-[#334155] rounded-lg p-4 cursor-pointer hover:border-[#f59e0b] transition-all"
                      onClick={() => setSelectedDeadline(deadline)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[#f8fafc] font-medium text-sm">{deadline.project}</p>
                          <p className="text-[#64748b] text-xs mt-1">{deadline.dueDate}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-md text-xs font-medium ${
                            deadline.priority === 'High' ? 'bg-[rgba(239,68,68,0.15)] text-[#ef4444]' :
                            deadline.priority === 'Medium' ? 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]' :
                            'bg-[rgba(16,185,129,0.15)] text-[#10b981]'
                          }`}>
                            {deadline.priority}
                          </span>
                          <svg className="w-4 h-4 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly Trend */}
            {selectedStat.details.monthlyTrend && selectedStat.details.monthlyTrend.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Monthly Trend</h3>
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4">
                  <div className="flex items-end justify-between gap-4 h-32">
                    {selectedStat.details.monthlyTrend.map((item, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full bg-[#0a0e27] rounded-t-lg relative" style={{ height: `${item.rate}%` }}>
                          <div 
                            className="absolute bottom-0 w-full bg-gradient-to-t from-[#10b981] to-[#10b981]/50 rounded-t-lg transition-all duration-500"
                            style={{ height: '100%' }}
                          >
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[#f8fafc] text-xs font-bold">
                              {item.rate}%
                            </span>
                          </div>
                        </div>
                        <span className="text-[#64748b] text-xs font-medium">{item.month}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Top Performers - Clickable */}
            {selectedStat.details.topPerformers && selectedStat.details.topPerformers.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Top Performers</h3>
                <div className="space-y-2">
                  {selectedStat.details.topPerformers.map((performer, idx) => (
                    <div 
                      key={idx}
                      className="bg-[#0f172a] border border-[#334155] rounded-lg p-4 cursor-pointer hover:border-[#10b981] transition-all"
                      onClick={() => setSelectedPerformer(performer)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-[#ffd700] text-[#000]' :
                            idx === 1 ? 'bg-[#c0c0c0] text-[#000]' :
                            'bg-[#cd7f32] text-[#000]'
                          }`}>
                            {idx + 1}
                          </div>
                          <span className="text-[#f8fafc] text-sm font-medium">
                            {typeof performer === 'string' ? performer : performer.name}
                          </span>
                        </div>
                        <svg className="w-4 h-4 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setSelectedStat(null)}
              className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] text-white font-medium rounded-lg hover:shadow-[0_4px_20px_rgba(0,212,255,0.4)] transition-all"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* Breakdown Detail Modal */}
      {selectedBreakdown && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedBreakdown(null)}
        >
          <div 
            className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#334155] rounded-2xl p-8 max-w-2xl w-full max-h-[calc(100vh-40px)] overflow-y-auto "style={{scrollbarWidth:'none'}}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedBreakdown(null)}
                  className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-[#f8fafc]">{selectedBreakdown.label}</h2>
                  <p className="text-[#94a3b8] text-sm mt-1">
                    {selectedBreakdown.count} {selectedStat.id === 4 ? '% completion rate' : 'items'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedBreakdown(null)}
                className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Content based on type */}
            {selectedBreakdown.projects && selectedBreakdown.projects.length > 0 && (
              <div className="space-y-3">
                {selectedBreakdown.projects.map((project, idx) => (
                  <div 
                    key={idx}
                    className="bg-[#0f172a] border border-[#334155] rounded-lg p-5 cursor-pointer hover:border-[#00d4ff] transition-all"
                    onClick={() => {
                      setSelectedBreakdown(null);
                      setSelectedProject(project);
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-[#f8fafc] font-semibold mb-1">{project.name}</h3>
                        <p className="text-[#64748b] text-sm">Lead: {project.lead}</p>
                      </div>
                      <span className="text-[#00d4ff] font-bold text-lg">{project.progress}%</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#94a3b8] mb-3">
                      <span>👥 {Array.isArray(project.team) ? project.team.length : project.team} members</span>
                    </div>
                    <div className="w-full h-2 bg-[#0a0e27] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${project.progress}%`,
                          backgroundColor: selectedBreakdown.color
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedBreakdown.members && selectedBreakdown.members.length > 0 && (
              <div className="space-y-3">
                {selectedBreakdown.members.map((member, idx) => (
                  <div 
                    key={idx}
                    className="bg-[#0f172a] border border-[#334155] rounded-lg p-5 cursor-pointer hover:border-[#7c3aed] transition-all"
                    onClick={() => setSelectedProject(member)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-[#f8fafc] font-semibold mb-1">{member.name}</h3>
                        <p className="text-[#64748b] text-sm">{member.role}</p>
                      </div>
                      <span className="text-[#7c3aed] text-sm font-medium">{member.experience}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-2 py-1 bg-[rgba(124,58,237,0.15)] text-[#7c3aed] text-xs rounded-md">
                        {member.projects} Projects
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedBreakdown.tasks && selectedBreakdown.tasks.length > 0 && (
              <div className="space-y-3">
                {selectedBreakdown.tasks.map((task, idx) => (
                  <div 
                    key={idx}
                    className="bg-[#0f172a] border border-[#334155] rounded-lg p-5"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-[#f8fafc] font-semibold mb-1">{task.name || task.project}</h3>
                        <p className="text-[#64748b] text-sm mb-2">{task.description}</p>
                        <div className="flex items-center gap-3 text-xs text-[#94a3b8]">
                          <span>Project: {task.project}</span>
                          <span>•</span>
                          <span>Due: {task.dueDate}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ml-3 ${
                        task.priority === 'Critical' || task.priority === 'High' ? 'bg-[rgba(239,68,68,0.15)] text-[#ef4444]' :
                        task.priority === 'Medium' ? 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]' :
                        'bg-[rgba(16,185,129,0.15)] text-[#10b981]'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="mt-3 p-2 bg-[#0a0e27] rounded text-xs text-[#94a3b8]">
                      Assigned to: <span className="text-[#f8fafc]">{task.assignedTo || task.lead}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!selectedBreakdown.projects?.length && !selectedBreakdown.members?.length && !selectedBreakdown.tasks?.length && (
              <div className="text-center py-12">
                <p className="text-[#64748b] text-lg">No data available</p>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setSelectedBreakdown(null)}
              className="w-full mt-6 px-4 py-3 bg-[#334155] text-[#f8fafc] font-medium rounded-lg hover:bg-[#475569] transition-all"
            >
              Back to Overview
            </button>
          </div>
        </div>
      )}

      {/* Project/Member Detail Modal - SAME AS BEFORE */}
      {selectedProject && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedProject(null)}
        >
          <div 
            className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#334155] rounded-2xl p-8 max-w-2xl w-full max-h-[calc(100vh-40px)] overflow-y-auto" style={{scrollbarWidth:'none'}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-[#f8fafc]">{selectedProject.name}</h2>
                  {selectedProject.status && (
                    <p className="text-[#94a3b8] text-sm mt-1">{selectedProject.status}</p>
                  )}
                  {selectedProject.role && (
                    <p className="text-[#94a3b8] text-sm mt-1">{selectedProject.role}</p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setSelectedProject(null)}
                className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {selectedProject.progress !== undefined && (
              <div className="bg-[#0f172a] border border-[#334155] rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[#94a3b8] text-sm">Progress</span>
                  <span className="text-[#00d4ff] font-bold text-2xl">{selectedProject.progress}%</span>
                </div>
                <div className="w-full h-3 bg-[#0a0e27] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] rounded-full transition-all duration-500"
                    style={{ width: `${selectedProject.progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              {selectedProject.startDate && (
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4">
                  <p className="text-[#94a3b8] text-xs mb-1">Start Date</p>
                  <p className="text-[#f8fafc] font-semibold">{selectedProject.startDate}</p>
                </div>
              )}
              {selectedProject.expectedEnd && (
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4">
                  <p className="text-[#94a3b8] text-xs mb-1">Expected End</p>
                  <p className="text-[#f8fafc] font-semibold">{selectedProject.expectedEnd}</p>
                </div>
              )}
              {selectedProject.budget && (
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4">
                  <p className="text-[#94a3b8] text-xs mb-1">Budget</p>
                  <p className="text-[#f8fafc] font-semibold">{selectedProject.budget}</p>
                </div>
              )}
              {selectedProject.joinDate && (
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4">
                  <p className="text-[#94a3b8] text-xs mb-1">Join Date</p>
                  <p className="text-[#f8fafc] font-semibold">{selectedProject.joinDate}</p>
                </div>
              )}
              {selectedProject.email && (
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4 col-span-2">
                  <p className="text-[#94a3b8] text-xs mb-1">Email</p>
                  <p className="text-[#f8fafc] font-semibold">{selectedProject.email}</p>
                </div>
              )}
              {selectedProject.phone && (
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4 col-span-2">
                  <p className="text-[#94a3b8] text-xs mb-1">Phone</p>
                  <p className="text-[#f8fafc] font-semibold">{selectedProject.phone}</p>
                </div>
              )}
            </div>

            {selectedProject.team && Array.isArray(selectedProject.team) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Team Members</h3>
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.team.map((member, idx) => (
                      <span key={idx} className="px-3 py-1 bg-[rgba(0,212,255,0.15)] text-[#00d4ff] text-sm rounded-md">
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedProject.skills && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Skills</h3>
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.skills.map((skill, idx) => (
                      <span key={idx} className="px-3 py-1 bg-[rgba(124,58,237,0.15)] text-[#7c3aed] text-sm rounded-md">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedProject(null)}
              className="w-full px-4 py-3 bg-[#334155] text-[#f8fafc] font-medium rounded-lg hover:bg-[#475569] transition-all"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Deadline Detail Modal - SAME AS BEFORE */}
      {selectedDeadline && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDeadline(null)}
        >
          <div 
            className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#334155] rounded-2xl p-8 max-w-2xl w-full max-h-[calc(100vh-40px)] overflow-y-auto" style={{scrollbarWidth:'none'}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedDeadline(null)}
                  className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-[#f8fafc]">{selectedDeadline.project}</h2>
                  <p className="text-[#94a3b8] text-sm mt-1">{selectedDeadline.description}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDeadline(null)}
                className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {selectedDeadline.progress !== undefined && (
              <div className="bg-[#0f172a] border border-[#334155] rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[#94a3b8] text-sm">Progress</span>
                  <span className="text-[#f59e0b] font-bold text-2xl">{selectedDeadline.progress}%</span>
                </div>
                <div className="w-full h-3 bg-[#0a0e27] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#f59e0b] to-[#ef4444] rounded-full transition-all duration-500"
                    style={{ width: `${selectedDeadline.progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4">
                <p className="text-[#94a3b8] text-xs mb-1">Due Date</p>
                <p className="text-[#f8fafc] font-semibold">{selectedDeadline.dueDate}</p>
              </div>
              <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4">
                <p className="text-[#94a3b8] text-xs mb-1">Priority</p>
                <span className={`inline-block px-3 py-1 rounded-md text-xs font-medium ${
                  selectedDeadline.priority === 'High' ? 'bg-[rgba(239,68,68,0.15)] text-[#ef4444]' :
                  selectedDeadline.priority === 'Medium' ? 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]' :
                  'bg-[rgba(16,185,129,0.15)] text-[#10b981]'
                }`}>
                  {selectedDeadline.priority}
                </span>
              </div>
              {selectedDeadline.lead && (
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4">
                  <p className="text-[#94a3b8] text-xs mb-1">Project Lead</p>
                  <p className="text-[#f8fafc] font-semibold">{selectedDeadline.lead}</p>
                </div>
              )}
              {selectedDeadline.team && (
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4">
                  <p className="text-[#94a3b8] text-xs mb-1">Team Size</p>
                  <p className="text-[#f8fafc] font-semibold">{selectedDeadline.team} members</p>
                </div>
              )}
              {selectedDeadline.tasksRemaining !== undefined && (
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4 col-span-2">
                  <p className="text-[#94a3b8] text-xs mb-1">Tasks Remaining</p>
                  <p className="text-[#f8fafc] font-semibold">{selectedDeadline.tasksRemaining} tasks</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedDeadline(null)}
              className="w-full px-4 py-3 bg-[#334155] text-[#f8fafc] font-medium rounded-lg hover:bg-[#475569] transition-all"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Performer Detail Modal - SAME AS BEFORE */}
      {selectedPerformer && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPerformer(null)}
        >
          <div 
            className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#334155] rounded-2xl p-8 max-w-2xl w-full max-h-[calc(100vh-40px)] overflow-y-auto" style={{scrollbarWidth:'none'}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedPerformer(null)}
                  className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-[#f8fafc]">{selectedPerformer.name}</h2>
                  <p className="text-[#94a3b8] text-sm mt-1">{selectedPerformer.specialization}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPerformer(null)}
                className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[#0f172a] border border-[#334155] rounded-xl p-4 text-center">
                <p className="text-[#94a3b8] text-xs mb-2">Completion Rate</p>
                <p className="text-[#10b981] font-bold text-2xl">{selectedPerformer.completionRate}%</p>
              </div>
              <div className="bg-[#0f172a] border border-[#334155] rounded-xl p-4 text-center">
                <p className="text-[#94a3b8] text-xs mb-2">Projects</p>
                <p className="text-[#00d4ff] font-bold text-2xl">{selectedPerformer.projectsCompleted}</p>
              </div>
              <div className="bg-[#0f172a] border border-[#334155] rounded-xl p-4 text-center">
                <p className="text-[#94a3b8] text-xs mb-2">Avg Rating</p>
                <p className="text-[#ffd700] font-bold text-2xl">{selectedPerformer.avgRating}</p>
              </div>
            </div>

            {selectedPerformer.achievements && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#f8fafc] mb-4">Achievements</h3>
                <div className="space-y-2">
                  {selectedPerformer.achievements.map((achievement, idx) => (
                    <div key={idx} className="bg-[#0f172a] border border-[#334155] rounded-lg p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffd700] to-[#f59e0b] flex items-center justify-center text-lg">
                        🏆
                      </div>
                      <span className="text-[#f8fafc] font-medium">{achievement}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedPerformer(null)}
              className="w-full px-4 py-3 bg-[#334155] text-[#f8fafc] font-medium rounded-lg hover:bg-[#475569] transition-all"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default StatsGrid;