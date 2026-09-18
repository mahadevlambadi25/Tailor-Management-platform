import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { Search, Globe, LogOut, Wifi, WifiOff, Scissors, Menu } from 'lucide-react';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu }) => {
  const { user, logout } = useAuth();
  const { tenant } = useTenant();
  const { language, setLanguage, t } = useLanguage();
  const { isOnline } = useOfflineSync();
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/customers?search=${encodeURIComponent(searchQuery.trim())}`);
      setShowMobileSearch(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex flex-col w-full border-b border-slate-200 bg-white shadow-xs">
      <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6">
        {/* Left: Mobile Menu Hamburger & Brand / Active Shop */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Hamburger button on mobile */}
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Open mobile navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
            <Scissors className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>

          <div className="min-w-0 truncate">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-slate-900 leading-none tracking-tight truncate">
                {tenant?.name || t('appName')}
              </span>
              <span className="hidden sm:inline rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 uppercase">
                V1 SaaS
              </span>
              {tenant?.demoStats?.hasDemoData && (
                <span 
                  onClick={() => navigate('/settings')}
                  title="Demo sample data loaded. Click to open Settings."
                  className="cursor-pointer rounded-full bg-amber-100 text-amber-800 px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider border border-amber-300 hover:bg-amber-200 transition hidden sm:inline-flex"
                >
                  Demo ({tenant.demoStats.demoOrdersCount})
                </span>
              )}
              {tenant?.subscription?.status === 'ACTIVE' && (
                <span className="hidden sm:inline-flex rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border border-emerald-300">
                  PRO
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-xs text-slate-500 font-medium truncate block">
              {tenant?.city || 'Bangalore'} • {user?.role || 'Staff'}
            </span>
          </div>
        </div>

        {/* Global Quick Search for Tablet / Desktop */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xs lg:max-w-md mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs font-normal text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden transition-all"
            />
          </div>
        </form>

        {/* Right Controls: Search icon (mobile), Online, Language, User, Logout */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Mobile search toggle button */}
          <button
            type="button"
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Offline / Online indicator */}
          <div className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium border border-slate-200 bg-slate-50">
            {isOnline ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-600" />
                <span className="text-emerald-700 hidden lg:inline">{t('online')}</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-rose-600 animate-pulse" />
                <span className="text-rose-700 font-bold">{t('offline')}</span>
              </>
            )}
          </div>

          {/* Language Switcher - Compact on mobile */}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 text-[10px] font-medium">
            <Globe className="h-3 w-3 text-slate-400 ml-1 hidden sm:inline" />
            <button
              onClick={() => setLanguage('en')}
              className={`px-1.5 py-0.5 rounded transition ${language === 'en' ? 'bg-white shadow-2xs text-blue-600 font-bold' : 'text-slate-600'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('hi')}
              className={`px-1.5 py-0.5 rounded transition ${language === 'hi' ? 'bg-white shadow-2xs text-blue-600 font-bold' : 'text-slate-600'}`}
            >
              HI
            </button>
            <button
              onClick={() => setLanguage('kn')}
              className={`px-1.5 py-0.5 rounded transition ${language === 'kn' ? 'bg-white shadow-2xs text-blue-600 font-bold' : 'text-slate-600'}`}
            >
              KN
            </button>
          </div>

          {/* Desktop User Info */}
          <div className="hidden xl:flex flex-col items-end text-right">
            <span className="text-xs font-bold text-slate-800">{user?.name}</span>
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">{user?.role}</span>
          </div>

          {/* Logout button */}
          <button
            onClick={logout}
            title={t('logout')}
            className="flex items-center gap-1 rounded-lg border border-slate-200 p-1.5 sm:p-2 text-slate-600 hover:bg-slate-50 hover:text-rose-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expandable Mobile Search Bar */}
      {showMobileSearch && (
        <form onSubmit={handleSearch} className="md:hidden px-3 pb-2.5 pt-1 border-t border-slate-100 bg-slate-50/50">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search customer, mobile, order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden"
            />
          </div>
        </form>
      )}
    </header>
  );
};
