import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { ChangeOwnPasswordModal } from '../staff/ChangeOwnPasswordModal';
import { Search, Globe, LogOut, Wifi, WifiOff, Scissors, Menu, HelpCircle, Sparkles, KeyRound } from 'lucide-react';

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
  const [showOwnPasswordModal, setShowOwnPasswordModal] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/customers?search=${encodeURIComponent(searchQuery.trim())}`);
      setShowMobileSearch(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex flex-col w-full border-b border-slate-200 bg-white shadow-xs shrink-0 pt-[env(safe-area-inset-top,0px)]">
      <div className="flex h-16 min-h-[64px] items-center justify-between px-3 sm:px-6 w-full">
        {/* Left: Mobile Menu Hamburger, Logo & Shop Name */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
          {/* Hamburger button on mobile */}
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 cursor-pointer"
            aria-label="Open mobile navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* App / Atelier Logo */}
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
            <Scissors className="h-5 w-5" />
          </div>

          {/* Workspace / Shop Name */}
          <div className="min-w-0 flex-1 sm:flex-initial">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug tracking-tight truncate block">
                {tenant?.name || t('appName')}
              </span>
              <span className="hidden sm:inline rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 uppercase shrink-0">
                V1 SaaS
              </span>

              {tenant?.subscription?.status === 'ACTIVE' && (
                <span className="hidden sm:inline-flex rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-emerald-300 shrink-0">
                  PRO
                </span>
              )}
            </div>
            {/* Location & Role Subtitle - hidden on mobile to prevent row crowding */}
            <span className="hidden md:block text-xs text-slate-500 font-medium truncate mt-0.5">
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
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile search toggle button */}
          <button
            type="button"
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 cursor-pointer"
            title="Search"
            aria-label="Toggle Search"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Offline / Online indicator - desktop */}
          <div className="hidden md:flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border border-slate-200 bg-slate-50">
            {isOnline ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 hidden lg:inline">{t('online')}</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-rose-600 animate-pulse" />
                <span className="text-rose-700 font-bold">{t('offline')}</span>
              </>
            )}
          </div>

          {/* Language Switcher - desktop */}
          <div className="hidden md:flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
            <Globe className="h-3.5 w-3.5 text-slate-400 ml-1 hidden sm:inline" />
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded transition ${language === 'en' ? 'bg-white shadow-2xs text-blue-600 font-bold' : 'text-slate-600'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('hi')}
              className={`px-2 py-1 rounded transition ${language === 'hi' ? 'bg-white shadow-2xs text-blue-600 font-bold' : 'text-slate-600'}`}
            >
              HI
            </button>
            <button
              onClick={() => setLanguage('kn')}
              className={`px-2 py-1 rounded transition ${language === 'kn' ? 'bg-white shadow-2xs text-blue-600 font-bold' : 'text-slate-600'}`}
            >
              KN
            </button>
          </div>

          {/* Desktop User Info - click to change password */}
          <button
            type="button"
            onClick={() => setShowOwnPasswordModal(true)}
            title="Account Settings • Change Password"
            className="hidden xl:flex flex-col items-end text-right group cursor-pointer"
          >
            <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{user?.name}</span>
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">{user?.role}</span>
          </button>

          {/* Replay Guided Tour - desktop */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('start_guided_tour'))}
            title="Interactive Walkthrough"
            aria-label="Help and walkthrough"
            className="hidden md:flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center text-slate-500 hover:text-blue-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* Upgrade CTA Button */}
          {tenant?.subscription?.status !== 'ACTIVE' && (
            <button
              type="button"
              onClick={() => navigate('/subscription')}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-xs font-bold text-white shadow-xs hover:shadow-md hover:shadow-indigo-500/20 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 active:scale-[0.98] transition-all shrink-0 cursor-pointer"
              title="Upgrade Subscription & Plans"
              aria-label="Upgrade Subscription"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300 fill-amber-300/20 shrink-0" />
              <span>Upgrade</span>
            </button>
          )}

          {/* Change Password button for logged-in user (mobile & desktop) */}
          <button
            type="button"
            onClick={() => setShowOwnPasswordModal(true)}
            title="Change Password"
            aria-label="Change Password"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shrink-0 cursor-pointer"
          >
            <KeyRound className="h-5 w-5" />
          </button>

          {/* Logout button - desktop */}
          <button
            onClick={logout}
            title={t('logout')}
            aria-label="Logout"
            className="hidden md:flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-rose-600 transition-colors shrink-0 cursor-pointer"
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

      {/* Change Own Password Modal */}
      <ChangeOwnPasswordModal
        isOpen={showOwnPasswordModal}
        onClose={() => setShowOwnPasswordModal(false)}
      />
    </header>
  );
};
