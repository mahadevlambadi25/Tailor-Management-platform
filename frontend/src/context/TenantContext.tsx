import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

export interface SubscriptionDetails {
  id?: string;
  tenantId?: string;
  planName: string;
  status: 'TRIAL' | 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAST_DUE' | string;
  trialUsed?: boolean;
  isTrialEligible?: boolean;
  trialStart?: string | null;
  trialEnd?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  cancelAtPeriodEnd?: boolean;
  maxOrdersPerMonth?: number;
  maxStaff?: number;
  maxBranches?: number;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string | null;
  address: string | null;
  city?: string | null;
  currency: string;
  defaultUnit: 'INCHES' | 'CENTIMETERS';
  gstNumber: string | null;
  config?: any;
  subscription?: SubscriptionDetails;
  featureFlags?: Array<{ featureKey: string; isEnabled: boolean }>;
  demoStats?: {
    demoOrdersCount: number;
    demoCustomersCount: number;
    demoAppointmentsCount?: number;
    hasDemoData: boolean;
  };
}

interface TenantContextType {
  tenant: TenantInfo | null;
  subscription: SubscriptionDetails | null;
  tenantSlug: string;
  setTenantSlug: (slug: string) => void;
  isLoading: boolean;
  isSubscriptionActive: boolean;
  isSubscriptionExpired: boolean;
  isTrial: boolean;
  trialDaysRemaining: number;
  refreshTenant: () => Promise<void>;
  isFeatureEnabled: (key: string) => boolean;
  startTrial: () => Promise<{ success: boolean; data?: any; error?: any }>;
}

const TenantContext = createContext<TenantContextType>({} as TenantContextType);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenantSlug, setTenantSlugState] = useState<string>(
    localStorage.getItem('tailor_tenant_slug') || 'royal-bespoke'
  );
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTenant = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/tenants');
      if (res.data.success) {
        setTenant(res.data.data);
      }
    } catch (e) {
      console.warn('Failed to load tenant info');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
  }, [tenantSlug]);

  const setTenantSlug = (slug: string) => {
    setTenantSlugState(slug);
    localStorage.setItem('tailor_tenant_slug', slug);
  };

  const isFeatureEnabled = (key: string): boolean => {
    if (!tenant?.featureFlags) return false;
    const flag = tenant.featureFlags.find(f => f.featureKey === key);
    return flag ? flag.isEnabled : false;
  };

  const subscription = tenant?.subscription || null;
  const isTrial = subscription?.status === 'TRIAL';
  const isSubscriptionExpired = subscription?.status === 'EXPIRED';
  const isSubscriptionActive = subscription?.status === 'ACTIVE' || (
    isTrial && (!subscription?.trialEnd || new Date(subscription.trialEnd).getTime() > Date.now())
  );

  let trialDaysRemaining = 0;
  if (isTrial && subscription?.trialEnd) {
    const diff = new Date(subscription.trialEnd).getTime() - Date.now();
    trialDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const startTrial = async (): Promise<{ success: boolean; data?: any; error?: any }> => {
    try {
      const res = await api.post('/subscriptions/start-trial');
      if (res.data.success) {
        await fetchTenant();
        return { success: true, data: res.data.data };
      }
      return { success: false, error: res.data.error || 'Failed to start trial' };
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to start trial';
      return { success: false, error: errMsg };
    }
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        subscription,
        tenantSlug,
        setTenantSlug,
        isLoading,
        isSubscriptionActive,
        isSubscriptionExpired,
        isTrial,
        trialDaysRemaining,
        refreshTenant: fetchTenant,
        isFeatureEnabled,
        startTrial
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
