import React, { useState } from 'react';

// ============================================
// 1. CREATE NEW PROJECT MODAL
// ============================================
const CreateProjectModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    projectName: '',
    client: '',
    description: '',
    startDate: '',
    endDate: '',
    budget: '',
    priority: 'medium',
    category: 'web-development'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Project Created:', formData);
    // Add your API call here
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1f3a] border border-[#1e293b] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[0_0_40px_rgba(0,212,255,0.15)]">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1f3a] border-b border-[#1e293b] p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-[#f8fafc] mb-1">Create New Project</h2>
            <p className="text-[#94a3b8] text-sm">Fill in the details to start a new project</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-[#141937] hover:bg-[#ef4444]/20 text-[#94a3b8] hover:text-[#ef4444] transition-all"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Project Name */}
          <div>
            <label className="block text-[#f8fafc] font-semibold mb-2 text-sm">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={formData.projectName}
              onChange={(e) => setFormData({...formData, projectName: e.target.value})}
              placeholder="e.g., E-Commerce Mobile App"
              className="w-full bg-[#141937] border border-[#1e293b] rounded-xl px-4 py-3 text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
            />
          </div>

          {/* Client Name */}
          <div>
            <label className="block text-[#f8fafc] font-semibold mb-2 text-sm">
              Client Name *
            </label>
            <input
              type="text"
              required
              value={formData.client}
              onChange={(e) => setFormData({...formData, client: e.target.value})}
              placeholder="e.g., TechMart Solutions"
              className="w-full bg-[#141937] border border-[#1e293b] rounded-xl px-4 py-3 text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[#f8fafc] font-semibold mb-2 text-sm">
              Project Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Brief description of the project..."
              rows="4"
              className="w-full bg-[#141937] border border-[#1e293b] rounded-xl px-4 py-3 text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all resize-none"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#f8fafc] font-semibold mb-2 text-sm">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                className="w-full bg-[#141937] border border-[#1e293b] rounded-xl px-4 py-3 text-[#f8fafc] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-[#f8fafc] font-semibold mb-2 text-sm">
                End Date *
              </label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                className="w-full bg-[#141937] border border-[#1e293b] rounded-xl px-4 py-3 text-[#f8fafc] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
              />
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-[#f8fafc] font-semibold mb-2 text-sm">
              Budget (USD)
            </label>
            <input
              type="number"
              value={formData.budget}
              onChange={(e) => setFormData({...formData, budget: e.target.value})}
              placeholder="e.g., 50000"
              className="w-full bg-[#141937] border border-[#1e293b] rounded-xl px-4 py-3 text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
            />
          </div>

          {/* Priority & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#f8fafc] font-semibold mb-2 text-sm">
                Priority *
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
                className="w-full bg-[#141937] border border-[#1e293b] rounded-xl px-4 py-3 text-[#f8fafc] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-[#f8fafc] font-semibold mb-2 text-sm">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full bg-[#141937] border border-[#1e293b] rounded-xl px-4 py-3 text-[#f8fafc] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
              >
                <option value="web-development">Web Development</option>
                <option value="mobile-app">Mobile App</option>
                <option value="ui-ux-design">UI/UX Design</option>
                <option value="backend">Backend Development</option>
                <option value="devops">DevOps</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-[#1e293b]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-[#141937] hover:bg-[#1e293b] text-[#94a3b8] rounded-xl font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] hover:shadow-[0_8px_20px_rgba(0,212,255,0.3)] text-white rounded-xl font-semibold transition-all"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// 2. ASSIGN TEAM MEMBERS MODAL
// ============================================
const AssignTeamModal = ({ isOpen, onClose }) => {
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const projects = [
    { id: 1, name: 'E-Commerce Mobile App', client: 'TechMart Solutions' },
    { id: 2, name: 'Corporate Website Redesign', client: 'Global Industries' },
    { id: 3, name: 'CRM Dashboard Development', client: 'SalesPro Inc' }
  ];

  const teamMembers = [
    { id: 1, name: 'Ali Hassan', role: 'Full Stack Developer', avatar: 'AH', available: true },
    { id: 2, name: 'Sara Khan', role: 'Frontend Developer', avatar: 'SK', available: false },
    { id: 3, name: 'Muhammad Kamran', role: 'Backend Developer', avatar: 'MK', available: true },
    { id: 4, name: 'Fatima Zahra', role: 'UI/UX Designer', avatar: 'FZ', available: false },
    { id: 5, name: 'Ahmed Raza', role: 'DevOps Engineer', avatar: 'AR', available: true },
    { id: 6, name: 'Ayesha Malik', role: 'QA Engineer', avatar: 'AM', available: true },
    { id: 7, name: 'Usman Ali', role: 'Project Manager', avatar: 'UA', available: true },
    { id: 8, name: 'Zainab Noor', role: 'Mobile Developer', avatar: 'ZN', available: false }
  ];

  const filteredMembers = teamMembers.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleMember = (memberId) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleAssign = () => {
    console.log('Assigning members:', selectedMembers, 'to project:', selectedProject);
    // Add your API call here
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1f3a] border border-[#1e293b] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-[0_0_40px_rgba(0,212,255,0.15)]">
        {/* Header */}
        <div className="bg-[#1a1f3a] border-b border-[#1e293b] p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-[#f8fafc] mb-1">Assign Team Members</h2>
            <p className="text-[#94a3b8] text-sm">Select project and team members to assign</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-[#141937] hover:bg-[#ef4444]/20 text-[#94a3b8] hover:text-[#ef4444] transition-all"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Project Selection */}
          <div className="mb-6">
            <label className="block text-[#f8fafc] font-semibold mb-3 text-sm">
              Select Project *
            </label>
            <div className="space-y-2">
              {projects.map(project => (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedProject === project.id
                      ? 'bg-gradient-to-r from-[rgba(0,212,255,0.15)] to-[rgba(124,58,237,0.15)] border-[#00d4ff]'
                      : 'bg-[#141937] border-[#1e293b] hover:border-[#00d4ff]/50'
                  }`}
                >
                  <div className="font-semibold text-[#f8fafc]">{project.name}</div>
                  <div className="text-sm text-[#94a3b8] mt-1">Client: {project.client}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="mb-4">
            <label className="block text-[#f8fafc] font-semibold mb-3 text-sm">
              Select Team Members ({selectedMembers.length} selected)
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search team members..."
                className="w-full bg-[#141937] border border-[#1e293b] rounded-xl pl-11 pr-4 py-3 text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
          </div>

          {/* Team Members Grid */}
          <div className="grid grid-cols-2 gap-3">
            {filteredMembers.map(member => (
              <div
                key={member.id}
                onClick={() => toggleMember(member.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedMembers.includes(member.id)
                    ? 'bg-gradient-to-r from-[rgba(0,212,255,0.15)] to-[rgba(124,58,237,0.15)] border-[#00d4ff]'
                    : 'bg-[#141937] border-[#1e293b] hover:border-[#00d4ff]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center text-white font-bold flex-shrink-0">
                    {member.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#f8fafc] truncate">{member.name}</div>
                    <div className="text-xs text-[#94a3b8] truncate">{member.role}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-2 h-2 rounded-full ${member.available ? 'bg-[#10b981]' : 'bg-[#f59e0b]'}`}></div>
                      <span className={`text-xs ${member.available ? 'text-[#10b981]' : 'text-[#f59e0b]'}`}>
                        {member.available ? 'Available' : 'On Task'}
                      </span>
                    </div>
                  </div>
                  {selectedMembers.includes(member.id) && (
                    <div className="text-[#00d4ff] flex-shrink-0">✓</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#1e293b] bg-[#1a1f3a]">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-[#141937] hover:bg-[#1e293b] text-[#94a3b8] rounded-xl font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedProject || selectedMembers.length === 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] hover:shadow-[0_8px_20px_rgba(0,212,255,0.3)] text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Assign Members ({selectedMembers.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 3. GENERATE REPORTS MODAL
// ============================================
const GenerateReportModal = ({ isOpen, onClose }) => {
  const [reportConfig, setReportConfig] = useState({
    reportType: 'project-summary',
    dateRange: 'last-month',
    customStartDate: '',
    customEndDate: '',
    projects: [],
    includeCharts: true,
    includeTeamStats: true,
    includeFinancials: false,
    format: 'pdf'
  });

  const reportTypes = [
    { id: 'project-summary', name: 'Project Summary Report', icon: '📊', desc: 'Overview of all projects' },
    { id: 'team-performance', name: 'Team Performance Report', icon: '👥', desc: 'Team productivity analysis' },
    { id: 'financial', name: 'Financial Report', icon: '💰', desc: 'Budget and expenses' },
    { id: 'time-tracking', name: 'Time Tracking Report', icon: '⏱️', desc: 'Hours logged per project' },
    { id: 'client', name: 'Client Report', icon: '🤝', desc: 'Client-specific project status' },
    { id: 'custom', name: 'Custom Report', icon: '⚙️', desc: 'Build your own report' }
  ];

  const projects = [
    'E-Commerce Mobile App',
    'Corporate Website Redesign',
    'CRM Dashboard Development',
    'Marketing Platform',
    'Inventory Management System'
  ];

  const handleGenerate = () => {
    console.log('Generating report with config:', reportConfig);
    // Add your API call here
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1f3a] border border-[#1e293b] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-[0_0_40px_rgba(0,212,255,0.15)]">
        {/* Header */}
        <div className="bg-[#1a1f3a] border-b border-[#1e293b] p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-[#f8fafc] mb-1">Generate Report</h2>
            <p className="text-[#94a3b8] text-sm">Create detailed reports for your projects</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-[#141937] hover:bg-[#ef4444]/20 text-[#94a3b8] hover:text-[#ef4444] transition-all"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Report Type Selection */}
          <div className="mb-6">
            <label className="block text-[#f8fafc] font-semibold mb-3 text-sm">
              Report Type *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {reportTypes.map(type => (
                <div
                  key={type.id}
                  onClick={() => setReportConfig({...reportConfig, reportType: type.id})}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    reportConfig.reportType === type.id
                      ? 'bg-gradient-to-r from-[rgba(0,212,255,0.15)] to-[rgba(124,58,237,0.15)] border-[#00d4ff]'
                      : 'bg-[#141937] border-[#1e293b] hover:border-[#00d4ff]/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{type.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-[#f8fafc] text-sm">{type.name}</div>
                      <div className="text-xs text-[#94a3b8] mt-1">{type.desc}</div>
                    </div>
                    {reportConfig.reportType === type.id && (
                      <div className="text-[#00d4ff]">✓</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="mb-6">
            <label className="block text-[#f8fafc] font-semibold mb-3 text-sm">
              Date Range *
            </label>
            <select
              value={reportConfig.dateRange}
              onChange={(e) => setReportConfig({...reportConfig, dateRange: e.target.value})}
              className="w-full bg-[#141937] border border-[#1e293b] rounded-xl px-4 py-3 text-[#f8fafc] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all mb-3"
            >
              <option value="last-week">Last 7 Days</option>
              <option value="last-month">Last 30 Days</option>
              <option value="last-quarter">Last Quarter</option>
              <option value="last-year">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>

            {reportConfig.dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs mb-2">From Date</label>
                  <input
                    type="date"
                    value={reportConfig.customStartDate}
                    onChange={(e) => setReportConfig({...reportConfig, customStartDate: e.target.value})}
                    className="w-full bg-[#141937] border border-[#1e293b] rounded-xl px-4 py-3 text-[#f8fafc] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs mb-2">To Date</label>
                  <input
                    type="date"
                    value={reportConfig.customEndDate}
                    onChange={(e) => setReportConfig({...reportConfig, customEndDate: e.target.value})}
                    className="w-full bg-[#141937] border border-[#1e293b] rounded-xl px-4 py-3 text-[#f8fafc] focus:outline-none focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Project Selection */}
          <div className="mb-6">
            <label className="block text-[#f8fafc] font-semibold mb-3 text-sm">
              Select Projects (Optional)
            </label>
            <div className="bg-[#141937] border border-[#1e293b] rounded-xl p-4 max-h-48 overflow-y-auto">
              {projects.map(project => (
                <label key={project} className="flex items-center gap-3 p-2 hover:bg-[#1a1f3a] rounded-lg cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={reportConfig.projects.includes(project)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setReportConfig({...reportConfig, projects: [...reportConfig.projects, project]});
                      } else {
                        setReportConfig({...reportConfig, projects: reportConfig.projects.filter(p => p !== project)});
                      }
                    }}
                    className="w-4 h-4 accent-[#00d4ff]"
                  />
                  <span className="text-[#f8fafc] text-sm">{project}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-[#94a3b8] mt-2">Leave empty to include all projects</p>
          </div>

          {/* Report Options */}
          <div className="mb-6">
            <label className="block text-[#f8fafc] font-semibold mb-3 text-sm">
              Report Options
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-[#141937] border border-[#1e293b] rounded-xl cursor-pointer hover:border-[#00d4ff]/50 transition-all">
                <input
                  type="checkbox"
                  checked={reportConfig.includeCharts}
                  onChange={(e) => setReportConfig({...reportConfig, includeCharts: e.target.checked})}
                  className="w-4 h-4 accent-[#00d4ff]"
                />
                <div className="flex-1">
                  <div className="text-[#f8fafc] text-sm font-medium">Include Charts & Graphs</div>
                  <div className="text-xs text-[#94a3b8]">Visual representation of data</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[#141937] border border-[#1e293b] rounded-xl cursor-pointer hover:border-[#00d4ff]/50 transition-all">
                <input
                  type="checkbox"
                  checked={reportConfig.includeTeamStats}
                  onChange={(e) => setReportConfig({...reportConfig, includeTeamStats: e.target.checked})}
                  className="w-4 h-4 accent-[#00d4ff]"
                />
                <div className="flex-1">
                  <div className="text-[#f8fafc] text-sm font-medium">Team Statistics</div>
                  <div className="text-xs text-[#94a3b8]">Member performance and hours</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[#141937] border border-[#1e293b] rounded-xl cursor-pointer hover:border-[#00d4ff]/50 transition-all">
                <input
                  type="checkbox"
                  checked={reportConfig.includeFinancials}
                  onChange={(e) => setReportConfig({...reportConfig, includeFinancials: e.target.checked})}
                  className="w-4 h-4 accent-[#00d4ff]"
                />
                <div className="flex-1">
                  <div className="text-[#f8fafc] text-sm font-medium">Financial Details</div>
                  <div className="text-xs text-[#94a3b8]">Budget, expenses, and revenue</div>
                </div>
              </label>
            </div>
          </div>

          {/* Export Format */}
          <div>
            <label className="block text-[#f8fafc] font-semibold mb-3 text-sm">
              Export Format *
            </label>
            <div className="grid grid-cols-4 gap-3">
              {['pdf', 'excel', 'csv', 'json'].map(format => (
                <div
                  key={format}
                  onClick={() => setReportConfig({...reportConfig, format})}
                  className={`p-3 rounded-xl border cursor-pointer transition-all text-center ${
                    reportConfig.format === format
                      ? 'bg-gradient-to-r from-[rgba(0,212,255,0.15)] to-[rgba(124,58,237,0.15)] border-[#00d4ff]'
                      : 'bg-[#141937] border-[#1e293b] hover:border-[#00d4ff]/50'
                  }`}
                >
                  <div className="text-2xl mb-1">
                    {format === 'pdf' && '📄'}
                    {format === 'excel' && '📊'}
                    {format === 'csv' && '📋'}
                    {format === 'json' && '{ }'}
                  </div>
                  <div className="text-xs text-[#f8fafc] font-medium uppercase">{format}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#1e293b] bg-[#1a1f3a]">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-[#141937] hover:bg-[#1e293b] text-[#94a3b8] rounded-xl font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] hover:shadow-[0_8px_20px_rgba(0,212,255,0.3)] text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              <span>Generate Report</span>
              <span>📥</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// QUICK ACTIONS COMPONENT (Main Component)
// ============================================
const QuickActions = () => {
  const [activeModal, setActiveModal] = useState(null);

  // Actions Data with Icons and Descriptions
  const actions = [
    {
      id: 1,
      title: 'Create New Project',
      description: 'Start a new project workflow',
      icon: '➕',
      color: 'from-[#00d4ff] to-[#0891b2]',
      modalType: 'create'
    },
    {
      id: 2,
      title: 'Assign Team Member',
      description: 'Add members to projects',
      icon: '👤',
      color: 'from-[#7c3aed] to-[#6366f1]',
      modalType: 'assign'
    },
    {
      id: 3,
      title: 'Generate Report',
      description: 'Create project reports',
      icon: '📄',
      color: 'from-[#10b981] to-[#059669]',
      modalType: 'report'
    },
    {
      id: 4,
      title: 'Schedule Meeting',
      description: 'Plan team meetings',
      icon: '📅',
      color: 'from-[#f59e0b] to-[#ea580c]',
      modalType: null
    },
    {
      id: 5,
      title: 'Upload Documents',
      description: 'Add project files',
      icon: '📤',
      color: 'from-[#ec4899] to-[#db2777]',
      modalType: null
    },
    {
      id: 6,
      title: 'View Analytics',
      description: 'Check performance metrics',
      icon: '📊',
      color: 'from-[#06b6d4] to-[#0891b2]',
      modalType: null
    },
  ];

  const handleActionClick = (modalType) => {
    if (modalType) {
      setActiveModal(modalType);
    } else {
      console.log('This action is coming soon!');
    }
  };

  return (
    <>
      <div className="bg-[#1a1f3a] mt-10 border border-[#1e293b] rounded-2xl p-7 transition-all hover:border-[rgba(0,212,255,0.3)]">
        {/* Header */}
        <div className="pb-4 mb-6 border-b border-[#1e293b]">
          <h2 className="text-xl font-bold text-[#f8fafc]">Quick Actions</h2>
          <p className="text-[0.85rem] text-[#94a3b8] mt-1">Fast access to common tasks</p>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-1 gap-3">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action.modalType)}
              className="group w-full p-4 bg-gradient-to-r from-[rgba(0,212,255,0.1)] to-[rgba(124,58,237,0.1)] border border-[#00d4ff] rounded-xl text-left transition-all duration-300 hover:from-[rgba(0,212,255,0.2)] hover:to-[rgba(124,58,237,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,212,255,0.3)] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110`}>
                  {action.icon}
                </div>
                
                {/* Text Content */}
                <div className="flex-1">
                  <div className="font-semibold text-[#f8fafc] mb-0.5">
                    {action.title}
                  </div>
                  <div className="text-[0.75rem] text-[#94a3b8]">
                    {action.description}
                  </div>
                </div>

                {/* Arrow Icon */}
                <svg 
                  className="w-5 h-5 text-[#00d4ff] opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#1e293b]">
          <div className="text-center">
            <a 
              href="#" 
              className="text-[0.85rem] text-[#00d4ff] hover:text-[#7c3aed] font-medium transition-colors"
            >
              View All Actions →
            </a>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateProjectModal 
        isOpen={activeModal === 'create'} 
        onClose={() => setActiveModal(null)} 
      />
      <AssignTeamModal 
        isOpen={activeModal === 'assign'} 
        onClose={() => setActiveModal(null)} 
      />
      <GenerateReportModal 
        isOpen={activeModal === 'report'} 
        onClose={() => setActiveModal(null)} 
      />
    </>
  );
};

export default QuickActions;
export { CreateProjectModal, AssignTeamModal, GenerateReportModal };