// File Clean up Finished: 2025-11-25
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// Eager imports (needed immediately)
import SimpleLogin from './components/auth/SimpleLogin';
import SimpleDashboard from './components/dashboard/SimpleDashboard';
import { authApi } from './services/api';
import type { AccountUser } from './types/user';
import { SessionProvider } from './contexts/SessionContext';
import { SessionExpiredModal } from './components/common/SessionExpiredModal';

// Lazy imports (loaded on demand)
const SimpleCustomerList = lazy(() => import('./components/customers/SimpleCustomerList'));
const TimeManagement = lazy(() => import('./components/time/TimeManagement').then(m => ({ default: m.TimeManagement })));
const WageManagement = lazy(() => import('./components/wages/WageManagement').then(m => ({ default: m.WageManagement })));
const AccountManagement = lazy(() => import('./components/accounts/AccountManagement').then(m => ({ default: m.AccountManagement })));
const VinylInventory = lazy(() => import('./components/inventory/VinylInventory'));
const SupplyChainDashboard = lazy(() => import('./components/supplyChain/SupplyChainDashboard').then(m => ({ default: m.SupplyChainDashboard })));
const JobEstimationDashboard = lazy(() => import('./components/jobEstimation/JobEstimationDashboard').then(m => ({ default: m.JobEstimationDashboard })));
const EstimateEditorPage = lazy(() => import('./components/jobEstimation/EstimateEditorPage').then(m => ({ default: m.EstimateEditorPage })));
const OrdersPage = lazy(() => import('./components/orders/OrdersPage'));
const OrderDetailsPage = lazy(() => import('./components/orders/details/OrderDetailsPage'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));
const SettingsIndex = lazy(() => import('./components/settings/SettingsIndex').then(m => ({ default: m.SettingsIndex })));
const SpecificationOptionsManager = lazy(() => import('./components/settings/SpecificationOptionsManager').then(m => ({ default: m.SpecificationOptionsManager })));
const TasksManager = lazy(() => import('./components/settings/TasksManager').then(m => ({ default: m.TasksManager })));
const RolesManager = lazy(() => import('./components/settings/RolesManager').then(m => ({ default: m.RolesManager })));
const AuditLogViewer = lazy(() => import('./components/settings/AuditLogViewer').then(m => ({ default: m.AuditLogViewer })));
const EmailTemplatesManager = lazy(() => import('./components/settings/EmailTemplatesManager').then(m => ({ default: m.EmailTemplatesManager })));
const PaintingMatrixManager = lazy(() => import('./components/settings/PaintingMatrixManager').then(m => ({ default: m.PaintingMatrixManager })));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const InvoicesPage = lazy(() => import('./components/invoices/InvoicesPage'));

// Loading component for lazy routes
const RouteLoader = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <p className="text-lg text-gray-600">Loading...</p>
    </div>
  </div>
);

function AppContent() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');

    if (!token && !refreshToken) {
      setIsLoading(false);
      setUser(null);
      return;
    }

    try {
      // Use the authApi which will automatically handle refresh via interceptor
      const data = await authApi.getCurrentUser();
      setUser(data.user as AccountUser);
    } catch (error) {
      console.error('Auth check failed:', error);
      handleLogout();
    } finally {
      setIsLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogin = (userData: AccountUser) => {
    setUser(userData);
    navigate('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" /> : <SimpleLogin onLogin={handleLogin} />
        } />

        <Route path="/dashboard" element={
          user ? <SimpleDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
        } />

        <Route path="/customers" element={
          user ? <SimpleCustomerList /> : <Navigate to="/login" />
        } />

        <Route path="/time-management" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <TimeManagement user={user} /> : <Navigate to="/dashboard" />
        } />

        <Route path="/vinyl-inventory" element={
          user ? <VinylInventory user={user} /> : <Navigate to="/login" />
        } />

        <Route path="/wages" element={
          user && user.role === 'owner' ? <WageManagement /> : <Navigate to="/dashboard" />
        } />

        <Route path="/account-management" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <AccountManagement user={user} /> : <Navigate to="/dashboard" />
        } />

        <Route path="/supply-chain" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <SupplyChainDashboard user={user} /> : <Navigate to="/dashboard" />
        } />

        {/* Estimate Editor - singular /estimate/:estimateId */}
        <Route path="/estimate/:estimateId" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <EstimateEditorPage user={user} /> : <Navigate to="/dashboard" />
        } />

        {/* Navigation page - uses query params ?cid=123&jid=456 */}
        <Route path="/estimates" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <JobEstimationDashboard user={user} /> : <Navigate to="/dashboard" />
        } />

        {/* Backwards compatibility redirect */}
        <Route path="/job-estimation" element={<Navigate to="/estimates" replace />} />

        <Route path="/orders" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <OrdersPage /> : <Navigate to="/dashboard" />
        } />
        <Route path="/orders/table" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <OrdersPage /> : <Navigate to="/dashboard" />
        } />
        <Route path="/orders/tasks" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <OrdersPage /> : <Navigate to="/dashboard" />
        } />
        <Route path="/orders/role-tasks" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <OrdersPage /> : <Navigate to="/dashboard" />
        } />
        <Route path="/orders/calendar" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <OrdersPage /> : <Navigate to="/dashboard" />
        } />

        <Route path="/orders/:orderNumber" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <OrderDetailsPage /> : <Navigate to="/dashboard" />
        } />

        {/* Settings - Nested Routes */}
        <Route path="/settings" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <SettingsPage /> : <Navigate to="/dashboard" />
        }>
          <Route index element={<SettingsIndex />} />
          <Route path="specifications" element={<SpecificationOptionsManager />} />
          <Route path="tasks" element={<TasksManager />} />
          <Route path="roles" element={<RolesManager />} />
          <Route path="painting-matrix" element={<PaintingMatrixManager />} />
          <Route path="email-templates" element={<EmailTemplatesManager />} />
          <Route path="audit-log" element={<AuditLogViewer />} />
        </Route>

        <Route path="/payments" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <PaymentsPage /> : <Navigate to="/dashboard" />
        } />

        {/* Invoices Page with tabs */}
        <Route path="/invoices" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <InvoicesPage /> : <Navigate to="/dashboard" />
        } />
        <Route path="/invoices/payments" element={
          user && (user.role === 'manager' || user.role === 'owner') ? <InvoicesPage /> : <Navigate to="/dashboard" />
        } />

        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <SessionProvider>
      <Router>
        <AppContent />
        <SessionExpiredModal />
      </Router>
    </SessionProvider>
  );
}

export default App;
