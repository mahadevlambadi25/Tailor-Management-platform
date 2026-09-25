import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { api, API_BASE_URL } from '../../api/client';
import {
  Scissors,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface LoginPageProps {
  initialMode?: 'login' | 'register';
}

interface DemoAccount {
  name: string;
  role: string;
  email: string;
  slug: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Shop Owner',
    role: 'SHOP_OWNER',
    email: 'owner@royalbespoke.com',
    slug: 'royal-bespoke',
    description: 'Full atelier ownership, settings, billing & multi-branch control',
    badge: 'Owner Access',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  {
    name: 'Demo Atelier',
    role: 'SHOP_OWNER',
    email: 'owner@demo-tailors.com',
    slug: 'demo-tailors',
    description: 'Independent atelier tenant with fresh workshop data',
    badge: 'NEW ATELIER',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  {
    name: 'Receptionist',
    role: 'RECEPTIONIST',
    email: 'receptionist@royalbespoke.com',
    slug: 'royal-bespoke',
    description: 'Front-desk orders, client appointments & measurements',
    badge: 'Front Desk',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200'
  },
  {
    name: 'Master Tailor',
    role: 'TAILOR',
    email: 'tailor@royalbespoke.com',
    slug: 'royal-bespoke',
    description: 'Workshop production board, cutting & stitching tasks',
    badge: 'Workshop Floor',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
  }
];

export const LoginPage: React.FC<LoginPageProps> = ({ initialMode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { tenantSlug, setTenantSlug } = useTenant();

  // Mode state: 'login' | 'register'
  const isRegisterRoute = location.pathname === '/register' || initialMode === 'register';
  const [mode, setMode] = useState<'login' | 'register'>(isRegisterRoute ? 'register' : 'login');

  // Sub-tab in Login mode: 'credentials' | 'demo'
  const tabParam = searchParams.get('tab');
  const [loginSubTab, setLoginSubTab] = useState<'credentials' | 'demo'>(tabParam === 'demo' ? 'demo' : 'credentials');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [customSlug, setCustomSlug] = useState(tenantSlug || '');
  const [showAdvancedSlug, setShowAdvancedSlug] = useState(false);

  // Status & feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [signingInDemoRole, setSigningInDemoRole] = useState<string | null>(null);

  // Sync mode with route changes
  useEffect(() => {
    if (location.pathname === '/register') {
      setMode('register');
    } else if (location.pathname === '/login') {
      setMode('login');
      if (searchParams.get('tab') === 'demo') {
        setLoginSubTab('demo');
      }
    }
  }, [location.pathname, searchParams]);

  // Handle OAuth callback parameters (e.g. ?token=... or ?error=...)
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const slugParam = searchParams.get('slug');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      if (errorParam === 'GOOGLE_OAUTH_NOT_CONFIGURED') {
        setError('Google OAuth is not configured on this server. Please ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.');
      } else if (errorParam === 'TENANT_INACTIVE') {
        setError('Your atelier subscription is inactive or suspended.');
      } else if (errorParam === 'ACCOUNT_DEACTIVATED') {
        setError('Your account has been deactivated. Please contact your atelier administrator.');
      } else {
        setError(decodeURIComponent(errorParam));
      }
    }

    if (tokenParam) {
      setLoading(true);
      localStorage.setItem('tailor_token', tokenParam);
      if (slugParam) {
        localStorage.setItem('tailor_tenant_slug', slugParam);
        setTenantSlug(slugParam);
      }
      api.get('/auth/me', { headers: { Authorization: `Bearer ${tokenParam}` } })
        .then((res) => {
          if (res.data.success) {
            login(tokenParam, res.data.data.user, res.data.data.permissions || []);
            navigate('/dashboard');
          } else {
            setError('Failed to load user profile after Google authentication.');
          }
        })
        .catch((err) => {
          setError(err.response?.data?.error?.message || 'Google authentication verification failed.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [searchParams]);

  // Switch between Login and Register modes
  const handleSwitchMode = (targetMode: 'login' | 'register') => {
    setError('');
    setSuccessMsg('');
    setMode(targetMode);
    if (targetMode === 'register') {
      navigate('/register', { replace: false });
    } else {
      setLoginSubTab('credentials');
      navigate('/login', { replace: false });
    }
  };

  // Google OAuth initiation
  const handleGoogleAuth = () => {
    setError('');
    // Direct redirect to backend Google OAuth initiation route
    const base = API_BASE_URL.replace(/\/+$/, '');
    window.location.href = `${base}/auth/google`;
  };

  // Standard Email / Password Sign In
  const handleEmailLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const activeSlug = customSlug.trim() || undefined;
      const payload: any = {
        email: email.trim().toLowerCase(),
        password
      };
      if (activeSlug) {
        payload.tenantSlug = activeSlug;
      }

      const headers: any = {};
      if (activeSlug) {
        headers['x-tenant-slug'] = activeSlug;
      } else {
        // Explicitly clear header so backend auto-resolves tenant by user email
        headers['x-tenant-slug'] = '';
      }

      const res = await api.post('/auth/login', payload, { headers });
      if (res.data.success) {
        const resolvedSlug = res.data.data.user.tenant?.slug || activeSlug || 'royal-bespoke';
        localStorage.setItem('tailor_tenant_slug', resolvedSlug);
        setTenantSlug(resolvedSlug);
        login(res.data.data.token, res.data.data.user, res.data.data.permissions);
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else if (!err.response || err.response.status === 504 || err.response.status === 502) {
        setError('Cannot connect to backend server. Please verify your connection or ensure backend is running.');
      } else {
        setError(err.message || 'Login failed. Verify your email and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Demo Login
  const handleDemoLogin = async (demo: DemoAccount) => {
    setError('');
    setSuccessMsg('');
    setSigningInDemoRole(demo.name);
    setLoading(true);

    try {
      localStorage.setItem('tailor_tenant_slug', demo.slug);
      setTenantSlug(demo.slug);

      const res = await api.post(
        '/auth/login',
        {
          email: demo.email,
          password: 'Password@123',
          tenantSlug: demo.slug
        },
        {
          headers: { 'x-tenant-slug': demo.slug }
        }
      );

      if (res.data.success) {
        login(res.data.data.token, res.data.data.user, res.data.data.permissions);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || `Failed to sign in to demo account (${demo.name}).`);
    } finally {
      setLoading(false);
      setSigningInDemoRole(null);
    }
  };

  // User Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!password) {
      setError('Please enter a password');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword
      });

      if (res.data.success) {
        const userSlug = res.data.data.user.tenant?.slug || '';
        if (userSlug) {
          localStorage.setItem('tailor_tenant_slug', userSlug);
          setTenantSlug(userSlug);
        }
        login(res.data.data.token, res.data.data.user, res.data.data.permissions);
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError(err.message || 'Registration failed. Please check your information and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col justify-center py-10 sm:px-6 lg:px-8 selection:bg-blue-600 selection:text-white">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/25 mb-4 ring-4 ring-blue-500/20">
          <Scissors className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Tailor Management System</h1>
        <p className="mt-1 text-xs text-slate-400">Multi-Tenant SaaS Platform — Core Operating System</p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          
          {/* Card Title & Subtitle */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {mode === 'login'
                ? 'Enter your credentials or choose a demo atelier'
                : 'Start running your atelier with a 14-day free trial'}
            </p>
          </div>

          {/* Sub-Tabs for Login Mode (Sign In vs Demo Accounts) */}
          {mode === 'login' && (
            <div className="mb-5 flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                id="login-tab-credentials"
                onClick={() => setLoginSubTab('credentials')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  loginSubTab === 'credentials'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                id="login-tab-demo"
                onClick={() => setLoginSubTab('demo')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  loginSubTab === 'demo'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Demo Accounts</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full font-extrabold">4</span>
              </button>
            </div>
          )}

          {/* Alerts */}
          {error && (
            <div className="mb-4 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          {/* 1. LOGIN MODE - CREDENTIALS VIEW */}
          {mode === 'login' && loginSubTab === 'credentials' && (
            <div>
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Email</label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      id="login-email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all"
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
                      id="login-password-input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {/* Optional Custom Atelier Slug */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSlug(!showAdvancedSlug)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <span>{showAdvancedSlug ? 'Hide atelier ID' : 'Atelier ID / Tenant Slug (optional)'}</span>
                    {showAdvancedSlug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {showAdvancedSlug && (
                    <div className="mt-2 relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value)}
                        className="block w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-hidden"
                        placeholder="e.g. royal-bespoke (auto-detected if empty)"
                      />
                    </div>
                  )}
                </div>

                <button
                  id="login-submit-button"
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus:outline-hidden shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading && !signingInDemoRole ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider">
                    OR
                  </span>
                </div>
              </div>

              {/* Continue with Google */}
              <button
                id="google-login-button"
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs hover:border-slate-300 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Link to Register */}
              <div className="mt-5 text-center">
                <span className="text-xs text-slate-500">Don't have an account? </span>
                <button
                  id="go-to-register-link"
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Register
                </button>
              </div>

              {/* Quick Accordion for Demo Accounts */}
              <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                <button
                  type="button"
                  id="explore-demo-accounts-button"
                  onClick={() => setLoginSubTab('demo')}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-blue-600 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Looking for Demo Accounts? Click to View 4 Accounts →</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. LOGIN MODE - DEMO ACCOUNTS VIEW */}
          {mode === 'login' && loginSubTab === 'demo' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-800">4 Ready-to-Use Demo Accounts</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLoginSubTab('credentials')}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  ← Back to Email Sign In
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Click any demo option below to immediately log in and go to the dashboard:
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                {DEMO_ACCOUNTS.map((demo) => {
                  const isSigningInThis = signingInDemoRole === demo.name;
                  return (
                    <button
                      key={demo.email}
                      type="button"
                      id={`demo-account-${demo.role.toLowerCase()}`}
                      disabled={loading}
                      onClick={() => handleDemoLogin(demo)}
                      className={`text-left p-3 rounded-xl border transition-all relative overflow-hidden group cursor-pointer ${
                        demo.slug === 'demo-tailors'
                          ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-500'
                          : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                            {demo.name}
                          </span>
                          {demo.badge && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-extrabold border ${demo.badgeColor}`}>
                              {demo.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          {isSigningInThis ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <span>Log in</span>
                              <ArrowRight className="h-3 w-3" />
                            </>
                          )}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-600">{demo.email}</div>
                      <div className="mt-1 text-[10px] text-slate-500 leading-relaxed">{demo.description}</div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLoginSubTab('credentials')}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Use my own email and password instead
                </button>
              </div>
            </div>
          )}

          {/* 3. REGISTER MODE */}
          {mode === 'register' && (
            <div>
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Name</label>
                  <div className="relative mt-1">
                    <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      id="register-name-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all"
                      placeholder="e.g. Master Sartor"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Email</label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      id="register-email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all"
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
                      id="register-password-input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all"
                      placeholder="Minimum 6 characters"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Confirm Password</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      id="register-confirm-password-input"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all"
                      placeholder="Re-enter password"
                      required
                    />
                  </div>
                </div>

                <button
                  id="register-submit-button"
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus:outline-hidden shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Register</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider">
                    OR
                  </span>
                </div>
              </div>

              {/* Continue with Google */}
              <button
                id="google-register-button"
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs hover:border-slate-300 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Link to Login */}
              <div className="mt-5 text-center">
                <span className="text-xs text-slate-500">Already have an account? </span>
                <button
                  id="go-to-login-link"
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Login
                </button>
              </div>
            </div>
          )}

          {/* Link to Customer Self-Service OTP Portal */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link
              to="/portal/login"
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

export default LoginPage;
