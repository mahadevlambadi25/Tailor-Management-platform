import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Palette, Plus, Tag } from 'lucide-react';

export const StylesPage: React.FC = () => {
  const [styles, setStyles] = useState<any[]>([]);
  const [garments, setGarments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    garmentTypeId: '',
    name: '',
    category: 'Collar',
    description: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [styleRes, garmRes] = await Promise.all([
        api.get('/styles'),
        api.get('/garments')
      ]);
      if (styleRes.data.success) setStyles(styleRes.data.data);
      if (garmRes.data.success) {
        setGarments(garmRes.data.data);
        if (garmRes.data.data.length > 0) {
          setForm((prev) => ({ ...prev, garmentTypeId: garmRes.data.data[0].id }));
        }
      }
    } catch (e) {
      console.error('Failed to load styles', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/styles', form);
      if (res.data.success) {
        setShowModal(false);
        setForm({ garmentTypeId: garments[0]?.id || '', name: '', category: 'Collar', description: '', notes: '' });
        fetchData();
      }
    } catch (e) {
      alert('Failed to create style');
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
          <h1 className="text-xl font-bold text-slate-900">Style Library & Design Catalog</h1>
          <p className="text-xs text-slate-500">Reusable pattern cuts, collar types, cuffs, and client favourites.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
        >
          <Plus className="h-4 w-4" /> Add New Style
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {styles.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900">{s.name}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                {s.category}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Garment: <span className="font-semibold text-slate-700">{s.garmentType?.name}</span>
            </div>
            {s.description && <p className="text-xs text-slate-600 mt-2">{s.description}</p>}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Add Design / Style</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Garment Type</label>
                <select
                  value={form.garmentTypeId}
                  onChange={(e) => setForm({ ...form, garmentTypeId: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                >
                  {garments.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Style Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Cutaway Collar"
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                >
                  <option value="Collar">Collar</option>
                  <option value="Cuff">Cuff</option>
                  <option value="Pocket">Pocket</option>
                  <option value="Pleat">Pleat</option>
                  <option value="Lapel">Lapel</option>
                  <option value="Hem">Bottom Hem</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Save Style
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
