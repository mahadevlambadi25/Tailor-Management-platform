import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { LayoutDashboard, Users, ShoppingBag, Plus, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1 flex items-center justify-around select-none">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
            isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <LayoutDashboard className="h-5 w-5 mb-0.5" />
        <span>{t('dashboard')}</span>
      </NavLink>

      <NavLink
        to="/customers"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
            isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <Users className="h-5 w-5 mb-0.5" />
        <span>{t('customers')}</span>
      </NavLink>

      <NavLink
        to="/orders/new"
        className="flex flex-col items-center justify-center -mt-4 active:scale-95 transition-transform"
      >
        <div className="h-11 w-11 rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/30 flex items-center justify-center border-2 border-white">
          <Plus className="h-5 w-5 stroke-[2.5]" />
        </div>
        <span className="text-[10px] font-bold text-blue-600 mt-0.5">New</span>
      </NavLink>

      <NavLink
        to="/orders"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
            isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <ShoppingBag className="h-5 w-5 mb-0.5" />
        <span>{t('orders')}</span>
      </NavLink>

      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        <Menu className="h-5 w-5 mb-0.5" />
        <span>Menu</span>
      </button>
    </nav>
  );
};
