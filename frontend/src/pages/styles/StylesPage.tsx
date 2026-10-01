import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Scissors, Palette, Plus, Tag, AlertCircle, CheckCircle2, ChevronRight, Layers, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { Modal } from '../../components/common/Modal';

export const StylesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'garments' ? 'garments' : 'styles';

  const [activeTab, setActiveTab] = useState<'garments' | 'styles'>(initialTab);
  const [styles, setStyles] = useState<any[]>([]);
  const [garments, setGarments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGarmentId, setFilterGarmentId] = useState<string>('ALL');

  // Modals
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [showGarmentModal, setShowGarmentModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Style Form
  const [styleForm, setStyleForm] = useState({
    garmentTypeId: '',
    name: '',
    category: 'Collar',
    description: '',
    notes: ''
  });

  // Garment Form
  const [garmentForm, setGarmentForm] = useState({
    name: '',
    code: '',
    category: 'Men',
    defaultPrice: 1500
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [styleRes, garmRes] = await Promise.all([
        api.get('/styles'),
        api.get('/garments')
      ]);

      let loadedGarments: any[] = [];
      if (garmRes.data.success) {
        loadedGarments = garmRes.data.data;
        setGarments(loadedGarments);
        if (loadedGarments.length > 0 && !styleForm.garmentTypeId) {
          setStyleForm((prev) => ({ ...prev, garmentTypeId: loadedGarments[0].id }));
        }
      }

      if (styleRes.data.success) {
        setStyles(styleRes.data.data);
      }
    } catch (e: any) {
      console.error('Failed to load styles and garments', e);
      setErrorMsg(e.response?.data?.error?.message || 'Unable to load catalog data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTabChange = (tab: 'garments' | 'styles') => {
    setActiveTab(tab);
    setSearchParams(tab === 'garments' ? { tab: 'garments' } : {});
  };

  // Create Style Cut
  const handleCreateStyle = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      const res = await api.post('/styles', styleForm);
      if (res.data.success) {
        setShowStyleModal(false);
        setStyleForm({
          garmentTypeId: garments[0]?.id || '',
          name: '',
          category: 'Collar',
          description: '',
          notes: ''
        });
        setSuccessMsg('Style cut added successfully.');
        setTimeout(() => setSuccessMsg(''), 3000);
        await fetchData();
      }
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error?.message || 'Failed to create style cut.');
    } finally {
      setSaving(false);
    }
  };

  // Create Garment Type
  const handleCreateGarment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      const res = await api.post('/garments', garmentForm);
      if (res.data.success) {
        setShowGarmentModal(false);
        setGarmentForm({
          name: '',
          code: '',
          category: 'Men',
          defaultPrice: 1500
        });
        setSuccessMsg('Garment type added successfully.');
        setTimeout(() => setSuccessMsg(''), 3000);
        await fetchData();
      }
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error?.message || 'Failed to create garment type.');
    } finally {
      setSaving(false);
    }
  };

  const filteredStyles = filterGarmentId === 'ALL'
    ? styles
    : styles.filter((s) => s.garmentTypeId === filterGarmentId);

  if (loading && garments.length === 0 && styles.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-xs text-slate-500 font-medium">Loading catalog master data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Garment Types & Style Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure atelier garment categories, base pricing, pattern cuts, collar types, and styles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'garments' ? (
            <button
              onClick={() => {
                setErrorMsg('');
                setShowGarmentModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Garment Type
            </button>
          ) : (
            <button
              onClick={() => {
                setErrorMsg('');
                setShowStyleModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add New Style Cut
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => handleTabChange('garments')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'garments'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scissors className="h-4 w-4" />
          <span>Garment Types</span>
          <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-bold">
            {garments.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('styles')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'styles'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Palette className="h-4 w-4" />
          <span>Designs & Style Cuts</span>
          <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-bold">
            {styles.length}
          </span>
        </button>
      </div>

      {/* TAB 1: GARMENT TYPES */}
      {activeTab === 'garments' && (
        <div className="space-y-4">
          {garments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Scissors className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-900">No garment types configured yet</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Set up categories and base pricing for the garments you tailor (e.g. Shirts, Pants, Suits, Kurtas) to start taking walk-in orders.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowGarmentModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add Garment Type
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {garments.map((g) => {
                const associatedStyles = styles.filter((s) => s.garmentTypeId === g.id);
                return (
                  <div
                    key={g.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-sm text-slate-900 leading-tight">{g.name}</span>
                        <span className="rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-bold font-mono">
                          {g.code}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                          {g.category}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Base: {formatCurrency(Number(g.defaultPrice) || 0)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">
                        {associatedStyles.length} style {associatedStyles.length === 1 ? 'cut' : 'cuts'}
                      </span>
                      <button
                        onClick={() => {
                          setFilterGarmentId(g.id);
                          handleTabChange('styles');
                        }}
                        className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold flex items-center gap-0.5 cursor-pointer"
                      >
                        View Styles <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STYLES & CUTS */}
      {activeTab === 'styles' && (
        <div className="space-y-4">
          {/* Garment Type Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Filter by Garment:
            </span>
            <button
              onClick={() => setFilterGarmentId('ALL')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                filterGarmentId === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Garments ({styles.length})
            </button>
            {garments.map((g) => {
              const count = styles.filter((s) => s.garmentTypeId === g.id).length;
              return (
                <button
                  key={g.id}
                  onClick={() => setFilterGarmentId(g.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                    filterGarmentId === g.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {g.name} ({count})
                </button>
              );
            })}
          </div>

          {filteredStyles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Palette className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-900">No styles configured for this selection</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Add customizable cuts, collar varieties, lapels, pleats, and finishes.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowStyleModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add New Style Cut
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredStyles.map((s) => (
                <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900">{s.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 flex-shrink-0">
                      {s.category}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500">
                    Garment: <span className="font-semibold text-slate-800">{s.garmentType?.name || 'General'}</span>
                  </div>

                  {s.description && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {s.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD GARMENT TYPE */}
      <Modal
        isOpen={showGarmentModal}
        onClose={() => setShowGarmentModal(false)}
        maxWidth="max-w-md"
        className="rounded-2xl p-6 space-y-4"
        ariaLabel="Add Garment Type"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Scissors className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Add Garment Type</h2>
                  <p className="text-[11px] text-slate-500">Add a new tailored garment to your atelier catalog</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateGarment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Garment Name *</label>
                <input
                  type="text"
                  required
                  value={garmentForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 10);
                    setGarmentForm({ ...garmentForm, name, code: garmentForm.code ? garmentForm.code : code });
                  }}
                  placeholder="e.g. Wedding Sherwani or Casual Chinos"
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Category *</label>
                  <select
                    value={garmentForm.category}
                    onChange={(e) => setGarmentForm({ ...garmentForm, category: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                  >
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                    <option value="Kids">Kids</option>
                    <option value="Unisex">Unisex</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Catalog Code</label>
                  <input
                    type="text"
                    value={garmentForm.code}
                    onChange={(e) => setGarmentForm({ ...garmentForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SHERWANI"
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Default Base Price (₹) *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={garmentForm.defaultPrice}
                  onChange={(e) => setGarmentForm({ ...garmentForm, defaultPrice: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  This base price auto-populates in the New Walk-in Order wizard when this garment is chosen.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowGarmentModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm cursor-pointer"
                >
                  {saving ? 'Creating...' : 'Create Garment Type'}
                </button>
              </div>
            </form>
      </Modal>

      {/* MODAL: ADD STYLE CUT */}
      <Modal
        isOpen={showStyleModal}
        onClose={() => setShowStyleModal(false)}
        maxWidth="max-w-md"
        className="rounded-2xl p-6 space-y-4"
        ariaLabel="Add Design / Style Cut"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Add Design / Style Cut</h2>
                  <p className="text-[11px] text-slate-500">Add customizable cuts, collar styles, or cuffs</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateStyle} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Garment Type *</label>
                <select
                  value={styleForm.garmentTypeId}
                  onChange={(e) => setStyleForm({ ...styleForm, garmentTypeId: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                  required
                >
                  {garments.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Style Cut Name *</label>
                <input
                  type="text"
                  required
                  value={styleForm.name}
                  onChange={(e) => setStyleForm({ ...styleForm, name: e.target.value })}
                  placeholder="e.g. Cutaway Collar or Slim Fit Cut"
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Category *</label>
                <select
                  value={styleForm.category}
                  onChange={(e) => setStyleForm({ ...styleForm, category: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                >
                  <option value="Collar">Collar</option>
                  <option value="Cuff">Cuff</option>
                  <option value="Pocket">Pocket</option>
                  <option value="Pleat">Pleat</option>
                  <option value="Lapel">Lapel</option>
                  <option value="Vent">Vent</option>
                  <option value="Hem">Bottom Hem</option>
                  <option value="Pattern">Pattern / Cut</option>
                  <option value="Fit">Fit / Silhouette</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={styleForm.description}
                  onChange={(e) => setStyleForm({ ...styleForm, description: e.target.value })}
                  placeholder="Details about this style cut..."
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowStyleModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Style Cut'}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
};
export default StylesPage;
