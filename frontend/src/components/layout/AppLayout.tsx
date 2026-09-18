import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { AlertCircle } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { isOnline, syncMessage } = useOfflineSync();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-slate-50 antialiased overflow-hidden">
      <Navbar onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)} />

      {(!isOnline || syncMessage) && (
        <div className={`flex items-center justify-center gap-2 py-1.5 px-3 text-[11px] sm:text-xs font-medium ${
          isOnline ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
        }`}>
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{syncMessage || 'Working in Offline Mode. Cached records available.'}</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8 pb-20 md:pb-8">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav onOpenMenu={() => setMobileMenuOpen(true)} />
    </div>
  );
};
