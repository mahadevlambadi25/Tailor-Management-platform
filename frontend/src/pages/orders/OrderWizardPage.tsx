import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import {
  Plus,
  Trash2,
  Scissors,
  CheckCircle2,
  User,
  Ruler,
  Palette,
  AlertCircle,
  Calendar,
  CreditCard,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';

export const OrderWizardPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Master Data
  const [customers, setCustomers] = useState<any[]>([]);
  const [garmentTypes, setGarmentTypes] = useState<any[]>([]);
  const [availableStyles, setAvailableStyles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState(searchParams.get('customerId') || '');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Default delivery date: 7 days from today
  const defaultDeliveryDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  // Multi-item Garment List
  const [items, setItems] = useState<any[]>([
    {
      garmentTypeId: '',
      itemPrice: 2500,
      stitchingCharge: 500,
      fabricCharge: 0,
      quantity: 1,
      measurementValues: { Chest: 40, Waist: 34, Neck: 16, Sleeve: 25, Shoulder: 18, Length: 30 },
      unit: 'INCHES',
      selectedStyleId: '',
      internalNotes: '',
      customerNotes: '',
      appliedSavedProfileId: null
    }
  ]);

  // Pricing & Commercials
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(0);
  const [isGstInclusive, setIsGstInclusive] = useState(false);

  // Delivery & Payment
  const [deliveryDate, setDeliveryDate] = useState(defaultDeliveryDate);
  const [priority, setPriority] = useState('REGULAR');
  const [advanceAmount, setAdvanceAmount] = useState<number>(1000);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentRef, setPaymentRef] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initial Load
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        setLoading(true);
        const [custRes, garmRes, styleRes] = await Promise.all([
          api.get('/customers?limit=100'),
          api.get('/garments'),
          api.get('/styles')
        ]);

        let loadedCustomers: any[] = [];
        if (custRes.data.success) {
          loadedCustomers = custRes.data.data.customers;
          setCustomers(loadedCustomers);
        }

        let loadedGarments: any[] = [];
        if (garmRes.data.success) {
          loadedGarments = garmRes.data.data;
          setGarmentTypes(loadedGarments);
        }

        if (styleRes.data.success) {
          setAvailableStyles(styleRes.data.data);
        }

        // Handle customer pre-selection from URL query param
        if (selectedCustomerId) {
          let found = loadedCustomers.find((c: any) => c.id === selectedCustomerId);
          if (!found) {
            try {
              // Fetch customer profile directly if not in initial list
              const singleRes = await api.get(`/customers/${selectedCustomerId}`);
              if (singleRes.data.success) {
                found = singleRes.data.data;
                setCustomers((prev) => [found, ...prev]);
              }
            } catch (err) {
              console.error('Failed to load selected customer', err);
            }
          }

          if (found) {
            handleSelectCustomer(found, loadedGarments);
          }
        } else if (loadedGarments.length > 0) {
          const shirt = loadedGarments.find((g: any) => g.code === 'SHIRT') || loadedGarments[0];
          setItems((prev) => [{ ...prev[0], garmentTypeId: shirt.id }]);
        }
      } catch (e) {
        console.error('Failed to load order master data', e);
      } finally {
        setLoading(false);
      }
    };
    loadMasterData();
  }, []);

  // Customer selection handler
  const handleSelectCustomer = async (c: any, garments = garmentTypes) => {
    setSelectedCustomerId(c.id);

    // Fetch full profile to get customer's saved measurements if not populated
    let fullCustomer = c;
    if (!c.measurements) {
      try {
        const fullRes = await api.get(`/customers/${c.id}`);
        if (fullRes.data.success) {
          fullCustomer = fullRes.data.data;
        }
      } catch (e) {
        console.error('Failed to fetch full customer details', e);
      }
    }
    setSelectedCustomer(fullCustomer);

    // Auto-apply saved measurements for the first item if matching garment found
    const defaultGarment = garments.find((g: any) => g.code === 'SHIRT') || garments[0];
    if (defaultGarment) {
      const match = fullCustomer.measurements?.find((m: any) => m.garmentTypeId === defaultGarment.id);
      if (match && match.versions?.[0]?.values) {
        setItems((prev) => [
          {
            ...prev[0],
            garmentTypeId: defaultGarment.id,
            measurementValues: { ...match.versions[0].values },
            unit: match.unit || 'INCHES',
            appliedSavedProfileId: match.id
          },
          ...prev.slice(1)
        ]);
      } else {
        setItems((prev) => [
          {
            ...prev[0],
            garmentTypeId: defaultGarment.id
          },
          ...prev.slice(1)
        ]);
      }
    }
  };

  // Garment type change handler for an item
  const handleGarmentTypeChange = (index: number, garmentId: string) => {
    const g = garmentTypes.find((gt) => gt.id === garmentId);
    const updated = [...items];
    updated[index].garmentTypeId = garmentId;

    // Check if customer has a saved measurement profile for this garment
    const savedMatch = selectedCustomer?.measurements?.find((m: any) => m.garmentTypeId === garmentId);
    if (savedMatch && savedMatch.versions?.[0]?.values) {
      updated[index].measurementValues = { ...savedMatch.versions[0].values };
      updated[index].unit = savedMatch.unit || 'INCHES';
      updated[index].appliedSavedProfileId = savedMatch.id;
    } else {
      updated[index].appliedSavedProfileId = null;
      if (g?.code === 'PANT') {
        updated[index].itemPrice = 2200;
        updated[index].measurementValues = { Waist: 34, Hip: 40, Inseam: 31, Outseam: 41, Thigh: 24, Bottom: 15 };
      } else if (g?.code === 'SUIT') {
        updated[index].itemPrice = 8500;
        updated[index].measurementValues = { Chest: 40, Waist: 34, Shoulder: 18, Sleeve: 25, Length: 31, Hip: 40 };
      } else {
        updated[index].itemPrice = 2500;
        updated[index].measurementValues = { Chest: 40, Waist: 34, Neck: 16, Sleeve: 25, Shoulder: 18, Length: 30 };
      }
    }

    setItems(updated);
  };

  // Load a specific customer measurement profile into an item
  const handleApplySavedMeasurement = (itemIndex: number, measurement: any) => {
    const updated = [...items];
    if (measurement && measurement.versions?.[0]?.values) {
      updated[itemIndex].measurementValues = { ...measurement.versions[0].values };
      updated[itemIndex].unit = measurement.unit || 'INCHES';
      updated[itemIndex].appliedSavedProfileId = measurement.id;
      setItems(updated);
    }
  };

  // Add Item to Order
  const handleAddItem = () => {
    const defaultGarment = garmentTypes[1] || garmentTypes[0];
    const savedMatch = selectedCustomer?.measurements?.find((m: any) => m.garmentTypeId === defaultGarment?.id);

    setItems([
      ...items,
      {
        garmentTypeId: defaultGarment ? defaultGarment.id : '',
        itemPrice: defaultGarment?.code === 'PANT' ? 2200 : 2500,
        stitchingCharge: 0,
        fabricCharge: 0,
        quantity: 1,
        measurementValues: savedMatch?.versions?.[0]?.values
          ? { ...savedMatch.versions[0].values }
          : defaultGarment?.code === 'PANT'
          ? { Waist: 34, Hip: 40, Inseam: 31, Outseam: 41, Thigh: 24, Bottom: 15 }
          : { Chest: 40, Waist: 34, Neck: 16, Sleeve: 25, Shoulder: 18, Length: 30 },
        unit: savedMatch?.unit || 'INCHES',
        selectedStyleId: '',
        internalNotes: '',
        customerNotes: '',
        appliedSavedProfileId: savedMatch?.id || null
      }
    ]);
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Measurement key-value updater
  const handleUpdateMeasurementValue = (itemIndex: number, key: string, value: any) => {
    const updated = [...items];
    updated[itemIndex].measurementValues = {
      ...updated[itemIndex].measurementValues,
      [key]: value
    };
    setItems(updated);
  };

  // Calculate Subtotals & Net
  const itemsTotal = items.reduce((sum, item) => {
    const base = Number(item.itemPrice || 0) + Number(item.stitchingCharge || 0) + Number(item.fabricCharge || 0);
    return sum + base * (Number(item.quantity) || 1);
  }, 0);

  const discountAmount = discountType === 'PERCENTAGE'
    ? (itemsTotal * Number(discountValue || 0)) / 100
    : Number(discountValue || 0);

  const subtotalAfterDiscount = Math.max(0, itemsTotal - discountAmount);

  let gstAmount = 0;
  let netTotal = subtotalAfterDiscount;
  if (gstRate > 0) {
    if (isGstInclusive) {
      gstAmount = subtotalAfterDiscount - subtotalAfterDiscount / (1 + gstRate / 100);
      netTotal = subtotalAfterDiscount;
    } else {
      gstAmount = (subtotalAfterDiscount * gstRate) / 100;
      netTotal = subtotalAfterDiscount + gstAmount;
    }
  }

  const balanceDue = Math.max(0, netTotal - Number(advanceAmount || 0));

  // Submit Order Booking
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedCustomerId) {
      setError('Please select or search a customer.');
      return;
    }

    if (!deliveryDate) {
      setError('Delivery commitment date is mandatory.');
      return;
    }

    if (items.some((i) => !i.garmentTypeId)) {
      setError('Please choose a garment type for all items.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        deliveryDate: new Date(deliveryDate).toISOString(),
        priority,
        discountType,
        discountValue: Number(discountValue || 0),
        gstRate: Number(gstRate || 0),
        isGstInclusive,
        advancePayment: Number(advanceAmount) > 0 ? {
          amount: Number(advanceAmount),
          paymentMethod,
          referenceNumber: paymentRef || undefined
        } : undefined,
        internalNotes: internalNotes || undefined,
        customerNotes: customerNotes || undefined,
        items: items.map((item) => ({
          garmentTypeId: item.garmentTypeId,
          itemPrice: Number(item.itemPrice || 0),
          stitchingCharge: Number(item.stitchingCharge || 0),
          fabricCharge: Number(item.fabricCharge || 0),
          quantity: Number(item.quantity || 1),
          measurementSnapshot: {
            valuesSnapshot: item.measurementValues,
            unit: item.unit
          },
          styleOptions: item.selectedStyleId ? [{ styleId: item.selectedStyleId }] : [],
          internalNotes: item.internalNotes || undefined,
          customerNotes: item.customerNotes || undefined
        }))
      };

      const res = await api.post('/orders', payload);
      if (res.data.success) {
        navigate(`/orders/${res.data.data.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div>
        <Link to="/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Orders
        </Link>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create Bespoke Order</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Intake walk-in tailoring orders, capture body measurement snapshots, select styles, and record advance payment.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmitOrder} className="space-y-6">
        {/* Step 1: Customer Selection */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <User className="h-4 w-4 text-blue-600" />
              1. Customer Selection
            </div>
            {selectedCustomer && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                ✓ Existing Customer Selected
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Choose Registered Customer *</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  const cust = customers.find((c) => c.id === e.target.value);
                  if (cust) handleSelectCustomer(cust);
                }}
                className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs bg-white focus:border-blue-500 focus:outline-hidden"
                required
              >
                <option value="">-- Select Client from Directory --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.mobile}) - {c.customerId}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Need to add a new client first? <Link to="/customers" className="text-blue-600 font-semibold hover:underline">Add in Customer Directory</Link>
              </p>
            </div>

            {selectedCustomer ? (
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 text-xs flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-blue-900">{selectedCustomer.firstName} {selectedCustomer.lastName}</div>
                    <span className="font-mono text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                      {selectedCustomer.customerId}
                    </span>
                  </div>
                  <div className="text-[11px] text-blue-800 mt-1 flex flex-wrap gap-2">
                    <span>Phone: {selectedCustomer.mobile}</span>
                    {selectedCustomer.email && <span>• {selectedCustomer.email}</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selectedCustomer.address ? `${selectedCustomer.address}, ` : ''}{selectedCustomer.city || 'Bangalore'}
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-100 flex items-center justify-between text-[11px]">
                  <span className="text-blue-700 font-medium">
                    {selectedCustomer.measurements?.length || 0} saved measurement profile(s)
                  </span>
                  <a
                    href={`/customers/${selectedCustomer.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 font-bold hover:underline"
                  >
                    View Profile ↗
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 flex flex-col items-center justify-center">
                <User className="h-6 w-6 text-slate-400 mb-1" />
                <span>Select a client from the dropdown or URL to view measurements</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Garments & Historical Measurement Snapshots */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Scissors className="h-4 w-4 text-blue-600" />
              2. Garments & Historical Measurement Snapshots
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Another Garment
            </button>
          </div>

          {items.map((item, idx) => {
            const currentGarment = garmentTypes.find((g) => g.id === item.garmentTypeId);
            const savedProfileForGarment = selectedCustomer?.measurements?.find((m: any) => m.garmentTypeId === item.garmentTypeId);

            return (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-xs text-slate-800">Garment #{idx + 1}</span>
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-rose-600 hover:text-rose-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700">Garment Type *</label>
                    <select
                      value={item.garmentTypeId}
                      onChange={(e) => handleGarmentTypeChange(idx, e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white focus:border-blue-500 focus:outline-hidden"
                      required
                    >
                      <option value="">-- Choose Garment Type --</option>
                      {garmentTypes.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700">Base Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={item.itemPrice}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].itemPrice = Number(e.target.value);
                        setItems(updated);
                      }}
                      className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
                        setItems(updated);
                      }}
                      className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white font-semibold"
                    />
                  </div>
                </div>

                {/* Additional Charges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">Stitching Charge (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={item.stitchingCharge}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].stitchingCharge = Number(e.target.value);
                        setItems(updated);
                      }}
                      className="mt-1 block w-full rounded-lg border border-slate-300 py-1 px-2.5 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">Fabric Charge (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={item.fabricCharge}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].fabricCharge = Number(e.target.value);
                        setItems(updated);
                      }}
                      className="mt-1 block w-full rounded-lg border border-slate-300 py-1 px-2.5 text-xs bg-white"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-medium text-slate-600">Design / Style Cut</label>
                    <select
                      value={item.selectedStyleId}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].selectedStyleId = e.target.value;
                        setItems(updated);
                      }}
                      className="mt-1 block w-full rounded-lg border border-slate-300 py-1 px-2.5 text-xs bg-white"
                    >
                      <option value="">Default Classic Cut</option>
                      {availableStyles
                        .filter((s) => !item.garmentTypeId || s.garmentTypeId === item.garmentTypeId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.category})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Measurement Snapshot Section */}
                <div className="pt-2">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Ruler className="h-4 w-4 text-blue-600" />
                        <span>Measurement Snapshot for {currentGarment?.name || 'Garment'}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {savedProfileForGarment && (
                          <button
                            type="button"
                            onClick={() => handleApplySavedMeasurement(idx, savedProfileForGarment)}
                            className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 cursor-pointer"
                          >
                            ✓ Load Saved Profile (v{savedProfileForGarment.versions?.[0]?.versionNumber || 1})
                          </button>
                        )}
                        <select
                          value={item.unit}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[idx].unit = e.target.value;
                            setItems(updated);
                          }}
                          className="rounded border border-slate-300 py-0.5 px-2 text-[11px] font-semibold text-slate-700 bg-white"
                        >
                          <option value="INCHES">Inches (")</option>
                          <option value="CM">Centimeters (cm)</option>
                        </select>
                      </div>
                    </div>

                    {/* Measurement Key-Value Inputs */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      {Object.entries(item.measurementValues).map(([key, val]: any) => (
                        <div key={key} className="bg-slate-50/80 p-2 rounded-lg border border-slate-200">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {key}
                          </label>
                          <input
                            type="number"
                            step="0.25"
                            value={val}
                            onChange={(e) => handleUpdateMeasurementValue(idx, key, Number(e.target.value))}
                            className="w-full bg-white rounded border border-slate-200 py-1 px-1.5 text-xs font-bold text-center text-slate-900 focus:border-blue-500 focus:outline-hidden"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step 3: Pricing & Commercials */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b border-slate-100 pb-2.5">
            <CreditCard className="h-4 w-4 text-blue-600" />
            3. Commercial Pricing & Discounts
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Discount Type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs bg-white"
              >
                <option value="FIXED">Flat Amount (₹)</option>
                <option value="PERCENTAGE">Percentage (%)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Discount Value {discountType === 'FIXED' ? '(₹)' : '(%)'}
              </label>
              <input
                type="number"
                min={0}
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs bg-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">GST Rate (%)</label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
                className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs bg-white"
              >
                <option value={0}>0% (Exempt)</option>
                <option value={5}>5% (Standard Tailoring)</option>
                <option value={12}>12% (Bespoke Apparel)</option>
                <option value={18}>18% (Luxury Suits)</option>
              </select>
            </div>
          </div>

          {/* Pricing Summary Ribbon */}
          <div className="p-4 bg-slate-900 rounded-xl text-white text-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Gross Total</span>
              <span className="font-bold text-sm text-slate-200">{formatCurrency(itemsTotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div>
                <span className="text-rose-400 block text-[10px] uppercase font-bold">Discount</span>
                <span className="font-bold text-sm text-rose-300">-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            {gstAmount > 0 && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">GST</span>
                <span className="font-bold text-sm text-slate-200">+{formatCurrency(gstAmount)}</span>
              </div>
            )}
            <div className="border-l border-slate-800 pl-4">
              <span className="text-emerald-400 block text-[10px] uppercase font-bold">Net Total Amount</span>
              <span className="font-extrabold text-base text-emerald-300">{formatCurrency(netTotal)}</span>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-amber-400 block text-[10px] uppercase font-bold">Estimated Balance</span>
              <span className="font-extrabold text-base text-amber-300">{formatCurrency(balanceDue)}</span>
            </div>
          </div>
        </div>

        {/* Step 4: Delivery & Advance Payment */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b border-slate-100 pb-2.5">
            <Calendar className="h-4 w-4 text-blue-600" />
            4. Delivery Commitment & Advance Payment
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Delivery Commitment Date *</label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs bg-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs bg-white"
              >
                <option value="REGULAR">Regular Production</option>
                <option value="URGENT">URGENT (Express Delivery)</option>
              </select>
            </div>
          </div>

          {/* Advance Payment Details */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Advance Payment (Recorded at Intake)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Advance Amount (₹)</label>
                <input
                  type="number"
                  min={0}
                  max={netTotal}
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Payment Mode</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white font-medium"
                >
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Transaction / Reference #</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. UPI-12345678"
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Customer Instructions (Printed on Receipt)</label>
              <textarea
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Specific customer requests, fabric remarks..."
                className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Internal Workshop Notes (Staff Only)</label>
              <textarea
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Workshop reminders, tailor remarks..."
                className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs bg-white"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          <Link
            to="/orders"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Creating Bespoke Order...' : `Confirm & Book Order (${formatCurrency(netTotal)})`}
          </button>
        </div>
      </form>
    </div>
  );
};
