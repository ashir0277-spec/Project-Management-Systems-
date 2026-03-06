// UserDetails.jsx – Individual Member Profile Page
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, User, Mail, Phone, MapPin, Calendar,
  Briefcase, CreditCard, FileText, Image, Building2, Hash,
  Shield, Star, ExternalLink, X

} from 'lucide-react';

const TL = 'rgba(51,51,51,0.12)';

const statusColors = {
  'Active':   { text: 'text-teal-600',  dot: 'bg-teal-500',  bg: 'bg-teal-50',  border: 'border-teal-200'  },
  'Inactive': { text: 'text-gray-500',  dot: 'bg-gray-400',  bg: 'bg-gray-50',  border: 'border-gray-200'  },
  'On Leave': { text: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Away':     { text: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
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

// ── Section ───────────────────────────────────────────────────────────────────
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
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [member,   setMember]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const [activeTab,setActiveTab]= useState('overview');

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

  const docs     = member.documents || [];
  const media    = member.media     || member.images || [];
  const bankInfo = member.bankInfo  || {};
  const sCfg     = statusColors[member.status] || statusColors['Inactive'];

  const TABS = [
    { key: 'overview', label: 'Overview',  icon: User        },
    { key: 'bank',     label: 'Bank Info', icon: CreditCard  },
    { key: 'docs',     label: 'Documents', icon: FileText,   count: docs.length  },
    { key: 'media',    label: 'Media',     icon: Image,      count: media.length },
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
            <div className="flex flex-col sm:flex-row items-start gap-5">

              {/* ── LEFT: Avatar + Core Info ── */}
              <div className="flex items-start gap-4 flex-1 min-w-0">

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

                {/* Name / Email / Role / Experience */}
                <div className="min-w-0">
                  {/* Name only */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-xl font-bold text-gray-900">{member.name || 'Unknown'}</h1>
                  </div>

                  {/* Email */}
                  {member.email && (
                    <p className="text-[13px] text-gray-400 mt-1.5 flex items-center gap-1.5">
                      <Mail size={12} className="flex-shrink-0" />{member.email}
                    </p>
                  )}

                  {/* Role badge only */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {member.role && (
                      <span className="text-[12px] font-semibold px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
                        {member.role}
                      </span>
                    )}
                  </div>

                  {/* Phone */}
                  {member.phone && (
                    <p className="text-[12px] mt-2 flex items-center gap-1.5">
                      <Phone size={11} className="text-teal-400 flex-shrink-0" />
                      <span className="font-semibold text-gray-700">{member.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* ── RIGHT: Employment Type + Experience + Address ── */}
              <div className="flex flex-col gap-2.5 flex-shrink-0 w-full sm:w-auto">
                {member.employmentType && (
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#EEF2F7]"
                    style={{ border: `1px solid ${TL}` }}>
                    <Briefcase size={13} className="text-violet-500 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Employment Type</p>
                      <p className="text-[12px] font-semibold text-gray-700">{member.employmentType}</p>
                    </div>
                  </div>
                )}
                {member.experience && (
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#EEF2F7]"
                    style={{ border: `1px solid ${TL}` }}>
                    <Star size={13} className="text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Experience</p>
                      <p className="text-[12px] font-semibold text-gray-700">{member.experience}</p>
                    </div>
                  </div>
                )}
                {member.address && (
                  <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#EEF2F7]"
                    style={{ border: `1px solid ${TL}` }}>
                    <MapPin size={13} className="text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Address</p>
                      <p className="text-[12px] font-semibold text-gray-700 max-w-[200px] leading-snug">{member.address}</p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ── Tabs — SEPARATE from profile card ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
          <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
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
                <InfoRow icon={User}     label="Full Name"          value={member.name}             />
                <InfoRow icon={Mail}     label="Email Address"      value={member.email}            />
                <InfoRow icon={Phone}    label="Phone Number"       value={member.phone}            />
                <InfoRow icon={MapPin}   label="Address"            value={member.address}          />
                <InfoRow icon={Calendar} label="Date of Birth"      value={member.dob}              />
                <InfoRow icon={Hash}     label="National ID / CNIC" value={member.cnic}             />
                <InfoRow icon={Shield}   label="Emergency Contact"  value={member.emergencyContact} />
              </div>
            </Section>

            <Section icon={Briefcase} title="Work Information" iconColor="text-violet-500">
              <div className="-mt-2.5">
                <InfoRow icon={Briefcase} label="Role / Position"   value={member.role}           />
                <InfoRow icon={Building2} label="Department"        value={member.department}      />
                <InfoRow icon={Star}      label="Experience"        value={member.experience}      />
                <InfoRow icon={Calendar}  label="Joining Date"      value={member.joiningDate}     />
                <InfoRow icon={Star}      label="Employment Type"   value={member.employmentType}  />
                <InfoRow icon={MapPin}    label="Work Location"     value={member.workLocation}    />
                <InfoRow icon={User}      label="Reporting Manager" value={member.manager}         />
                {member.salary && (
                  <InfoRow icon={CreditCard} label="Salary" value={`PKR ${member.salary}`} valueClass="text-teal-600 font-bold" />
                )}
              </div>
            </Section>
          </div>
        )}

        {/* ══════════════════════════════
            TAB: BANK INFO
        ══════════════════════════════ */}
        {activeTab === 'bank' && (
          <div className="grid grid-cols-1 gap-5">
            <Section icon={CreditCard} title="Bank Details" iconColor="text-emerald-500">
              <div className="-mt-2.5">
                <InfoRow icon={Building2}  label="Bank Name"      value={bankInfo.bankName      || member.bankName}      />
                <InfoRow icon={Hash}       label="Account Number" value={bankInfo.accountNumber || member.accountNumber} />
                <InfoRow icon={User}       label="Account Title"  value={bankInfo.accountTitle  || member.accountTitle}  />
                <InfoRow icon={Hash}       label="IBAN"           value={bankInfo.iban           || member.iban}          />
                <InfoRow icon={Building2}  label="Branch Code"    value={bankInfo.branchCode    || member.branchCode}    />
                <InfoRow icon={MapPin}     label="Branch Name"    value={bankInfo.branchName    || member.branchName}    />
                <InfoRow icon={CreditCard} label="Payment Method" value={bankInfo.paymentMethod || member.paymentMethod} />
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
                  const ext  = name.split('.').pop()?.toUpperCase().slice(0, 4) || 'FILE';
                  return (
                    <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-gray-50 transition-colors"
                      style={{ border: `1px solid ${TL}` }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 border border-blue-200 flex-shrink-0">
                        <FileText size={16} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800 truncate">{name}</p>
                        <p className="text-[11px] text-gray-400">{ext} · {docItem.size ? (docItem.size / 1024).toFixed(1) + ' KB' : 'file'}</p>
                      </div>
                      {typeof url === 'string' && url.startsWith('http') && (
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
          <Section icon={Image} title="Media & Files"
            badge={<span className="text-xs text-gray-400">{media.length} files</span>}>
            {media.length === 0 && !member.profileImage ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🖼️</div>
                <p className="text-gray-500 font-semibold">No media uploaded</p>
                <p className="text-gray-400 text-sm mt-1">Images, videos and audio will appear here</p>
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
                  const url      = item.url  || item;
                  const name     = item.name || `Media ${i + 1}`;
                  const isImage  = item.type?.startsWith('image/') || (typeof url === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url));
                  const isVideo  = item.type?.startsWith('video/');
                  const isAudio  = item.type?.startsWith('audio/');

                  return (
                    <div key={i}
                      className="relative group cursor-pointer rounded-xl overflow-hidden aspect-square shadow-sm"
                      style={{ border: `1px solid ${TL}` }}
                      onClick={() => isImage && typeof url === 'string' && setLightbox(url)}>
                      {isImage && typeof url === 'string' && url.startsWith('http') ? (
                        <>
                          <img src={url} alt={name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <ExternalLink size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-2">
                          {isVideo && <span className="text-2xl">🎬</span>}
                          {isAudio && <span className="text-2xl">🎵</span>}
                          {!isVideo && !isAudio && <Image size={24} className="text-gray-400" />}
                          <span className="text-[9px] font-bold text-gray-400 uppercase px-2 text-center truncate w-full">
                            {name.split('.').pop()}
                          </span>
                        </div>
                      )}
                      {/* Name tooltip on hover */}
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[9px] text-white font-semibold truncate">{name}</p>
                      </div>
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