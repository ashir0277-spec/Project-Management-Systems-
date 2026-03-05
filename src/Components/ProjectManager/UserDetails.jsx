// UserDetails.jsx – Individual Member Profile Page (matches Dashboard theme)
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, User, Mail, Phone, MapPin, Calendar,
  Briefcase, CheckCircle2, Clock,
  CreditCard, FileText, Image, Building2, Hash,
  Shield, Star, ExternalLink, X
} from 'lucide-react';

const TL  = 'rgba(51,51,51,0.12)';

const statusColors = {
  'Active':   { text: 'text-teal-600',  dot: 'bg-teal-500',  bg: 'bg-teal-50',  border: 'border-teal-200'  },
  'Inactive': { text: 'text-gray-500',  dot: 'bg-gray-400',  bg: 'bg-gray-50',  border: 'border-gray-200'  },
  'On Leave': { text: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
};

const priorityColors = {
  High:     { text: 'text-red-600',     dot: 'bg-red-500',     bg: 'bg-red-50',     border: 'border-red-200'     },
  Medium:   { text: 'text-amber-600',   dot: 'bg-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-200'   },
  Low:      { text: 'text-emerald-600', dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  Critical: { text: 'text-red-600',     dot: 'bg-red-500',     bg: 'bg-red-50',     border: 'border-red-200'     },
};

const taskStatusColors = {
  'Done':        { text: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200'   },
  'In Progress': { text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  'Pending':     { text: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200'   },
  'Review':      { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  'Overdue':     { text: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200'    },
};

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

// ── Reusable Section ──────────────────────────────────────────────────────────
const Section = ({ icon: Icon, iconColor = 'text-teal-500', title, badge, children }) => (
  <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
    <div className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: `1px solid ${TL}` }}>
      <Icon size={15} className={iconColor} />
      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{title}</h3>
      {badge && <span className="ml-auto">{badge}</span>}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// ── Info Row ──────────────────────────────────────────────────────────────────
const InfoRow = ({ icon: Icon, label, value, valueClass = 'text-gray-700' }) => (
  <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: `1px solid ${TL}` }}>
    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#EEF2F7] flex-shrink-0 mt-0.5">
      <Icon size={13} className="text-gray-500" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-[13px] font-semibold mt-0.5 truncate ${valueClass}`}>{value || '—'}</p>
    </div>
  </div>
);

// ── Lightbox ──────────────────────────────────────────────────────────────────
const Lightbox = ({ src, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    onClick={onClose}>
    <div className="relative max-w-3xl w-full mx-4" onClick={e => e.stopPropagation()}>
      <button onClick={onClose}
        className="absolute -top-10 right-0 text-white/70 hover:text-white flex items-center gap-1 text-sm">
        <X size={16} /> Close
      </button>
      <img src={src} alt="Preview" className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl" />
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const UserDetails = () => {
  const { id }      = useParams();          // ✅ reads :id from /userdetails/:id
  const navigate    = useNavigate();
  const [member,    setMember]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [lightbox,  setLightbox]  = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, 'teamMembers', id),
      snap => { setMember(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false); },
      ()   => setLoading(false)
    );
    return unsub;
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin" />
    </div>
  );

  if (!member) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">👤</div>
        <p className="text-lg font-semibold text-gray-700">Member not found</p>
        <button onClick={() => navigate('/userrecord')}
          className="mt-4 px-4 py-2 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors">
          Back to Records
        </button>
      </div>
    </div>
  );

  const tasks      = member.tasks     || [];
  const docs       = member.documents || [];
  const media      = member.media     || member.images || [];
  const bankInfo   = member.bankInfo  || {};
  const sCfg       = statusColors[member.status] || statusColors['Inactive'];
  const doneTasks  = tasks.filter(t => t.status === 'Done').length;
  const pendingT   = tasks.filter(t => t.status !== 'Done' && t.status !== 'In Progress').length;
  const inProgT    = tasks.filter(t => t.status === 'In Progress').length;
  const completion = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  const TABS = [
    { key: 'overview', label: 'Overview',  icon: User,         },
    { key: 'tasks',    label: 'Tasks',     icon: CheckCircle2, count: tasks.length },
    { key: 'bank',     label: 'Bank Info', icon: CreditCard,   },
    { key: 'docs',     label: 'Documents', icon: FileText,     count: docs.length  },
    { key: 'media',    label: 'Media',     icon: Image,        count: media.length },
  ];

  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">

        {/* ── Back button ── */}
        <button onClick={() => navigate('/userrecord')}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-teal-600 transition-colors group">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white shadow-sm"
            style={{ border: `1px solid ${TL}` }}>
            <ChevronLeft size={14} className="text-gray-400 group-hover:text-teal-500 transition-colors" />
          </div>
          Back to User Records
        </button>

        {/* ── Profile Hero Card ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
          <div className={`h-2 bg-gradient-to-r ${getAvatarColor(member.id)}`} />
          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {member.profileImage ? (
                  <img src={member.profileImage} alt={member.name}
                    className="w-20 h-20 rounded-2xl object-cover shadow-md cursor-pointer border-2 border-white"
                    onClick={() => setLightbox(member.profileImage)} />
                ) : (
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br ${getAvatarColor(member.id)} text-white text-2xl font-bold shadow-md`}>
                    {getInitials(member.name)}
                  </div>
                )}
                <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${sCfg.dot}`} />
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold text-gray-900">{member.name || 'Unknown'}</h1>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${sCfg.text} ${sCfg.bg} ${sCfg.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />{member.status || 'Unknown'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  {member.role       && <span className="text-sm font-semibold text-teal-600">{member.role}</span>}
                  {member.department && <><span className="text-gray-300">·</span><span className="text-sm text-gray-500">{member.department}</span></>}
                  {member.employeeId && <><span className="text-gray-300">·</span><span className="text-xs font-mono text-gray-400">#{member.employeeId}</span></>}
                </div>
                {member.email && (
                  <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                    <Mail size={12} />{member.email}
                  </p>
                )}
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {[
                  { label: 'Total Tasks', value: tasks.length, color: 'text-gray-800'  },
                  { label: 'Done',        value: doneTasks,    color: 'text-teal-600'  },
                  { label: 'Pending',     value: pendingT,     color: 'text-amber-600' },
                ].map(s => (
                  <div key={s.label} className="text-center px-3 py-2 rounded-xl bg-[#EEF2F7]"
                    style={{ border: `1px solid ${TL}` }}>
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            {tasks.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${TL}` }}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-gray-500 font-medium">Task Completion</span>
                  <span className="text-xs font-bold text-teal-600">{completion}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#EEF2F7] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all duration-700"
                    style={{ width: `${completion}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* ── Tabs ── */}
          <div className="flex overflow-x-auto" style={{ borderTop: `1px solid ${TL}`, scrollbarWidth: 'none' }}>
            {TABS.map(tab => {
              const active = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-[13px] font-semibold whitespace-nowrap transition-all border-b-2 flex-shrink-0
                    ${active
                      ? 'text-teal-600 border-teal-500 bg-teal-50/50'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'}`}>
                  <tab.icon size={14} />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-500'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════
            TAB: OVERVIEW
        ══════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Section icon={User} title="Personal Information">
              <div className="-mt-2.5">
                <InfoRow icon={User}     label="Full Name"           value={member.name}             />
                <InfoRow icon={Mail}     label="Email Address"       value={member.email}            />
                <InfoRow icon={Phone}    label="Phone Number"        value={member.phone}            />
                <InfoRow icon={MapPin}   label="Address"             value={member.address}          />
                <InfoRow icon={Calendar} label="Date of Birth"       value={member.dob}              />
                <InfoRow icon={Hash}     label="National ID / CNIC"  value={member.cnic}             />
                <InfoRow icon={Shield}   label="Emergency Contact"   value={member.emergencyContact} />
              </div>
            </Section>

            <Section icon={Briefcase} title="Work Information" iconColor="text-violet-500">
              <div className="-mt-2.5">
                <InfoRow icon={Briefcase} label="Role / Position"    value={member.role}            />
                <InfoRow icon={Building2} label="Department"         value={member.department}       />
                <InfoRow icon={Hash}      label="Employee ID"        value={member.employeeId}       />
                <InfoRow icon={Calendar}  label="Joining Date"       value={member.joiningDate}      />
                <InfoRow icon={Star}      label="Employment Type"    value={member.employmentType}   />
                <InfoRow icon={MapPin}    label="Work Location"      value={member.workLocation}     />
                <InfoRow icon={User}      label="Reporting Manager"  value={member.manager}          />
                {member.salary && (
                  <InfoRow icon={CreditCard} label="Salary" value={`PKR ${member.salary}`} valueClass="text-teal-600 font-bold" />
                )}
              </div>
            </Section>
          </div>
        )}

        {/* ══════════════════════════════
            TAB: TASKS
        ══════════════════════════════ */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total',       value: tasks.length, color: 'text-gray-800', bg: 'bg-white'   },
                { label: 'Done',        value: doneTasks,    color: 'text-teal-600', bg: 'bg-teal-50' },
                { label: 'In Progress', value: inProgT,      color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center shadow-sm`}
                  style={{ border: `1px solid ${TL}` }}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            <Section icon={CheckCircle2} title="All Tasks"
              badge={<span className="text-xs text-gray-400">{tasks.length} tasks</span>}>
              {tasks.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-3xl mb-2">📋</div>
                  <p className="text-gray-400 text-sm">No tasks assigned yet</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {tasks.map((task, i) => {
                    const pCfg  = priorityColors[task.priority] || priorityColors.Medium;
                    const tsCfg = taskStatusColors[task.status] || taskStatusColors['Pending'];
                    return (
                      <div key={task.id || i}
                        className="flex items-start gap-3 p-3.5 rounded-xl hover:bg-gray-50 transition-colors"
                        style={{ border: `1px solid ${TL}` }}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${pCfg.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-gray-800">{task.title}</p>
                          {task.description && (
                            <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-[11px] font-semibold ${pCfg.text}`}>{task.priority}</span>
                            {task.dueDate && (
                              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                <Clock size={10} />{task.dueDate}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${tsCfg.text} ${tsCfg.bg} ${tsCfg.border}`}>
                          {task.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ══════════════════════════════
            TAB: BANK INFO
        ══════════════════════════════ */}
        {activeTab === 'bank' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Section icon={CreditCard} title="Bank Details" iconColor="text-emerald-500">
              <div className="-mt-2.5">
                <InfoRow icon={Building2}  label="Bank Name"       value={bankInfo.bankName      || member.bankName}      />
                <InfoRow icon={Hash}       label="Account Number"  value={bankInfo.accountNumber || member.accountNumber} />
                <InfoRow icon={User}       label="Account Title"   value={bankInfo.accountTitle  || member.accountTitle}  />
                <InfoRow icon={Hash}       label="IBAN"            value={bankInfo.iban           || member.iban}          />
                <InfoRow icon={Building2}  label="Branch Code"     value={bankInfo.branchCode    || member.branchCode}    />
                <InfoRow icon={MapPin}     label="Branch Name"     value={bankInfo.branchName    || member.branchName}    />
                <InfoRow icon={CreditCard} label="Payment Method"  value={bankInfo.paymentMethod || member.paymentMethod} />
              </div>
            </Section>

            <Section icon={Star} title="Compensation" iconColor="text-amber-500">
              <div className="-mt-2.5">
                <InfoRow icon={CreditCard} label="Basic Salary"   value={member.salary     ? `PKR ${member.salary}`     : null} valueClass="text-teal-600 font-bold" />
                <InfoRow icon={CreditCard} label="Allowances"     value={member.allowances ? `PKR ${member.allowances}` : null} />
                <InfoRow icon={Calendar}   label="Pay Cycle"      value={member.payCycle   || 'Monthly'} />
                <InfoRow icon={Calendar}   label="Last Pay Date"  value={member.lastPayDate}              />
                <InfoRow icon={Hash}       label="Tax ID / NTN"   value={member.ntn        || member.taxId} />
              </div>
            </Section>
          </div>
        )}

        {/* ══════════════════════════════
            TAB: DOCUMENTS
        ══════════════════════════════ */}
        {activeTab === 'docs' && (
          <Section icon={FileText} title="Documents"
            badge={<span className="text-xs text-gray-400">{docs.length} files</span>}>
            {docs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-gray-500 font-semibold">No documents uploaded</p>
                <p className="text-gray-400 text-sm mt-1">CNIC, contracts, certificates will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docs.map((docItem, i) => {
                  const name = docItem.name || docItem.fileName || `Document ${i + 1}`;
                  const url  = docItem.url  || docItem.link    || docItem;
                  const ext  = typeof url === 'string' ? url.split('.').pop()?.toUpperCase().slice(0, 4) : 'FILE';
                  return (
                    <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-gray-50 transition-colors"
                      style={{ border: `1px solid ${TL}` }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 border border-blue-200 flex-shrink-0">
                        <FileText size={16} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800 truncate">{name}</p>
                        <p className="text-[11px] text-gray-400">{ext} file</p>
                      </div>
                      {typeof url === 'string' && (
                        <a href={url} target="_blank" rel="noreferrer"
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors flex-shrink-0">
                          <ExternalLink size={13} className="text-teal-600" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* ══════════════════════════════
            TAB: MEDIA
        ══════════════════════════════ */}
        {activeTab === 'media' && (
          <Section icon={Image} title="Media & Images"
            badge={<span className="text-xs text-gray-400">{media.length} files</span>}>
            {media.length === 0 && !member.profileImage ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🖼️</div>
                <p className="text-gray-500 font-semibold">No media uploaded</p>
                <p className="text-gray-400 text-sm mt-1">Images and photos will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {member.profileImage && (
                  <div className="relative group cursor-pointer rounded-xl overflow-hidden aspect-square shadow-sm"
                    style={{ border: `1px solid ${TL}` }}
                    onClick={() => setLightbox(member.profileImage)}>
                    <img src={member.profileImage} alt="Profile"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ExternalLink size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500 text-white">
                      Profile
                    </span>
                  </div>
                )}
                {media.map((item, i) => {
                  const url  = item.url  || item;
                  const name = item.name || `Image ${i + 1}`;
                  return (
                    <div key={i}
                      className="relative group cursor-pointer rounded-xl overflow-hidden aspect-square shadow-sm"
                      style={{ border: `1px solid ${TL}` }}
                      onClick={() => typeof url === 'string' && setLightbox(url)}>
                      {typeof url === 'string' ? (
                        <>
                          <img src={url} alt={name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <ExternalLink size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                          <Image size={24} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

      </div>
    </div>
  );
};

export default UserDetails;