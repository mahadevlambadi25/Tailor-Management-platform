import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { Search, UserPlus, Upload, Download, Eye, Phone, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

export const CustomerListPage: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    email: '',
    gender: 'Male',
    address: '',
    city: 'Bangalore',
    notes: ''
  });
  const [formError, setFormError] = useState('');

  const [csvText, setCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);

  const fetchCustomers = async (query = search, targetPage = page) => {
    try {
      setLoading(true);
      const res = await api.get(`/customers?page=${targetPage}&limit=20&search=${encodeURIComponent(query)}`);
      if (res.data.success) {
        setCustomers(res.data.data.customers);
        if (res.data.data.pagination) {
          setPagination(res.data.data.pagination);
          setPage(res.data.data.pagination.page);
        }
      }
    } catch (e) {
      console.error('Failed to load customers', e);
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

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const res = await api.post('/customers', formData);
      if (res.data.success) {
        setShowAddModal(false);
        setFormData({ firstName: '', lastName: '', mobile: '', email: '', gender: 'Male', address: '', city: 'Bangalore', notes: '' });
        fetchCustomers();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Failed to create customer');
    }
  };

  const handlePreviewCsv = async () => {
    if (!csvText.trim()) return;
    setImportLoading(true);
    try {
      const lines = csvText.trim().split('\n');
      const rows = lines.slice(1).map(l => {
        const parts = l.split(',').map(s => s.replace(/["\r]/g, '').trim());
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customer Directory</h1>
          <p className="text-xs text-slate-500">Manage client accounts, measurements, profiles, and order histories.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all"
          >
            <UserPlus className="h-4 w-4" />
            Add Customer
          </button>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name, mobile number, email, or customer ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden shadow-xs"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all"
        >
          Search
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No customers found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Customer ID</th>
                  <th className="py-3 px-4">Name & Contact</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Lifetime Spend</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{c.customerId}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{c.firstName} {c.lastName}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Phone className="h-3 w-3" /> {c.mobile}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1 text-[11px]">
                        <MapPin className="h-3 w-3 text-slate-400" /> {c.city || 'Bangalore'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      ?{(c.totalSpend || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      {c.outstandingBalance > 0 ? (
                        <span className="font-bold text-rose-600">?{c.outstandingBalance.toLocaleString()}</span>
                      ) : (
                        <span className="font-medium text-emerald-700">Settled (?0)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/customers/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Full Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-medium transition shadow-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="px-2 font-semibold text-slate-700">Page {page} of {pagination.pages}</span>
              <button
                type="button"
                onClick={() => fetchCustomers(search, page + 1)}
                disabled={page >= pagination.pages || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-medium transition shadow-xs"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Add Walk-in Customer</h2>
            <p className="text-xs text-slate-500 mt-0.5">Capture client details for instant orders & measurements.</p>

            {formError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-700 border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                    placeholder="e.g. Rajesh"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                    placeholder="e.g. Kumar"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                    placeholder="9876543210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                    placeholder="optional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Street Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                  placeholder="Flat, building, area"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Import Customers from CSV</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste CSV records below. System validates records strictly before committing to database.
            </p>

            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="firstName,lastName,mobile,email,city&#10;Sunil,Kumar,9811122233,sunil@test.com,Bangalore"
              className="mt-3 block w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs"
            />

            <div className="mt-3 flex justify-between items-center">
              <button
                type="button"
                onClick={handlePreviewCsv}
                disabled={importLoading}
                className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50"
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
                    {importPreview.errors.map((e: string, idx: number) => <div key={idx}>? {e}</div>)}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => { setShowImportModal(false); setImportPreview(null); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Close
              </button>
              {importPreview?.canCommit && (
                <button
                  type="button"
                  onClick={handleCommitCsv}
                  disabled={importLoading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
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
