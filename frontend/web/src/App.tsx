// File Clean up Finished: 2025-11-25
// Auth refactored to AuthContext: 2026-01-16
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Eager imports (needed immediately)
import SimpleLogin from './components/auth/SimpleLogin';
import SimpleDashboard from './components/dashboard/SimpleDashboard';
import { SessionProvider } from './contexts/SessionContext';
import { SessionExpiredModal } from './components/common/SessionExpiredModal';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';
import { FeedbackButton } from './components/feedback';

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
const FeedbackManager = lazy(() => import('./components/settings/FeedbackManager').then(m => ({ default: m.FeedbackManager })));
const FeedbackPage = lazy(() => import('./components/feedback/FeedbackPage'));
const MyFeedbackPage = lazy(() => import('./components/feedback/MyFeedbackPage'));
const EmailTemplatesManager = lazy(() => import('./components/settings/EmailTemplatesManager').then(m => ({ default: m.EmailTemplatesManager })));
const PaintingMatrixManager = lazy(() => import('./components/settings/PaintingMatrixManager').then(m => ({ default: m.PaintingMatrixManager })));
const VinylApplicationMatrixManager = lazy(() => import('./components/settings/VinylApplicationMatrixManager').then(m => ({ default: m.VinylApplicationMatrixManager })));
const LEDTypesManager = lazy(() => import('./components/settings/LEDTypesManager').then(m => ({ default: m.LEDTypesManager })));
const PowerSuppliesManager = lazy(() => import('./components/settings/PowerSuppliesManager').then(m => ({ default: m.PowerSuppliesManager })));
const PricingManager = lazy(() => import('./components/settings/pricing/PricingManager').then(m => ({ default: m.PricingManager })));
const ValidationRulesManager = lazy(() => import('./components/settings/validationRules/ValidationRulesManager').then(m => ({ default: m.ValidationRulesManager })));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const InvoicesPage = lazy(() => import('./components/invoices/InvoicesPage'));
const ServerManagement = lazy(() => import('./components/serverManagement/ServerManagement'));
const StaffJobsPage = lazy(() => import('./components/staff/StaffJobsPage'));
const FileBrowser = lazy(() => import('./components/fileBrowser/FileBrowser'));

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
  const { user, isLoading, isManager, isOwner, login, logout } = useAuth();

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
          user ? <Navigate to="/dashboard" /> : <SimpleLogin onLogin={login} />
        } />

        <Route path="/dashboard" element={
          user ? <SimpleDashboard user={user} onLogout={logout} /> : <Navigate to="/login" />
        } />

        <Route path="/customers" element={
          user ? <SimpleCustomerList /> : <Navigate to="/login" />
        } />

        <Route path="/time-management" element={
          isManager ? <TimeManagement user={user!} /> : <Navigate to="/dashboard" />
        } />

        <Route path="/vinyl-inventory" element={
          user ? <VinylInventory user={user} /> : <Navigate to="/login" />
        } />

        {/* Staff Jobs Page - accessible to all authenticated users */}
        <Route path="/jobs" element={
          user ? <StaffJobsPage user={user} /> : <Navigate to="/login" />
        } />

        <Route path="/wages" element={
          isOwner ? <WageManagement /> : <Navigate to="/dashboard" />
        } />

        <Route path="/account-management" element={
          isManager ? <AccountManagement user={user!} /> : <Navigate to="/dashboard" />
        } />

        <Route path="/supply-chain" element={
          isManager ? <SupplyChainDashboard user={user!} /> : <Navigate to="/dashboard" />
        } />
        <Route path="/supply-chain/all-orders" element={
          isManager ? <SupplyChainDashboard user={user!} /> : <Navigate to="/dashboard" />
        } />
        <Route path="/supply-chain/shopping-cart" element={
          isManager ? <SupplyChainDashboard user={user!} /> : <Navigate to="/dashboard" />
        } />
        <Route path="/supply-chain/vinyl-inventory" element={
          isManager ? <SupplyChainDashboard user={user!} /> : <Navigate to="/dashboard" />
        } />
        <Route path="/supply-chain/inventory" element={
          isManager ? <SupplyChainDashboard user={user!} /> : <Navigate to="/dashboard" />
        } />
        <Route path="/supply-chain/suppliers" element={
          isManager ? <SupplyChainDashboard user={user!} /> : <Navigate to="/dashboard" />
        } />
        <Route path="/supply-chain/supplier-products-orders" element={
          isManager ? <SupplyChainDashboard user={user!} /> : <Navigate to="/dashboard" />
        } />
        <Route path="/supply-chain/product-types" element={
          isManager ? <SupplyChainDashboard user={user!} /> : <Navigate to="/dashboard" />
        } />
        <Route path="/supply-chain/low-stock" element={
          isManager ? <SupplyChainDashboard user={user!} /> : <Navigate to="/dashboard" />
        } />

        {/* Estimate Editor - singular /estimate/:estimateId */}
        <Route path="/estimate/:estimateId" element={
          isManager ? <EstimateEditorPage user={user!} /> : <Navigate to="/dashboard" />
        } />

        {/* Navigation page - uses query params ?cid=123&jid=456 */}
        <Route path="/estimates" element={
          isManager ? <JobEstimationDashboard user={user!} /> : <Navigate to="/dashboard" />
        } />

        {/* Backwards compatibility redirect */}
        <Route path="/job-estimation" element={<Navigate to="/estimates" replace />} />

        <Route path="/orders" element={
          isManager ? <OrdersPage /> : <Navigate to="/dashboard" />
        } />
        <Route path="/orders/table" element={
          isManager ? <OrdersPage /> : <Navigate to="/dashboard" />
        } />
        <Route path="/orders/tasks" element={
          isManager ? <OrdersPage /> : <Navigate to="/dashboard" />
        } />
        <Route path="/orders/role-tasks" element={
          isManager ? <OrdersPage /> : <Navigate to="/dashboard" />
        } />
        <Route path="/orders/calendar" element={
          isManager ? <OrdersPage /> : <Navigate to="/dashboard" />
        } />
        <Route path="/orders/kanban" element={
          isManager ? <OrdersPage /> : <Navigate to="/dashboard" />
        } />

        <Route path="/orders/:orderNumber" element={
          isManager ? <OrderDetailsPage /> : <Navigate to="/dashboard" />
        } />

        {/* Settings - Nested Routes */}
        <Route path="/settings" element={
          isManager ? <SettingsPage /> : <Navigate to="/dashboard" />
        }>
          <Route index element={<SettingsIndex />} />
          <Route path="specifications" element={<SpecificationOptionsManager />} />
          <Route path="tasks" element={<TasksManager />} />
          <Route path="roles" element={<RolesManager />} />
          <Route path="painting-matrix" element={<PaintingMatrixManager />} />
          <Route path="vinyl-matrix" element={<VinylApplicationMatrixManager />} />
          <Route path="email-templates" element={<EmailTemplatesManager />} />
          <Route path="led-types" element={<LEDTypesManager />} />
          <Route path="power-supplies" element={<PowerSuppliesManager />} />
          <Route path="pricing" element={<PricingManager />} />
          <Route path="validation-rules" element={<ValidationRulesManager />} />
          <Route path="audit-log" element={<AuditLogViewer />} />
          <Route path="feedback" element={<FeedbackManager />} />
        </Route>

        <Route path="/payments" element={
          isManager ? <PaymentsPage /> : <Navigate to="/dashboard" />
        } />

        {/* Invoices Page with tabs */}
        <Route path="/invoices" element={
          isManager ? <InvoicesPage /> : <Navigate to="/dashboard" />
        } />
        <Route path="/invoices/payments" element={
          isManager ? <InvoicesPage /> : <Navigate to="/dashboard" />
        } />

        {/* Server Management - Owner only */}
        <Route path="/server-management" element={
          isOwner ? <ServerManagement /> : <Navigate to="/dashboard" />
        } />

        {/* File Browser - Manager+ */}
        <Route path="/file-browser" element={
          isManager ? <FileBrowser /> : <Navigate to="/dashboard" />
        } />

        {/* Feedback Manager - Manager+ */}
        <Route path="/feedback" element={
          isManager ? <FeedbackPage /> : <Navigate to="/dashboard" />
        } />

        {/* My Feedback - All authenticated users */}
        <Route path="/my-feedback" element={
          user ? <MyFeedbackPage /> : <Navigate to="/login" />
        } />

        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <SessionProvider>
      <ThemeProvider>
        <Router>
          <AuthProvider>
            <AlertProvider>
              <AppContent />
              <SessionExpiredModal />
              <FeedbackButton />
            </AlertProvider>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </SessionProvider>
  );
}

export default App;
