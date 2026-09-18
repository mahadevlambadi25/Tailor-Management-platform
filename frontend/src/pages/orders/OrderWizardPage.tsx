import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Plus, Trash2, Scissors, CheckCircle2, User, Ruler, Palette, IndianRupee, AlertCircle } from 'lucide-react';

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
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Multi-item Garment List
  const [items, setItems] = useState<any[]>([
    {
      garmentTypeId: '',
      itemPrice: 4000,
      stitchingCharge: 500,
      fabricCharge: 0,
      quantity: 1,
      measurementValues: { Chest: 40, Waist: 34, Neck: 16, Sleeve: 25, Shoulder: 18, Length: 30 },
      unit: 'INCHES',
      selectedStyleId: '',
      internalNotes: '',
      customerNotes: ''
    }
  ]);

  // Pricing & Commercials
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [discountValue, setDiscountValue] = useState<number>(500);
  const [gstRate, setGstRate] = useState<number>(0);
  const [isGstInclusive, setIsGstInclusive] = useState(false);

  // Delivery & Payment
  const [deliveryDate, setDeliveryDate] = useState('2026-09-20');
  const [priority, setPriority] = useState('REGULAR');
  const [advanceAmount, setAdvanceAmount] = useState<number>(3000);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentRef, setPaymentRef] = useState('UPI-987654321');
  const [internalNotes, setInternalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initial Load
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        setLoading(true);
        const [custRes, garmRes, styleRes] = await Promise.all([
          api.get('/customers?limit=50'),
          api.get('/garments'),
          api.get('/styles')
        ]);

        if (custRes.data.success) {
          setCustomers(custRes.data.data.customers);
          if (selectedCustomerId) {
            const found = custRes.data.data.customers.find((c: any) => c.id === selectedCustomerId);
            if (found) setSelectedCustomer(found);
          }
        }
        if (garmRes.data.success) {
          setGarmentTypes(garmRes.data.data);
          if (garmRes.data.data.length > 0) {
            // Default first item to Shirt
            const shirt = garmRes.data.data.find((g: any) => g.code === 'SHIRT') || garmRes.data.data[0];
            setItems((prev) => [{ ...prev[0], garmentTypeId: shirt.id }]);
          }
        }
        if (styleRes.data.success) {
          setAvailableStyles(styleRes.data.data);
        }
      } catch (e) {
        console.error('Failed to load order master data', e);
      } finally {
        setLoading(false);
      }
    };
    loadMasterData();
  }, []);

  // Update selected customer
  const handleSelectCustomer = (c: any) => {
    setSelectedCustomerId(c.id);
    setSelectedCustomer(c);
  };

  // Add Item to Order
  const handleAddItem = () => {
    const defaultGarment = garmentTypes[1] || garmentTypes[0];
    setItems([
      ...items,
      {
        garmentTypeId: defaultGarment ? defaultGarment.id : '',
        itemPrice: defaultGarment?.code === 'PANT' ? 3500 : 1500,
        stitchingCharge: 0,
        fabricCharge: 0,
        quantity: 1,
        measurementValues: defaultGarment?.code === 'PANT'
          ? { Waist: 34, Hip: 40, Inseam: 31, Outseam: 41, Thigh: 24, Bottom: 15 }
          : { Chest: 38, Waist: 32 },
        unit: 'INCHES',
        selectedStyleId: '',
        internalNotes: '',
        customerNotes: ''
      }
    ]);
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Calculate Subtotals & Net
  const itemsTotal = items.reduce((sum, item) => {
    const base = Number(item.itemPrice || 0) + Number(item.stitchingCharge || 0) + Number(item.fabricCharge || 0);
    return sum + base * (item.quantity || 1);
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
      setError('Delivery date is mandatory.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        deliveryDate: new Date(deliveryDate).toISOString(),
        priority,
        discountType,
        discountValue,
        gstRate,
        isGstInclusive,
        advancePayment: advanceAmount > 0 ? {
          amount: advanceAmount,
          paymentMethod,
          referenceNumber: paymentRef
        } : undefined,
        internalNotes,
        items: items.map((item) => ({
          garmentTypeId: item.garmentTypeId,
          itemPrice: item.itemPrice,
          stitchingCharge: item.stitchingCharge,
          fabricCharge: item.fabricCharge,
          quantity: item.quantity,
          measurementSnapshot: {
            valuesSnapshot: item.measurementValues,
            unit: item.unit
          },
          styleOptions: item.selectedStyleId ? [{ styleId: item.selectedStyleId }] : [],
          internalNotes: item.internalNotes,
          customerNotes: item.customerNotes
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
      <div>
        <h1 className="text-xl font-bold text-slate-900">Walk-in Customer & Order Wizard</h1>
        <p className="text-xs text-slate-500">Multi-item order intake, measurement snapshots, styles, and advance payments.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmitOrder} className="space-y-6">
        {/* Step 1: Customer Selection */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
            <User className="h-4 w-4 text-blue-600" />
            1. Customer Selection
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Choose Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  const cust = customers.find((c) => c.id === e.target.value);
                  handleSelectCustomer(cust);
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs"
                required
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.mobile}) - {c.customerId}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomer && (
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs">
                <div className="font-bold text-blue-900">{selectedCustomer.firstName} {selectedCustomer.lastName}</div>
                <div className="text-[11px] text-blue-700">Mobile: {selectedCustomer.mobile} ? ID: {selectedCustomer.customerId}</div>
                <div className="text-[11px] text-blue-600 mt-1">{selectedCustomer.address || 'Indiranagar, Bangalore'}</div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Garments & Measurement Snapshots */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Scissors className="h-4 w-4 text-blue-600" />
              2. Garments & Historical Measurement Snapshots
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
            >
              <Plus className="h-3.5 w-3.5" /> Add Another Garment
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">Garment #{idx + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-rose-600 hover:text-rose-800 text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700">Garment Type</label>
                  <select
                    value={item.garmentTypeId}
                    onChange={(e) => {
                      const g = garmentTypes.find((gt) => gt.id === e.target.value);
                      const updated = [...items];
                      updated[idx].garmentTypeId = e.target.value;
                      if (g?.code === 'PANT') {
                        updated[idx].itemPrice = 3500;
                        updated[idx].measurementValues = { Waist: 34, Hip: 40, Inseam: 31, Outseam: 41, Thigh: 24, Bottom: 15 };
                      } else {
                        updated[idx].itemPrice = 4000;
                        updated[idx].measurementValues = { Chest: 40, Waist: 34, Neck: 16, Sleeve: 25, Shoulder: 18, Length: 30 };
                      }
                      setItems(updated);
                    }}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                  >
                    {garmentTypes.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Item Price (?)</label>
                  <input
                    type="number"
                    value={item.itemPrice}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].itemPrice = Number(e.target.value);
                      setItems(updated);
                    }}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Stitching Charge (?)</label>
                  <input
                    type="number"
                    value={item.stitchingCharge}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].stitchingCharge = Number(e.target.value);
                      setItems(updated);
                    }}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Measurement Snapshot Inputs */}
              <div>
                <span className="block text-[11px] font-bold text-slate-700 mb-1">
                  Measurement Snapshot Values (Inches)
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-white p-3 rounded-lg border border-slate-200">
                  {Object.entries(item.measurementValues).map(([k, v]: any) => (
                    <div key={k}>
                      <label className="block text-[10px] text-slate-400 font-medium">{k}</label>
                      <input
                        type="number"
                        step="0.25"
                        value={v}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].measurementValues[k] = Number(e.target.value);
                          setItems(updated);
                        }}
                        className="mt-0.5 block w-full rounded border border-slate-300 py-1 px-1.5 text-xs text-center font-bold"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Style Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Design / Style Option</label>
                  <select
                    value={item.selectedStyleId}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].selectedStyleId = e.target.value;
                      setItems(updated);
                    }}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                  >
                    <option value="">Default Classic Style</option>
                    {availableStyles.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Garment Note</label>
                  <input
                    type="text"
                    value={item.internalNotes}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].internalNotes = e.target.value;
                      setItems(updated);
                    }}
                    placeholder="e.g. Double stitch, horn buttons"
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Step 3: Pricing, Discount & GST Reconciliation */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
            <IndianRupee className="h-4 w-4 text-blue-600" />
            3. Pricing & Financial Reconciliation
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Discount Amount (?)</label>
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">GST Rate (%)</label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
                className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs"
              >
                <option value={0}>0% (Tax Exempt / Non-GST)</option>
                <option value={5}>5% GST</option>
                <option value={12}>12% GST</option>
                <option value={18}>18% GST</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Delivery Date *</label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs"
              />
            </div>
          </div>

          {/* Advance Payment Details */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Advance Payment (?)</label>
              <input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Payment Mode</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
              >
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Debit / Credit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Reference / Transaction #</label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
              />
            </div>
          </div>

          {/* Commercial Reconciliation Breakdown Box */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
            <div className="space-y-1">
              <div>Total Garments Price: <span className="font-bold">?{itemsTotal.toLocaleString()}</span></div>
              <div>Discount: <span className="font-bold text-rose-600">-?{discountAmount.toLocaleString()}</span></div>
              <div>Net Total: <span className="font-bold text-blue-900">?{netTotal.toLocaleString()}</span></div>
            </div>
            <div className="sm:text-right space-y-1">
              <div>Advance Received: <span className="font-bold text-emerald-700">?{Number(advanceAmount).toLocaleString()}</span></div>
              <div className="text-sm font-bold text-rose-600">
                Balance Due: ?{balanceDue.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {submitting ? 'Confirming Booking...' : 'Book Order & Print Receipt'}
          </button>
        </div>
      </form>
    </div>
  );
};
