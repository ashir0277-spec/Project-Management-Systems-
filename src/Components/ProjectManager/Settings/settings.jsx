import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Save, Check, Loader2 } from 'lucide-react';

const TL = 'rgba(51,51,51,0.20)';

const DEFAULT = {
  name: '', email: '', phone: '', company: '',
  timezone: 'Asia/Karachi', currency: 'USD',
  emailNotifs: true, paymentAlerts: true,
};

const inputCls = 'w-full px-4 py-3 rounded-lg text-sm text-gray-800 bg-white placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all';

const Toggle = ({ value, onChange, label }) => (
  <div className="flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${TL}` }}>
    <p className="text-sm font-medium text-gray-700">{label}</p>
    <button onClick={() => onChange(!value)}
      className={`relative w-10 h-[22px] rounded-full transition-all duration-200 flex-shrink-0 ${value ? 'bg-gradient-to-r from-teal-500 to-cyan-500' : 'bg-gray-200'}`}>
      <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${value ? 'left-[22px]' : 'left-[3px]'}`} />
    </button>
  </div>
);

const Settings = () => {
  const [s, setS]           = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [loading, setLoad]  = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'app'), snap => {
      if (snap.exists()) setS({ ...DEFAULT, ...snap.data() });
      setLoad(false);
    }, () => setLoad(false));
    return unsub;
  }, []);

  const set = (k, v) => setS(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'app'), s, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { alert('Error saving. Check Firebase rules.'); }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#EEF2F7]">

      {/* HEADER */}
      <header className="ml-[280px] fixed top-0 left-0 right-0 z-50 bg-white shadow-sm" style={{ borderBottom: `1px solid ${TL}` }}>
        <div className="flex items-center justify-between px-8 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500">Manage your preferences</p>
          </div>
          <button onClick={save} disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold rounded-lg text-sm text-white shadow transition-all disabled:opacity-70
              ${saved ? 'bg-emerald-500' : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600'}`}>
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving</>
              : saved ? <><Check size={15} /> Saved!</>
              : <><Save size={15} /> Save</>}
          </button>
        </div>
      </header>

      <div className="h-[25px]" />

      <div className="p-8  mx-auto space-y-5">

        {/* Profile */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${TL}` }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${TL}` }}>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Profile</h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            {[
              { key: 'name',    label: 'Full Name',    ph: 'Enter your name'    },
              { key: 'email',   label: 'Email',        ph: 'you@company.com', type: 'email' },
              { key: 'phone',   label: 'Phone',        ph: '+92 300 0000000'    },
              { key: 'company', label: 'Company',      ph: 'Your company name'  },
            ].map(({ key, label, ph, type }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
                <input type={type || 'text'} value={s[key]} onChange={e => set(key, e.target.value)}
                  placeholder={ph} className={inputCls} style={{ border: `1px solid ${TL}` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Preferences */}
       

      </div>
    </div>
  );
};

export default Settings;