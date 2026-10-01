import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Scissors,
  ArrowRight,
  CheckCircle2,
  Users,
  Ruler,
  ShoppingBag,
  KanbanSquare,
  CreditCard,
  UserCheck,
  Building2,
  BarChart3,
  Smartphone,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronRight,
  Menu,
  X,
  Lock,
  Layers,
  Check,
  Eye,
  AlertCircle,
  HelpCircle,
  FileText,
  TrendingUp,
  Tag,
  Calendar,
  CheckCircle,
  Shield,
  LayoutDashboard,
  LogOut,
  MessageCircle
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'ANNUAL' | 'MONTHLY'>('ANNUAL');
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '919999999999';
  const [activeDashboardTab, setActiveDashboardTab] = useState<'overview' | 'kanban' | 'measurements' | 'ledger'>('overview');
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(3); // Default to Cutting

  // Auto-close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* ========================================================================= */}
      {/* 1. HEADER / NAVIGATION                                                    */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-slate-950 flex items-center justify-center text-white shadow-md shadow-slate-950/20 group-hover:bg-blue-600 transition-colors">
              <Scissors className="h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:rotate-12" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-950 flex items-center gap-1.5">
                Tailor Management
              </span>
              <span className="text-[11px] font-semibold text-blue-600 tracking-wider uppercase -mt-0.5">
                Digital Atelier OS
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors">
              Features
            </a>
            <a href="#workflow" className="text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors">
              How It Works
            </a>
            <a href="#roles" className="text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors">
              Solutions & Roles
            </a>
            <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors">
              Pricing
            </a>
            <Link to="/portal/login" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors">
              <Smartphone className="h-4 w-4" />
              Customer Portal
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all hover:shadow-md"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Go to Dashboard
                </Link>
                <button
                  onClick={() => logout()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-sm font-medium transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-700 hover:text-slate-950 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 text-white font-medium text-sm hover:bg-blue-600 shadow-md shadow-slate-950/10 hover:shadow-blue-500/20 transition-all active:scale-[0.98]"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-slate-200 bg-white px-5 pt-4 pb-6 space-y-4 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col space-y-3 pb-3 border-b border-slate-100">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-slate-700 hover:text-blue-600 py-1"
              >
                Features
              </a>
              <a
                href="#workflow"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-slate-700 hover:text-blue-600 py-1"
              >
                How It Works
              </a>
              <a
                href="#roles"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-slate-700 hover:text-blue-600 py-1"
              >
                Solutions & Roles
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-slate-700 hover:text-blue-600 py-1"
              >
                Pricing
              </a>
              <Link
                to="/portal/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-blue-600 hover:text-blue-700 flex items-center gap-2 py-1"
              >
                <Smartphone className="h-4 w-4" />
                Customer Portal Login
              </Link>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-3 rounded-xl bg-blue-600 text-white font-medium text-sm shadow-sm"
                  >
                    Go to Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-center py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-3 rounded-xl bg-slate-950 text-white font-medium text-sm shadow-md hover:bg-blue-600 transition-colors"
                  >
                    Start 14-Day Free Trial
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 rounded-xl border border-slate-300 text-slate-800 font-medium text-sm hover:bg-slate-50 transition-colors"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION                                                           */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-32 bg-radial from-blue-50/40 via-white to-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Headlines & Call to Action */}
            <div className="lg:col-span-6 space-y-6 sm:space-y-8 text-center lg:text-left">
              
              {/* Product Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold tracking-wide">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                Tailoring Operating System • Version 1.0
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 tracking-tight leading-[1.12]">
                Run Your Tailoring Business.{' '}
                <span className="text-blue-600">Beautifully.</span>
              </h1>

              {/* Supporting Subheadline */}
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Manage customers, measurements, orders, production, payments, and deliveries, all from one powerful tailoring management platform.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <Link
                  to="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-slate-950 text-white font-semibold text-base hover:bg-blue-600 shadow-lg shadow-slate-950/15 hover:shadow-blue-500/25 transition-all active:scale-[0.98]"
                >
                  <span>Start 14-Day Free Trial</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi, I run a tailoring shop and want to know more.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold text-base hover:bg-emerald-100 transition-colors"
                >
                  <MessageCircle className="h-5 w-5 text-emerald-600" />
                  <span>Chat on WhatsApp</span>
                </a>
              </div>

              {/* Trust Subtext */}
              <div className="pt-2 text-xs sm:text-sm text-slate-500 flex flex-wrap items-center justify-center lg:justify-start gap-x-3 gap-y-1">
                <span>No credit card required</span>
                <span className="text-slate-300">•</span>
                <span>14-day free trial</span>
                <span className="text-slate-300">•</span>
                <span>Built for tailoring businesses</span>
              </div>
            </div>

            {/* Right Column: Hero Visual - Phone Frame Mockup (Measurement -> Order -> Customer Update) */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative mx-auto w-full max-w-sm sm:max-w-md">
                {/* Subtle Ambient Glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/15 to-emerald-600/15 rounded-[44px] blur-2xl opacity-75" />

                {/* Smartphone Device Frame */}
                <div className="relative rounded-[40px] border-4 border-slate-900 bg-slate-900 p-3 shadow-2xl shadow-slate-900/20">
                  {/* Dynamic Island / Speaker Notch */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-full z-20 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                  </div>

                  <div className="rounded-[32px] bg-slate-50 overflow-hidden pt-6 pb-4 px-3 sm:px-4 space-y-3.5 border border-slate-200/50">
                    
                    {/* Phone Header Status */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
                      <span className="font-bold text-slate-900">Tailor OS Live</span>
                      <span className="flex items-center gap-1 font-semibold text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        In Sync
                      </span>
                    </div>

                    {/* Step 1: Measurement */}
                    <div className="rounded-2xl border border-blue-200 bg-white p-3.5 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                            1
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Ramesh Patel</div>
                            <div className="text-[10px] text-slate-500">Measurement Profile (Inches)</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          Saved
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] font-medium text-slate-700 bg-slate-50 p-2 rounded-xl">
                        <div><span className="text-slate-400 block text-[9px]">CHEST</span>39.5"</div>
                        <div><span className="text-slate-400 block text-[9px]">WAIST</span>34.0"</div>
                        <div><span className="text-slate-400 block text-[9px]">INSEAM</span>31.0"</div>
                      </div>
                    </div>

                    {/* Flow Connector Arrow */}
                    <div className="flex justify-center -my-1">
                      <span className="text-slate-300 font-bold text-xs">↓</span>
                    </div>

                    {/* Step 2: Order Creation */}
                    <div className="rounded-2xl border border-indigo-200 bg-white p-3.5 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            2
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Order #ORD-204</div>
                            <div className="text-[10px] text-slate-500">Navy 2-Piece Suit</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          In Cutting
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-600">
                        <span>Due: <strong className="text-slate-900">Friday, 5:00 PM</strong></span>
                        <span className="font-semibold text-emerald-600">Paid: ₹5,000 / ₹9,500</span>
                      </div>
                    </div>

                    {/* Flow Connector Arrow */}
                    <div className="flex justify-center -my-1">
                      <span className="text-slate-300 font-bold text-xs">↓</span>
                    </div>

                    {/* Step 3: Customer WhatsApp Update */}
                    <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-3.5 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                            <MessageCircle className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Customer Update Sent</div>
                            <div className="text-[10px] text-emerald-700">Instant WhatsApp Notification</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Delivered
                        </span>
                      </div>
                      <div className="rounded-xl bg-white border border-emerald-200 p-2.5 text-[11px] text-slate-700 leading-snug">
                        "Hi Ramesh, your Navy Suit has moved to Cutting. Track live: <span className="text-blue-600 underline">bespoke.me/o/204</span>"
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2.5 AT A GLANCE (Desktop Dashboard Showcase)                             */}
      {/* ========================================================================= */}
      <section id="dashboard-preview" className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">At A Glance</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight mt-2">
              Your entire shop on one clear screen.
            </h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">
              See today's intake, orders in production, trial dates, and pending balance collections.
            </p>
          </div>

          {/* Desktop Web Frame Preview */}
          <div className="relative mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Browser Bar */}
            <div className="h-10 border-b border-slate-200 bg-slate-50 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-rose-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <div className="px-4 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-mono text-slate-500 max-w-[220px] truncate select-none shadow-2xs">
                app.tailormanagement.com/dashboard
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold uppercase border border-amber-200">
                  Demo Preview
                </span>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-4 sm:p-6 bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
                    <Scissors className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 leading-tight">Sample Atelier (Demo Workspace)</div>
                    <div className="text-[10px] text-slate-500">Flagship Boutique • Mumbai (Illustrative)</div>
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  Sample Data
                </span>
              </div>

              {/* Today's Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Today's Orders</div>
                  <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">12</div>
                  <div className="text-[10px] text-emerald-600 font-medium mt-0.5">3 new today</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Ready for Delivery</div>
                  <div className="text-lg sm:text-xl font-extrabold text-teal-600 mt-1">8</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">QC passed</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">In Production</div>
                  <div className="text-lg sm:text-xl font-extrabold text-blue-600 mt-1">17</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Across workshop</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Pending Balance</div>
                  <div className="text-lg sm:text-xl font-extrabold text-amber-600 mt-1">₹24,500</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">4 orders pending</div>
                </div>
              </div>

              {/* Pipeline Highlight */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold font-mono">
                      #ORD-1042
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      Bespoke 3-Piece Tuxedo
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Client: <span className="font-semibold text-slate-700">Rajesh Kumar</span>
                  </span>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1.5">
                    <span>Production Pipeline</span>
                    <span className="text-blue-600 font-semibold">Stage: Finishing (75%)</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    <div className="h-2 rounded-full bg-emerald-500" />
                    <div className="h-2 rounded-full bg-emerald-500" />
                    <div className="h-2 rounded-full bg-blue-600 animate-pulse" />
                    <div className="h-2 rounded-full bg-slate-200" />
                    <div className="h-2 rounded-full bg-slate-200" />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Delivery: <strong className="text-slate-800">Tomorrow, 4:00 PM</strong></span>
                  </div>
                  <div className="font-medium text-slate-700">
                    Advance: <span className="text-emerald-600 font-semibold">₹8,000</span> • Balance: <span className="text-amber-600 font-semibold">₹4,500</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. TRUST STRIP                                                            */}
      {/* ========================================================================= */}
      <section className="py-7 bg-slate-950 text-white border-y border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="text-sm font-semibold tracking-wide uppercase text-slate-300">
              Built for modern tailoring businesses
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm font-medium text-slate-200">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-400" /> Customer Management
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-400" /> Production Tracking
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-400" /> Multi-Branch Support
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-400" /> Secure Cloud Platform
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. THE PROBLEM SECTION                                                    */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Operational Clarity</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight mt-2">
              Bring your entire tailoring workflow into one place.
            </h2>
            <p className="text-slate-600 mt-3 text-base sm:text-lg">
              Replace fragmented records, scattered chat updates, and disconnected notes with a single, dependable system built for tailoring operations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg mb-4">
                ✕
              </div>
              <h3 className="text-base font-bold text-slate-900">Customer details scattered across notebooks</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Client names, phone numbers, and past styling requests sit trapped in handwritten registers. When a customer walks in, staff spend 10 minutes flipping pages.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg mb-4">
                ✕
              </div>
              <h3 className="text-base font-bold text-slate-900">Measurements difficult to find or overwritten</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Lost measurement slips cause incorrect cuts. Alterations get written on top of old measurements, making it impossible to know the true historical fit profile.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg mb-4">
                ✕
              </div>
              <h3 className="text-base font-bold text-slate-900">Orders missed, delayed, or rushed</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Without a unified schedule, urgent wedding orders get buried under routine jobs. Deliveries get postponed, causing awkward confrontations with angry clients.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg mb-4">
                ✕
              </div>
              <h3 className="text-base font-bold text-slate-900">Production status unclear across the workshop</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Owners constantly have to walk onto the workshop floor shouting to find out whether a suit has been cut, stitched, or sent for buttonholing.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg mb-4">
                ✕
              </div>
              <h3 className="text-base font-bold text-slate-900">Payment records and balances difficult to track</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Partially paid advance deposits, cash receipts, and pending balances get lost, resulting in uncollected revenue during final garment pickup.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg mb-4">
                ✕
              </div>
              <h3 className="text-base font-bold text-slate-900">Multiple branches become impossible to manage</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Opening a second boutique or remote stitching unit multiplies confusion. Owners cannot see daily sales, staff workloads, or order progress across locations.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. THE SOLUTION GRID                                                      */}
      {/* ========================================================================= */}
      <section id="features" className="py-20 sm:py-28 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">All-in-One Solution</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight mt-2">
              Everything your tailoring business needs. In one place.
            </h2>
            <p className="text-slate-600 mt-3 text-base sm:text-lg">
              Engineered specifically for bespoke ateliers, commercial tailoring shops, and multi-branch couture houses.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7">
            
            {/* 1. Customer Management */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">1. Customer Management</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Store customer profiles, contact details, measurements, fabric preferences, and complete historical order records in one searchable directory.
              </p>
            </div>

            {/* 2. Smart Measurements */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Ruler className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">2. Smart Measurements</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Keep customer measurements organized, versioned, and accessible whenever you need them. Historical order measurements remain permanently immutable.
              </p>
            </div>

            {/* 3. Order Management */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">3. Order Management</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Create and manage orders from initial walk-in booking to final customer handover, including style specs, trial dates, and promised delivery deadlines.
              </p>
            </div>

            {/* 4. Production Tracking */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <KanbanSquare className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">4. Production Tracking</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Track Cutting, Stitching, Finishing, Trial, Alteration, Ready, and Delivery with a clear workshop visual Kanban board that keeps tailors aligned.
              </p>
            </div>

            {/* 5. Payments & Billing */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <CreditCard className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">5. Payments & Billing</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Maintain clear payment and billing records. Collect advance deposits, generate receipts, and reconcile outstanding balances accurately.
              </p>
            </div>

            {/* 6. Staff & Roles */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <UserCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">6. Staff & Roles</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Manage staff responsibilities with role-based access for Shop Owners, Managers, Cutters, Tailors, Finishers, Cashiers, and Receptionists.
              </p>
            </div>

            {/* 7. Branch Management */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">7. Branch Management</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Manage multiple branches from one centralized system. Monitor performance, staff activity, and workshop throughput across all your shops.
              </p>
            </div>

            {/* 8. Reports & Dashboard */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">8. Reports & Dashboard</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Understand orders, revenue, production velocity, and business activity at a glance with clear, real-time analytics.
              </p>
            </div>

            {/* 9. Customer Portal */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Smartphone className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">9. Customer Portal</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Let customers securely check their order progress and fitting dates online with mobile OTP, eliminating repetitive phone calls to your desk.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. PRODUCT WORKFLOW (THE TIMELINE)                                        */}
      {/* ========================================================================= */}
      <section id="workflow" className="py-20 sm:py-28 bg-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Unbroken Digital Lifecycle</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
              From measurement to delivery - everything stays connected.
            </h2>
            <p className="text-slate-300 mt-3 text-base sm:text-lg">
              Every garment moves through a structured 10-stage lifecycle, keeping team handoffs aligned and delivery milestones predictable.
            </p>
          </div>

          {/* Workflow Stepper: Desktop Horizontal, Mobile Vertical */}
          <div className="hidden lg:block relative pb-4">
            {/* Horizontal Connecting Rail */}
            <div className="absolute top-7 left-6 right-6 h-1 bg-slate-800 -z-0" />
            
            <div className="grid grid-cols-10 gap-2 relative z-10">
              {[
                { num: '01', title: 'Customer', desc: 'Profile & contact' },
                { num: '02', title: 'Measurement', desc: 'Anatomical fit' },
                { num: '03', title: 'Order', desc: 'Style & advance' },
                { num: '04', title: 'Cutting', desc: 'Fabric patterned' },
                { num: '05', title: 'Stitching', desc: 'Tailor workshop' },
                { num: '06', title: 'Finishing', desc: 'Pressing & QC' },
                { num: '07', title: 'Trial', desc: 'Fitting session' },
                { num: '08', title: 'Alteration', desc: 'Adjustments' },
                { num: '09', title: 'Ready', desc: 'Bagged & tagged' },
                { num: '10', title: 'Delivery', desc: 'Handover & balance' }
              ].map((step, idx) => (
                <div key={idx} className="flex flex-col items-center text-center group cursor-default">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center font-bold text-sm transition-all shadow-md ${
                    idx <= activeWorkflowStep
                      ? 'bg-blue-600 text-white ring-4 ring-slate-900 shadow-blue-500/20'
                      : 'bg-slate-800 text-slate-400 ring-4 ring-slate-900'
                  }`}>
                    {step.num}
                  </div>
                  <div className="mt-3 font-bold text-xs text-white leading-tight">
                    {step.title}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    {step.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Vertical Stepper */}
          <div className="lg:hidden space-y-4 max-w-md mx-auto">
            {[
              { num: '01', title: 'Customer', desc: 'Profile created with contact details and preferences.' },
              { num: '02', title: 'Measurement', desc: 'Comprehensive anatomical measurements saved & versioned.' },
              { num: '03', title: 'Order Booking', desc: 'Garment specs, fabric details, trial date, and advance deposit.' },
              { num: '04', title: 'Cutting', desc: 'Pattern cutter claims the job and prepares fabric panels.' },
              { num: '05', title: 'Stitching', desc: 'Assigned tailor stitches garment to exact specifications.' },
              { num: '06', title: 'Finishing', desc: 'Buttonholes, pressing, trimming, and master quality check.' },
              { num: '07', title: 'Trial', desc: 'Customer visits for fitting inspection and approval.' },
              { num: '08', title: 'Alteration', desc: 'Precision alterations recorded and completed if required.' },
              { num: '09', title: 'Ready', desc: 'Garment is bagged, tagged, and marked ready for pickup.' },
              { num: '10', title: 'Delivery', desc: 'Final balance settled and garment delivered to client.' }
            ].map((step, idx) => (
              <div key={idx} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <div className="h-8 w-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {step.num}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{step.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. DASHBOARD PREVIEW SHOWCASE (INTERACTIVE PRODUCT TABS)                  */}
      {/* ========================================================================= */}
      <section id="dashboard-preview" className="py-20 sm:py-28 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Product Showcase</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight mt-2">
              Know what's happening in your business at a glance.
            </h2>
            <p className="text-slate-600 mt-3 text-base sm:text-lg">
              Explore the actual interface used by master tailors, managers, and shop owners every day.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-200/80 text-slate-700 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              <span>Interactive preview with sample demo data (Not connected to live tenant records)</span>
            </div>

            {/* Interactive Module Switcher */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
              {[
                { id: 'overview', label: "Overview & Orders" },
                { id: 'kanban', label: "Production Board" },
                { id: 'measurements', label: "Smart Measurements" },
                { id: 'ledger', label: "Payments & Ledger" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDashboardTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    activeDashboardTab === tab.id
                      ? 'bg-slate-950 text-white shadow-md'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Browser Mockup Canvas */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-w-5xl mx-auto">
            
            {/* Mockup Top Navigation Bar */}
            <div className="h-12 border-b border-slate-200 bg-slate-100/80 px-4 sm:px-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-slate-300" />
                <div className="h-3 w-3 rounded-full bg-slate-300" />
                <div className="h-3 w-3 rounded-full bg-slate-300" />
                <span className="ml-3 text-xs font-semibold text-slate-700 hidden sm:inline">
                  Sample Atelier (Demo Workspace) | Tailor Management Platform
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  Role: Shop Owner
                </span>
                <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                  Sample / Demo Data
                </span>
              </div>
            </div>

            {/* Tab 1: Overview & Orders */}
            {activeDashboardTab === 'overview' && (
              <div className="p-6 sm:p-8 space-y-6 animate-in fade-in-50 duration-200">
                {/* 4 Real Metric Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="text-xs font-semibold text-slate-500">Monthly Revenue (Sample)</div>
                    <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">₹1,84,500</div>
                    <div className="text-xs text-emerald-600 font-medium mt-1">↑ 18% vs last month</div>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="text-xs font-semibold text-slate-500">Active Orders (Sample)</div>
                    <div className="text-xl sm:text-2xl font-extrabold text-blue-600 mt-1">42</div>
                    <div className="text-xs text-slate-500 font-medium mt-1">12 booked this week</div>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="text-xs font-semibold text-slate-500">Total Customers (Sample)</div>
                    <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">328</div>
                    <div className="text-xs text-emerald-600 font-medium mt-1">85% repeat clients</div>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="text-xs font-semibold text-slate-500">Due for Delivery (Sample)</div>
                    <div className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">5 Today</div>
                    <div className="text-xs text-slate-500 font-medium mt-1">All fitting trials approved</div>
                  </div>
                </div>

                {/* Recent Orders Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100/60 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Recent Atelier Orders (Sample Records)</span>
                    <span className="text-xs text-blue-600 font-semibold">Viewing 4 of 42 Demo Orders</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold">Order #</th>
                          <th className="py-2.5 px-4 font-semibold">Client</th>
                          <th className="py-2.5 px-4 font-semibold">Garments</th>
                          <th className="py-2.5 px-4 font-semibold">Status</th>
                          <th className="py-2.5 px-4 font-semibold">Delivery</th>
                          <th className="py-2.5 px-4 font-semibold text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-3 px-4 font-mono font-bold text-blue-600">#ORD-1042</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">Rajesh Kumar (Sample)</td>
                          <td className="py-3 px-4 text-slate-600">Bespoke 3-Piece Tuxedo</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              FINISHING
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">Tomorrow</td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">₹12,500</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-mono font-bold text-blue-600">#ORD-1041</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">Vikram Malhotra (Sample)</td>
                          <td className="py-3 px-4 text-slate-600">Sherwani & Kurta Set</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              TRIAL PENDING
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">Oct 02, 2026</td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">₹18,000</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-mono font-bold text-blue-600">#ORD-1040</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">Anita Desai (Sample)</td>
                          <td className="py-3 px-4 text-slate-600">Designer Silk Blouse (x2)</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              READY FOR DELIVERY
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">Today</td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">₹4,200</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-mono font-bold text-blue-600">#ORD-1039</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">Siddharth Rao (Sample)</td>
                          <td className="py-3 px-4 text-slate-600">Formal Cotton Shirts (x4)</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              STITCHING
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">Oct 05, 2026</td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">₹6,800</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Production Kanban */}
            {activeDashboardTab === 'kanban' && (
              <div className="p-6 sm:p-8 space-y-4 animate-in fade-in-50 duration-200">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs text-slate-500 font-medium">Live Workshop Floor Kanban Board (Sample Pipeline)</div>
                  <div className="text-xs text-slate-700 font-semibold">17 garments active in production</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  
                  {/* Cutting Column */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">CUTTING (4)</span>
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="text-xs font-bold text-slate-900">Italian Wool Trousers</div>
                      <div className="text-[11px] text-slate-500">#ORD-1045 • Master Cutter Imran (Demo)</div>
                      <div className="text-[10px] text-blue-600 font-medium">Fabric: Raymond Super 120s</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="text-xs font-bold text-slate-900">Linen Nehru Jacket</div>
                      <div className="text-[11px] text-slate-500">#ORD-1046 • Unassigned (Demo)</div>
                      <div className="text-[10px] text-blue-600 font-medium">Due: Oct 04</div>
                    </div>
                  </div>

                  {/* Stitching Column */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">STITCHING (6)</span>
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="text-xs font-bold text-slate-900">Wedding Sherwani</div>
                      <div className="text-[11px] text-slate-500">#ORD-1041 • Tailor Rashid (Demo)</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">Zari embroidery completed</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="text-xs font-bold text-slate-900">French Cuff Shirts (x4)</div>
                      <div className="text-[11px] text-slate-500">#ORD-1039 • Tailor Salim (Demo)</div>
                      <div className="text-[10px] text-slate-500">Collar fusing verified</div>
                    </div>
                  </div>

                  {/* Finishing Column */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">FINISHING (4)</span>
                      <span className="h-2 w-2 rounded-full bg-purple-500" />
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="text-xs font-bold text-slate-900">Bespoke Tuxedo Coat</div>
                      <div className="text-[11px] text-slate-500">#ORD-1042 • Finisher Prakash (Demo)</div>
                      <div className="text-[10px] text-purple-700 font-semibold">Satin lapel pressing in progress</div>
                    </div>
                  </div>

                  {/* Ready Column */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">READY (3)</span>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="text-xs font-bold text-slate-900">Silk Blouses (x2)</div>
                      <div className="text-[11px] text-slate-500">#ORD-1040 • Final QC Checked (Demo)</div>
                      <div className="text-[10px] text-emerald-700 font-semibold">Ready on Hanger #A-14</div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Tab 3: Smart Measurements */}
            {activeDashboardTab === 'measurements' && (
              <div className="p-6 sm:p-8 space-y-5 animate-in fade-in-50 duration-200">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <div className="text-base font-bold text-slate-900">Client Measurement Profile: Rajesh Kumar (Sample Record)</div>
                    <div className="text-xs text-slate-500">Mobile: +91 98765 43210 (Demo Contact) • Sample Profile Version 2</div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                    <CheckCircle className="h-3.5 w-3.5" /> Sample Dataset
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Chest / Bust</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">40.0"</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Waist</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">34.0"</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Shoulder Width</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">18.5"</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Sleeve Length</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">25.0"</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Collar</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">16.0"</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Inseam</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">32.0"</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Hip</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">41.0"</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Bicep</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">14.5"</div>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80 text-xs text-blue-900">
                  <strong>Master Cutter Fitting Note (Sample):</strong> Client prefers slim Italian taper with +0.5" comfort ease across chest armhole. Double vent jacket back.
                </div>
              </div>
            )}

            {/* Tab 4: Payments & Ledger */}
            {activeDashboardTab === 'ledger' && (
              <div className="p-6 sm:p-8 space-y-5 animate-in fade-in-50 duration-200">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <div className="text-base font-bold text-slate-900">Order Ledger: #ORD-1042 (Sample Record)</div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    PARTIALLY PAID
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500">Order Total (Sample)</span>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">₹12,500</div>
                  </div>
                  <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
                    <span className="text-xs text-emerald-800">Advance Paid (Sample)</span>
                    <div className="text-xl font-extrabold text-emerald-700 mt-1">₹8,000</div>
                    <div className="text-[10px] text-emerald-600 mt-0.5">UPI / Razorpay Verified</div>
                  </div>
                  <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200">
                    <span className="text-xs text-amber-800">Balance Due (Sample)</span>
                    <div className="text-xl font-extrabold text-amber-700 mt-1">₹4,500</div>
                    <div className="text-[10px] text-amber-600 mt-0.5">Due at Handover</div>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pt-2">
                  <span>Sample Invoice #INV-2026-1042 issued for illustration.</span>
                  <span className="font-semibold text-slate-700">Digital receipt sent via SMS & Customer Portal</span>
                </div>
              </div>
            )}

            {/* Showcase Bottom Disclaimer */}
            <div className="bg-slate-50 px-6 py-2.5 border-t border-slate-200 text-center text-[11px] text-slate-500">
              * Interactive product showcase utilizing simulated sample datasets. No live customer or tenant records are connected to marketing previews.
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. ROLE MANAGEMENT (EVERYONE KNOWS WHAT TO DO)                           */}
      {/* ========================================================================= */}
      <section id="roles" className="py-20 sm:py-28 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Role-Based Access Control</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight mt-2">
              Everyone knows what to do.
            </h2>
            <p className="text-slate-600 mt-3 text-base sm:text-lg">
              Workshop teams have distinct responsibilities. Tailor Management provides each staff role with dedicated queues and permissions. Customer self-service is provided through the separate Customer Portal.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            
            {/* Shop Owner */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2.5">
              <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                OW
              </div>
              <h3 className="text-base font-bold text-slate-950">Shop Owner</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Full visibility over atelier revenue, P&L reports, pricing models, multi-branch operations, and shop settings.
              </p>
              <div className="text-[11px] font-semibold text-blue-600 pt-1">
                Full Master Access
              </div>
            </div>

            {/* Manager */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs">
                MG
              </div>
              <h3 className="text-base font-bold text-slate-950">Manager</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Oversees daily atelier flow, assigns cutting jobs, approves delivery schedule adjustments, and supervises staff.
              </p>
              <div className="text-[11px] font-semibold text-indigo-600 pt-1">
                Workshop Operations
              </div>
            </div>

            {/* Receptionist */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2.5">
              <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                RC
              </div>
              <h3 className="text-base font-bold text-slate-950">Receptionist</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Front-desk customer intake, appointment booking, order wizard creation, and taking preliminary measurements.
              </p>
              <div className="text-[11px] font-semibold text-purple-600 pt-1">
                Front Desk & Intake
              </div>
            </div>

            {/* Cutter */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                CT
              </div>
              <h3 className="text-base font-bold text-slate-950">Cutter</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dedicated cutting queue with immediate access to client measurement records, style options, and fabric notes.
              </p>
              <div className="text-[11px] font-semibold text-amber-700 pt-1">
                Pattern & Cutting Floor
              </div>
            </div>

            {/* Tailor */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2.5">
              <div className="h-9 w-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                TL
              </div>
              <h3 className="text-base font-bold text-slate-950">Tailor</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Focused workshop screen showing stitching tasks, construction details, pocket specs, and alteration checklists.
              </p>
              <div className="text-[11px] font-semibold text-teal-700 pt-1">
                Workshop Stitching
              </div>
            </div>

            {/* Finisher */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2.5">
              <div className="h-9 w-9 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold text-xs">
                FN
              </div>
              <h3 className="text-base font-bold text-slate-950">Finisher</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Buttonhole placement, steam pressing, final seam trimming, and quality-control inspection before trial.
              </p>
              <div className="text-[11px] font-semibold text-cyan-700 pt-1">
                Pressing & QC
              </div>
            </div>

            {/* Cashier */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                CS
              </div>
              <h3 className="text-base font-bold text-slate-950">Cashier</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Billing desk, advance deposit logging, tax invoices, receipt printing, and final delivery balance settlement.
              </p>
              <div className="text-[11px] font-semibold text-emerald-700 pt-1">
                Billing & Receipts
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. MULTI-BRANCH / SCALE                                                   */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-5">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Multi-Branch Architecture</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
                Built to grow with your business.
              </h2>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                Start with a single boutique. Expand into a multi-branch network. Manage your entire enterprise from one centralized platform.
              </p>

              <div className="space-y-3.5 pt-2">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Unified Customer Directory</h4>
                    <p className="text-xs text-slate-600">A customer measured at your flagship atelier can order from your second branch without taking fresh measurements.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Branch-Specific Workshop Queues</h4>
                    <p className="text-xs text-slate-600">Staff see only the orders and jobs assigned to their local workshop, avoiding clutter and confusion.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Consolidated Business Intelligence</h4>
                    <p className="text-xs text-slate-600">Owners view aggregated revenue, workload bottlenecks, and delivery rates across every studio location.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tree Diagram Visual */}
            <div className="lg:col-span-6">
              <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-md space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-blue-400" />
                    <div>
                      <div className="text-sm font-bold">Central Atelier Enterprise (Sample Network)</div>
                      <div className="text-xs text-slate-400">Headquarters & Master Account (Demo)</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-600 text-white">
                    3 Locations
                  </span>
                </div>

                {/* Sub branches */}
                <div className="pl-6 border-l-2 border-slate-200 ml-4 space-y-3.5">
                  
                  {/* Branch 1 */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Main Flagship Atelier (Demo)</div>
                      <div className="text-[11px] text-slate-500">Staff: 12 • Active Orders: 28</div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600">₹1,18,000 (Sample)</span>
                  </div>

                  {/* Branch 2 */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">City Boutique Studio (Demo)</div>
                      <div className="text-[11px] text-slate-500">Staff: 6 • Active Orders: 14</div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600">₹66,500 (Sample)</span>
                  </div>

                  {/* Branch 3 */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Central Workshop Hub (Demo)</div>
                      <div className="text-[11px] text-slate-500">Specialized Cutting & Heavy Embroidery</div>
                    </div>
                    <span className="text-[11px] font-medium text-blue-600">Production Hub</span>
                  </div>

                </div>

                <div className="text-[11px] text-slate-400 text-center pt-1 border-t border-slate-100">
                  * Sample multi-branch topology for demonstration.
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. CUSTOMER PORTAL SHOWCASE                                              */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            {/* Visual Phone Mockup */}
            <div className="lg:col-span-5 order-2 lg:order-1 flex justify-center">
              <div className="w-full max-w-sm rounded-[36px] border-4 border-slate-950 bg-white p-3 shadow-2xl shadow-slate-900/15">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5 space-y-4">
                  
                  {/* Phone Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Customer Fitting Portal</div>
                      <div className="text-[10px] text-slate-500">Sample Atelier (Demo Portal)</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      Sample Session
                    </span>
                  </div>

                  {/* Order Status Card */}
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-blue-600">#ORD-1042 (Sample)</span>
                        <div className="text-xs font-bold text-slate-900">Bespoke 3-Piece Tuxedo</div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        In Progress
                      </span>
                    </div>

                    {/* Customer Stepper */}
                    <div className="space-y-2.5 pt-1 text-xs">
                      <div className="flex items-center gap-2 text-emerald-700 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Order Confirmed & Pattern Created</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-700 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Fabric Precision Cut</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-700 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Master Tailor Stitching</span>
                      </div>
                      <div className="flex items-center gap-2 text-blue-700 font-semibold">
                        <div className="h-4 w-4 rounded-full border-2 border-blue-600 flex items-center justify-center shrink-0">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                        </div>
                        <span>Finishing & Quality Inspection</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <div className="h-4 w-4 rounded-full border border-slate-300 shrink-0" />
                        <span>First Trial Fitting (Tomorrow, 4 PM)</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <div className="h-4 w-4 rounded-full border border-slate-300 shrink-0" />
                        <span>Ready for Handover</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-600 text-center">
                    Confidential internal workshop notes remain hidden from client view.
                  </div>

                </div>
              </div>
            </div>

            {/* Content Column */}
            <div className="lg:col-span-7 order-1 lg:order-2 space-y-5">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Client Self-Service Experience</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
                Keep your customers informed.
              </h2>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                Give your bespoke clients instant transparency. Customers securely check order progress, fitting schedules, and payment balances directly from their smartphones, without repeatedly calling your front desk.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 pt-3">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <h4 className="text-sm font-bold text-slate-900">Passwordless Mobile OTP</h4>
                  <p className="text-xs text-slate-600 mt-1">Clients simply enter their mobile number to receive a secure OTP. No forgotten passwords.</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <h4 className="text-sm font-bold text-slate-900">Strict Privacy Isolation</h4>
                  <p className="text-xs text-slate-600 mt-1">Clients see only their personal orders and measurements. Internal workshop notes and business records remain confidential.</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <h4 className="text-sm font-bold text-slate-900">Fitting Appointment Reminders</h4>
                  <p className="text-xs text-slate-600 mt-1">Live visibility into scheduled trial times reduces no-shows and rescheduling delays.</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <h4 className="text-sm font-bold text-slate-900">Digital Receipts & Invoices</h4>
                  <p className="text-xs text-slate-600 mt-1">Clear breakdown of advances paid and remaining balance due for transparent settlement.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 11. SECURITY & DATA INTEGRITY                                             */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-slate-950 text-white border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Enterprise Architecture</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
              Your business data stays protected.
            </h2>
            <p className="text-slate-300 mt-3 text-base sm:text-lg">
              Designed with logical tenant separation, role-based access controls, and point-in-time order measurement records.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-blue-900/60 text-blue-400 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Tenant-Isolated Business Data</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every shop operates with logical multi-tenant database separation. Customer lists, measurement profiles, pricing models, and orders are partitioned strictly by tenant organization.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-blue-900/60 text-blue-400 flex items-center justify-center">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Role-Based Access</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Granular role permissions ensure workshop staff view only the tasks relevant to their station, while financial and business analytics remain restricted to owners and managers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-blue-900/60 text-blue-400 flex items-center justify-center">
                <CheckCircle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Measurement Immutability</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Measurements captured for an order are saved as point-in-time snapshots. Even if a customer updates their sizing profile in the future, past order cuts remain accurately documented.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-blue-900/60 text-blue-400 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Secure Cloud Architecture</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Built with managed PostgreSQL database persistence, authenticated JSON Web Tokens (JWT), and responsive cross-device web design.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 12. PRICING & SUBSCRIPTION PLANS                                          */}
      {/* ========================================================================= */}
      <section id="pricing" className="py-20 sm:py-28 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Subscription Tiers</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight mt-2">
              Start free. Upgrade when your business grows.
            </h2>
            <p className="text-slate-600 mt-3 text-base sm:text-lg">
              Predictable tiers with clear capacity limits. All new tailoring shops start with an automatic 14-day free trial upon registration.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-200/80 text-slate-700 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
              <span>Indicative standard rates • Final pricing and billing terms confirmed during onboarding</span>
            </div>
          </div>

          {/* Monthly / Annual Toggle */}
          <div className="flex flex-col items-center justify-center gap-3 mb-12">
            <div className="inline-flex items-center rounded-xl bg-slate-200/70 p-1 border border-slate-300">
              <button
                type="button"
                onClick={() => setBillingCycle('MONTHLY')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  billingCycle === 'MONTHLY'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('ANNUAL')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  billingCycle === 'ANNUAL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Annual Billing</span>
                <span className="text-[10px] bg-amber-300 text-amber-950 font-extrabold px-1.5 py-0.5 rounded-full">
                  Save 2 Months
                </span>
              </button>
            </div>
            {billingCycle === 'ANNUAL' && (
              <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                Pay yearly, get 2 months free
              </span>
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            
            {/* Plan 1: Free Trial */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Trial Tier
                </span>
                <h3 className="text-xl font-extrabold text-slate-950">Free Trial</h3>
                <p className="text-xs text-slate-500">Explore core tailoring operations with full feature access.</p>
                <div className="pt-2">
                  <span className="text-3xl font-extrabold text-slate-950">₹0</span>
                  <span className="text-xs text-slate-500 ml-1">/ 14 days</span>
                </div>
                <div className="text-[11px] font-semibold text-emerald-600">
                  No credit card required
                </div>
                <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Up to <strong>100 orders / mo</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Up to <strong>5 staff members</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span><strong>1 shop branch</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Core Orders & Measurements</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Customer Portal & Appointments</span>
                  </div>
                </div>
              </div>
              <div className="pt-8">
                <Link
                  to="/register"
                  className="w-full text-center py-2.5 px-4 rounded-xl border border-slate-300 text-slate-900 font-semibold text-sm hover:bg-slate-100 transition-colors block"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>

            {/* Plan 2: STARTER */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">
                  Single Branch
                </span>
                <h3 className="text-xl font-extrabold text-slate-950">Starter</h3>
                <p className="text-xs text-slate-500">For independent tailoring studios and neighborhood shops.</p>
                <div className="pt-2">
                  <span className="text-3xl font-extrabold text-slate-950">
                    {billingCycle === 'ANNUAL' ? '₹9,990' : '₹999'}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">
                    {billingCycle === 'ANNUAL' ? '/ year' : '/ month'}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-500">
                  {billingCycle === 'ANNUAL' ? 'Billed annually' : 'Billed monthly'}
                </div>
                <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Up to <strong>500 orders / mo</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Up to <strong>15 staff members</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Up to <strong>2 shop branches</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Full Kanban Production Board</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Customer Self-Service Portal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Payment & Advance Billing</span>
                  </div>
                </div>
              </div>
              <div className="pt-8">
                <Link
                  to="/register"
                  className="w-full text-center py-2.5 px-4 rounded-xl bg-slate-950 text-white font-semibold text-sm hover:bg-blue-600 transition-colors block shadow-xs"
                >
                  Select Starter
                </Link>
              </div>
            </div>

            {/* Plan 3: PROFESSIONAL (Most popular) */}
            <div className="relative p-7 rounded-2xl border-2 border-blue-600 bg-white flex flex-col justify-between shadow-xl shadow-blue-500/10 ring-4 ring-blue-50">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                Most popular
              </div>
              <div className="space-y-4">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">
                  High Volume
                </span>
                <h3 className="text-xl font-extrabold text-slate-950">Professional</h3>
                <p className="text-xs text-slate-500">For busy bespoke ateliers and growing multi-cutter workshops.</p>
                <div className="pt-2">
                  <span className="text-3xl font-extrabold text-slate-950">
                    {billingCycle === 'ANNUAL' ? '₹24,990' : '₹2,499'}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">
                    {billingCycle === 'ANNUAL' ? '/ year' : '/ month'}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-blue-700">
                  {billingCycle === 'ANNUAL' ? 'Billed annually (Save ₹4,998)' : 'Billed monthly'}
                </div>
                <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Up to <strong>2,000 orders / mo</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Up to <strong>50 staff members</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Up to <strong>5 shop branches</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Advanced P&L & Revenue Reports</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Comprehensive Security Audit Logs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Cross-Branch Customer Sharing</span>
                  </div>
                </div>
              </div>
              <div className="pt-8">
                <Link
                  to="/register"
                  className="w-full text-center py-2.5 px-4 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all block"
                >
                  Select Professional
                </Link>
              </div>
            </div>

            {/* Plan 4: BUSINESS */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Enterprise Network
                </span>
                <h3 className="text-xl font-extrabold text-slate-950">Business</h3>
                <p className="text-xs text-slate-500">For multi-city retail chains and centralized production factories.</p>
                <div className="pt-2">
                  <span className="text-3xl font-extrabold text-slate-950">
                    {billingCycle === 'ANNUAL' ? '₹59,990' : '₹5,999'}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">
                    {billingCycle === 'ANNUAL' ? '/ year' : '/ month'}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-500">
                  {billingCycle === 'ANNUAL' ? 'Billed annually (Save ₹11,998)' : 'Billed monthly'}
                </div>
                <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Up to <strong>10,000 orders / mo</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Up to <strong>200 staff members</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Up to <strong>20 shop branches</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Dedicated Support & SLA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Dedicated Telemetry & Monitoring</span>
                  </div>
                </div>
              </div>
              <div className="pt-8">
                <Link
                  to="/register"
                  className="w-full text-center py-2.5 px-4 rounded-xl border border-slate-300 text-slate-900 font-semibold text-sm hover:bg-slate-100 transition-colors block"
                >
                  Select Business
                </Link>
              </div>
            </div>

          </div>

          <div className="mt-12 text-center space-y-1.5 text-xs text-slate-500">
            <div>
              * Displayed pricing reflects standard tier guidelines. Final billing terms, custom branch packages, and applicable taxes are confirmed upon onboarding.
            </div>
            <div>
              All plans include role-based permissions, automated database backups, and customer self-service access.
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 13. FINAL CALL TO ACTION (CTA)                                            */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-slate-950 text-white relative overflow-hidden">
        
        {/* Subtle Decorative Ambient Background */}
        <div className="absolute inset-0 bg-radial from-blue-900/20 via-transparent to-transparent opacity-60" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-950 border border-blue-800 text-blue-300 text-xs font-semibold">
            Ready in Under 2 Minutes
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Ready to bring your tailoring business online?
          </h2>

          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Manage customers, orders, production, payments, and deliveries from one simple platform.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-blue-600 text-white font-semibold text-base hover:bg-blue-500 shadow-xl shadow-blue-600/30 transition-all active:scale-[0.98]"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-slate-700 text-slate-200 font-semibold text-base hover:bg-slate-900 transition-colors"
            >
              <span>Sign In</span>
            </Link>
          </div>

          <div className="pt-2 text-xs text-slate-400">
            No credit card required • Instant setup • 14-day free trial on all plans
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 14. FOOTER                                                                */}
      {/* ========================================================================= */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 pb-12 border-b border-slate-900">
            
            {/* Col 1: Brand */}
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <Scissors className="h-5 w-5" />
                </div>
                <span className="text-lg font-bold text-white tracking-tight">
                  Tailor Management
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                The modern operating system for bespoke tailoring shops, master tailors, boutique studios, and multi-branch ateliers.
              </p>
              <div className="text-xs text-slate-500">
                Built for craftspeople who take pride in perfection.
              </div>
            </div>

            {/* Col 2: Product */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-white uppercase tracking-wider">Product</div>
              <ul className="space-y-2 text-xs">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#workflow" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/portal/login" className="hover:text-white transition-colors">Customer Portal</Link></li>
              </ul>
            </div>

            {/* Col 3: Platform */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-white uppercase tracking-wider">Platform</div>
              <ul className="space-y-2 text-xs">
                <li><a href="#roles" className="hover:text-white transition-colors">Staff Roles & RBAC</a></li>
                <li><a href="#dashboard-preview" className="hover:text-white transition-colors">Production Kanban</a></li>
                <li><a href="#dashboard-preview" className="hover:text-white transition-colors">Smart Measurements</a></li>
                <li><Link to="/register" className="hover:text-white transition-colors">Multi-Branch Support</Link></li>
              </ul>
            </div>

            {/* Col 4: Account */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-white uppercase tracking-wider">Account</div>
              <ul className="space-y-2 text-xs">
                <li><Link to="/login" className="hover:text-white transition-colors">Sign In</Link></li>
                <li><Link to="/register" className="hover:text-white transition-colors">Create Your Shop</Link></li>
                <li><Link to="/portal/login" className="hover:text-white transition-colors">Client Fitting Login</Link></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              © 2026 Tailor Management. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <span>Tailoring Business Platform</span>
              <span>•</span>
              <span>Tenant-Isolated Business Data</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp button on mobile */}
      <a
        href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi, I run a tailoring shop and want to know more.')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="md:hidden fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-white font-bold shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 active:scale-95 transition-all"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-xs">Chat with us</span>
      </a>

    </div>
  );
};
