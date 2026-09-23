import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import {
  Search,
  UserPlus,
  Upload,
  Download,
  Eye,
  Phone,
  MapPin,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  MessageSquare
} from 'lucide-react';

export const CustomerListPage: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Add Customer Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    sameWhatsApp: true,
    whatsapp: '',
    email: '',
    gender: 'Male',
    address: '',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '',
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [duplicateCustomer, setDuplicateCustomer] = useState<{ id: string; name: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);

  const fetchCustomers = async (query = search, targetPage = page) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/customers?page=${targetPage}&limit=20&search=${encodeURIComponent(query)}`);
      if (res.data.success) {
        setCustomers(res.data.data.customers);
        if (res.data.data.pagination) {
          setPagination(res.data.data.pagination);
          setPage(res.data.data.pagination.page);
        }
      } else {
        setError(res.data.error?.message || 'Failed to load customers');
      }
    } catch (e: any) {
      console.error('Failed to load customers', e);
      setError(e.response?.data?.error?.message || 'Failed to connect to customer service. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchCustomers(search, 1);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers(search, 1);
  };

  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    fetchCustomers('', 1);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setDuplicateCustomer(null);

    // Front-end Validation
    const trimmedFirst = formData.firstName.trim();
    const trimmedLast = formData.lastName.trim();
    const cleanMobile = formData.mobile.trim();
    const mobileDigits = cleanMobile.replace(/\D/g, '');

    if (!trimmedFirst || !trimmedLast) {
      setFormError('First and last name are required.');
      return;
    }

    if (mobileDigits.length < 7 || mobileDigits.length > 15) {
      setFormError('Please enter a valid phone number (7 to 15 digits).');
      return;
    }

    if (!formData.sameWhatsApp && formData.whatsapp.trim()) {
      const waDigits = formData.whatsapp.trim().replace(/\D/g, '');
      if (waDigits.length < 7 || waDigits.length > 15) {
        setFormError('Please enter a valid WhatsApp number (7 to 15 digits).');
        return;
      }
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setFormError('Please enter a valid email address.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: any = {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        mobile: cleanMobile,
        email: formData.email.trim() || undefined,
        gender: formData.gender,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        pincode: formData.pincode.trim() || undefined,
        notes: formData.notes.trim() || undefined
      };

      if (formData.sameWhatsApp) {
        payload.whatsapp = cleanMobile;
        payload.preferences = { preferredContactMethod: 'WHATSAPP' };
      } else if (formData.whatsapp.trim()) {
        payload.whatsapp = formData.whatsapp.trim();
        payload.preferences = { preferredContactMethod: 'WHATSAPP' };
      } else {
        payload.preferences = { preferredContactMethod: 'PHONE' };
      }

      const res = await api.post('/customers', payload);
      if (res.data.success) {
        const created = res.data.data;
        setShowAddModal(false);
        setFormData({
          firstName: '',
          lastName: '',
          mobile: '',
          sameWhatsApp: true,
          whatsapp: '',
          email: '',
          gender: 'Male',
          address: '',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '',
          notes: ''
        });
        setSuccessBanner(`Customer ${created.firstName} ${created.lastName} (${created.customerId}) created successfully!`);
        setTimeout(() => setSuccessBanner(null), 5000);
        fetchCustomers();
      }
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      if (err.response?.status === 409 && errorData?.existingCustomerId) {
        setDuplicateCustomer({
          id: errorData.existingCustomerId,
          name: errorData.existingCustomerName || 'Existing Customer',
          message: errorData.message || 'A customer with this phone number already exists.'
        });
      } else {
        setFormError(errorData?.message || 'Failed to create customer. Please verify details and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreviewCsv = async () => {
    if (!csvText.trim()) return;
    setImportLoading(true);
    try {
      const lines = csvText.trim().split('\n');
      const rows = lines.slice(1).map((l) => {
        const parts = l.split(',').map((s) => s.replace(/["\r]/g, '').trim());
        return {
          firstName: parts[0] || '',
          lastName: parts[1] || '',
          mobile: parts[2] || '',
          email: parts[3] || '',
          city: parts[4] || ''
        };
      });

      const res = await api.post('/import-export/preview', { entity: 'CUSTOMERS', rows });
      if (res.data.success) {
        setImportPreview(res.data.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Import preview failed');
    } finally {
      setImportLoading(false);
    }
  };

  const handleCommitCsv = async () => {
    if (!importPreview?.validRowsPreview) return;
    setImportLoading(true);
    try {
      const res = await api.post('/import-export/commit', {
        entity: 'CUSTOMERS',
        validRows: importPreview.validRowsPreview
      });
      if (res.data.success) {
        alert(res.data.message);
        setShowImportModal(false);
        setImportPreview(null);
        setCsvText('');
        fetchCustomers();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Commit failed');
    } finally {
      setImportLoading(false);
    }
  };

  const handleExport = () => {
    window.open('/api/v1/import-export/export/CUSTOMERS', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Customer Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage client profiles, measurements, contact channels, and order histories.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            Import CSV
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export
          </button>
          <button
            onClick={() => {
              setFormError('');
              setDuplicateCustomer(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name, phone number, email, or customer ID (e.g. CUST-10001)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden shadow-2xs"
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all cursor-pointer"
        >
          Search
        </button>
      </form>

      {/* Main Content Area: Loading, Error, Empty, or Data */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-xs text-slate-500 font-medium">Loading customers...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
            <p className="text-xs font-semibold text-slate-800">{error}</p>
            <button
              onClick={() => fetchCustomers(search, page)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Search className="h-6 w-6" />
            </div>
            {search ? (
              <>
                <p className="text-xs font-semibold text-slate-800">
                  No customers found matching "<span className="text-blue-600 font-bold">{search}</span>"
                </p>
                <p className="text-xs text-slate-500">
                  Try searching by single name, phone number, or clear your search to see all clients.
                </p>
                <button
                  onClick={handleClearSearch}
                  className="rounded-lg bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-slate-800">Your customer directory is empty</p>
                <p className="text-xs text-slate-500">
                  Register walk-in clients to record custom measurements, style preferences, and track orders.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  <UserPlus className="h-4 w-4" /> Add First Customer
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Customer ID</th>
                    <th className="py-3 px-4">Name & Contact</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Orders</th>
                    <th className="py-3 px-4">Lifetime Spend</th>
                    <th className="py-3 px-4">Balance</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                        {c.customerId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <a
                            href={`tel:${c.mobile}`}
                            className="inline-flex items-center gap-1 hover:text-blue-600"
                            title="Call customer"
                          >
                            <Phone className="h-3 w-3 text-slate-400" /> {c.mobile}
                          </a>
                          {c.preferences?.preferredContactMethod === 'WHATSAPP' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              WhatsApp
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1 text-[11px]">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{c.city || 'Bangalore'}{c.state ? `, ${c.state}` : ''}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {c.orderCount ?? 0} {c.orderCount === 1 ? 'order' : 'orders'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {formatCurrency(c.totalSpend)}
                      </td>
                      <td className="py-3.5 px-4">
                        {c.outstandingBalance > 0 ? (
                          <span className="font-bold text-rose-600">
                            {formatCurrency(c.outstandingBalance)}
                          </span>
                        ) : (
                          <span className="font-medium text-emerald-700">Settled ({formatCurrency(0)})</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            to={`/orders/new?customerId=${c.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                            title="Create new order for this customer"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            + Order
                          </Link>
                          <Link
                            to={`/customers/${c.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Profile
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="block md:hidden divide-y divide-slate-100">
              {customers.map((c) => (
                <div key={c.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {c.customerId}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 mt-1">
                        {c.firstName} {c.lastName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <a href={`tel:${c.mobile}`} className="flex items-center gap-1 hover:text-blue-600">
                          <Phone className="h-3 w-3 text-slate-400" /> {c.mobile}
                        </a>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Spend</div>
                      <div className="font-bold text-xs text-slate-900">{formatCurrency(c.totalSpend)}</div>
                      {c.outstandingBalance > 0 && (
                        <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                          Bal: {formatCurrency(c.outstandingBalance)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <MapPin className="h-3 w-3 text-slate-400" /> {c.city || 'Bangalore'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/orders/new?customerId=${c.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <PlusCircle className="h-3.5 w-3.5" /> Order
                      </Link>
                      <Link
                        to={`/customers/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Profile
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 px-4 py-3 bg-slate-50/60 text-xs text-slate-600 gap-2">
            <div>
              Showing <span className="font-semibold text-slate-800">{Math.min((page - 1) * pagination.limit + 1, pagination.total)}</span> to{' '}
              <span className="font-semibold text-slate-800">{Math.min(page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-semibold text-slate-800">{pagination.total}</span> clients
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchCustomers(search, page - 1)}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-medium transition shadow-2xs cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="px-2 font-semibold text-slate-700">Page {page} of {pagination.pages}</span>
              <button
                type="button"
                onClick={() => fetchCustomers(search, page + 1)}
                disabled={page >= pagination.pages || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-medium transition shadow-2xs cursor-pointer"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Add New Customer</h2>
                <p className="text-xs text-slate-500 mt-0.5">Capture client details for instant orders & measurements.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error Notification */}
            {formError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 border border-rose-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* Duplicate Customer Resolution Banner */}
            {duplicateCustomer && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3.5 text-xs border border-amber-200 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Customer Already Registered</span>
                </div>
                <p className="text-[11px] text-amber-800">{duplicateCustomer.message}</p>
                <div className="pt-2 flex flex-wrap gap-2">
                  <Link
                    to={`/customers/${duplicateCustomer.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 shadow-2xs"
                  >
                    <Eye className="h-3.5 w-3.5" /> View Profile ({duplicateCustomer.name})
                  </Link>
                  <Link
                    to={`/orders/new?customerId=${duplicateCustomer.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 shadow-2xs"
                  >
                    <PlusCircle className="h-3.5 w-3.5" /> Book Order for Customer
                  </Link>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                    placeholder="e.g. Sunil"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                    placeholder="e.g. Rao"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Phone Number *</label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="block w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs focus:border-blue-500 focus:outline-hidden"
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* WhatsApp Option */}
              <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.sameWhatsApp}
                    onChange={(e) => setFormData({ ...formData, sameWhatsApp: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                    WhatsApp number is same as phone
                  </span>
                </label>

                {!formData.sameWhatsApp && (
                  <div>
                    <label className="block font-medium text-slate-600 text-[11px]">Separate WhatsApp Number</label>
                    <input
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                      placeholder="e.g. 9811122233"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Email Address (Optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Street Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  placeholder="Flat, building, street, landmark"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                    placeholder="Bangalore"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                    placeholder="Karnataka"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Pincode</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                    placeholder="560001"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">VIP / Customer Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  placeholder="Fabric preferences, fitting nuances, special instructions..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-md shadow-blue-500/20"
                >
                  {submitting ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-base font-bold text-slate-900">Import Customers from CSV</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste CSV records below. System validates records strictly before committing to database.
            </p>

            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="firstName,lastName,mobile,email,city&#10;Sunil,Kumar,9811122233,sunil@test.com,Bangalore"
              className="mt-3 block w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs focus:border-blue-500 focus:outline-hidden"
            />

            <div className="mt-3 flex justify-between items-center">
              <button
                type="button"
                onClick={handlePreviewCsv}
                disabled={importLoading || !csvText.trim()}
                className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50 cursor-pointer"
              >
                {importLoading ? 'Validating...' : 'Validate & Preview'}
              </button>
            </div>

            {importPreview && (
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div className="flex gap-4 font-bold">
                  <span className="text-emerald-700">Valid Rows: {importPreview.validCount}</span>
                  <span className="text-rose-600">Invalid Rows: {importPreview.invalidCount}</span>
                </div>
                {importPreview.errors?.length > 0 && (
                  <div className="mt-2 text-rose-600 space-y-0.5 text-[11px]">
                    {importPreview.errors.map((e: string, idx: number) => (
                      <div key={idx}>• {e}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportPreview(null);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              {importPreview?.canCommit && (
                <button
                  type="button"
                  onClick={handleCommitCsv}
                  disabled={importLoading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-500/20"
                >
                  Commit {importPreview.validCount} Valid Records
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
