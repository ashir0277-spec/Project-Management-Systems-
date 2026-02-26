import React, { useState } from 'react';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('month');

  const stats = [
    { label: 'Total Revenue', value: '$125,450', change: '+18.2%', trend: 'up' },
    { label: 'Active Projects', value: '24', change: '+12%', trend: 'up' },
    { label: 'Task Completion', value: '87%', change: '+5%', trend: 'up' },
    { label: 'Client Satisfaction', value: '4.8/5', change: '+0.3', trend: 'up' },
  ];

  const projectPerformance = [
    { name: 'E-commerce Platform', completion: 75, onTime: true, budget: 'On Track' },
    { name: 'Mobile App Redesign', completion: 90, onTime: true, budget: 'On Track' },
    { name: 'Marketing Campaign', completion: 45, onTime: false, budget: 'Over Budget' },
    { name: 'Data Analytics Dashboard', completion: 15, onTime: true, budget: 'Under Budget' },
  ];

  const teamProductivity = [
    { member: 'Alice Johnson', tasksCompleted: 28, efficiency: 92 },
    { member: 'Bob Smith', tasksCompleted: 24, efficiency: 88 },
    { member: 'Charlie Davis', tasksCompleted: 26, efficiency: 90 },
    { member: 'Diana Williams', tasksCompleted: 22, efficiency: 85 },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#f8fafc] mb-2">Analytics</h1>
          <p className="text-[#94a3b8]">Track performance and insights</p>
        </div>
        <div className="flex gap-2 bg-[#1e293b] p-1 rounded-lg">
          {['week', 'month', 'quarter', 'year'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-md transition-all duration-300 capitalize ${
                timeRange === range
                  ? 'bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] text-white'
                  : 'text-[#94a3b8] hover:text-[#00d4ff]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-6 rounded-xl border border-[#334155] hover:border-[#00d4ff] transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-[#94a3b8] text-sm">{stat.label}</div>
              <span className={`text-sm font-medium ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                {stat.change}
              </span>
            </div>
            <div className="text-3xl font-bold text-[#f8fafc]">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl border border-[#334155] p-6">
          <h2 className="text-xl font-bold text-[#f8fafc] mb-6">Revenue Trend</h2>
          <div className="h-64 flex items-end justify-between gap-2">
            {[40, 65, 45, 80, 60, 90, 75, 95, 70, 85, 100, 90].map((height, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-[#0f172a] rounded-t-lg overflow-hidden" style={{ height: '100%' }}>
                  <div
                    className="w-full bg-gradient-to-t from-[#00d4ff] to-[#7c3aed] rounded-t-lg transition-all duration-500"
                    style={{ height: `${height}%` }}
                  ></div>
                </div>
                <span className="text-[#64748b] text-xs">
                  {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][index]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Task Distribution */}
        <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl border border-[#334155] p-6">
          <h2 className="text-xl font-bold text-[#f8fafc] mb-6">Task Distribution</h2>
          <div className="flex items-center justify-center h-64">
            <div className="relative w-48 h-48">
              {/* Donut Chart Simulation */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#7c3aed]" style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 50% 100%)' }}></div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#10b981] to-[#059669]" style={{ clipPath: 'polygon(50% 50%, 100% 50%, 100% 100%, 50% 100%)' }}></div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#f59e0b] to-[#d97706]" style={{ clipPath: 'polygon(50% 50%, 50% 100%, 0% 100%, 0% 50%)' }}></div>
              <div className="absolute inset-6 rounded-full bg-[#0f172a]"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#f8fafc]">156</div>
                  <div className="text-[#94a3b8] text-sm">Total Tasks</div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="w-3 h-3 bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] rounded-full mx-auto mb-2"></div>
              <div className="text-[#f8fafc] font-semibold">78</div>
              <div className="text-[#94a3b8] text-xs">Completed</div>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-gradient-to-br from-[#10b981] to-[#059669] rounded-full mx-auto mb-2"></div>
              <div className="text-[#f8fafc] font-semibold">52</div>
              <div className="text-[#94a3b8] text-xs">In Progress</div>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-gradient-to-br from-[#f59e0b] to-[#d97706] rounded-full mx-auto mb-2"></div>
              <div className="text-[#f8fafc] font-semibold">26</div>
              <div className="text-[#94a3b8] text-xs">Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Performance */}
      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl border border-[#334155] p-6">
        <h2 className="text-xl font-bold text-[#f8fafc] mb-6">Project Performance</h2>
        <div className="space-y-4">
          {projectPerformance.map((project, index) => (
            <div key={index} className="bg-[#0f172a] p-4 rounded-lg border border-[#334155]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#f8fafc] font-semibold">{project.name}</h3>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    project.onTime ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {project.onTime ? 'On Time' : 'Delayed'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    project.budget === 'On Track' ? 'bg-green-500/20 text-green-400' : 
                    project.budget === 'Under Budget' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {project.budget}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00d4ff] to-[#7c3aed]"
                      style={{ width: `${project.completion}%` }}
                    ></div>
                  </div>
                </div>
                <span className="text-[#f8fafc] font-semibold">{project.completion}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Productivity */}
      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl border border-[#334155] p-6">
        <h2 className="text-xl font-bold text-[#f8fafc] mb-6">Team Productivity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {teamProductivity.map((member, index) => (
            <div key={index} className="bg-[#0f172a] p-4 rounded-lg border border-[#334155]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center text-white font-bold">
                  {member.member[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[#f8fafc] font-semibold text-sm truncate">{member.member}</h4>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#94a3b8] text-xs">Tasks Completed</span>
                    <span className="text-[#f8fafc] font-semibold text-sm">{member.tasksCompleted}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#94a3b8] text-xs">Efficiency</span>
                    <span className="text-[#00d4ff] font-semibold text-sm">{member.efficiency}%</span>
                  </div>
                  <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00d4ff] to-[#7c3aed]"
                      style={{ width: `${member.efficiency}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;