import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../utils/currency';
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  Ruler,
  ShoppingBag,
  CreditCard,
  Image,
  FileText,
  Activity,
  Scissors,
  MessageSquare,
  Edit,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  X,
  ExternalLink,
  User
} from 'lucide-react';

export const CustomerProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preference form state
  const [prefForm, setPrefForm] = useState({
    fitPreference: '',
    fabricPreferences: '',
    preferredContactMethod: 'PHONE',
    notes: ''
  });
  const [savingPref, setSavingPref] = useState(false);
  const [prefMessage, setPrefMessage] = useState<string | null>(null);

  // Edit Customer Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    email: '',
    gender: 'Male',
    dob: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    notes: ''
  });
  const [editFormError, setEditFormError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/customers/${id}`);
      if (res.data.success) {
        const c = res.data.data;
        setCustomer(c);
        if (c.preferences) {
          setPrefForm({
            fitPreference: c.preferences.fitPreference || '',
            fabricPreferences: c.preferences.fabricPreferences || '',
            preferredContactMethod: c.preferences.preferredContactMethod || 'PHONE',
            notes: c.preferences.notes || ''
          });
        }
        setEditFormData({
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          mobile: c.mobile || '',
          email: c.email || '',
          gender: c.gender || 'Male',
          dob: c.dob ? c.dob.substring(0, 10) : '',
          address: c.address || '',
          city: c.city || 'Bangalore',
          state: c.state || 'Karnataka',
          pincode: c.pincode || '',
          notes: c.notes || ''
        });
      } else {
        setError(res.data.error?.message || 'Customer not found.');
      }
    } catch (e: any) {
      console.error('Failed to load customer profile', e);
      setError(e.response?.data?.error?.message || 'Failed to load customer profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPref(true);
    setPrefMessage(null);
    try {
      const res = await api.put(`/customers/${id}/preferences`, prefForm);
      if (res.data.success) {
        setPrefMessage('Preferences updated successfully!');
        setTimeout(() => setPrefMessage(null), 4000);
        fetchCustomer();
      }
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to update preferences');
    } finally {
      setSavingPref(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');

    const trimmedFirst = editFormData.firstName.trim();
    const trimmedLast = editFormData.lastName.trim();
    const cleanMobile = editFormData.mobile.trim();
    const digits = cleanMobile.replace(/\D/g, '');

    if (!trimmedFirst || !trimmedLast) {
      setEditFormError('First and last name are required.');
      return;
    }

    if (digits.length < 7 || digits.length > 15) {
      setEditFormError('Please enter a valid phone number (7 to 15 digits).');
      return;
    }

    if (editFormData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editFormData.email.trim())) {
        setEditFormError('Please enter a valid email address.');
        return;
      }
    }

    setSavingEdit(true);
    try {
      const res = await api.put(`/customers/${id}`, {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        mobile: cleanMobile,
        email: editFormData.email.trim() || null,
        gender: editFormData.gender,
        dob: editFormData.dob ? new Date(editFormData.dob).toISOString() : null,
        address: editFormData.address.trim() || null,
        city: editFormData.city.trim() || null,
        state: editFormData.state.trim() || null,
        pincode: editFormData.pincode.trim() || null,
        notes: editFormData.notes.trim() || null
      });

      if (res.data.success) {
        setShowEditModal(false);
        fetchCustomer();
      }
    } catch (err: any) {
      setEditFormError(err.response?.data?.error?.message || 'Failed to update customer details.');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
        <h2 className="text-base font-bold text-slate-800">{error || 'Customer not found.'}</h2>
        <Link
          to="/customers"
          className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
        >
          Return to Customer Directory
        </Link>
      </div>
    );
  }

  // Derive phone digits for WhatsApp URL
  const phoneDigits = customer.mobile.replace(/\D/g, '');
  const whatsAppUrl = `https://wa.me/${phoneDigits}`;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'measurements', label: 'Measurements', count: customer.measurements?.length },
    { id: 'preferences', label: 'Preferences' },
    { id: 'orders', label: 'Orders', count: customer.orders?.length },
    { id: 'payments', label: 'Payments', count: customer.payments?.length },
    { id: 'style_preferences', label: 'Saved Styles' },
    { id: 'photos', label: 'Photos', count: customer.photos?.length },
    { id: 'appointments', label: 'Appointments', count: customer.appointments?.length },
    { id: 'alterations', label: 'Alterations', count: customer.alterations?.length },
    { id: 'documents', label: 'Documents', count: customer.documents?.length },
    { id: 'activity', label: 'Activity Log' }
  ];

  return (
    <div className="space-y-6">
      {/* Customer Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xl shadow-md shadow-blue-500/20">
              {customer.firstName[0]}{customer.lastName[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {customer.firstName} {customer.lastName}
                </h1>
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                  {customer.customerId}
                </span>
                {customer.gender && (
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {customer.gender}
                  </span>
                )}
              </div>

              {/* Contact Information & Quick Actions */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
                <a
                  href={`tel:${customer.mobile}`}
                  className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-blue-600 bg-slate-50 px-2 py-1 rounded border border-slate-200"
                  title="Call Customer"
                >
                  <Phone className="h-3.5 w-3.5 text-blue-600" />
                  {customer.mobile}
                </a>

                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200"
                  title="Open WhatsApp Chat"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                  WhatsApp
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>

                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 bg-slate-50 px-2 py-1 rounded border border-slate-200"
                    title="Send Email"
                  >
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {customer.email}
                  </a>
                )}

                <span className="inline-flex items-center gap-1 text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {customer.city || 'Bangalore'}
                </span>
              </div>
            </div>
          </div>

          {/* Spend / Balance & Primary Actions */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Spend</span>
              <div className="text-lg font-bold text-slate-900">{formatCurrency(customer.totalSpend)}</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Balance Due</span>
              <div className={`text-lg font-bold ${customer.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatCurrency(customer.outstandingBalance)}
              </div>
            </div>

            <div className="flex items-center gap-2 pl-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
              >
                <Edit className="h-3.5 w-3.5 text-slate-500" />
                Edit Profile
              </button>
              <Link
                to={`/orders/new?customerId=${customer.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                Create New Order
              </Link>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex overflow-x-auto border-b border-slate-200 gap-1 pb-px scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`whitespace-nowrap px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              {typeof t.count === 'number' && (
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === t.id ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Customer Profile Overview</h3>
              <button
                onClick={() => setShowEditModal(true)}
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Edit className="h-3 w-3" /> Edit Info
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Basic Information */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block border-b border-slate-200 pb-1.5">
                  Basic Information
                </span>
                <div className="text-xs space-y-1.5 text-slate-600">
                  <div>
                    <span className="text-slate-400">Customer ID:</span>{' '}
                    <span className="font-mono font-bold text-blue-700">{customer.customerId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Full Name:</span>{' '}
                    <span className="font-semibold text-slate-800">{customer.firstName} {customer.lastName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Gender:</span>{' '}
                    <span className="font-medium text-slate-700">{customer.gender || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Date of Birth:</span>{' '}
                    <span className="font-medium text-slate-700">
                      {customer.dob ? new Date(customer.dob).toLocaleDateString() : 'Not recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Client Since:</span>{' '}
                    <span className="font-medium text-slate-700">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact & Address */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block border-b border-slate-200 pb-1.5">
                  Contact & Address
                </span>
                <div className="text-xs space-y-1.5 text-slate-600">
                  <div>
                    <span className="text-slate-400">Phone:</span>{' '}
                    <a href={`tel:${customer.mobile}`} className="font-bold text-blue-600 hover:underline">
                      {customer.mobile}
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-400">WhatsApp:</span>{' '}
                    <a href={whatsAppUrl} target="_blank" rel="noreferrer" className="font-bold text-emerald-700 hover:underline">
                      {customer.mobile}
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-400">Email:</span>{' '}
                    <span className="font-medium text-slate-700">{customer.email || 'None recorded'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Street:</span>{' '}
                    <span className="font-medium text-slate-700">{customer.address || 'None recorded'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">City / State:</span>{' '}
                    <span className="font-medium text-slate-700">
                      {customer.city || 'Bangalore'} {customer.state ? `, ${customer.state}` : ''} {customer.pincode ? `- ${customer.pincode}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Preferences Summary */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block border-b border-slate-200 pb-1.5">
                  Style & Fit Preferences
                </span>
                <div className="text-xs space-y-1.5 text-slate-600">
                  <div>
                    <span className="text-slate-400">Fit Preference:</span>{' '}
                    <span className="font-semibold text-slate-800">{customer.preferences?.fitPreference || 'Regular fit'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Fabric Preference:</span>{' '}
                    <span className="font-semibold text-slate-800">{customer.preferences?.fabricPreferences || 'Cotton / Linen'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Preferred Channel:</span>{' '}
                    <span className="font-semibold text-slate-800">{customer.preferences?.preferredContactMethod || 'PHONE'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Saved Measurement Sets:</span>{' '}
                    <span className="font-bold text-blue-700">{customer.measurements?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Lifetime Orders:</span>{' '}
                    <span className="font-bold text-slate-800">{customer.orders?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* VIP & Internal Notes Card */}
            <div className="rounded-xl bg-amber-50/70 p-4 border border-amber-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  VIP Instructions & Tailor Notes
                </span>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="text-[11px] font-semibold text-amber-800 hover:underline"
                >
                  Edit Notes
                </button>
              </div>
              <p className="text-xs text-amber-900/90 whitespace-pre-wrap">
                {customer.notes || 'No special notes or tailoring instructions recorded for this client.'}
              </p>
            </div>
          </div>
        )}

        {/* MEASUREMENTS TAB */}
        {activeTab === 'measurements' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recorded Measurement Profiles</h3>
                <p className="text-xs text-slate-500">Live body measurements for bespoke pattern creation.</p>
              </div>
              <Link to="/measurements" className="text-xs font-semibold text-blue-600 hover:underline">
                Open Measurement Studio →
              </Link>
            </div>

            {!customer.measurements || customer.measurements.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <Ruler className="mx-auto h-8 w-8 text-slate-400" />
                <p className="font-semibold text-slate-700">No measurements recorded yet.</p>
                <p>Record standard body parameters in the Measurement Studio or during Order intake.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customer.measurements.map((m: any) => (
                  <div key={m.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scissors className="h-4 w-4 text-blue-600" />
                        <span className="font-bold text-xs text-slate-900">{m.garmentType?.name}</span>
                      </div>
                      <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                        Unit: {m.unit}
                      </span>
                    </div>

                    {m.versions?.[0] ? (
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 mb-2">
                          Latest Version #{m.versions[0].versionNumber} (Saved {new Date(m.versions[0].createdAt).toLocaleDateString()}):
                        </div>
                        <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-lg border border-slate-200">
                          {Object.entries(m.versions[0].values || {}).map(([k, v]: any) => (
                            <div key={k} className="text-center p-1 bg-slate-50/60 rounded">
                              <span className="block text-[10px] text-slate-400 font-medium">{k}</span>
                              <span className="text-xs font-bold text-slate-800">{String(v)}"</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No version snapshot saved.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PREFERENCES TAB */}
        {activeTab === 'preferences' && (
          <div className="max-w-lg space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Client Preferences & Bespoke Defaults</h3>
              <p className="text-xs text-slate-500">Configure default fitting style, fabric choices, and primary notification channel.</p>
            </div>

            {prefMessage && (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{prefMessage}</span>
              </div>
            )}

            <form onSubmit={handleSavePreferences} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Preferred Fit</label>
                <input
                  type="text"
                  value={prefForm.fitPreference}
                  onChange={(e) => setPrefForm({ ...prefForm, fitPreference: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  placeholder="e.g. Slim fit, Regular fit, Comfort fit, Italian cut"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Preferred Fabrics</label>
                <input
                  type="text"
                  value={prefForm.fabricPreferences}
                  onChange={(e) => setPrefForm({ ...prefForm, fabricPreferences: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  placeholder="e.g. 100% Egyptian Cotton, Irish Linen, Merino Wool"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Preferred Contact Channel</label>
                <select
                  value={prefForm.preferredContactMethod}
                  onChange={(e) => setPrefForm({ ...prefForm, preferredContactMethod: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="WHATSAPP">WhatsApp Message</option>
                  <option value="PHONE">Phone Call</option>
                  <option value="EMAIL">Email</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Preference Notes</label>
                <textarea
                  rows={3}
                  value={prefForm.notes}
                  onChange={(e) => setPrefForm({ ...prefForm, notes: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  placeholder="Notes on collar styles, cuff buttons, pocket styles..."
                />
              </div>

              <button
                type="submit"
                disabled={savingPref}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-md shadow-blue-500/20"
              >
                {savingPref ? 'Saving...' : 'Save Preferences'}
              </button>
            </form>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Order History</h3>
                <p className="text-xs text-slate-500">All tailoring and alteration orders linked to this client.</p>
              </div>
              <Link
                to={`/orders/new?customerId=${customer.id}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                <PlusCircle className="h-3.5 w-3.5" /> Book New Order
              </Link>
            </div>

            {!customer.orders || customer.orders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <ShoppingBag className="mx-auto h-8 w-8 text-slate-400" />
                <p className="font-semibold text-slate-700">No orders placed yet.</p>
                <Link
                  to={`/orders/new?customerId=${customer.id}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Create First Order
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {customer.orders.map((ord: any) => (
                  <div key={ord.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-blue-700">{ord.orderNumber}</span>
                        <StatusBadge status={ord.status} size="sm" />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Booked: {new Date(ord.createdAt).toLocaleDateString()} • Items: {ord.items?.length || 1}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold text-xs text-slate-900">{formatCurrency(ord.netAmount)}</div>
                        <div className="text-[10px] text-slate-500">Paid: {formatCurrency(ord.paidAmount)}</div>
                      </div>
                      <Link
                        to={`/orders/${ord.id}`}
                        className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        View Order →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Payment Ledger</h3>
            {!customer.payments || customer.payments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                <CreditCard className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                <p className="font-semibold text-slate-700">No payment records found.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {customer.payments.map((p: any) => (
                  <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-emerald-700">{formatCurrency(p.amount)}</span>
                      <span className="text-slate-600 ml-2 font-medium">via {p.paymentMethod}</span>
                      {p.referenceNumber && (
                        <span className="text-slate-400 ml-1.5 font-mono text-[10px]">
                          (Ref: {p.referenceNumber})
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(p.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SAVED STYLES TAB */}
        {activeTab === 'style_preferences' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Saved Design & Style Favourites</h3>
            {!customer.customerStyles || customer.customerStyles.length === 0 ? (
              <p className="text-xs text-slate-500">No favourite styles saved.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {customer.customerStyles.map((cs: any) => (
                  <div key={cs.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                    <div className="font-bold text-xs text-slate-900">{cs.style?.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {cs.style?.category} • {cs.style?.garmentType?.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PHOTOS TAB */}
        {activeTab === 'photos' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Fitting & Reference Photos</h3>
            {!customer.photos || customer.photos.length === 0 ? (
              <p className="text-xs text-slate-500">No photos uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {customer.photos.map((p: any) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                    <img src={p.fileUrl} alt={p.caption || 'Customer photo'} className="h-32 w-full object-cover" />
                    <div className="p-2 text-[10px] text-slate-600">{p.caption || p.photoType}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Scheduled Appointments</h3>
            {!customer.appointments || customer.appointments.length === 0 ? (
              <p className="text-xs text-slate-500">No appointments scheduled.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {customer.appointments.map((a: any) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{a.type}</span>
                      <span className="text-slate-500 ml-2">with {a.staff?.name || 'Staff'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-[11px]">{new Date(a.scheduledAt).toLocaleString()}</span>
                      <StatusBadge status={a.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ALTERATIONS TAB */}
        {activeTab === 'alterations' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Alteration Records</h3>
            {!customer.alterations || customer.alterations.length === 0 ? (
              <p className="text-xs text-slate-500">No alterations recorded for this customer.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {customer.alterations.map((alt: any) => (
                  <div key={alt.id} className="py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{alt.instructions}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          alt.isChargeable ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {alt.isChargeable ? `Chargeable (?${alt.chargeAmount})` : 'Free Adjustment'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Status: {alt.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Saved Documents & ID</h3>
            {!customer.documents || customer.documents.length === 0 ? (
              <p className="text-xs text-slate-500">No documents stored.</p>
            ) : (
              <div className="space-y-2">
                {customer.documents.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 text-xs">
                    <span>{d.fileName} ({d.docType})</span>
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY LOG TAB */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Activity & Audit Timeline</h3>
            {!customer.auditLogs || customer.auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No audit logs recorded.</p>
            ) : (
              <div className="space-y-3">
                {customer.auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <Activity className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-slate-800">{log.action.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] text-slate-500">
                        Performed by: {log.user?.name || 'System / Customer'} • {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Customer Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Edit Customer Information</h2>
                <p className="text-xs text-slate-500 mt-0.5">Update contact, address, and profile details for {customer.customerId}.</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editFormError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 border border-rose-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{editFormError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateCustomer} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">First Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.firstName}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.lastName}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={editFormData.mobile}
                    onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Gender</label>
                  <select
                    value={editFormData.gender}
                    onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Date of Birth</label>
                  <input
                    type="date"
                    value={editFormData.dob}
                    onChange={(e) => setEditFormData({ ...editFormData, dob: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Street Address</label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  placeholder="Flat, building, street"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700">City</label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">State</label>
                  <input
                    type="text"
                    value={editFormData.state}
                    onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Pincode</label>
                  <input
                    type="text"
                    value={editFormData.pincode}
                    onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">VIP / Customer Notes</label>
                <textarea
                  rows={2}
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  placeholder="Fabric preferences, fitting nuances, special instructions..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-md shadow-blue-500/20"
                >
                  {savingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
