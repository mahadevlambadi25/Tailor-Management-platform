import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../api/client';
import { 
  Building2, Sliders, ShieldCheck, DollarSign, 
  Save, CheckCircle2, AlertCircle, RefreshCw, Layers,
  Crown, Sparkles
} from 'lucide-react';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { tenant, refreshTenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    defaultUnit: 'INCHES',
    orderPrefix: 'ORD',
    invoicePrefix: 'INV',
    gstRate: 5,
    taxInclusive: true,
    strictDelayPolicy: true,
    enableWhatsAppAlerts: true,
    enableSmsAlerts: false,
    enableAiSuggestions: false,
    enable3DScanPreview: false
  });

  useEffect(() => {
    if (tenant) {
      setFormData(prev => ({
        ...prev,
        name: tenant.name || '',
        slug: tenant.slug || '',
        phone: tenant.phone || '',
        email: tenant.email || '',
        address: tenant.address || '',
        gstin: tenant.gstNumber || '',
        defaultUnit: tenant.defaultUnit || 'INCHES',
        orderPrefix: (tenant.config as any)?.orderPrefix || 'ORD',
        invoicePrefix: (tenant.config as any)?.invoicePrefix || 'INV',
        gstRate: (tenant.config as any)?.gstRate ?? 5,
        taxInclusive: (tenant.config as any)?.taxInclusive ?? true,
        strictDelayPolicy: (tenant.config as any)?.strictDelayPolicy ?? true,
        enableWhatsAppAlerts: (tenant.config as any)?.enableWhatsAppAlerts ?? true,
        enableSmsAlerts: (tenant.config as any)?.enableSmsAlerts ?? false,
        enableAiSuggestions: (tenant.config as any)?.enableAiSuggestions ?? false,
        enable3DScanPreview: (tenant.config as any)?.enable3DScanPreview ?? false
      }));
    }
  }, [tenant]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        gstin: formData.gstin,
        config: {
          defaultUnit: formData.defaultUnit,
          orderPrefix: formData.orderPrefix,
          invoicePrefix: formData.invoicePrefix,
          gstRate: Number(formData.gstRate),
          taxInclusive: formData.taxInclusive,
          strictDelayPolicy: formData.strictDelayPolicy,
          enableWhatsAppAlerts: formData.enableWhatsAppAlerts,
          enableSmsAlerts: formData.enableSmsAlerts,
          enableAiSuggestions: formData.enableAiSuggestions,
          enable3DScanPreview: formData.enable3DScanPreview
        }
      };

      await api.put(`/tenants/${tenant?.id || 'current'}`, payload);
      setSuccessMsg('Tenant configurations successfully saved and updated in real-time!');
      await refreshTenant();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to update tenant config:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to save configurations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Atelier Settings & Preferences</h1>
          <p className="text-sm text-slate-500">Configure shop identity, subscription lifecycle, measurement standards, and flags.</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition shadow-sm disabled:opacity-50"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          <span>Save Configuration</span>
        </button>
      </div>

      {/* Status Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2 text-sm shadow-xs">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2 text-sm shadow-xs">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Subscription Section (Clean Production SaaS Experience) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-11 w-11 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <Crown size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Subscription</h2>
                <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full border ${
                  tenant?.subscription?.status === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {tenant?.subscription?.status === 'ACTIVE'
                    ? `${tenant.subscription.planName || 'ACTIVE'} PLAN`
                    : '14-DAY FREE TRIAL'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Current Plan: <span className="font-semibold text-white">{tenant?.subscription?.planName || 'FREE_TRIAL'}</span>
                {' • '}
                {tenant?.subscription?.status === 'ACTIVE'
                  ? 'All atelier features & capacity unlocked'
                  : "You're currently using your 14-day free trial."}
              </p>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => navigate('/subscription')}
              className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-xs tracking-wide shadow-md transition cursor-pointer"
            >
              <Sparkles size={15} />
              <span>{tenant?.subscription?.status === 'ACTIVE' ? 'Manage Subscription' : 'View Plans'}</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-xs text-slate-600 leading-relaxed">
            {tenant?.subscription?.status === 'ACTIVE'
              ? 'Your subscription is active and your atelier workspace is running in full production mode.'
              : 'Upgrade to a paid plan to continue using Tailor Management after your trial. All your real customer records, orders, and measurements will remain permanently intact.'}
          </p>
        </div>


      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Atelier Identity */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <Building2 className="text-amber-600" size={20} />
            <h2 className="text-base font-bold text-slate-800">Business Profile & Identity</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Atelier / Brand Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Unique Tenant Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                disabled
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Tenant subdomain slug is immutable.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Primary Phone / WhatsApp
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Official Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Studio Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                GSTIN / Tax Registration Number
              </label>
              <input
                type="text"
                value={formData.gstin}
                onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="29AAAAA0000A1Z5"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Operational & Measurement Units */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <Sliders className="text-amber-600" size={20} />
            <h2 className="text-base font-bold text-slate-800">Operational & Measurement Defaults</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Default Measurement Unit
              </label>
              <select
                value={formData.defaultUnit}
                onChange={e => setFormData({ ...formData, defaultUnit: e.target.value as 'INCHES' | 'CENTIMETERS' })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="INCHES">Inches (Standard Imperial)</option>
                <option value="CENTIMETERS">Centimeters (Metric cm)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Applied by default in measurement capture sheets.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Order Prefix
              </label>
              <input
                type="text"
                value={formData.orderPrefix}
                onChange={e => setFormData({ ...formData, orderPrefix: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">e.g. ORD-2026-0001</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Invoice Prefix
              </label>
              <input
                type="text"
                value={formData.invoicePrefix}
                onChange={e => setFormData({ ...formData, invoicePrefix: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">e.g. INV-2026-0001</p>
            </div>
          </div>
        </div>

        {/* Financial & Tax Rules */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <DollarSign className="text-amber-600" size={20} />
            <h2 className="text-base font-bold text-slate-800">Financial & Tax Policies</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Standard GST Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="28"
                step="0.5"
                value={formData.gstRate}
                onChange={e => setFormData({ ...formData, gstRate: Number(e.target.value) })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <p className="text-[11px] text-slate-400 mt-1">Applicable tailoring job-work tax rate (usually 5% or 12%).</p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div>
                <p className="text-sm font-semibold text-slate-800">Tax Inclusive Pricing</p>
                <p className="text-xs text-slate-500">When enabled, garment unit prices entered include GST.</p>
              </div>
              <input
                type="checkbox"
                checked={formData.taxInclusive}
                onChange={e => setFormData({ ...formData, taxInclusive: e.target.checked })}
                className="w-5 h-5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Governance & Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <ShieldCheck className="text-amber-600" size={20} />
            <h2 className="text-base font-bold text-slate-800">Quality Control & Communication Rules</h2>
          </div>

          <div className="space-y-3">
            <label className="flex items-start space-x-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.strictDelayPolicy}
                onChange={e => setFormData({ ...formData, strictDelayPolicy: e.target.checked })}
                className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800">Strict Delay Governance</p>
                <p className="text-xs text-slate-500">
                  Mandates entering a delay reason and a revised delivery date before any late production stage change can be saved.
                </p>
              </div>
            </label>

            <label className="flex items-start space-x-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enableWhatsAppAlerts}
                onChange={e => setFormData({ ...formData, enableWhatsAppAlerts: e.target.checked })}
                className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800">WhatsApp Notification Links</p>
                <p className="text-xs text-slate-500">
                  Generates 1-click wa.me action links on order confirmation, trial reminders, and ready notifications.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Future Capabilities / Feature Flags */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <Layers className="text-slate-400" size={20} />
            <h2 className="text-base font-bold text-slate-800">Next-Gen Feature Flags (Phase 3 Roadmap)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">AI Neckline & Lapel Design Generator</p>
                <p className="text-xs text-slate-400">Generative styling recommendations for clients.</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600 uppercase">
                Feature Flag
              </span>
            </div>

            <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">3D Body Mesh Scan Ingestion</p>
                <p className="text-xs text-slate-400">Direct integration with LIDAR measurement mobile sensors.</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600 uppercase">
                Feature Flag
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
