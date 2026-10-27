import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

export interface User {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
  role: string;
  customerId?: string;
  branch?: { id: string; name: string } | null;
  tenant?: { id: string; name: string; slug: string };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  permissions: string[];
  isLoading: boolean;
  login: (token: string, user: User, permissions: string[]) => void;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('tailor_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('tailor_token'));
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(!token ? false : true);

  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        if (res.data?.success) {
          const fetchedUser = res.data.data.user;
          setUser(fetchedUser);
          setPermissions(res.data.data.permissions || []);
          localStorage.setItem('tailor_user', JSON.stringify(fetchedUser));
          if (fetchedUser.tenant?.slug) {
            localStorage.setItem('tailor_tenant_slug', fetchedUser.tenant.slug);
          }
        }
      } catch (err: any) {
        console.warn('Session verification notice:', err?.response?.status, err?.message);
        // Only invalidate the session if the token is definitively rejected by authentication middleware
        if (
          err.response?.status === 401 ||
          err.response?.data?.error?.code === 'TOKEN_INVALID' ||
          err.response?.data?.error?.code === 'ACCOUNT_DEACTIVATED'
        ) {
          logout();
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchMe();
  }, [token]);

  const login = (newToken: string, newUser: User, newPerms: string[]) => {
    setToken(newToken);
    setUser(newUser);
    setPermissions(newPerms);
    localStorage.setItem('tailor_token', newToken);
    localStorage.setItem('tailor_user', JSON.stringify(newUser));
    if (newUser.tenant?.slug) {
      localStorage.setItem('tailor_tenant_slug', newUser.tenant.slug);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setPermissions([]);
    localStorage.removeItem('tailor_token');
    localStorage.removeItem('tailor_user');
  };

  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    if (user.role === 'SAAS_OWNER' || permissions.includes('*')) return true;
    const domain = perm.split(':')[0];
    return permissions.includes(`${domain}:*`) || permissions.includes(perm);
  };

  const hasRole = (...roles: string[]): boolean => {
    if (!user) return false;
    if (user.role === 'SAAS_OWNER') return true;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, token, permissions, isLoading, login, logout, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
