import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { ChangeOwnPasswordModal } from '../staff/ChangeOwnPasswordModal';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  PlusCircle,
  KanbanSquare,
  Calendar,
  Ruler,
  Palette,
  Briefcase,
  CreditCard,
  BarChart3,
  Printer,
  ShieldCheck,
  Settings,
  X,
  Scissors,
  Sparkles,
  Wifi,
  WifiOff,
  Globe,
  HelpCircle,
  KeyRound,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onClose }) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const { tenant, subscription, isSubscriptionExpired, isTrial, trialDaysRemaining } = useTenant();
  const { isOnline } = useOfflineSync();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Prevent background page scrolling while mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [mobileOpen]);

  const navItems = [
    { to: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { to: '/customers', label: t('customers'), icon: Users },
    { to: '/orders', label: t('orders'), icon: ShoppingBag },
    { to: '/orders/new', label: t('newOrder'), icon: PlusCircle, highlight: true },
    { to: '/production', label: t('production'), icon: KanbanSquare, roleRestricted: ['SHOP_OWNER', 'MANAGER', 'TAILOR', 'CUTTER', 'FINISHER'] },
    { to: '/appointments', label: t('appointments'), icon: Calendar },
    { to: '/measurements', label: t('measurements'), icon: Ruler },
    { to: '/styles', label: t('styles'), icon: Palette },
    { to: '/staff', label: t('staff'), icon: Briefcase, roleRestricted: ['SHOP_OWNER', 'MANAGER'] },
    { to: '/payments', label: t('payments'), icon: CreditCard },
    { to: '/reports', label: t('reports'), icon: BarChart3, roleRestricted: ['SHOP_OWNER', 'MANAGER', 'CASHIER'] },
    { to: '/documents', label: t('documents'), icon: Printer },
    { to: '/subscription', label: t('subscription') || 'Subscription & Plans', icon: Sparkles },
    { to: '/portal', label: t('customerPortal'), icon: ShieldCheck },
    { to: '/settings', label: t('settings'), icon: Settings, roleRestricted: ['SHOP_OWNER'] }
  ];

  const renderNavLinks = (isMobile = false) => (
    <div className={`p-3 space-y-1 ${isMobile ? 'space-y-1.5' : ''}`}>
      {navItems.map((item) => {
        if (item.roleRestricted && user && !item.roleRestricted.includes(user.role) && user.role !== 'SAAS_OWNER') {
          return null;
        }

        if (item.highlight) {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 ${
                  isMobile ? 'py-3 min-h-[44px]' : 'py-2.5'
                } rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`
              }
            >
              <item.icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        }

        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 ${
                isMobile ? 'py-3 min-h-[44px]' : 'py-2'
              } rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );

  const renderSubscriptionBadge = () => {
    if (isSubscriptionExpired) {
      return (
        <NavLink
          to="/subscription"
          onClick={onClose}
          className="block rounded-xl bg-rose-50 p-3 border border-rose-200 hover:bg-rose-100/80 transition-colors text-left group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              Subscription Expired
            </span>
            <span className="text-[10px] font-bold text-rose-700 underline group-hover:text-rose-900">Renew</span>
          </div>
          <p className="text-[10px] text-rose-600 mt-1 leading-snug">Operations locked. Reactivate your subscription.</p>
        </NavLink>
      );
    }

    if (isTrial) {
      return (
        <NavLink
          to="/subscription"
          onClick={onClose}
          className="block rounded-xl bg-amber-50/90 p-3 border border-amber-200/80 hover:bg-amber-100/70 transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Free Trial
            </span>
            <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
              {trialDaysRemaining}d left
            </span>
          </div>
          <p className="text-[10px] text-amber-700 mt-1 leading-snug">All features active. Upgrade to keep uninterrupted access.</p>
        </NavLink>
      );
    }

    return (
      <NavLink
        to="/subscription"
        onClick={onClose}
        className="block rounded-xl bg-blue-50/70 p-3 border border-blue-100/60 hover:bg-blue-100/60 transition-colors text-left"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-blue-950 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            {subscription?.planName || 'Active Atelier'}
          </span>
          <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full">
            Active
          </span>
        </div>
        <p className="text-[10px] text-blue-700 mt-0.5">Limits & subscription details</p>
      </NavLink>
    );
  };

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 border-r border-slate-200 bg-white flex-col justify-between overflow-y-auto">
        {renderNavLinks(false)}

        <div className="p-3 border-t border-slate-100 bg-slate-50/40">
          {renderSubscriptionBadge()}
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {mobileOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] md:hidden flex" role="dialog" aria-modal="true" aria-label="Navigation Drawer">
            {/* Backdrop Overlay */}
            <div
              onClick={onClose}
              className="fixed inset-0 w-full h-full bg-black/50 backdrop-blur-sm transition-opacity"
            />

            {/* Slide-over Drawer Panel */}
            <div className="relative z-[100000] w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto transform transition-transform duration-300 ease-in-out pt-[env(safe-area-inset-top,0px)] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs shrink-0">
                      <Scissors className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">{tenant?.name || 'Tailor Atelier'}</div>
                      <div className="text-[10px] text-slate-500 font-medium">All Features & Operations</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close menu"
                    className="p-2 min-h-touch min-w-touch flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* User Profile & Connection Status Card */}
                <div className="mx-3 mt-3 p-3 rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200/80 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">{user?.name || 'Staff User'}</div>
                    <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">{user?.role || 'Staff'}</div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-slate-200 bg-white shrink-0">
                    {isOnline ? (
                      <>
                        <Wifi className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">{t('online')}</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3 text-rose-600 animate-pulse" />
                        <span className="text-rose-700 font-bold">{t('offline')}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Navigation Items */}
                {renderNavLinks(true)}
              </div>

              {/* Drawer Footer & Secondary Utilities */}
              <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2.5">
                {/* Language Switcher */}
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">
                    <Globe className="h-3 w-3 text-slate-400" />
                    <span>Language</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`py-1.5 rounded-lg transition-all text-center min-h-[38px] flex items-center justify-center cursor-pointer ${
                        language === 'en' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('hi')}
                      className={`py-1.5 rounded-lg transition-all text-center min-h-[38px] flex items-center justify-center cursor-pointer ${
                        language === 'hi' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      हिंदी
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('kn')}
                      className={`py-1.5 rounded-lg transition-all text-center min-h-[38px] flex items-center justify-center cursor-pointer ${
                        language === 'kn' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ಕನ್ನಡ
                    </button>
                  </div>
                </div>

                {/* Change Password */}
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) onClose();
                    setShowPasswordModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 min-h-touch rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:text-blue-600 transition-colors shadow-2xs cursor-pointer"
                >
                  <KeyRound className="h-4 w-4 text-slate-500 shrink-0" />
                  <span>Change My Password</span>
                </button>

                {/* Interactive Tour / Help */}
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) onClose();
                    window.dispatchEvent(new CustomEvent('start_guided_tour'));
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 min-h-touch rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:text-blue-600 transition-colors shadow-2xs cursor-pointer"
                >
                  <HelpCircle className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>Interactive Walkthrough</span>
                </button>

                {/* Subscription Badge */}
                {renderSubscriptionBadge()}

                {/* Logout */}
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) onClose();
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-touch rounded-xl text-xs sm:text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>{t('logout') || 'Log Out'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Change Password Modal when triggered from Mobile Drawer */}
      <ChangeOwnPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  );
};
