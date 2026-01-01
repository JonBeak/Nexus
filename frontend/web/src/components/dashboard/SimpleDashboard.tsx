import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import TimeTracking from '../time/TimeTracking';
import TimeApprovals from '../time/TimeApprovals';
import type { AccountUser } from '../../types/user';
import { apiClient } from '../../services/api';
import { MODULE_COLORS, PAGE_STYLES, getModulePillClasses, getModuleCardClasses } from '../../constants/moduleColors';
import '../jobEstimation/JobEstimation.css';

// Backup Status Types
interface BackupInfo {
  name: string;
  schedule: string;
  lastBackup: string | null;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  fileCount?: number;
  latestFile?: string;
  latestSize?: string;
  isComplete?: boolean;
}

interface BackupStatusData {
  backups: BackupInfo[];
  serverTime: string;
}

interface SimpleDashboardProps {
  user: AccountUser;
  onLogout: () => void;
}

function SimpleDashboard({ user, onLogout }: SimpleDashboardProps) {
  const navigate = useNavigate();
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatusData | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  // Theme state - 'industrial' (default) or 'light'
  const [theme, setTheme] = useState<'industrial' | 'light'>(() => {
    // Initialize from localStorage or default to 'industrial'
    const saved = localStorage.getItem('signhouse-theme');
    return (saved === 'light' ? 'light' : 'industrial') as 'industrial' | 'light';
  });

  // Apply theme on mount and when theme changes
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('signhouse-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'industrial' ? 'light' : 'industrial');
  };

  // Fetch backup status for owners
  useEffect(() => {
    if (user.role === 'owner') {
      fetchBackupStatus();
    }
  }, [user.role]);

  const fetchBackupStatus = async () => {
    setBackupLoading(true);
    setBackupError(null);
    try {
      const response = await apiClient.get('/system/backup-status');
      setBackupStatus(response.data);
    } catch (error: any) {
      console.error('Failed to fetch backup status:', error);
      setBackupError(error.response?.data?.message || 'Failed to load backup status');
    } finally {
      setBackupLoading(false);
    }
  };

  const runTest = async () => {
    setTestLoading(true);
    setTestResult(null);

    try {
      // ==================================================
      // TEST QUICKBOOKS SPECIAL PATTERNS
      // ==================================================
      console.log('🧪 Testing QuickBooks Special Patterns...');

      const response = await apiClient.post('/quickbooks-test/row-types', {
        customerName: 'Sign House Inc.',
        useHardcodedTest: true,
        debugMode: true
      });

      // Interceptor unwraps { success: true, data: T } to just T
      // So response.data directly contains { qbEstimateId, qbDocNumber, linesCreated }
      if (response.data.qbEstimateId) {
        const { qbEstimateId, qbDocNumber, linesCreated } = response.data;
        setTestResult(`✅ SUCCESS!

QB Estimate ID: ${qbEstimateId}
QB Doc Number: ${qbDocNumber}
Lines Created: ${linesCreated}

Check backend logs for detailed comparison!`);
      } else {
        setTestResult(`❌ FAILED: ${response.data.error || 'Unknown error'}`);
      }

    } catch (error: any) {
      console.error('❌ Test failed:', error);
      setTestResult(`❌ ERROR: ${error.response?.data?.error || error.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className={PAGE_STYLES.fullPage}>
      <header className={`${PAGE_STYLES.panel.background} shadow-lg border-b-4 border-primary-red`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-red rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${PAGE_STYLES.panel.text}`}>Sign House Web</h1>
                <p className={`text-lg ${PAGE_STYLES.panel.textSecondary}`}>Welcome back, {user.first_name}!</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`p-3 rounded-lg ${PAGE_STYLES.header.background} ${PAGE_STYLES.interactive.hover} ${PAGE_STYLES.panel.text} transition-colors shadow-lg`}
                title={theme === 'industrial' ? 'Switch to Light Theme' : 'Switch to Industrial Theme'}
              >
                {theme === 'industrial' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              <button
                onClick={onLogout}
                className="bg-primary-red hover:bg-primary-red-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
        {(user.role === 'production_staff' || user.role === 'designer') ? (
          // Staff and Designer Dashboard - Actions left, Time Tracking right (wider)
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Actions (1 column) */}
            <div className="lg:col-span-1">
              <div className={`${PAGE_STYLES.composites.panelContainer} p-8`}>
                <h3 className={`text-2xl font-bold ${PAGE_STYLES.panel.text} mb-8`}>{user.role === 'designer' ? 'Designer Actions' : 'Staff Actions'}</h3>

                <div className="grid grid-cols-1 gap-6">
                  <button
                    onClick={() => navigate('/vinyl-inventory')}
                    className={getModuleCardClasses('vinyls')}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg ${MODULE_COLORS.vinyls.text} text-2xl font-bold`}>
                        V
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">{MODULE_COLORS.vinyls.name}</h4>
                        <p className={MODULE_COLORS.vinyls.lightText}>Manage vinyl stock</p>
                      </div>
                    </div>
                  </button>

                  <button
                    className={`group p-6 ${PAGE_STYLES.header.background} rounded-2xl transition-all duration-300 text-left shadow-lg cursor-not-allowed`}
                    disabled
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 ${PAGE_STYLES.panel.background} rounded-xl flex items-center justify-center shadow-lg`}>
                        <span className={`${PAGE_STYLES.panel.textMuted} text-2xl`}>📋</span>
                      </div>
                      <div>
                        <h4 className={`font-bold ${PAGE_STYLES.panel.text} text-lg`}>Request Supplies</h4>
                        <p className={PAGE_STYLES.panel.textMuted}>Coming soon</p>
                      </div>
                    </div>
                  </button>

                  <button
                    className={`group p-6 ${PAGE_STYLES.header.background} rounded-2xl transition-all duration-300 text-left shadow-lg cursor-not-allowed`}
                    disabled
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 ${PAGE_STYLES.panel.background} rounded-xl flex items-center justify-center shadow-lg`}>
                        <span className={`${PAGE_STYLES.panel.textMuted} text-2xl`}>📄</span>
                      </div>
                      <div>
                        <h4 className={`font-bold ${PAGE_STYLES.panel.text} text-lg`}>Request Documents</h4>
                        <p className={PAGE_STYLES.panel.textMuted}>Coming soon</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Time Tracking (2 columns, wider) */}
            <div className="lg:col-span-2">
              <TimeTracking />
            </div>
          </div>
        ) : user.role === 'owner' ? (
          // Owner Dashboard - Compact Pages on left, content on right
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Pages Navigation - Compact sidebar pills */}
            <div className="lg:col-span-1">
              <div className={`${PAGE_STYLES.composites.panelContainer} p-6`}>
                <h3 className={`text-xl font-bold ${PAGE_STYLES.panel.text} mb-4`}>Pages</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate('/estimates')}
                    className={getModulePillClasses('estimates')}
                  >
                    {MODULE_COLORS.estimates.name}
                  </button>
                  <button
                    onClick={() => navigate('/orders')}
                    className={getModulePillClasses('orders')}
                  >
                    {MODULE_COLORS.orders.name}
                  </button>
                  <button
                    onClick={() => navigate('/supply-chain')}
                    className={getModulePillClasses('supplyChain')}
                  >
                    {MODULE_COLORS.supplyChain.name}
                  </button>
                  <button
                    onClick={() => navigate('/invoices')}
                    className={getModulePillClasses('invoices')}
                  >
                    {MODULE_COLORS.invoices.name}
                  </button>
                  <button
                    onClick={() => navigate('/customers')}
                    className={getModulePillClasses('customers')}
                  >
                    {MODULE_COLORS.customers.name}
                  </button>
                  <button
                    onClick={() => navigate('/vinyl-inventory')}
                    className={getModulePillClasses('vinyls')}
                  >
                    {MODULE_COLORS.vinyls.name}
                  </button>
                  <button
                    onClick={() => navigate('/time-management')}
                    className={getModulePillClasses('timeTracking')}
                  >
                    {MODULE_COLORS.timeTracking.name}
                  </button>
                  <button
                    onClick={() => navigate('/wages')}
                    className={getModulePillClasses('wages')}
                  >
                    {MODULE_COLORS.wages.name}
                  </button>
                  <button
                    onClick={() => navigate('/account-management')}
                    className={getModulePillClasses('accounts')}
                  >
                    {MODULE_COLORS.accounts.name}
                  </button>
                  <button
                    onClick={() => navigate('/settings')}
                    className={getModulePillClasses('settings')}
                  >
                    {MODULE_COLORS.settings.name}
                  </button>
                  <button
                    onClick={() => navigate('/server-management')}
                    className={getModulePillClasses('servers')}
                  >
                    {MODULE_COLORS.servers.name}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Time Approvals and System Status */}
            <div className="lg:col-span-2">
              <TimeApprovals />

              {/* Database Backup Status */}
              <div className={`${PAGE_STYLES.composites.panelContainer} p-6 mt-8`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-bold ${PAGE_STYLES.panel.text}`}>Database Backups</h3>
                  <button
                    onClick={fetchBackupStatus}
                    disabled={backupLoading}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    {backupLoading ? '...' : 'Refresh'}
                  </button>
                </div>

                {backupError && (
                  <p className="text-red-600 text-sm mb-2">{backupError}</p>
                )}

                {backupLoading && !backupStatus && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  </div>
                )}

                {backupStatus && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {backupStatus.backups.map((backup, index) => (
                      <div
                        key={index}
                        className={`flex items-center space-x-2 p-3 ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.panel.border} border`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0 ${
                            backup.status === 'healthy'
                              ? 'bg-green-500'
                              : backup.status === 'warning'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                        ></div>
                        <div className="min-w-0">
                          <p className={`font-semibold ${PAGE_STYLES.panel.text} text-sm truncate`}>{backup.name}</p>
                          <p className={`text-xs ${
                            backup.status === 'healthy'
                              ? 'text-green-600'
                              : backup.status === 'warning'
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}>
                            {backup.lastBackup || backup.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* System Development Progress */}
              <div className={`${PAGE_STYLES.composites.panelContainer} p-6 mt-8`}>
                <h3 className={`text-lg font-bold ${PAGE_STYLES.panel.text} mb-4`}>Development Progress</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className={`flex items-center space-x-2 p-2 ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.panel.border} border`}>
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className={`text-sm ${PAGE_STYLES.panel.text}`}>Customers</span>
                  </div>
                  <div className={`flex items-center space-x-2 p-2 ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.panel.border} border`}>
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className={`text-sm ${PAGE_STYLES.panel.text}`}>Estimates</span>
                  </div>
                  <div className={`flex items-center space-x-2 p-2 ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.panel.border} border`}>
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className={`text-sm ${PAGE_STYLES.panel.text}`}>Vinyl</span>
                  </div>
                  <div className={`flex items-center space-x-2 p-2 ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.panel.border} border`}>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0"></div>
                    <span className={`text-sm ${PAGE_STYLES.panel.text}`}>Job Board</span>
                  </div>
                  <div className={`flex items-center space-x-2 p-2 ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.panel.border} border`}>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0"></div>
                    <span className={`text-sm ${PAGE_STYLES.panel.text}`}>Invoicing</span>
                  </div>
                  <div className={`flex items-center space-x-2 p-2 ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.panel.border} border`}>
                    <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                    <span className={`text-sm ${PAGE_STYLES.panel.text}`}>Inventory</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Manager Dashboard - Compact pages on left, Time Approvals on right (same layout as Owner)
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Pages Navigation - Compact sidebar pills */}
            <div className="lg:col-span-1">
              <div className={`${PAGE_STYLES.composites.panelContainer} p-6`}>
                <h3 className={`text-xl font-bold ${PAGE_STYLES.panel.text} mb-4`}>Pages</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate('/estimates')}
                    className={getModulePillClasses('estimates')}
                  >
                    {MODULE_COLORS.estimates.name}
                  </button>
                  <button
                    onClick={() => navigate('/orders')}
                    className={getModulePillClasses('orders')}
                  >
                    {MODULE_COLORS.orders.name}
                  </button>
                  <button
                    onClick={() => navigate('/supply-chain')}
                    className={getModulePillClasses('supplyChain')}
                  >
                    {MODULE_COLORS.supplyChain.name}
                  </button>
                  <button
                    onClick={() => navigate('/invoices')}
                    className={getModulePillClasses('invoices')}
                  >
                    {MODULE_COLORS.invoices.name}
                  </button>
                  <button
                    onClick={() => navigate('/customers')}
                    className={getModulePillClasses('customers')}
                  >
                    {MODULE_COLORS.customers.name}
                  </button>
                  <button
                    onClick={() => navigate('/vinyl-inventory')}
                    className={getModulePillClasses('vinyls')}
                  >
                    {MODULE_COLORS.vinyls.name}
                  </button>
                  <button
                    onClick={() => navigate('/time-management')}
                    className={getModulePillClasses('timeTracking')}
                  >
                    {MODULE_COLORS.timeTracking.name}
                  </button>
                  <button
                    onClick={() => navigate('/account-management')}
                    className={getModulePillClasses('accounts')}
                  >
                    {MODULE_COLORS.accounts.name}
                  </button>
                  <button
                    onClick={() => navigate('/settings')}
                    className={getModulePillClasses('settings')}
                  >
                    {MODULE_COLORS.settings.name}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Time Approvals */}
            <div className="lg:col-span-2">
              <TimeApprovals />
            </div>
          </div>
        )}
      </main>

      {/* Test Button - Dev/Testing Only */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={runTest}
          disabled={testLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testLoading ? '🔄 Testing QB Patterns...' : '🧪 Test QB Special Patterns'}
        </button>

        {testResult && (
          <div className={`absolute bottom-16 right-0 ${PAGE_STYLES.panel.background} rounded-lg shadow-2xl p-6 border-2 ${PAGE_STYLES.panel.border} min-w-96 max-w-2xl`}>
            <button
              onClick={() => setTestResult(null)}
              className={`absolute top-2 right-2 ${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.text}`}
            >
              ✕
            </button>
            <pre className={`text-sm whitespace-pre-wrap ${PAGE_STYLES.panel.text}`}>{testResult}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default SimpleDashboard;
