
import React, { useState, useEffect } from 'react';
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, collection, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2, Clock, Calendar, Loader2, AlertCircle,
  Users, ChevronRight, X, Shield,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const STATUS_OPTIONS = [
  {
    label: 'Present',
    icon: CheckCircle2,
    desc: 'I am here on time',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    activeBg: 'bg-emerald-500',
    activeBorder: 'border-emerald-600',
    dotColor: 'bg-emerald-500',
  },
  {
    label: 'Late',
    icon: Clock,
    desc: 'I arrived late',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    activeBg: 'bg-amber-500',
    activeBorder: 'border-amber-600',
    dotColor: 'bg-amber-500',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDateFull = (ymd) => {
  if (!ymd) return '';
  const d = new Date(ymd + 'T00:00:00');
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

// ── Screens ───────────────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center"
    style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfeff 50%, #f0f9ff 100%)' }}>
    <div className="text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
        <Calendar size={26} className="text-white" />
      </div>
      <div className="w-8 h-8 rounded-full border-4 border-teal-200 border-t-teal-500 animate-spin mx-auto mb-3" />
      <p className="text-sm text-teal-600 font-semibold">Loading attendance...</p>
    </div>
  </div>
);

const ErrorScreen = ({ message }) => (
  <div className="min-h-screen flex items-center justify-center p-4"
    style={{ background: 'linear-gradient(135deg, #fff5f5 0%, #fff1f2 100%)' }}>
    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"
      style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-5">
        <AlertCircle size={30} className="text-red-400" />
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Link Error</h2>
      <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
    </div>
  </div>
);

const AlreadyMarkedScreen = ({ memberName, status }) => (
  <div className="min-h-screen flex items-center justify-center p-4"
    style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)' }}>
    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"
      style={{ border: '1px solid rgba(251,191,36,0.25)' }}>
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5">
        <AlertCircle size={30} className="text-amber-400" />
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Already Marked</h2>
      <p className="text-sm text-gray-500">
        <span className="font-semibold text-gray-700">{memberName}</span> has already marked attendance as{' '}
        <span className="font-semibold text-amber-600">{status}</span> today.
      </p>
      <p className="text-[11px] text-gray-400 mt-3">Each member can only mark once per day.</p>
    </div>
  </div>
);

const SuccessScreen = ({ memberName, status, date }) => (
  <div className="min-h-screen flex items-center justify-center p-4"
    style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfeff 50%, #f0fdf4 100%)' }}>
    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"
      style={{ border: '1px solid rgba(20,184,166,0.2)' }}>
      {/* Animated checkmark */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-200">
          <CheckCircle2 size={38} className="text-white" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-md">
          <span className="text-white text-[10px] font-bold">✓</span>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-800 mb-1">Attendance Marked!</h2>
      <p className="text-sm text-gray-500 mb-5">
        <span className="font-semibold text-gray-700">{memberName}</span> — marked as{' '}
        <span className={`font-bold ${status === 'Present' ? 'text-emerald-600' : 'text-amber-600'}`}>{status}</span>
      </p>

      {/* Date badge */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl"
        style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)' }}>
        <Calendar size={14} className="text-teal-500" />
        <span className="text-[12px] font-semibold text-teal-700">{fmtDateFull(date)}</span>
      </div>

      <p className="text-[11px] text-gray-400 mt-5 leading-relaxed">
        Your attendance has been recorded. You can close this page.
      </p>
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const AttendancePublic = () => {
  const { linkId } = useParams();

  const [linkData,      setLinkData]      = useState(null);
  const [members,       setMembers]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [selectedMember,setSelectedMember]= useState(null);
  const [selectedStatus,setSelectedStatus]= useState('');
  const [step,          setStep]          = useState(1); // 1=select member, 2=select status, 3=confirm
  const [submitting,    setSubmitting]    = useState(false);
  const [success,       setSuccess]       = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [prevStatus,    setPrevStatus]    = useState('');

  // ── Init: validate link & load members ───────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Load & validate link
        const linkRef  = doc(db, 'attendanceLinks', linkId);
        const linkSnap = await getDoc(linkRef);

        if (!linkSnap.exists()) {
          setError('This link does not exist or has been removed.');
          setLoading(false);
          return;
        }

        const data = linkSnap.data();

        if (!data.isActive) {
          setError('This attendance link has been deactivated by the admin.');
          setLoading(false);
          return;
        }

        if (new Date() > new Date(data.expiresAt)) {
          setError('This link has expired. It was only valid for ' + fmtDateFull(data.date) + '.');
          setLoading(false);
          return;
        }

        setLinkData(data);

        // 2. Load team members (name + role only — no sensitive data)
        const membersSnap = await getDocs(collection(db, 'teamMembers'));
        const list = membersSnap.docs
          .map(d => ({ id: d.id, name: d.data().name, role: d.data().role || d.data().department || '' }))
          .filter(m => m.name)
          .sort((a, b) => a.name.localeCompare(b.name));
        setMembers(list);

      } catch (e) {
        console.error(e);
        setError('Something went wrong. Please try again or contact your admin.');
      }
      setLoading(false);
    };
    init();
  }, [linkId]);

  // ── Submit Attendance ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedMember || !selectedStatus || !linkData) return;
    setSubmitting(true);
    try {
      // Re-check if already marked (fresh read)
      const freshSnap = await getDoc(doc(db, 'attendanceLinks', linkId));
      const usedBy    = freshSnap.data()?.usedBy || [];

      if (usedBy.includes(selectedMember.id)) {
        // Find what status they marked
        const attSnap = await getDoc(doc(db, 'attendance', `${linkData.date}_${selectedMember.id}`));
        setPrevStatus(attSnap.data()?.status || 'Present');
        setAlreadyMarked(true);
        setSubmitting(false);
        return;
      }

      // Save attendance record
      await setDoc(doc(db, 'attendance', `${linkData.date}_${selectedMember.id}`), {
        date:       linkData.date,
        memberId:   selectedMember.id,
        memberName: selectedMember.name,
        status:     selectedStatus,
        note:       '',
        markedAt:   new Date().toISOString(),
        markedBy:   'self',
      });

      // Mark this member as having used the link
      await updateDoc(doc(db, 'attendanceLinks', linkId), {
        usedBy: arrayUnion(selectedMember.id),
      });

      setSuccess(true);
    } catch (e) {
      console.error(e);
      setError('Failed to save attendance. Please try again.');
    }
    setSubmitting(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading)                              return <LoadingScreen />;
  if (error)                                return <ErrorScreen message={error} />;
  if (alreadyMarked)                        return <AlreadyMarkedScreen memberName={selectedMember?.name} status={prevStatus} />;
  if (success)                              return <SuccessScreen memberName={selectedMember?.name} status={selectedStatus} date={linkData?.date} />;

  return (
    <div className="min-h-screen"
      style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #f8faff 50%, #f0f9ff 100%)' }}>
      <div className="max-w-lg mx-auto px-4 py-8 pb-16">

        {/* ── Top Header ── */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-200/50">
            <Calendar size={26} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Mark Attendance</h1>
          <p className="text-[13px] text-gray-500 mt-1">{fmtDateFull(linkData?.date)}</p>
          {/* Security badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-3"
            style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)' }}>
            <Shield size={11} className="text-teal-600" />
            <span className="text-[10px] font-semibold text-teal-600">Secure · Read-only access</span>
          </div>
        </div>

        {/* ── Step Indicator ── */}
        <div className="flex items-center gap-2 mb-5">
          {[
            { num: 1, label: 'Select Name' },
            { num: 2, label: 'Mark Status' },
            { num: 3, label: 'Confirm' },
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              <div className={`flex items-center gap-1.5 ${step >= s.num ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all
                  ${step > s.num ? 'bg-teal-500 text-white' : step === s.num ? 'bg-teal-500 text-white ring-4 ring-teal-100' : 'bg-gray-200 text-gray-500'}`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className={`text-[11px] font-semibold hidden sm:block ${step === s.num ? 'text-teal-700' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div className={`flex-1 h-0.5 rounded-full transition-all ${step > s.num ? 'bg-teal-400' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1: Select Member ── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden"
            style={{ border: '1px solid rgba(51,51,51,0.1)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(51,51,51,0.1)' }}>
              <div className="flex items-center gap-2">
                <Users size={15} className="text-teal-500" />
                <p className="text-sm font-bold text-gray-800">Select Your Name</p>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5 ml-5">Tap your name to continue</p>
            </div>
            <div className="p-3 space-y-1.5 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {members.length === 0 && (
                <div className="text-center py-10">
                  <Users size={28} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No team members found</p>
                </div>
              )}
              {members.map(member => {
                const alreadyUsed = linkData?.usedBy?.includes(member.id);
                return (
                  <button key={member.id}
                    onClick={() => {
                      if (alreadyUsed) return;
                      setSelectedMember(member);
                      setStep(2);
                    }}
                    disabled={alreadyUsed}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all
                      ${alreadyUsed
                        ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                        : 'bg-white border-gray-100 hover:border-teal-300 hover:bg-teal-50/50 hover:shadow-sm active:scale-[0.99]'
                      }`}>
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0
                      ${alreadyUsed ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-br from-teal-400 to-cyan-500 text-white shadow-sm'}`}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold truncate ${alreadyUsed ? 'text-gray-400' : 'text-gray-800'}`}>
                        {member.name}
                      </p>
                      {member.role && (
                        <p className="text-[11px] text-gray-400 truncate">{member.role}</p>
                      )}
                    </div>
                    {alreadyUsed ? (
                      <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <CheckCircle2 size={10} /> Done
                      </span>
                    ) : (
                      <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 2: Select Status ── */}
        {step === 2 && selectedMember && (
          <div className="space-y-3">
            {/* Selected member card */}
            <div className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm"
              style={{ border: '1px solid rgba(20,184,166,0.2)' }}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                {selectedMember.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-800 truncate">{selectedMember.name}</p>
                <p className="text-[11px] text-teal-600">{fmtDateFull(linkData?.date)}</p>
              </div>
              <button onClick={() => { setSelectedMember(null); setSelectedStatus(''); setStep(1); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            </div>

            {/* Status Options */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden"
              style={{ border: '1px solid rgba(51,51,51,0.1)' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(51,51,51,0.1)' }}>
                <p className="text-sm font-bold text-gray-800">How are you today?</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Select your attendance status</p>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {STATUS_OPTIONS.map(opt => {
                  const selected = selectedStatus === opt.label;
                  return (
                    <button key={opt.label}
                      onClick={() => setSelectedStatus(opt.label)}
                      className={`p-5 rounded-2xl border-2 text-center transition-all active:scale-[0.97]
                        ${selected
                          ? `${opt.activeBg} ${opt.activeBorder} text-white shadow-lg scale-[1.02]`
                          : `${opt.bg} ${opt.border} ${opt.color} hover:shadow-md hover:scale-[1.01]`
                        }`}>
                      <opt.icon size={28} className={`mx-auto mb-2 ${selected ? 'text-white' : ''}`} />
                      <p className="text-[14px] font-bold">{opt.label}</p>
                      <p className={`text-[10px] mt-0.5 ${selected ? 'text-white/80' : 'text-gray-400'}`}>{opt.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="px-4 pb-4">
                <button
                  onClick={() => selectedStatus && setStep(3)}
                  disabled={!selectedStatus}
                  className="w-full py-3 rounded-xl text-[14px] font-bold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md">
                  Continue
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === 3 && selectedMember && selectedStatus && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden"
            style={{ border: '1px solid rgba(51,51,51,0.1)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(51,51,51,0.1)' }}>
              <p className="text-sm font-bold text-gray-800">Confirm Attendance</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Please review before submitting</p>
            </div>
            <div className="p-5 space-y-4">
              {/* Summary */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: '#FAFAFA', border: '1px solid rgba(51,51,51,0.1)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                    {selectedMember.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-gray-800">{selectedMember.name}</p>
                    {selectedMember.role && <p className="text-[11px] text-gray-400">{selectedMember.role}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg p-2.5" style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.15)' }}>
                    <p className="text-[10px] text-gray-400 mb-0.5">Date</p>
                    <p className="text-[12px] font-bold text-gray-700">{fmtDateFull(linkData?.date)}</p>
                  </div>
                  <div className={`rounded-lg p-2.5 ${
                    selectedStatus === 'Present'
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-amber-50 border border-amber-200'
                  }`}>
                    <p className="text-[10px] text-gray-400 mb-0.5">Status</p>
                    <p className={`text-[13px] font-bold ${selectedStatus === 'Present' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {selectedStatus}
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 rounded-xl"
                style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-500">
                  This action <span className="font-semibold">cannot be undone</span> by you. 
                  Only the admin can edit attendance records after submission.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50">
                  Back
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex-2 flex-grow-[2] py-2.5 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm hover:shadow-md">
                  {submitting ? (
                    <><Loader2 size={15} className="animate-spin" /> Saving...</>
                  ) : (
                    <><CheckCircle2 size={15} /> Submit Attendance</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <div className="inline-flex items-center gap-1.5">
            <Shield size={11} className="text-gray-300" />
            <p className="text-[10px] text-gray-300">This is a secure, restricted link. No dashboard access.</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AttendancePublic;