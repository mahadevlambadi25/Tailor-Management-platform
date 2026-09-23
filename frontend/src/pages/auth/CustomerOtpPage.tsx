import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../api/client';
import { Phone, KeyRound, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export const CustomerOtpPage: React.FC = () => {
  const [mobile, setMobile] = useState('9876543210');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'MOBILE' | 'OTP'>('MOBILE');
  const [serverMsg, setServerMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { tenantSlug } = useTenant();
  const navigate = useNavigate();

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/customer/request-otp', { mobile });
      if (res.data.success) {
        setStep('OTP');
        setServerMsg(res.data.data.message + (res.data.data.devOtp ? ` (Dev Code: ${res.data.data.devOtp})` : ''));
        if (res.data.data.devOtp) setOtp(res.data.data.devOtp);
      }
    } catch (err: any) {
      if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else if (!err.response || err.response.status === 504 || err.response.status === 502 || typeof err.response.data === 'string') {
        setError('Cannot connect to backend server. Please verify your connection or ensure the backend service is running.');
      } else {
        setError(err.message || 'Failed to send OTP.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/customer/verify-otp', { mobile, otp });
      if (res.data.success) {
        const c = res.data.data.customer;
        const customerUser = {
          id: c.id,
          customerId: c.customerId || c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          mobile: c.mobile,
          role: 'CUSTOMER',
          tenant: c.tenant
        };
        login(res.data.data.token, customerUser, ['portal:view']);
        navigate('/portal');
      }
    } catch (err: any) {
      if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else if (!err.response || err.response.status === 504 || err.response.status === 502 || typeof err.response.data === 'string') {
        setError('Cannot connect to backend server. Please verify your connection or ensure the backend service is running.');
      } else {
        setError(err.message || 'Invalid or expired OTP.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg mb-3">
          <Phone className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold text-white">Customer Self-Service Portal</h2>
        <p className="text-xs text-slate-400 mt-1">Check your orders, fitting trials, measurements and invoices.</p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-8 border border-slate-100">
          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
              {error}
            </div>
          )}
          {serverMsg && (
            <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
              {serverMsg}
            </div>
          )}

          {step === 'MOBILE' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Registered Mobile Number</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">+91</span>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 py-2 pl-12 pr-3 text-xs focus:border-blue-500 focus:outline-hidden"
                    placeholder="9876543210"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md transition-all disabled:opacity-50"
              >
                {loading ? 'Sending OTP...' : 'Send Verification OTP'}
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => { setMobile('9876543210'); }}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Quick Fill: Rajesh Kumar (9876543210)
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Enter 6-Digit OTP</label>
                <div className="relative mt-1">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm tracking-widest font-mono text-center focus:border-blue-500 focus:outline-hidden"
                    placeholder="123456"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify OTP & Enter Portal'}
                <CheckCircle2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setStep('MOBILE')}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-800"
              >
                Change mobile number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
