import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../api/client';
import { AlertCircle } from 'lucide-react';
import { SampleDataBanner } from '../conversion/SampleDataBanner';
import { ExpiredTrialBanner } from '../conversion/ExpiredTrialBanner';
import { GuidedTour } from '../conversion/GuidedTour';

export const AppLayout: React.FC = () => {
  const { isOnline, syncMessage } = useOfflineSync();
  const { tenant, refreshTenant } = useTenant();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Conversion: Sample Data state
  const [sampleStatus, setSampleStatus] = useState<{
    hasSampleData: boolean;
    sampleCustomerCount: number;
    sampleOrderCount: number;
    showFirstCustomerPrompt: boolean;
  }>({
    hasSampleData: false,
    sampleCustomerCount: 0,
    sampleOrderCount: 0,
    showFirstCustomerPrompt: false
  });

  // Conversion: Guided tour state
  const [tourOpen, setTourOpen] = useState(false);

  const fetchSampleStatus = async () => {
    try {
      const res = await api.get('/conversion/sample-data/status');
      if (res.data?.success) {
        setSampleStatus(res.data.data);
      }
    } catch {
      // safe fallback
    }
  };

  useEffect(() => {
    fetchSampleStatus();

    // Check if tour should auto-start on first entry
    api.get('/conversion/onboarding/status').then(res => {
      if (res.data?.success && !res.data.data?.tourCompleted) {
        // Automatically start tour on fresh shop entry
        setTourOpen(true);
      }
    }).catch(() => {});

    // Listen for custom event to replay tour from Help/Navbar
    const handleReplayTour = () => setTourOpen(true);
    window.addEventListener('start_guided_tour', handleReplayTour);
    return () => window.removeEventListener('start_guided_tour', handleReplayTour);
  }, []);

  const handleClearSampleData = async () => {
    await fetchSampleStatus();
    await refreshTenant();
  };

  const handleDismissFirstCustomerPrompt = async () => {
    try {
      await api.post('/conversion/sample-prompt/dismiss');
      setSampleStatus(prev => ({ ...prev, showFirstCustomerPrompt: false }));
    } catch {
      // safe
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50 antialiased overflow-hidden">
      <Navbar onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)} />

      {/* Top Conversion Banners */}
      <ExpiredTrialBanner />
      <SampleDataBanner
        hasSampleData={sampleStatus.hasSampleData}
        onClearSampleData={handleClearSampleData}
        onAddCustomerClick={() => navigate('/customers?action=new')}
        showFirstCustomerPrompt={sampleStatus.showFirstCustomerPrompt}
        onDismissFirstCustomerPrompt={handleDismissFirstCustomerPrompt}
      />

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
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-8 touch-pan-x">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav onOpenMenu={() => setMobileMenuOpen(true)} />

      {/* Interactive Guided Tour */}
      <GuidedTour
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        onComplete={() => setTourOpen(false)}
      />
    </div>
  );
};
