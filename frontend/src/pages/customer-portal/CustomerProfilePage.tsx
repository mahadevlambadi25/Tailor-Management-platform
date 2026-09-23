import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  Scissors,
  Sparkles,
  Building
} from 'lucide-react';

export const CustomerProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [fitPreference, setFitPreference] = useState('REGULAR');
  const [preferredContactMethod, setPreferredContactMethod] = useState('WHATSAPP');

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/portal/profile');
      if (res.data.success) {
        const p = res.data.data;
        setProfile(p);
        setEmail(p.email || '');
        setAddress(p.address || '');
        setCity(p.city || '');
        setFitPreference(p.preferences?.fitPreference || 'REGULAR');
        setPreferredContactMethod(p.preferences?.preferredContactMethod || 'WHATSAPP');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.put('/portal/profile', {
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        preferences: {
          fitPreference,
          preferredContactMethod
        }
      });

      if (res.data.success) {
        setSuccessMsg('Your profile and preferences have been updated successfully.');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Loading your profile details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* ------------------------------------------------------------- */}
      {/* Page Header                                                   */}
      {/* ------------------------------------------------------------- */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <User className="h-6 w-6 text-amber-600" />
          My Profile & Preferences
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your contact information, delivery address, and tailored fit preferences.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ----------------------------------------------------------- */}
        {/* Section 1: Personal & Contact Information                   */}
        {/* ----------------------------------------------------------- */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <User className="h-4 w-4 text-slate-600" /> Personal Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name (Read-only display) */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800">
                {profile?.firstName} {profile?.lastName}
              </div>
            </div>

            {/* Customer ID (Read-only) */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                <span>Client ID</span>
                <Lock className="h-3 w-3 text-slate-400" />
              </label>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-600">
                {profile?.customerId}
              </div>
            </div>

            {/* Mobile (Immutable login key) */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                <span>Registered Mobile Number</span>
                <Lock className="h-3 w-3 text-slate-400" />
              </label>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>{profile?.mobile}</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Verified Login</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">To change your registered mobile, please contact shop desk.</p>
            </div>

            {/* Email (Editable) */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Delivery / Home Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Apartment, Street address..."
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City name"
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* Section 2: Tailoring & Fit Preferences                      */}
        {/* ----------------------------------------------------------- */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <Sparkles className="h-4 w-4 text-amber-600" /> Bespoke Preferences
          </h2>

          <div className="space-y-4">
            {/* Fit Preference */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Preferred Silhouette & Fit</label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { key: 'SLIM', label: 'Slim Fit', desc: 'Contoured close to body' },
                  { key: 'REGULAR', label: 'Regular / Classic', desc: 'Comfortable balance' },
                  { key: 'RELAXED', label: 'Relaxed Fit', desc: 'Loose traditional drape' }
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFitPreference(f.key)}
                    className={`p-3 rounded-xl border text-left transition ${
                      fitPreference === f.key
                        ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900 block">{f.label}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Contact Method */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Order Status Updates Via</label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { key: 'WHATSAPP', label: 'WhatsApp', desc: 'Instant fitting notifications' },
                  { key: 'SMS', label: 'SMS Alerts', desc: 'Standard text messages' },
                  { key: 'PHONE', label: 'Phone Call', desc: 'Direct voice update' }
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPreferredContactMethod(m.key)}
                    className={`p-3 rounded-xl border text-left transition ${
                      preferredContactMethod === m.key
                        ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900 block">{m.label}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* Save Button                                                 */}
        {/* ----------------------------------------------------------- */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-sm transition disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving Changes...' : 'Save Profile & Preferences'}</span>
          </button>
        </div>
      </form>

      {/* ----------------------------------------------------------- */}
      {/* Atelier Contact Card                                        */}
      {/* ----------------------------------------------------------- */}
      {profile?.shop && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Building className="h-4 w-4 text-slate-500" /> Atelier Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Store Name</span>
              <span className="font-bold text-slate-800">{profile.shop.name}</span>
            </div>
            {profile.shop.phone && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Store Phone</span>
                <a href={`tel:${profile.shop.phone}`} className="font-bold text-blue-700 hover:underline">
                  {profile.shop.phone}
                </a>
              </div>
            )}
            {profile.shop.address && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Store Address</span>
                <span className="text-slate-700 font-medium">{profile.shop.address}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default CustomerProfilePage;
