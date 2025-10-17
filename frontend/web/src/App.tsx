import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// Import extracted components
import SimpleLogin from './components/auth/SimpleLogin';
import SimpleDashboard from './components/dashboard/SimpleDashboard';
import SimpleCustomerList from './components/customers/SimpleCustomerList';
import { TimeManagement } from './components/time/TimeManagement';
import { WageManagement } from './components/wages/WageManagement';
import { AccountManagement } from './components/accounts/AccountManagement';
import VinylInventory from './components/inventory/VinylInventory';
import { SupplyChainDashboard } from './components/supplyChain/SupplyChainDashboard';
import { JobEstimationDashboard } from './components/jobEstimation/JobEstimationDashboard';
import { authApi } from './services/api';
import type { AccountUser } from './types/user';
import { SessionProvider } from './contexts/SessionContext';
import { SessionExpiredModal } from './components/common/SessionExpiredModal';

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
      
      <Route path="/job-estimation" element={
        user && (user.role === 'manager' || user.role === 'owner') ? <JobEstimationDashboard user={user} /> : <Navigate to="/dashboard" />
      } />
      
      
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
    </Routes>
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
