import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { TenantProvider } from './context/TenantContext';
import { AuthProvider } from './context/AuthContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { CustomerOtpPage } from './pages/auth/CustomerOtpPage';

// Main Application Pages
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { CustomerListPage } from './pages/customers/CustomerListPage';
import { CustomerProfilePage } from './pages/customers/CustomerProfilePage';
import { OrderListPage } from './pages/orders/OrderListPage';
import { OrderWizardPage } from './pages/orders/OrderWizardPage';
import { OrderDetailPage } from './pages/orders/OrderDetailPage';
import { ProductionBoardPage } from './pages/production/ProductionBoardPage';
import { AppointmentsPage } from './pages/appointments/AppointmentsPage';
import { MeasurementsPage } from './pages/measurements/MeasurementsPage';
import { StylesPage } from './pages/styles/StylesPage';
import { PaymentsPage } from './pages/payments/PaymentsPage';
import { StaffPage } from './pages/staff/StaffPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { PrintableShellPage } from './pages/documents/PrintableShellPage';
import CustomerPortalPage from './pages/customer-portal/CustomerPortalPage';
import SettingsPage from './pages/settings/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <TenantProvider>
          <AuthProvider>
            <OfflineSyncProvider>
              <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/portal/login" element={<CustomerOtpPage />} />

                {/* Customer Facing Portal */}
                <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'SHOP_OWNER', 'MANAGER', 'RECEPTIONIST']} />}>
                  <Route path="/portal" element={<CustomerPortalPage />} />
                  <Route path="/customer-portal" element={<CustomerPortalPage />} />
                  <Route path="/customer-portal/demo" element={<CustomerPortalPage />} />
                </Route>

                {/* Protected Staff & Atelier Management Routes */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    
                    {/* Customers Module */}
                    <Route path="/customers" element={<CustomerListPage />} />
                    <Route path="/customers/:id" element={<CustomerProfilePage />} />

                    {/* Orders Module */}
                    <Route path="/orders" element={<OrderListPage />} />
                    <Route path="/orders/new" element={<OrderWizardPage />} />
                    <Route path="/orders/:id" element={<OrderDetailPage />} />

                    {/* Production & Kanban */}
                    <Route path="/production" element={<ProductionBoardPage />} />

                    {/* Appointments & Fitting Schedule */}
                    <Route path="/appointments" element={<AppointmentsPage />} />

                    {/* Measurements Catalog */}
                    <Route path="/measurements" element={<MeasurementsPage />} />

                    {/* Style Catalog */}
                    <Route path="/styles" element={<StylesPage />} />

                    {/* Payments & Financial Transactions */}
                    <Route path="/payments" element={<PaymentsPage />} />

                    {/* Staff & RBAC Management (Owner / Manager only) */}
                    <Route element={<ProtectedRoute allowedRoles={['SHOP_OWNER', 'MANAGER']} />}>
                      <Route path="/staff" element={<StaffPage />} />
                    </Route>

                    {/* Analytics & Business Reports */}
                    <Route element={<ProtectedRoute allowedRoles={['SHOP_OWNER', 'MANAGER', 'CASHIER']} />}>
                      <Route path="/reports" element={<ReportsPage />} />
                    </Route>

                    {/* Document Print Shells */}
                    <Route path="/documents" element={<PrintableShellPage />} />
                    <Route path="/documents/:type/:id" element={<PrintableShellPage />} />

                    {/* Atelier Settings & Policy Management */}
                    <Route element={<ProtectedRoute allowedRoles={['SHOP_OWNER']} />}>
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                  </Route>
                </Route>

                {/* Catch-all fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </OfflineSyncProvider>
          </AuthProvider>
        </TenantProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
