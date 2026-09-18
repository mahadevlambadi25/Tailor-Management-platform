import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute: React.FC<{ allowedRoles?: string[] }> = ({ allowedRoles }) => {
  const { user, isLoading, token } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Verifying security credentials...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'SAAS_OWNER') {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
        <p className="mt-2 text-slate-600">Your role ({user.role}) does not have permission to view this section.</p>
      </div>
    );
  }

  return <Outlet />;
};
