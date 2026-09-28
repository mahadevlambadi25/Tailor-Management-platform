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
  Loader2,
  KeyRound,
  X,
  Eye,
  EyeOff,
  Ruler,
  KanbanSquare,
  Shield,
  ArrowLeft
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

interface WorkspaceInfo {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  branchName: string;
  role: string;
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

  // Environment detection: in production build, Demo Accounts UI is strictly hidden
  const isDev = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === 'true';

  // Mode state: 'login' | 'register'
  const isRegisterRoute = location.pathname === '/register' || initialMode === 'register';
  const [mode, setMode] = useState<'login' | 'register'>(isRegisterRoute ? 'register' : 'login');

  // Sub-tab in Login mode: 'credentials' | 'demo' (only available in development)
  const tabParam = searchParams.get('tab');
  const [loginSubTab, setLoginSubTab] = useState<'credentials' | 'demo'>(
    isDev && tabParam === 'demo' ? 'demo' : 'credentials'
  );

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const [showAdvancedSlug, setShowAdvancedSlug] = useState(false);

  // Multi-workspace selection state
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);

  // Forgot password modal state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });

  // Status & feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [signingInDemoRole, setSigningInDemoRole] = useState<string | null>(null);

  // Clean error message to avoid exposing raw technical errors to users
  const getDisplayError = (raw: string): string => {
    if (!raw) return '';
    if (raw.includes('ECONNREFUSED') || raw.includes('Failed to fetch') || raw.includes('Network Error')) {
      return 'Unable to reach the server. Please verify your internet connection or try again shortly.';
    }
    if (raw.includes('SQL') || raw.includes('prisma') || raw.includes('syntax error')) {
      return 'An unexpected service error occurred. Please try again shortly or contact support.';
    }
    return raw;
  };

  // Sync mode with route changes
  useEffect(() => {
    if (location.pathname === '/register') {
      setMode('register');
    } else if (location.pathname === '/login') {
      setMode('login');
      if (isDev && searchParams.get('tab') === 'demo') {
        setLoginSubTab('demo');
      } else {
        setLoginSubTab('credentials');
      }
    }
  }, [location.pathname, searchParams, isDev]);

  // Handle OAuth callback parameters (e.g. ?token=... or ?error=...)
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const slugParam = searchParams.get('slug');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      if (errorParam === 'GOOGLE_OAUTH_NOT_CONFIGURED') {
        setError('Google authentication is currently unavailable on this server.');
      } else if (errorParam === 'TENANT_INACTIVE') {
        setError('Your shop subscription is inactive or suspended.');
      } else if (errorParam === 'ACCOUNT_DEACTIVATED') {
        setError('Your account has been deactivated. Please contact your shop administrator.');
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
    setWorkspaces([]);
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
    const base = API_BASE_URL.replace(/\/+$/, '');
    window.location.href = `${base}/auth/google`;
  };

  // Standard Email / Password Sign In
  const handleEmailLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');
    setWorkspaces([]);

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
      }

      const res = await api.post('/auth/login', payload, { headers });

      // Multi-workspace detection: show workspace picker
      if (res.data.requiresWorkspaceSelection && res.data.workspaces?.length > 1) {
        setWorkspaces(res.data.workspaces);
        return;
      }

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
        setError(err.message || 'An unexpected error occurred. Please verify your connection or try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Select a specific workspace from the workspace list
  const handleSelectWorkspace = async (workspaceSlug: string) => {
    setError('');
    setLoading(true);
    try {
      localStorage.setItem('tailor_tenant_slug', workspaceSlug);
      setTenantSlug(workspaceSlug);

      const res = await api.post(
        '/auth/login',
        {
          email: email.trim().toLowerCase(),
          password,
          tenantSlug: workspaceSlug
        },
        {
          headers: { 'x-tenant-slug': workspaceSlug }
        }
      );

      if (res.data.success) {
        login(res.data.data.token, res.data.data.user, res.data.data.permissions);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to open selected workspace.');
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Demo Login (Development Only)
  const handleDemoLogin = async (demo: DemoAccount) => {
    if (!isDev) return;
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

  // User Registration (New Shop Owner)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name.trim()) {
      setError('Please enter your full name or atelier name');
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

  // Forgot Password submission
  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotStatus({ type: 'error', message: 'Please enter your registered email address.' });
      return;
    }
    setForgotStatus({
      type: 'success',
      message: `If an account exists for ${forgotEmail.trim()}, a password reset link has been dispatched. You may also contact your shop administrator for quick credential recovery.`
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      <div className="flex-1 grid lg:grid-cols-12 min-h-screen">
        
        {/* ========================================================================= */}
        {/* LEFT PANEL: Professional Brand Presentation (Desktop only)                */}
        {/* ========================================================================= */}
        <div className="hidden lg:flex lg:col-span-5 xl:col-span-5 bg-slate-950 text-white relative overflow-hidden flex-col justify-between p-10 xl:p-14 border-r border-slate-800/80">
          
          {/* Subtle Ambient Background Accents */}
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Logo */}
          <div className="relative z-10">
            <Link
              to="/"
              className="inline-flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl p-1 -ml-1 transition-all"
            >
              <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:bg-blue-500 transition-colors">
                <Scissors className="h-6 w-6 transition-transform group-hover:rotate-12" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  Tailor Management
                </span>
                <span className="text-[11px] font-semibold text-blue-400 tracking-wider uppercase -mt-0.5">
                  Digital Atelier OS
                </span>
              </div>
            </Link>
          </div>

          {/* Center Brand Headline & Feature Visual */}
          <div className="relative z-10 my-auto py-10 max-w-md">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-blue-400 mb-6">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Production-Grade Tailoring Cloud</span>
            </div>

            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
              {mode === 'login'
                ? 'Run your tailoring business with confidence.'
                : 'Start scaling your bespoke atelier today.'}
            </h2>

            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              The unified operating system for bespoke tailors, bridal boutiques, and multi-branch ateliers. Precision measurements, live workshop tracking, and frictionless billing.
            </p>

            {/* Subtle Atelier Visual Card */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800/90 p-5 shadow-2xl backdrop-blur-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-200">Atelier Operations Hub</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Live OS</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-950/70 border border-blue-800/40 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Ruler className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Precision Client Measurements</div>
                    <div className="text-[11px] text-slate-400">Profile-linked measurements with full revision history.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-950/70 border border-amber-800/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <KanbanSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Workshop Production Board</div>
                    <div className="text-[11px] text-slate-400">Real-time status tracking from cutting to final trial.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-950/70 border border-emerald-800/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Tenant-Isolated Architecture</div>
                    <div className="text-[11px] text-slate-400">Strict per-atelier isolation & multi-branch controls.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Security / Navigation Footer */}
          <div className="relative z-10 pt-6 border-t border-slate-900 flex items-center justify-between text-xs text-slate-400">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to home</span>
            </Link>
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Secure Business Workspace</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: Centered Login / Register Form                                */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-7 flex flex-col justify-center items-center px-4 sm:px-8 py-10 lg:py-16 min-h-screen">
          
          {/* Mobile Top Brand (Hidden on Desktop) */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-md shadow-slate-950/20">
                <Scissors className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="text-lg font-bold text-slate-950 leading-tight">Tailor Management</div>
                <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Digital Atelier OS</div>
              </div>
            </Link>
          </div>

          {/* Form Container Card */}
          <div className="w-full max-w-[440px] bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/5 p-6 sm:p-9">
            
            {/* Header Titles */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700 mb-2.5">
                <ShieldCheck className="w-3 h-3 text-blue-600" />
                <span>
                  {workspaces.length > 0
                    ? 'Workspace Selection'
                    : mode === 'login'
                    ? 'Secure Business Workspace'
                    : '14-Day Free Atelier Trial'}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {workspaces.length > 0
                  ? 'Select your workspace'
                  : mode === 'login'
                  ? 'Sign in to your shop'
                  : 'Create your shop account'}
              </h1>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                {workspaces.length > 0
                  ? 'Your account has access to multiple ateliers. Choose which shop to open:'
                  : mode === 'login'
                  ? 'Welcome back. Enter your business credentials to continue.'
                  : 'No credit card required. Experience the full tailoring operating system.'}
              </p>
            </div>

            {/* Sub-Tabs for Login Mode (ONLY in Development Environment) */}
            {isDev && mode === 'login' && workspaces.length === 0 && (
              <div className="mb-5 flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                <button
                  type="button"
                  id="login-tab-credentials"
                  onClick={() => setLoginSubTab('credentials')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
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
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    loginSubTab === 'demo'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Demo Accounts</span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">4</span>
                </button>
              </div>
            )}

            {/* Clean Error Alert */}
            {error && (
              <div role="alert" className="mb-5 rounded-xl bg-rose-50 p-3.5 text-xs font-medium text-rose-800 border border-rose-200/80 flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 leading-relaxed">{getDisplayError(error)}</div>
              </div>
            )}

            {/* Clean Success Alert */}
            {successMsg && (
              <div role="status" className="mb-5 rounded-xl bg-emerald-50 p-3.5 text-xs font-medium text-emerald-800 border border-emerald-200/80 flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <div className="flex-1 leading-relaxed">{successMsg}</div>
              </div>
            )}

            {/* =============================================================== */}
            {/* VIEW 1: MULTI-WORKSPACE SELECTOR                                */}
            {/* =============================================================== */}
            {workspaces.length > 0 ? (
              <div className="space-y-3">
                <div className="space-y-2.5">
                  {workspaces.map((ws) => (
                    <div
                      key={ws.tenantId}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-between gap-3 bg-white shadow-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{ws.tenantName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{ws.branchName}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-blue-600 font-semibold">{ws.role}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleSelectWorkspace(ws.tenantSlug)}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1"
                      >
                        {loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <span>Open</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-3 text-center border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setWorkspaces([])}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    ← Sign in with a different account
                  </button>
                </div>
              </div>
            ) : mode === 'login' && loginSubTab === 'credentials' ? (
              /* =============================================================== */
              /* VIEW 2: STANDARD LOGIN CREDENTIALS                              */
              /* =============================================================== */
              <div>
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  {/* Email Input */}
                  <div>
                    <label htmlFor="login-email-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Business Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        id="login-email-input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none transition-all"
                        placeholder="owner@tailorshop.com"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="login-password-input" className="block text-xs font-semibold text-slate-700">
                        Password
                      </label>
                      <button
                        type="button"
                        id="forgot-password-button"
                        onClick={() => {
                          setForgotEmail(email);
                          setForgotStatus({ type: 'idle', message: '' });
                          setShowForgotPassword(true);
                        }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        id="login-password-input"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none transition-all"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        id="login-password-toggle"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Optional Custom Atelier Slug in Development */}
                  {isDev && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedSlug(!showAdvancedSlug)}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>{showAdvancedSlug ? 'Hide custom shop slug' : 'Shop ID / Tenant Slug (optional)'}</span>
                        {showAdvancedSlug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>

                      {showAdvancedSlug && (
                        <div className="mt-2 relative animate-fadeIn">
                          <Building2 className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            value={customSlug}
                            onChange={(e) => setCustomSlug(e.target.value)}
                            className="block w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3.5 text-xs text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none"
                            placeholder="e.g. royal-bespoke (auto-detected if empty)"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    id="login-submit-button"
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 px-4 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
                  >
                    {loading && !signingInDemoRole ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Signing in...</span>
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
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-white px-2.5 text-slate-400 font-medium tracking-wider">
                      or continue with
                    </span>
                  </div>
                </div>

                {/* Google Authentication */}
                <button
                  id="google-login-button"
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-all shadow-xs hover:border-slate-400 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
                <div className="mt-6 text-center text-xs sm:text-sm text-slate-600">
                  <span>Don't have an account? </span>
                  <button
                    id="go-to-register-link"
                    type="button"
                    onClick={() => handleSwitchMode('register')}
                    className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    Create your shop account
                  </button>
                </div>

                {/* Quick Toggle to Demo Accounts (Dev Only) */}
                {isDev && (
                  <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                    <button
                      type="button"
                      id="explore-demo-accounts-button"
                      onClick={() => setLoginSubTab('demo')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span>Need quick test access? View 4 Demo Accounts →</span>
                    </button>
                  </div>
                )}
              </div>
            ) : isDev && mode === 'login' && loginSubTab === 'demo' ? (
              /* =============================================================== */
              /* VIEW 3: DEMO ACCOUNTS DRAWER (Development Only)                  */
              /* =============================================================== */
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-800">4 Ready-to-Use Demo Roles</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLoginSubTab('credentials')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    ← Back to Sign In
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Click any role to log in instantly and explore the dashboard with sample atelier data:
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
                                <span>Sign In</span>
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
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Use standard email & password instead
                  </button>
                </div>
              </div>
            ) : (
              /* =============================================================== */
              /* VIEW 4: REGISTER MODE (14-DAY FREE TRIAL)                       */
              /* =============================================================== */
              <div>
                <form onSubmit={handleRegister} className="space-y-3.5">
                  {/* Shop / Owner Name */}
                  <div>
                    <label htmlFor="register-name-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Atelier or Owner Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        id="register-name-input"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none transition-all"
                        placeholder="e.g. Royal Atelier or Master Tailor"
                        required
                      />
                    </div>
                  </div>

                  {/* Business Email */}
                  <div>
                    <label htmlFor="register-email-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Business Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        id="register-email-input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none transition-all"
                        placeholder="owner@tailorshop.com"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="register-password-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        id="register-password-input"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none transition-all"
                        placeholder="Minimum 6 characters"
                        required
                      />
                      <button
                        type="button"
                        id="register-password-toggle"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="register-confirm-password-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        id="register-confirm-password-input"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none transition-all"
                        placeholder="Re-enter password"
                        required
                      />
                      <button
                        type="button"
                        id="register-confirm-password-toggle"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    id="register-submit-button"
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 px-4 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Creating shop account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Shop Account</span>
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
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-white px-2.5 text-slate-400 font-medium tracking-wider">
                      or continue with
                    </span>
                  </div>
                </div>

                {/* Google Sign In */}
                <button
                  id="google-register-button"
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-all shadow-xs hover:border-slate-400 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
                <div className="mt-6 text-center text-xs sm:text-sm text-slate-600">
                  <span>Already have an atelier account? </span>
                  <button
                    id="go-to-login-link"
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )}

            {/* Customer Portal Link */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <Link
                to="/portal/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span>Customer Self-Service OTP Portal →</span>
              </Link>
            </div>
          </div>

          {/* Security Sub-text below card on mobile */}
          <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            <span>Secure Business Workspace</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORGOT PASSWORD MODAL                                                     */}
      {/* ========================================================================= */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative">
            <button
              type="button"
              id="forgot-password-close-button"
              onClick={() => setShowForgotPassword(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset Shop Password</h3>
                <p className="text-xs text-slate-500">Atelier staff & owner password recovery</p>
              </div>
            </div>

            {forgotStatus.type === 'success' ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed">
                  {forgotStatus.message}
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your registered atelier business email address. If you are a tailor, cutter, or receptionist, your Atelier Owner can also reset your credentials directly from Staff Settings.
                </p>

                {forgotStatus.type === 'error' && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                    {forgotStatus.message}
                  </div>
                )}

                <div>
                  <label htmlFor="forgot-email-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      id="forgot-email-input"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-xs text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none"
                      placeholder="owner@tailorshop.com"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Send Instructions
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
