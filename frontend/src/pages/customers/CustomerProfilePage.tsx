import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
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
  Scissors
} from 'lucide-react';

export const CustomerProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [prefForm, setPrefForm] = useState({
    fitPreference: '',
    fabricPreferences: '',
    preferredContactMethod: 'PHONE',
    notes: ''
  });

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/customers/${id}`);
      if (res.data.success) {
        setCustomer(res.data.data);
        if (res.data.data.preferences) {
          setPrefForm({
            fitPreference: res.data.data.preferences.fitPreference || '',
            fabricPreferences: res.data.data.preferences.fabricPreferences || '',
            preferredContactMethod: res.data.data.preferences.preferredContactMethod || 'PHONE',
            notes: res.data.data.preferences.notes || ''
          });
        }
      }
    } catch (e) {
      console.error('Failed to load customer profile', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.put(`/customers/${id}/preferences`, prefForm);
      if (res.data.success) {
        alert('Preferences updated successfully');
        fetchCustomer();
      }
    } catch (e) {
      alert('Failed to update preferences');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!customer) {
    return <div className="p-8 text-center text-slate-500">Customer not found.</div>;
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'measurements', label: 'Measurements' },
    { id: 'style_preferences', label: 'Style Preferences' },
    { id: 'general_preferences', label: 'General Preferences' },
    { id: 'orders', label: 'Orders' },
    { id: 'payments', label: 'Payments' },
    { id: 'photos', label: 'Photos' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'alterations', label: 'Alterations' },
    { id: 'documents', label: 'Documents' },
    { id: 'activity', label: 'Activity History' }
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xl shadow-md shadow-blue-500/20">
              {customer.firstName[0]}{customer.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{customer.firstName} {customer.lastName}</h1>
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                  {customer.customerId}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {customer.mobile}</span>
                {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>}
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {customer.city || 'Bangalore'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Spend</span>
              <div className="text-lg font-bold text-slate-900">?{(customer.totalSpend || 0).toLocaleString()}</div>
            </div>
            <div className="h-8 w-px bg-slate-200 mx-1" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">Balance</span>
              <div className={`text-lg font-bold ${customer.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                ?{(customer.outstandingBalance || 0).toLocaleString()}
              </div>
            </div>
            <Link
              to={`/orders/new?customerId=${customer.id}`}
              className="ml-3 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
            >
              + Create Order
            </Link>
          </div>
        </div>

        <div className="mt-6 flex overflow-x-auto border-b border-slate-200 gap-1 pb-px scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`whitespace-nowrap px-3.5 py-2 text-xs font-semibold border-b-2 transition-all ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-900">Customer Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <span className="text-xs font-bold text-slate-700">Address & Notes</span>
                <p className="text-xs text-slate-600 mt-1">{customer.address || 'No street address recorded'}</p>
                <p className="text-xs text-slate-600 mt-1">{customer.city} - {customer.pincode}</p>
                {customer.notes && (
                  <div className="mt-3 p-2 rounded bg-amber-50 text-[11px] text-amber-800 border border-amber-200">
                    VIP Notes: {customer.notes}
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <span className="text-xs font-bold text-slate-700">Quick Fit & Preferences</span>
                <p className="text-xs text-slate-600 mt-1">
                  Fit: <span className="font-semibold">{customer.preferences?.fitPreference || 'Not set'}</span>
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Fabrics: <span className="font-semibold">{customer.preferences?.fabricPreferences || 'Not set'}</span>
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Contact: <span className="font-semibold">{customer.preferences?.preferredContactMethod || 'PHONE'}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'measurements' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Recorded Measurement Profiles</h3>
              <Link to="/measurements" className="text-xs font-semibold text-blue-600 hover:underline">
                Open Measurement Studio ?
              </Link>
            </div>
            {customer.measurements?.length === 0 ? (
              <p className="text-xs text-slate-500">No measurements recorded yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customer.measurements?.map((m: any) => (
                  <div key={m.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-slate-900">{m.garmentType?.name}</span>
                      <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        Unit: {m.unit}
                      </span>
                    </div>
                    {m.versions?.[0] ? (
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 mb-2">
                          Latest Version #{m.versions[0].versionNumber} ({new Date(m.versions[0].createdAt).toLocaleDateString()}):
                        </div>
                        <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                          {Object.entries(m.versions[0].values || {}).map(([k, v]: any) => (
                            <div key={k} className="text-center">
                              <span className="block text-[10px] text-slate-400 font-medium">{k}</span>
                              <span className="text-xs font-bold text-slate-800">{String(v)}"</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No version data saved.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'style_preferences' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Saved Design & Style Favourites</h3>
            {customer.customerStyles?.length === 0 ? (
              <p className="text-xs text-slate-500">No favourite styles saved.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {customer.customerStyles?.map((cs: any) => (
                  <div key={cs.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                    <div className="font-bold text-xs text-slate-900">{cs.style?.name}</div>
                    <div className="text-[10px] text-slate-500">{cs.style?.category} ? {cs.style?.garmentType?.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'general_preferences' && (
          <form onSubmit={handleSavePreferences} className="max-w-md space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Client Preferences</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Fit Preference</label>
              <input
                type="text"
                value={prefForm.fitPreference}
                onChange={(e) => setPrefForm({ ...prefForm, fitPreference: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                placeholder="e.g. Slim fit, Regular fit, Italian cut"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Fabric Preferences</label>
              <input
                type="text"
                value={prefForm.fabricPreferences}
                onChange={(e) => setPrefForm({ ...prefForm, fabricPreferences: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                placeholder="e.g. 100% Egyptian Cotton, Irish Linen"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Preferred Contact Channel</label>
              <select
                value={prefForm.preferredContactMethod}
                onChange={(e) => setPrefForm({ ...prefForm, preferredContactMethod: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
              >
                <option value="PHONE">Phone Call</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              Save Preferences
            </button>
          </form>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Order History</h3>
            {customer.orders?.length === 0 ? (
              <p className="text-xs text-slate-500">No orders placed yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {customer.orders?.map((ord: any) => (
                  <div key={ord.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{ord.orderNumber}</div>
                      <div className="text-[11px] text-slate-500">
                        Placed: {new Date(ord.createdAt).toLocaleDateString()} ? Items: {ord.items?.length}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold text-xs text-slate-900">?{Number(ord.netAmount).toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500">Paid: ?{Number(ord.paidAmount).toLocaleString()}</div>
                      </div>
                      <StatusBadge status={ord.status} />
                      <Link to={`/orders/${ord.id}`} className="text-xs font-semibold text-blue-600 hover:underline">
                        View ?
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Payment Ledger</h3>
            {customer.payments?.length === 0 ? (
              <p className="text-xs text-slate-500">No payment transactions recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {customer.payments?.map((p: any) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-emerald-700">?{Number(p.amount).toLocaleString()}</span>
                      <span className="text-slate-500 ml-2">via {p.paymentMethod}</span>
                      {p.referenceNumber && <span className="text-slate-400 ml-1.5 font-mono text-[10px]">({p.referenceNumber})</span>}
                    </div>
                    <span className="text-slate-400 text-[11px]">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Fitting & Reference Photos</h3>
            {customer.photos?.length === 0 ? (
              <p className="text-xs text-slate-500">No photos uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {customer.photos?.map((p: any) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                    <img src={p.fileUrl} alt={p.caption || 'Customer photo'} className="h-32 w-full object-cover" />
                    <div className="p-2 text-[10px] text-slate-600">{p.caption || p.photoType}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Scheduled Appointments</h3>
            {customer.appointments?.length === 0 ? (
              <p className="text-xs text-slate-500">No appointments scheduled.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {customer.appointments?.map((a: any) => (
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

        {activeTab === 'alterations' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Alteration Records</h3>
            {customer.alterations?.length === 0 ? (
              <p className="text-xs text-slate-500">No alterations recorded for this customer.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {customer.alterations?.map((alt: any) => (
                  <div key={alt.id} className="py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{alt.instructions}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${alt.isChargeable ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
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

        {activeTab === 'documents' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Saved Documents & ID</h3>
            {customer.documents?.length === 0 ? (
              <p className="text-xs text-slate-500">No documents stored.</p>
            ) : (
              <div className="space-y-2">
                {customer.documents?.map((d: any) => (
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

        {activeTab === 'activity' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Activity & Audit Timeline</h3>
            {customer.auditLogs?.length === 0 ? (
              <p className="text-xs text-slate-500">No audit logs recorded.</p>
            ) : (
              <div className="space-y-3">
                {customer.auditLogs?.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <Activity className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-slate-800">{log.action.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] text-slate-500">
                        Performed by: {log.user?.name || 'System / Customer'} ? {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
