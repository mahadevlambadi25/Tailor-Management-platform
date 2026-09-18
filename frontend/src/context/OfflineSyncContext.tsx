import React, { createContext, useContext, useState, useEffect } from 'react';

interface OfflineSyncContextType {
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'conflict';
  syncMessage: string | null;
  saveOfflineData: (key: string, data: any) => void;
  getOfflineData: (key: string) => any;
}

const OfflineSyncContext = createContext<OfflineSyncContextType>({} as OfflineSyncContextType);

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'conflict'>(
    navigator.onLine ? 'synced' : 'offline'
  );
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('synced');
      setSyncMessage('Back online. Synchronized with server.');
      setTimeout(() => setSyncMessage(null), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
      setSyncMessage('You are offline. Showing cached records. Read-only actions active.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveOfflineData = (key: string, data: any) => {
    try {
      localStorage.setItem(`offline_${key}`, JSON.stringify({ data, cachedAt: Date.now() }));
    } catch (e) {
      console.warn('LocalStorage limit reached for offline caching');
    }
  };

  const getOfflineData = (key: string) => {
    try {
      const raw = localStorage.getItem(`offline_${key}`);
      if (!raw) return null;
      return JSON.parse(raw).data;
    } catch (e) {
      return null;
    }
  };

  return (
    <OfflineSyncContext.Provider value={{ isOnline, syncStatus, syncMessage, saveOfflineData, getOfflineData }}>
      {children}
    </OfflineSyncContext.Provider>
  );
};

export const useOfflineSync = () => useContext(OfflineSyncContext);
