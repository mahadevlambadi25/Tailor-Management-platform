import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Ruler, Plus, History, CheckCircle2, User, RefreshCw } from 'lucide-react';

export const MeasurementsPage: React.FC = () => {
  const [garments, setGarments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerMeasurements, setCustomerMeasurements] = useState<any[]>([]);
  const [selectedGarmentId, setSelectedGarmentId] = useState('');
  const [unit, setUnit] = useState<'INCHES' | 'CENTIMETERS'>('INCHES');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Field values state for new measurement
  const [fieldValues, setFieldValues] = useState<Record<string, number>>({
    Chest: 40,
    Waist: 34,
    Neck: 16,
    Sleeve: 25,
    Shoulder: 18,
    Length: 30
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [garmsRes, custsRes] = await Promise.all([
        api.get('/garments'),
        api.get('/customers?limit=50')
      ]);

      if (garmsRes.data.success) {
        setGarments(garmsRes.data.data);
        if (garmsRes.data.data.length > 0) setSelectedGarmentId(garmsRes.data.data[0].id);
      }
      if (custsRes.data.success) {
        setCustomers(custsRes.data.data.customers);
        if (custsRes.data.data.customers.length > 0) {
          handleSelectCustomer(custsRes.data.data.customers[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load measurement data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = async (c: any) => {
    setSelectedCustomer(c);
    try {
      const res = await api.get(`/measurements/customer/${c.id}`);
      if (res.data.success) {
        setCustomerMeasurements(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load customer measurements', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedGarmentId) return;

    try {
      const res = await api.post('/measurements', {
        customerId: selectedCustomer.id,
        garmentTypeId: selectedGarmentId,
        unit,
        values: fieldValues,
        notes: `Recorded via Measurement Studio (${unit})`
      });

      if (res.data.success) {
        alert('Measurement version saved successfully!');
        setShowAddModal(false);
        handleSelectCustomer(selectedCustomer);
      }
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to save measurement');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Measurement Studio & Version Archive</h1>
          <p className="text-xs text-slate-500">
            Immutable measurement snapshots, template catalogues, and client body fitting history.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
        >
          <Plus className="h-4 w-4" /> Record New Version
        </button>
      </div>

      {/* Customer Selector Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-blue-600" />
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400">Select Customer Profile</label>
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const c = customers.find((cust) => cust.id === e.target.value);
                if (c) handleSelectCustomer(c);
              }}
              className="text-xs font-bold text-slate-900 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.mobile}) - {c.customerId}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Unit Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg text-xs font-bold">
          <span className="text-slate-500 px-2">Unit:</span>
          <button
            onClick={() => setUnit('INCHES')}
            className={`px-3 py-1 rounded-md transition-all ${unit === 'INCHES' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'}`}
          >
            Inches (")
          </button>
          <button
            onClick={() => setUnit('CENTIMETERS')}
            className={`px-3 py-1 rounded-md transition-all ${unit === 'CENTIMETERS' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'}`}
          >
            Centimeters (cm)
          </button>
        </div>
      </div>

      {/* Customer Measurements & Version Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {customerMeasurements.length === 0 ? (
          <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            No measurements recorded for this customer yet. Click "Record New Version" above to start.
          </div>
        ) : (
          customerMeasurements.map((m) => (
            <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{m.garmentType?.name}</h3>
                  <span className="text-[10px] text-slate-400">Profile: {m.name}</span>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                  {m.versions?.length || 0} Saved Versions
                </span>
              </div>

              {/* Version History Comparison */}
              <div className="space-y-3">
                {m.versions?.map((v: any, vIdx: number) => (
                  <div
                    key={v.id}
                    className={`p-3.5 rounded-xl border transition-all ${vIdx === 0 ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50/50 border-slate-200'}`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                      <span className="flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-blue-600" />
                        Version #{v.versionNumber} {vIdx === 0 && '(Latest)'}
                      </span>
                      <span className="text-[10px] font-normal text-slate-400">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      {Object.entries(v.values || {}).map(([k, val]: any) => (
                        <div key={k} className="text-center">
                          <span className="block text-[10px] text-slate-400 font-medium">{k}</span>
                          <span className="text-xs font-bold text-slate-900">{String(val)}"</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Record Measurement Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Record Measurement Profile</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Input measurements for {selectedCustomer?.firstName} {selectedCustomer?.lastName}.
            </p>

            <form onSubmit={handleSaveMeasurement} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Garment Type</label>
                <select
                  value={selectedGarmentId}
                  onChange={(e) => {
                    setSelectedGarmentId(e.target.value);
                    const g = garments.find((gt) => gt.id === e.target.value);
                    if (g?.code === 'PANT') {
                      setFieldValues({ Waist: 34, Hip: 40, Inseam: 31, Outseam: 41, Thigh: 24, Bottom: 15 });
                    } else {
                      setFieldValues({ Chest: 40, Waist: 34, Neck: 16, Sleeve: 25, Shoulder: 18, Length: 30 });
                    }
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                >
                  {garments.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  Body Parameters ({unit})
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(fieldValues).map(([k, val]) => (
                    <div key={k}>
                      <label className="block text-[11px] text-slate-500 font-medium">{k}</label>
                      <input
                        type="number"
                        step="0.25"
                        value={val}
                        onChange={(e) => setFieldValues({ ...fieldValues, [k]: Number(e.target.value) })}
                        className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-2 text-xs text-center font-bold text-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Save Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
