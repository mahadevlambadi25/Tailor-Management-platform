import React, { useState } from 'react';
import { api } from '../../api/client';
import { trackFunnelEvent } from '../../utils/funnel';
import { Modal } from '../common/Modal';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Check,
  AlertCircle,
  X,
  ArrowRight,
  Sparkles,
  PhoneCall,
  Info
} from 'lucide-react';

export interface CustomerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onImportSuccess?: () => void;
}

export const CustomerImportModal: React.FC<CustomerImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onImportSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'success'>('upload');
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    name: '',
    phone: '',
    notes: '',
    chest: '',
    waist: '',
    hip: '',
    length: '',
    shoulder: ''
  });
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Simple CSV Parser (handles comma & tab separated values)
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) throw new Error('File must contain at least a header row and 1 data row');

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const parsedHeaders = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
      const rowObj: Record<string, string> = {};
      parsedHeaders.forEach((h, idx) => {
        rowObj[h] = values[idx] || '';
      });
      rows.push(rowObj);
    }

    return { headers: parsedHeaders, rows };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { headers: parsedHeaders, rows } = parseCSV(text);
        setHeaders(parsedHeaders);
        setRawRows(rows);

        // Auto-match headers heuristically
        const autoMap: Record<string, string> = { ...mapping };
        parsedHeaders.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('name') && !autoMap.name) autoMap.name = h;
          if ((lower.includes('phone') || lower.includes('mobile')) && !autoMap.phone) autoMap.phone = h;
          if (lower.includes('note') && !autoMap.notes) autoMap.notes = h;
          if (lower.includes('chest') && !autoMap.chest) autoMap.chest = h;
          if (lower.includes('waist') && !autoMap.waist) autoMap.waist = h;
          if (lower.includes('hip') && !autoMap.hip) autoMap.hip = h;
          if (lower.includes('length') && !autoMap.length) autoMap.length = h;
          if (lower.includes('shoulder') && !autoMap.shoulder) autoMap.shoulder = h;
        });

        setMapping(autoMap);
        setStep('mapping');
      } catch (err: any) {
        setError(err.message || 'Unable to parse file. Please upload a standard CSV or Excel CSV file.');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const sampleCsv = `Name,Phone,Notes,Chest,Waist,Length\nRajesh Kumar,9876543210,Prefers 2-button classic suit,40,34,30\nSuresh Verma,9812345678,Single pleat trousers,38,32,29\nAnanya Sharma,9898989898,Silk blouse festive fit,36,30,15`;
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_customers_notebook.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProceedToPreview = async () => {
    if (!mapping.name || !mapping.phone) {
      setError('Please map both Name and Phone columns before proceeding.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.post('/conversion/import/preview', {
        rows: rawRows,
        columnMapping: mapping
      });

      if (res.data?.success) {
        setPreviewData(res.data.data);
        setStep('preview');
      } else {
        throw new Error(res.data?.error?.message || 'Failed to validate preview');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCommit = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post('/conversion/import/commit', {
        validRows: previewData.validRows
      });

      if (res.data?.success) {
        if (onSuccess) onSuccess();
        if (onImportSuccess) onImportSuccess();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to import customers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      className="rounded-3xl p-6 sm:p-8 border border-slate-100 space-y-6 max-h-[92vh] flex flex-col"
      ariaLabel="Customer Import"
    >
      <div className="w-full space-y-6 flex flex-col">
        
        {/* Modal Top Header */}
        <div className="flex items-start justify-between shrink-0 pb-2 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                <FileSpreadsheet className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Customer Import</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight mt-1">
              Move your notebook in, in two minutes.
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Upload the list you already have. We'll match the columns, you check the preview, done.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Upload File */}
        {step === 'upload' && (
          <div className="space-y-6 flex-1 overflow-y-auto">
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-blue-50/30 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    Click to browse or drop your CSV / Excel list here
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Supports .csv files exported from Excel, Google Sheets, or phone contacts
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download sample template (.csv)</span>
              </button>

              {/* Phone Contacts Import Placeholder */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200 cursor-not-allowed">
                <PhoneCall className="h-3.5 w-3.5" />
                <span>Phone contacts import</span>
                <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full ml-1">
                  Coming soon
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs text-blue-800">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0" />
                <span>Found {rawRows.length} rows. Match your column names below:</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[
                { field: 'name', label: 'Full Name *', required: true },
                { field: 'phone', label: 'Phone / Mobile *', required: true },
                { field: 'notes', label: 'Notes / Preferences', required: false },
                { field: 'chest', label: 'Chest Measurement', required: false },
                { field: 'waist', label: 'Waist Measurement', required: false },
                { field: 'hip', label: 'Hip Measurement', required: false },
                { field: 'length', label: 'Length Measurement', required: false },
                { field: 'shoulder', label: 'Shoulder Measurement', required: false }
              ].map(({ field, label, required }) => (
                <div key={field} className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    {label}
                  </label>
                  <select
                    value={mapping[field] || ''}
                    onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                    className={`w-full rounded-xl border py-2 px-3 text-xs bg-white text-slate-900 focus:outline-none ${
                      required && !mapping[field] ? 'border-amber-300' : 'border-slate-200'
                    }`}
                  >
                    <option value="">-- Choose column --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Back to upload
              </button>
              <button
                type="button"
                onClick={handleProceedToPreview}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
              >
                <span>Check Preview</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Preview First 10 Rows & Duplicate Detection */}
        {step === 'preview' && previewData && (
          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">Total in File</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{previewData.totalRows}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <div className="text-xs font-semibold">Ready to Import</div>
                <div className="text-lg font-bold mt-0.5">{previewData.validCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                <div className="text-xs font-semibold">Duplicates Skipped</div>
                <div className="text-lg font-bold mt-0.5">{previewData.duplicateCount || 0}</div>
              </div>
            </div>

            {/* Preview Table */}
            <div>
              <div className="text-xs font-bold text-slate-800 mb-2">
                Preview (First {previewData.previewRows.length} records):
              </div>
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-48 text-xs">
                <table className="w-full text-left divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">Notes</th>
                      <th className="py-2 px-3">Measurements</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewData.previewRows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{row.firstName} {row.lastName}</td>
                        <td className="py-2 px-3 text-slate-600">{row.mobile}</td>
                        <td className="py-2 px-3 text-slate-500 truncate max-w-[120px]">{row.notes || '-'}</td>
                        <td className="py-2 px-3 text-slate-500">
                          {row.measurements ? Object.entries(row.measurements).map(([k, v]) => `${k}:${v}`).join(', ') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Imported records are real customer profiles in your shop with full history support.</span>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Back to mapping
              </button>
              <button
                type="button"
                onClick={handleConfirmCommit}
                disabled={loading || previewData.validCount === 0}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
              >
                <span>{loading ? 'Importing...' : `Confirm & Import ${previewData.validCount} Customers`}</span>
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Success Message */}
        {step === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <Check className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-950">
                Customers imported successfully!
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Your notebook is safely digitized. All customer profiles, phone numbers, and measurements are ready in your shop.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-sm hover:bg-blue-700"
            >
              Done, view customers
            </button>
          </div>
        )}

      </div>
    </Modal>
  );
};
