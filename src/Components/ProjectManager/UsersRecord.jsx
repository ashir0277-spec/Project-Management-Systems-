// UsersRecord.jsx – Responsive All Team Members Table
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, ChevronRight,
  BarChart2, Mail, Phone, X, Building2,
  User
} from 'lucide-react';

const TL  = 'rgba(51,51,51,0.12)';
const TLB = 'rgba(51,51,51,0.18)';

const statusColors = {
  'Active':   { text: 'text-teal-600',  dot: 'bg-teal-500',  bg: 'bg-teal-50',  border: 'border-teal-200'  },
  'Inactive': { text: 'text-gray-500',  dot: 'bg-gray-400',  bg: 'bg-gray-50',  border: 'border-gray-200'  },
  'On Leave': { text: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Away':     { text: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
};

const roleColors = {
  'Frontend Developer': { text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  'Backend Developer':  { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  'Flutter Developer':  { text: 'text-cyan-600',   bg: 'bg-cyan-50',   border: 'border-cyan-200'   },
  'UI/UX Designer':     { text: 'text-pink-600',   bg: 'bg-pink-50',   border: 'border-pink-200'   },
  'Project Manager':    { text: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200'   },
  'QA Engineer':        { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  'Admin':              { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  'Developer':          { text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  'Designer':           { text: 'text-pink-600',   bg: 'bg-pink-50',   border: 'border-pink-200'   },
  'Manager':            { text: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200'   },
  'QA':                 { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
};
const defaultRoleColor = { text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };

const AVATAR_COLORS = [
  'from-teal-400 to-cyan-500',
  'from-violet-400 to-purple-500',
  'from-rose-400 to-pink-500',
  'from-amber-400 to-orange-500',
  'from-blue-400 to-indigo-500',
  'from-emerald-400 to-teal-500',
];

const getInitials    = (name = '') => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
const getAvatarColor = (id   = '') => AVATAR_COLORS[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const UsersRecord = () => {
  const navigate = useNavigate();
  const [members,    setMembers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'teamMembers'),
      snap => { setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      ()   => setLoading(false)
    );
    return unsub;
  }, []);

  const roles = ['All', ...Array.from(new Set(members.map(m => m.role).filter(Boolean)))];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members.filter(m => {
      const matchSearch = !q ||
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.role?.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q);
      const matchRole = roleFilter === 'All' || m.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [members, search, roleFilter]);

  if (loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">

        {/* ── Search + Role Filter + Members Count ── */}
        <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-3"
          style={{ border: `1px solid ${TL}` }}>

          {/* Search Input */}
          <div className="flex items-center gap-2 flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-[#EEF2F7]"
            style={{ border: `1px solid ${TL}` }}>
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, role..."
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none min-w-0"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Role Filter */}
          {roles.length > 1 && (
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="text-[12px] font-semibold px-2.5 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 outline-none cursor-pointer hover:border-teal-300 transition-colors flex-shrink-0 max-w-[130px] sm:max-w-none">
              {roles.map(r => <option key={r}>{r}</option>)}
            </select>
          )}

          {/* Members Count Badge */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EEF2F7] flex-shrink-0"
            style={{ border: `1px solid ${TL}` }}>
            <Users size={14} className="text-teal-500" />
            <span className="text-sm font-semibold text-gray-700">{members.length} Members</span>
          </div>

          <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
            {filtered.length} of {members.length}
          </span>
        </div>

        {/* ── Members Table / Cards ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
          <div className="flex items-center gap-2 px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${TL}` }}>
            <BarChart2 size={15} className="text-teal-500" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">All Members</h2>
            <span className="ml-auto text-xs text-gray-400">{filtered.length} records</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-4xl mb-3"><User/></div>
              <p className="text-gray-500 font-semibold">No members found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* ─── MOBILE CARD LIST (hidden on md+) ─── */}
              <div className="md:hidden">
                {filtered.map((member, idx) => {
                  const sCfg  = statusColors[member.status] || statusColors['Inactive'];
                  const rCfg  = roleColors[member.role]     || defaultRoleColor;
                  const tasks = member.tasks || [];
                  const done  = tasks.filter(t => t.status === 'Done').length;
                  const pend  = tasks.filter(t => t.status !== 'Done').length;

                  return (
                    <div
                      key={member.id}
                      onClick={() => navigate(`/userdetails/${member.id}`)}
                      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-teal-50/40 active:bg-teal-50/60 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                      style={{ borderBottom: `1px solid ${TL}` }}>

                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${getAvatarColor(member.id)} text-white text-[13px] font-bold shadow-sm`}>
                        {getInitials(member.name)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Name + Role badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-semibold text-gray-900 leading-tight">{member.name || '—'}</p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${rCfg.text} ${rCfg.bg} ${rCfg.border}`}>
                            {member.role || '—'}
                          </span>
                        </div>

                        {/* Row 2: Email */}
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate flex items-center gap-1">
                          <Mail size={9} className="flex-shrink-0" />{member.email || '—'}
                        </p>

                        {/* Row 3: Status · Dept · Tasks */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${sCfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sCfg.dot}`} />{member.status || 'Unknown'}
                          </span>
                          {member.department && (
                            <>
                              <span className="text-gray-200">·</span>
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5 truncate">
                                <Building2 size={9} className="flex-shrink-0" />{member.department}
                              </span>
                            </>
                          )}
                          {tasks.length > 0 && (
                            <>
                              <span className="text-gray-200">·</span>
                              <span className="text-[10px] text-gray-500 font-semibold">{tasks.length} tasks</span>
                              <span className="text-[10px] text-teal-500 font-semibold">{done}✓</span>
                              {pend > 0 && <span className="text-[10px] text-amber-500 font-semibold">{pend}⏳</span>}
                            </>
                          )}
                        </div>
                      </div>

                      <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>

              {/* ─── DESKTOP TABLE (shown on md+) ─── */}
              <div className="hidden md:block overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                <table className="w-full" style={{ minWidth: 720 }}>
                  <colgroup>
                    <col style={{ width: '4%'  }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '5%'  }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#EEF2F7]" style={{ borderBottom: `1px solid ${TLB}` }}>
                      {['#', 'Member', 'Email', 'Role', 'Department', 'Status', 'Tasks', ''].map((h, i) => (
                        <th key={i}
                          className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left whitespace-nowrap"
                          style={{ borderRight: i < 7 ? `1px solid ${TL}` : undefined }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((member, idx) => {
                      const sCfg  = statusColors[member.status] || statusColors['Inactive'];
                      const rCfg  = roleColors[member.role]     || defaultRoleColor;
                      const tasks = member.tasks || [];
                      const done  = tasks.filter(t => t.status === 'Done').length;
                      const pend  = tasks.filter(t => t.status !== 'Done').length;

                      return (
                        <tr key={member.id}
                          onClick={() => navigate(`/userdetails/${member.id}`)}
                          className={`cursor-pointer transition-colors hover:bg-teal-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                          style={{ borderBottom: `1px solid ${TL}` }}>

                          <td className="px-4 py-3.5 text-center" style={{ borderRight: `1px solid ${TL}` }}>
                            <span className="text-[12px] font-mono text-gray-400">{idx + 1}</span>
                          </td>

                          <td className="px-4 py-3.5" style={{ borderRight: `1px solid ${TL}` }}>
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${getAvatarColor(member.id)} text-white text-[12px] font-bold shadow-sm`}>
                                {getInitials(member.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-gray-900 truncate">{member.name || '—'}</p>
                                <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                                  <Phone size={9} />{member.phone || 'No phone'}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5" style={{ borderRight: `1px solid ${TL}` }}>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Mail size={11} className="text-gray-400 flex-shrink-0" />
                              <span className="text-[12px] text-gray-600 truncate">{member.email || '—'}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5" style={{ borderRight: `1px solid ${TL}` }}>
                            <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${rCfg.text} ${rCfg.bg} ${rCfg.border}`}>
                              {member.role || '—'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5" style={{ borderRight: `1px solid ${TL}` }}>
                            <span className="text-[12px] text-gray-600 truncate block">{member.department || '—'}</span>
                          </td>

                          <td className="px-4 py-3.5" style={{ borderRight: `1px solid ${TL}` }}>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap ${sCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sCfg.dot}`} />{member.status || 'Unknown'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5" style={{ borderRight: `1px solid ${TL}` }}>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] font-bold text-gray-700">{tasks.length}</span>
                              {tasks.length > 0 && (
                                <>
                                  <span className="text-[10px] text-teal-500 font-semibold whitespace-nowrap">{done}✓</span>
                                  {pend > 0 && <span className="text-[10px] text-amber-500 font-semibold whitespace-nowrap">{pend}⏳</span>}
                                </>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <ChevronRight size={15} className="text-gray-300" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 pb-2">
          Showing {filtered.length} of {members.length} members
        </p>

      </div>
    </div>
  );
};

export default UsersRecord;