import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { 
  Package, 
  Ruler, 
  User as UserIcon, 
  Home, 
  LogOut, 
  Scissors,
  Phone
} from 'lucide-react';

export const CustomerPortalLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/portal/login');
  };

  const navItems = [
    { to: '/portal', label: 'Dashboard', icon: Home, end: true },
    { to: '/portal/orders', label: 'My Orders', icon: Package, end: false },
    { to: '/portal/measurements', label: 'Fit Profile', icon: Ruler, end: false },
    { to: '/portal/profile', label: 'My Account', icon: UserIcon, end: false }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 md:pb-0">
      {/* ------------------------------------------------------------- */}
      {/* Sticky Top Header                                             */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between">
          {/* Atelier Brand & Shop Info */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base leading-tight flex items-center gap-1.5">
                <span>{tenant?.name || 'Bespoke Atelier'}</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Client Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Customer Self-Service</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                      isActive
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {/* User Controls & Logout */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-200">{user?.name || 'Valued Client'}</p>
              <p className="text-[11px] text-slate-400">{user?.mobile}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 text-xs font-semibold transition"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* Main Routed Page Content                                      */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* ------------------------------------------------------------- */}
      {/* Mobile Bottom Navigation Bar                                  */}
      {/* ------------------------------------------------------------- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-30 px-2 py-1.5 flex justify-around items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[11px] font-bold transition ${
                  isActive
                    ? 'text-amber-600 bg-amber-50/70'
                    : 'text-slate-500 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4 w-4 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
export default CustomerPortalLayout;
