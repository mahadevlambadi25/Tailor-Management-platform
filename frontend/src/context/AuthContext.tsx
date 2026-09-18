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
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('tailor_token'));
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        if (res.data.success) {
          setUser(res.data.data.user);
          setPermissions(res.data.data.permissions || []);
        }
      } catch (err) {
        console.error('Session validation failed', err);
        logout();
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
