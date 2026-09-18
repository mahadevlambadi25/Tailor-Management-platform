import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

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
  subscription?: {
    planName: string;
    status: string;
  };
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
  tenantSlug: string;
  setTenantSlug: (slug: string) => void;
  isLoading: boolean;
  refreshTenant: () => Promise<void>;
  isFeatureEnabled: (key: string) => boolean;
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

  return (
    <TenantContext.Provider value={{ tenant, tenantSlug, setTenantSlug, isLoading, refreshTenant: fetchTenant, isFeatureEnabled }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
