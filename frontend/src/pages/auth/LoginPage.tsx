import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../api/client';
import { Scissors, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('owner@royalbespoke.com');
  const [password, setPassword] = useState('Password@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { tenantSlug, setTenantSlug } = useTenant();
  const navigate = useNavigate();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      localStorage.setItem('tailor_tenant_slug', tenantSlug);
      const res = await api.post(
        '/auth/login',
        { email, password, tenantSlug },
        { headers: { 'x-tenant-slug': tenantSlug } }
      );
      if (res.data.success) {
        login(res.data.data.token, res.data.data.user, res.data.data.permissions);
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else if (!err.response || err.response.status === 504 || err.response.status === 502 || typeof err.response.data === 'string') {
        setError('Cannot connect to backend server. Please verify your connection or ensure the backend service is running.');
      } else {
        setError(err.message || 'Login failed. Verify your email and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (userEmail: string, slug: string = 'royal-bespoke') => {
    setEmail(userEmail);
    setPassword('Password@123');
    setTenantSlug(slug);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/30 mb-4">
          <Scissors className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Tailor Management System</h2>
        <p className="mt-1 text-xs text-slate-400">Multi-Tenant SaaS Platform — V1 Core Operating System</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Shop Tenant Slug</label>
              <input
                type="text"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-blue-500 focus:outline-hidden"
                placeholder="e.g. royal-bespoke"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Staff Email Address</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  placeholder="name@tailorshop.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-hidden"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus:outline-hidden shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign in to Shop'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Test Accounts */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider text-center mb-3">
              Quick Test Accounts (Click to Fill)
            </p>
            <div className="grid grid-cols-2 gap-2 text-left">
              <button
                type="button"
                onClick={() => quickFill('owner@royalbespoke.com', 'royal-bespoke')}
                className="p-2 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-[11px] text-slate-700 transition-all"
              >
                <div className="font-bold text-slate-900">Shop Owner</div>
                <div className="text-[10px] text-slate-500">owner@royalbespoke.com</div>
              </button>
              <button
                type="button"
                onClick={() => quickFill('owner@demo-tailors.com', 'demo-tailors')}
                className="p-2 rounded-lg border border-emerald-300 bg-emerald-50/40 hover:border-emerald-500 hover:bg-emerald-50 text-[11px] text-slate-700 transition-all"
              >
                <div className="font-bold text-emerald-900 flex items-center gap-1">
                  <span>Demo Atelier</span>
                  <span className="text-[9px] bg-emerald-200 text-emerald-800 px-1 rounded-sm font-extrabold">NEW</span>
                </div>
                <div className="text-[10px] text-emerald-700">owner@demo-tailors.com</div>
              </button>
              <button
                type="button"
                onClick={() => quickFill('receptionist@royalbespoke.com', 'royal-bespoke')}
                className="p-2 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-[11px] text-slate-700 transition-all"
              >
                <div className="font-bold text-slate-900">Receptionist</div>
                <div className="text-[10px] text-slate-500">receptionist@royalbespoke.com</div>
              </button>
              <button
                type="button"
                onClick={() => quickFill('tailor@royalbespoke.com', 'royal-bespoke')}
                className="p-2 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-[11px] text-slate-700 transition-all"
              >
                <div className="font-bold text-slate-900">Master Tailor</div>
                <div className="text-[10px] text-slate-500">tailor@royalbespoke.com</div>
              </button>
            </div>
          </div>

          {/* Link to Customer Portal */}
          <div className="mt-6 text-center">
            <Link
              to="/customer-portal/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <ShieldCheck className="h-4 w-4" />
              Customer Self-Service OTP Portal →
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Server-enforced tenant isolation & bcrypt password encryption.
        </p>
      </div>
    </div>
  );
};
