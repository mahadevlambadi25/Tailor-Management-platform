import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
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
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onClose }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { tenant, subscription, isSubscriptionExpired, isTrial, trialDaysRemaining } = useTenant();

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
    { to: '/customer-portal/demo', label: t('customerPortal'), icon: ShieldCheck },
    { to: '/settings', label: t('settings'), icon: Settings, roleRestricted: ['SHOP_OWNER'] }
  ];

  const renderNavLinks = () => (
    <div className="p-3 space-y-1">
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
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
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
              `flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-slate-100 text-blue-600 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
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
        {renderNavLinks()}

        <div className="p-3 border-t border-slate-100 bg-slate-50/40">
          {renderSubscriptionBadge()}
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Overlay */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
          />

          {/* Slide-over Drawer Panel */}
          <div className="relative z-50 w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto transform transition-transform duration-300 ease-in-out">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                    <Scissors className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 leading-tight">{tenant?.name || 'Tailor Atelier'}</div>
                    <div className="text-[10px] text-slate-500 font-medium">Navigation Menu</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation Items */}
              {renderNavLinks()}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/40">
              {renderSubscriptionBadge()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
