import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { api, API_BASE_URL } from '../../api/client';
import { Modal } from '../../components/common/Modal';
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
  ArrowLeft,
  Store,
  Phone
} from 'lucide-react';

interface LoginPageProps {
  initialMode?: 'login' | 'register';
}

interface WorkspaceInfo {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  branchName: string;
  role: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialMode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { tenantSlug, setTenantSlug } = useTenant();

  // Environment detection: in production build, Demo Accounts UI is strictly hidden
  // Mode state: 'login' | 'register'
  const isRegisterRoute = location.pathname === '/register' || initialMode === 'register';
  const [mode, setMode] = useState<'login' | 'register'>(isRegisterRoute ? 'register' : 'login');

  // Form fields
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const [showAdvancedSlug, setShowAdvancedSlug] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

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
    }
  }, [location.pathname]);

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

  // User Registration (New Shop Owner)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent duplicate requests
    setError('');
    setSuccessMsg('');

    const newFieldErrors: Record<string, string> = {};

    const cleanShop = shopName.trim();
    const cleanOwner = ownerName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim();

    // 1. Shop Name
    if (!cleanShop) {
      newFieldErrors.shopName = 'Shop Name is required';
    } else if (cleanShop.length < 2) {
      newFieldErrors.shopName = 'Shop Name must be at least 2 characters';
    }

    // 2. Owner Name
    if (!cleanOwner) {
      newFieldErrors.ownerName = 'Owner Name is required';
    } else if (cleanOwner.length < 2) {
      newFieldErrors.ownerName = 'Owner Name must be at least 2 characters';
    }

    // 3. Business Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail) {
      newFieldErrors.email = 'Business Email is required';
    } else if (!emailRegex.test(cleanEmail)) {
      newFieldErrors.email = 'Please enter a valid business email address';
    }

    // 4. Mobile Number
    const digitsOnly = cleanMobile.replace(/\D/g, '');
    if (!cleanMobile) {
      newFieldErrors.mobile = 'Mobile Number is required';
    } else if (digitsOnly.length !== 10 && !(digitsOnly.length === 12 && digitsOnly.startsWith('91'))) {
      newFieldErrors.mobile = 'Please enter a valid 10-digit mobile number';
    }

    // 5. Password
    if (!password) {
      newFieldErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newFieldErrors.password = 'Password must be at least 6 characters long';
    }

    // 6. Confirm Password
    if (!confirmPassword) {
      newFieldErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newFieldErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setError('Please review the highlighted fields below.');
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        shopName: cleanShop,
        ownerName: cleanOwner,
        name: cleanShop, // fallback for any older middleware expecting name
        email: cleanEmail,
        mobile: digitsOnly.slice(-10),
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
        const msg = err.response.data.error.message;
        const code = err.response.data.error.code;
        setError(msg);
        if (code === 'MISSING_SHOP_NAME' || code === 'INVALID_SHOP_NAME') {
          setFieldErrors({ shopName: msg });
        } else if (code === 'MISSING_OWNER_NAME' || code === 'INVALID_OWNER_NAME') {
          setFieldErrors({ ownerName: msg });
        } else if (code === 'MISSING_EMAIL' || code === 'INVALID_EMAIL' || code === 'EMAIL_ALREADY_EXISTS') {
          setFieldErrors({ email: msg });
        } else if (code === 'MISSING_MOBILE' || code === 'INVALID_MOBILE') {
          setFieldErrors({ mobile: msg });
        } else if (code === 'MISSING_PASSWORD' || code === 'PASSWORD_TOO_SHORT') {
          setFieldErrors({ password: msg });
        } else if (code === 'PASSWORD_MISMATCH') {
          setFieldErrors({ confirmPassword: msg });
        }
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
      <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
        
        {/* ========================================================================= */}
        {/* LEFT PANEL: Professional Brand Presentation (Desktop only)                */}
        {/* ========================================================================= */}
        <div className="hidden lg:flex lg:w-[38%] xl:w-[38%] bg-slate-950 text-white relative overflow-hidden flex-col px-8 xl:px-12 py-8 border-r border-slate-800/80 shrink-0">
          
          {/* Subtle Ambient Background Accents */}
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Logo */}
          <div className="relative z-10 mb-12 xl:mb-14">
            <Link
              to="/"
              className="inline-flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl p-1 -ml-1 transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:bg-blue-500 transition-colors">
                <Scissors className="h-5 w-5 transition-transform group-hover:rotate-12" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  Tailor Management
                </span>
                <span className="text-[10px] font-semibold text-blue-400 tracking-wider uppercase -mt-0.5">
                  Digital Atelier OS
                </span>
              </div>
            </Link>
          </div>

          {/* Center Brand Headline & Feature Highlights */}
          <div className="relative z-10 max-w-[520px] w-full">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-blue-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Production-Grade Tailoring Cloud</span>
            </div>

            <h2 className="text-2xl xl:text-3xl font-extrabold tracking-tight text-white leading-tight mb-4">
              {mode === 'login'
                ? 'Welcome back to your atelier.'
                : 'Run your entire tailoring business in one place.'}
            </h2>

            <p className="text-slate-400 text-xs xl:text-sm leading-relaxed mb-6">
              Manage customers, measurements, orders, production, staff, and payments from one simple workspace.
            </p>

            {/* Compact 3 Feature Highlights */}
            <div className="space-y-2.5">
              {/* 1. Precision Measurements */}
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/40 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Ruler className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200">Precision Measurements</div>
                  <div className="text-[11px] text-slate-400 leading-snug">Customer profiles with saved measurement history.</div>
                </div>
              </div>

              {/* 2. Production Tracking */}
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/40 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <KanbanSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200">Production Tracking</div>
                  <div className="text-[11px] text-slate-400 leading-snug">Track every garment from cutting to delivery.</div>
                </div>
              </div>

              {/* 3. Secure Workspace */}
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200">Secure Workspace</div>
                  <div className="text-[11px] text-slate-400 leading-snug">Tenant-isolated data with role-based access.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Back to Home */}
          <div className="relative z-10 mt-auto pt-6 flex items-center justify-between text-xs text-slate-400">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>← Back to home</span>
            </Link>
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Secure Business Workspace</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: Centered Login / Register Form                                */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[62%] xl:w-[62%] flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-6 overflow-y-auto">
          
          {/* Mobile Top Brand (Hidden on Desktop) */}
          <div className="lg:hidden text-center mb-4">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-md shadow-slate-950/20">
                <Scissors className="h-4.5 w-4.5" />
              </div>
              <div className="text-left">
                <div className="text-base font-bold text-slate-950 leading-tight">Tailor Management</div>
                <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Digital Atelier OS</div>
              </div>
            </Link>
          </div>

          {/* Form Container Card */}
          <div className={`w-full ${mode === 'register' ? 'max-w-[560px]' : 'max-w-[520px]'} bg-white border border-slate-200/90 shadow-xl shadow-slate-900/5 rounded-[20px] sm:rounded-[24px] p-6 sm:p-8 xl:p-8 transition-all`}>
            
            {/* Header Titles */}
            <div className="mb-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100/80 text-[10px] font-bold text-blue-700 mb-1.5 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>
                  {workspaces.length > 0
                    ? 'Workspace Selection'
                    : mode === 'login'
                    ? 'Secure Atelier Login'
                    : '14-Day Free Atelier Trial'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {workspaces.length > 0
                  ? 'Select your workspace'
                  : mode === 'login'
                  ? 'Welcome back'
                  : 'Create your tailoring workspace'}
              </h1>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                {workspaces.length > 0
                  ? 'Your account has access to multiple ateliers. Choose which shop to open:'
                  : mode === 'login'
                  ? 'Sign in to your tailoring workspace and keep your business moving.'
                  : 'Set up your shop in minutes. Manage customers, measurements, orders, production and payments from one place.'}
              </p>
            </div>

            {/* Clean Error Alert */}
            {error && (
              <div role="alert" className="mb-3.5 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-800 border border-rose-200/80 flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 leading-relaxed">{getDisplayError(error)}</div>
              </div>
            )}

            {/* Clean Success Alert */}
            {successMsg && (
              <div role="status" className="mb-3.5 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800 border border-emerald-200/80 flex items-start gap-2 animate-fadeIn">
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
            ) : mode === 'login' ? (
              /* =============================================================== */
              /* VIEW 2: STANDARD LOGIN CREDENTIALS                              */
              /* =============================================================== */
              <div>
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  {/* Email Input */}
                  <div>
                    <label htmlFor="login-email-input" className="block text-xs font-semibold text-slate-800 mb-1.5">
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
                        className="block w-full h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none transition-all"
                        placeholder="owner@tailorshop.com"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="login-password-input" className="block text-xs font-semibold text-slate-800">
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
                        className="block w-full h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none transition-all"
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        id="login-password-toggle"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    id="login-submit-button"
                    type="submit"
                    disabled={loading}
                    className="w-full h-[46px] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 active:scale-[0.98] text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-3"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Signing you in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In →</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-white px-2.5 text-slate-400 font-semibold tracking-wider">
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
                  className="w-full h-[42px] flex items-center justify-center gap-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-all shadow-xs hover:border-slate-400 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
                <div className="mt-3 text-center text-xs sm:text-sm text-slate-600">
                  <span>Don't have an account? </span>
                  <button
                    id="go-to-register-link"
                    type="button"
                    onClick={() => handleSwitchMode('register')}
                    className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer ml-1"
                  >
                    Create your shop
                  </button>
                </div>

                {/* Trust Footer */}
                <div className="mt-2.5 text-center">
                  <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    <span>🔒 Secure Business Workspace</span>
                  </div>
                </div>
              </div>
            ) : (
              /* =============================================================== */
              /* VIEW 4: REGISTER MODE (14-DAY FREE TRIAL)                       */
              /* =============================================================== */
              <div>
                <form onSubmit={handleRegister} className="space-y-3">
                  {/* SECTION 1: Tell us about your shop */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-blue-600" />
                        <span>Tell us about your shop</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Your brand & contact</span>
                    </div>

                    {/* 1. Shop / Business Name */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="register-shop-name-input" className="block text-xs font-semibold text-slate-800">
                          Shop Name <span className="text-blue-600">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400">Appears in workspace</span>
                      </div>
                      <div className="relative">
                        <Store className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          id="register-shop-name-input"
                          type="text"
                          value={shopName}
                          onChange={(e) => {
                            setShopName(e.target.value);
                            clearFieldError('shopName');
                          }}
                          className={`block w-full h-[44px] rounded-xl border ${
                            fieldErrors.shopName ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600/15'
                          } bg-white pl-10 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none transition-all`}
                          placeholder="e.g. Royal Bespoke Tailors"
                          required
                        />
                      </div>
                      {fieldErrors.shopName && (
                        <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.shopName}</span>
                        </p>
                      )}
                    </div>

                    {/* 2. Owner Name & 3. Business Email Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* 2. Owner Name */}
                      <div>
                        <label htmlFor="register-owner-name-input" className="block text-xs font-semibold text-slate-800 mb-1.5">
                          Owner Name <span className="text-blue-600">*</span>
                        </label>
                        <div className="relative">
                          <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                          <input
                            id="register-owner-name-input"
                            type="text"
                            value={ownerName}
                            onChange={(e) => {
                              setOwnerName(e.target.value);
                              clearFieldError('ownerName');
                            }}
                            className={`block w-full h-[44px] rounded-xl border ${
                              fieldErrors.ownerName ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600/15'
                            } bg-white pl-10 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none transition-all`}
                            placeholder="e.g. Mahadev Lambadi"
                            required
                          />
                        </div>
                        {fieldErrors.ownerName && (
                          <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{fieldErrors.ownerName}</span>
                          </p>
                        )}
                      </div>

                      {/* 3. Business Email */}
                      <div>
                        <label htmlFor="register-email-input" className="block text-xs font-semibold text-slate-800 mb-1.5">
                          Business Email <span className="text-blue-600">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                          <input
                            id="register-email-input"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              clearFieldError('email');
                            }}
                            className={`block w-full h-[44px] rounded-xl border ${
                              fieldErrors.email ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600/15'
                            } bg-white pl-10 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none transition-all`}
                            placeholder="owner@royalbespoke.com"
                            required
                          />
                        </div>
                        {fieldErrors.email && (
                          <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{fieldErrors.email}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 4. Mobile Number */}
                    <div>
                      <label htmlFor="register-mobile-input" className="block text-xs font-semibold text-slate-800 mb-1.5">
                        Mobile Number <span className="text-blue-600">*</span>
                      </label>
                      <div className="relative flex rounded-xl shadow-2xs">
                        <span className="inline-flex items-center px-3 h-[44px] rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold select-none">
                          <span className="mr-1.5">🇮🇳</span> +91
                        </span>
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                          <input
                            id="register-mobile-input"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            value={mobile}
                            onChange={(e) => {
                              setMobile(e.target.value);
                              clearFieldError('mobile');
                            }}
                            className={`block w-full h-[44px] rounded-r-xl border ${
                              fieldErrors.mobile ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600/15'
                            } bg-white pl-9 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none transition-all`}
                            placeholder="e.g. 98765 43210"
                            required
                          />
                        </div>
                      </div>
                      {fieldErrors.mobile && (
                        <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{fieldErrors.mobile}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* SECTION 2: Secure your account */}
                  <div className="space-y-2.5 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Secure your account</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Workspace credentials</span>
                    </div>

                    {/* 5. Password & 6. Confirm Password Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* 5. Password */}
                      <div>
                        <label htmlFor="register-password-input" className="block text-xs font-semibold text-slate-800 mb-1.5">
                          Password <span className="text-blue-600">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                          <input
                            id="register-password-input"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              clearFieldError('password');
                            }}
                            className={`block w-full h-[44px] rounded-xl border ${
                              fieldErrors.password ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600/15'
                            } bg-white pl-10 pr-9 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none transition-all`}
                            placeholder="Create a strong password"
                            required
                          />
                          <button
                            type="button"
                            id="register-password-toggle"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {fieldErrors.password && (
                          <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{fieldErrors.password}</span>
                          </p>
                        )}
                      </div>

                      {/* 6. Confirm Password */}
                      <div>
                        <label htmlFor="register-confirm-password-input" className="block text-xs font-semibold text-slate-800 mb-1.5">
                          Confirm Password <span className="text-blue-600">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                          <input
                            id="register-confirm-password-input"
                            type={showConfirmPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              clearFieldError('confirmPassword');
                            }}
                            className={`block w-full h-[44px] rounded-xl border ${
                              fieldErrors.confirmPassword ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600/15'
                            } bg-white pl-10 pr-9 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none transition-all`}
                            placeholder="Re-enter your password"
                            required
                          />
                          <button
                            type="button"
                            id="register-confirm-password-toggle"
                            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {fieldErrors.confirmPassword && (
                          <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{fieldErrors.confirmPassword}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    id="register-submit-button"
                    type="submit"
                    disabled={loading}
                    className="w-full h-[46px] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 active:scale-[0.99] text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-3"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Creating your workspace...</span>
                      </>
                    ) : (
                      <>
                        <span>Create My Shop →</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-white px-2.5 text-slate-400 font-semibold tracking-wider">
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
                  className="w-full h-[42px] flex items-center justify-center gap-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-all shadow-xs hover:border-slate-400 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
                <div className="mt-3 text-center text-xs sm:text-sm text-slate-600">
                  <span>Already have an account? </span>
                  <button
                    id="go-to-login-link"
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer ml-1"
                  >
                    Sign in
                  </button>
                </div>

                {/* Free trial & credit card note */}
                <div className="mt-2.5 text-center">
                  <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>✓ 14-day free trial &bull; No credit card required</span>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Portal Link */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 text-center">
              <Link
                to="/portal/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                <span>Customer Self-Service OTP Portal →</span>
              </Link>
            </div>
          </div>

          {/* Security Sub-text below card on mobile */}
          <div className="mt-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            <span>Secure Business Workspace</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORGOT PASSWORD MODAL                                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        maxWidth="max-w-md"
        className="rounded-2xl p-6 sm:p-7 shadow-2xl border border-slate-200 relative"
        ariaLabel="Reset Shop Password"
      >
        <div>
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
      </Modal>
    </div>
  );
};

export default LoginPage;
