import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TimeTracking from '../time/TimeTracking';
import TimeApprovals from '../time/TimeApprovals';
import type { AccountUser } from '../../types/user';
import { apiClient } from '../../services/api';

interface SimpleDashboardProps {
  user: AccountUser;
  onLogout: () => void;
}

function SimpleDashboard({ user, onLogout }: SimpleDashboardProps) {
  const navigate = useNavigate();
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

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

      if (response.data.success) {
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
        ) : (
          // Manager and Owner Dashboard - 3 column layout
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Card - Only for manager and owner */}
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
                  {/* Quick Actions - Ordered by workflow */}
                  <>
                    {/* 1. Orders - Manager and Owner */}
                    {(user.role === 'manager' || user.role === 'owner') && (
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
                    )}

                    {/* 2. Supply Chain - Manager and Owner */}
                    {(user.role === 'manager' || user.role === 'owner') && (
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
                    )}

                    {/* 3. Estimates - Manager and Owner */}
                    {(user.role === 'manager' || user.role === 'owner') && (
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
                    )}

                    {/* 4. Invoices (TBD) - Manager and Owner */}
                    {(user.role === 'manager' || user.role === 'owner') && (
                      <button
                        className="group p-6 bg-gray-400 rounded-2xl transition-all duration-300 text-left shadow-lg cursor-not-allowed"
                        disabled
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-gray-400 text-2xl">💵</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-lg">Invoices</h4>
                            <p className="text-gray-200">TBD</p>
                          </div>
                        </div>
                      </button>
                    )}

                    {/* 5. Customers - All roles */}
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

                    {/* 6. Vinyl Inventory - All roles */}
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

                    {/* 7. Time Tracking - All roles */}
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

                    {/* 8. Wages - Owner only */}
                    {user.role === 'owner' && (
                      <button
                        onClick={() => navigate('/wages')}
                        className="group p-6 bg-pink-600 hover:bg-pink-700 rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-pink-600 text-2xl">💰</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-lg">Wages</h4>
                            <p className="text-pink-100">Manage payroll & wages</p>
                          </div>
                        </div>
                      </button>
                    )}

                    {/* 9. User Accounts - Manager and Owner */}
                    {(user.role === 'manager' || user.role === 'owner') && (
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
                    )}
                  </>
                </div>
              </div>

              {/* Time Approvals - For Managers and Owners */}
              {(user.role === 'manager' || user.role === 'owner') && (
                <TimeApprovals />
              )}

              {/* System Status - Only for Owners */}
              {user.role === 'owner' && (
                <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8 mt-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">System Development Progress</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-2"></div>
                    <p className="text-sm font-bold text-gray-800">Customers</p>
                    <p className="text-green-600 font-semibold text-xs">Completed</p>
                  </div>
                  <div className="text-center">
                    <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-2"></div>
                    <p className="text-sm font-bold text-gray-800">Estimates</p>
                    <p className="text-green-600 font-semibold text-xs">Completed</p>
                  </div>
                  <div className="text-center">
                    <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-2"></div>
                    <p className="text-sm font-bold text-gray-800">Vinyl Inventory</p>
                    <p className="text-green-600 font-semibold text-xs">Completed</p>
                  </div>
                  <div className="text-center">
                    <div className="w-4 h-4 bg-yellow-500 rounded-full mx-auto mb-2"></div>
                    <p className="text-sm font-bold text-gray-800">Job Board</p>
                    <p className="text-yellow-600 font-semibold text-xs">In Progress</p>
                  </div>
                  <div className="text-center">
                    <div className="w-4 h-4 bg-yellow-500 rounded-full mx-auto mb-2"></div>
                    <p className="text-sm font-bold text-gray-800">Invoicing</p>
                    <p className="text-yellow-600 font-semibold text-xs">In Progress</p>
                  </div>
                  <div className="text-center">
                    <div className="w-4 h-4 bg-red-500 rounded-full mx-auto mb-2"></div>
                    <p className="text-sm font-bold text-gray-800">General Inventory</p>
                    <p className="text-red-600 font-semibold text-xs">Not Started</p>
                  </div>
                </div>
                </div>
              )}
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
