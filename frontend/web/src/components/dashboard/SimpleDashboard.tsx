import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TimeTracking from '../time/TimeTracking';
import TimeApprovals from '../time/TimeApprovals';
import type { AccountUser } from '../../types/user';
import { apiClient } from '../../services/api';

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
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-lg border-b-4 border-primary-red">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-red rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Sign House Web</h1>
                <p className="text-lg text-gray-600">Welcome back, {user.first_name}!</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="bg-primary-red hover:bg-primary-red-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
        {(user.role === 'production_staff' || user.role === 'designer') ? (
          // Staff and Designer Dashboard - Actions left, Time Tracking right (wider)
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Actions (1 column) */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-8">{user.role === 'designer' ? 'Designer Actions' : 'Staff Actions'}</h3>

                <div className="grid grid-cols-1 gap-6">
                  <button
                    onClick={() => navigate('/vinyl-inventory')}
                    className="group p-6 bg-purple-600 hover:bg-purple-700 rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-purple-600 text-2xl">📦</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Vinyl Inventory</h4>
                        <p className="text-purple-100">Manage vinyl stock</p>
                      </div>
                    </div>
                  </button>

                  <button
                    className="group p-6 bg-gray-400 rounded-2xl transition-all duration-300 text-left shadow-lg cursor-not-allowed"
                    disabled
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-gray-400 text-2xl">📋</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Request Supplies</h4>
                        <p className="text-gray-200">Coming soon</p>
                      </div>
                    </div>
                  </button>

                  <button
                    className="group p-6 bg-gray-400 rounded-2xl transition-all duration-300 text-left shadow-lg cursor-not-allowed"
                    disabled
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-gray-400 text-2xl">📄</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Request Documents</h4>
                        <p className="text-gray-200">Coming soon</p>
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
              <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Pages</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate('/job-estimation')}
                    className="px-3 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors text-left"
                  >
                    📋 Estimates
                  </button>
                  <button
                    onClick={() => navigate('/orders')}
                    className="px-3 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors text-left"
                  >
                    📦 Orders
                  </button>
                  <button
                    onClick={() => navigate('/supply-chain')}
                    className="px-3 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors text-left"
                  >
                    🏭 Supply Chain
                  </button>
                  <button
                    onClick={() => navigate('/payments')}
                    className="px-3 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-left"
                  >
                    💵 Payments
                  </button>
                  <button
                    onClick={() => navigate('/customers')}
                    className="px-3 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-left"
                  >
                    👥 Customers
                  </button>
                  <button
                    onClick={() => navigate('/vinyl-inventory')}
                    className="px-3 py-3 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors text-left"
                  >
                    🎨 Vinyls
                  </button>
                  <button
                    onClick={() => navigate('/time-management')}
                    className="px-3 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-left"
                  >
                    ⏰ Time Tracking
                  </button>
                  <button
                    onClick={() => navigate('/wages')}
                    className="px-3 py-3 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-lg transition-colors text-left"
                  >
                    💰 Wages
                  </button>
                  <button
                    onClick={() => navigate('/account-management')}
                    className="px-3 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors text-left"
                  >
                    🔐 Accounts
                  </button>
                  <button
                    onClick={() => navigate('/settings')}
                    className="px-3 py-3 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-left"
                  >
                    ⚙️ Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Time Approvals and System Status */}
            <div className="lg:col-span-2">
              <TimeApprovals />

              {/* Database Backup Status */}
              <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6 mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Database Backups</h3>
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
                        className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
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
                          <p className="font-semibold text-gray-800 text-sm truncate">{backup.name}</p>
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
              <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6 mt-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Development Progress</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm text-gray-800">Customers</span>
                  </div>
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm text-gray-800">Estimates</span>
                  </div>
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm text-gray-800">Vinyl</span>
                  </div>
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm text-gray-800">Job Board</span>
                  </div>
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm text-gray-800">Invoicing</span>
                  </div>
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm text-gray-800">Inventory</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Manager Dashboard - Profile card and Quick Actions
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8">
                <div className="text-center">
                  <div className="w-20 h-20 bg-primary-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <span className="text-white font-bold text-2xl">{user.first_name[0]}{user.last_name[0]}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">{user.first_name} {user.last_name}</h3>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-8">Quick Actions</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => navigate('/orders')}
                    className="group p-6 bg-amber-600 hover:bg-amber-700 rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-amber-600 text-2xl">📦</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Orders</h4>
                        <p className="text-amber-100">Manage production orders</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/supply-chain')}
                    className="group p-6 bg-orange-600 hover:bg-orange-700 rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-orange-600 text-2xl">🏭</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Supply Chain</h4>
                        <p className="text-orange-100">Manage inventory & suppliers</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/job-estimation')}
                    className="group p-6 bg-emerald-600 hover:bg-emerald-700 rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-emerald-600 text-2xl">📋</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Estimates</h4>
                        <p className="text-emerald-100">Create quotes & job specs</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/payments')}
                    className="group p-6 bg-green-600 hover:bg-green-700 rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-green-600 text-2xl">💵</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Payments</h4>
                        <p className="text-green-100">Record multi-invoice payments</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/customers')}
                    className="group p-6 bg-primary-blue hover:bg-primary-blue-dark rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-primary-blue text-2xl">👥</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Customers</h4>
                        <p className="text-blue-100">Manage all customers</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/vinyl-inventory')}
                    className="group p-6 bg-purple-600 hover:bg-purple-700 rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-purple-600 text-2xl">📦</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Vinyl Inventory</h4>
                        <p className="text-purple-100">Manage vinyl stock</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/time-management')}
                    className="group p-6 bg-green-600 hover:bg-green-700 rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-green-600 text-2xl">⏰</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Time Tracking</h4>
                        <p className="text-green-100">Manage all time entries</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/account-management')}
                    className="group p-6 bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-indigo-600 text-2xl">🔐</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">User Accounts</h4>
                        <p className="text-indigo-100">Manage user accounts & settings</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/settings')}
                    className="group p-6 bg-gray-600 hover:bg-gray-700 rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-gray-600 text-2xl">⚙️</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Settings</h4>
                        <p className="text-gray-100">System configuration</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-8">
                <TimeApprovals />
              </div>
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
          <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-2xl p-6 border-2 border-gray-300 min-w-96 max-w-2xl">
            <button
              onClick={() => setTestResult(null)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
            <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default SimpleDashboard;
