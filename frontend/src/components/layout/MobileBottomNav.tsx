import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { LayoutDashboard, Users, ShoppingBag, KanbanSquare, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
  const { t } = useLanguage();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center py-1.5 px-2 rounded-xl min-w-[56px] min-h-[48px] transition-all relative ${
      isActive
        ? 'text-blue-600 font-bold'
        : 'text-slate-500 hover:text-slate-800 font-medium'
    }`;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pt-1 flex items-center justify-around select-none pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))]"
    >
      {/* 1. Home / Dashboard */}
      <NavLink to="/dashboard" className={navLinkClass}>
        {({ isActive }) => (
          <>
            <LayoutDashboard className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] leading-tight tracking-tight">{t('dashboard') || 'Home'}</span>
            {isActive && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-600" />}
          </>
        )}
      </NavLink>

      {/* 2. Orders */}
      <NavLink to="/orders" className={navLinkClass}>
        {({ isActive }) => (
          <>
            <ShoppingBag className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] leading-tight tracking-tight">{t('orders') || 'Orders'}</span>
            {isActive && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-600" />}
          </>
        )}
      </NavLink>

      {/* 3. Customers */}
      <NavLink to="/customers" className={navLinkClass}>
        {({ isActive }) => (
          <>
            <Users className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] leading-tight tracking-tight">{t('customers') || 'Customers'}</span>
            {isActive && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-600" />}
          </>
        )}
      </NavLink>

      {/* 4. Production */}
      <NavLink to="/production" className={navLinkClass}>
        {({ isActive }) => (
          <>
            <KanbanSquare className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] leading-tight tracking-tight">{t('production') || 'Production'}</span>
            {isActive && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-600" />}
          </>
        )}
      </NavLink>

      {/* 5. More / Menu Drawer */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open More Menu"
        className="flex flex-col items-center justify-center py-1.5 px-2 rounded-xl min-w-[56px] min-h-[48px] text-slate-500 hover:text-slate-800 font-medium transition-all cursor-pointer"
      >
        <Menu className="h-5 w-5 mb-0.5" />
        <span className="text-[10px] leading-tight tracking-tight">More</span>
      </button>
    </nav>
  );
};

