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
      // QUICKBOOKS ROW TYPE COMPREHENSIVE TEST
      // ==================================================
      console.log('🧪 Starting QuickBooks Row Type Test...');

      const testItems = [
        // COMPREHENSIVE EDGE CASE TESTING 🧪

        // TEST 1: Subtotal BEFORE any items (what happens with $0?)
        {
          type: 'custom_description',
          description: 'Subtotal: $999.99'
        },

        // Section 1: Channel Letters (should total $150)
        {
          type: 'regular',
          itemName: '3" Channel Letters',
          quantity: 1,
          unitPrice: 100,
          extendedPrice: 100
        },
        {
          type: 'regular',
          itemName: 'LEDs',
          quantity: 1,
          unitPrice: 50,
          extendedPrice: 50
        },

        // TEST 2: Separate label line + subtotal (user's idea)
        {
          type: 'custom_description',
          description: '=== Channel Letters Section ==='
        },
        {
          type: 'custom_description',
          description: 'Subtotal: $0.00'
        },

        // Empty divider
        {
          type: 'empty_row',
          description: ''
        },

        // TEST 3: Back-to-back subtotals (no items between)
        {
          type: 'custom_description',
          description: 'Subtotal: $111.11'
        },
        {
          type: 'custom_description',
          description: 'Subtotal: $222.22'
        },

        // Single item
        {
          type: 'regular',
          itemName: 'Vinyl',
          quantity: 1,
          unitPrice: 75,
          extendedPrice: 75
        },

        // TEST 4: Negative amount (does QB accept it?)
        {
          type: 'custom_description',
          description: 'Subtotal: $-50.00'
        },

        // Another item
        {
          type: 'regular',
          itemName: 'Substrate Cut',
          quantity: 1,
          unitPrice: 25,
          extendedPrice: 25
        },

        // TEST 5: Very large amount
        {
          type: 'custom_description',
          description: 'Subtotal: $999999.99'
        },

        // TEST 6: Three decimal places
        {
          type: 'custom_description',
          description: 'Subtotal: $100.123'
        },

        // TEST 7: No decimal places
        {
          type: 'custom_description',
          description: 'Subtotal: $100'
        },

        // TEST 8: Text in the middle of amount?
        {
          type: 'custom_description',
          description: 'Subtotal: $100.00 USD'
        },

        // TEST 9: Multiple subtotal patterns in one description
        {
          type: 'custom_description',
          description: 'Subtotal: $50.00 | Subtotal: $75.00'
        },

        // Final item
        {
          type: 'regular',
          itemName: 'Shipping',
          quantity: 1,
          unitPrice: 20,
          extendedPrice: 20
        },

        // TEST 10: Subtotal with emoji/special chars
        {
          type: 'custom_description',
          description: '💰 Subtotal: $20.00 💰'
        }
      ];

      console.log('📋 Test Structure:');
      testItems.forEach((item: any, idx) => {
        console.log(`${idx + 1}. Type: ${item.type}${item.itemName ? ` - ${item.itemName}` : ''}${item.description ? ` - "${item.description}"` : ''}`);
      });

      console.log('\n📤 Sending to QuickBooks Test Endpoint...');

      const response = await apiClient.post('/quickbooks-test/row-types', {
        testItems,
        customerName: 'Sign House Inc.',
        debugMode: true
      });

      if (!response.data.success) {
        setTestResult(`❌ Failed: ${response.data.error}`);
        return;
      }

      console.log('✅ Estimate created:', response.data.qbEstimateId);
      console.log('📄 Doc Number:', response.data.qbDocNumber);

      if (response.data.debug) {
        console.log('\n═══════════════════════════════════════════');
        console.log('📊 COMPARISON RESULTS');
        console.log('═══════════════════════════════════════════');
        console.log(`Lines Sent: ${response.data.debug.linesSent}`);
        console.log(`Lines Returned: ${response.data.debug.linesReturned}`);

        if (response.data.debug.linesSent !== response.data.debug.linesReturned) {
          console.log(`⚠️  ${response.data.debug.linesSent - response.data.debug.linesReturned} line(s) removed by QB!`);
        }

        console.log('\n📤 SENT LINES:');
        response.data.debug.sentLines.forEach((line: any, idx: number) => {
          console.log(`\n[${idx + 1}] ${line.DetailType}`);
          console.log(`  Description: ${line.Description !== undefined ? `"${line.Description}"` : '(not included)'}`);
          console.log(`  Amount: ${line.Amount !== undefined ? line.Amount : 'N/A'}`);
          if (line.DetailType === 'DescriptionOnly') {
            console.log(`  DescriptionLineDetail: ${JSON.stringify(line.DescriptionLineDetail)}`);
          }
        });

        console.log('\n📥 RETURNED LINES:');
        response.data.debug.returnedLines.forEach((line: any, idx: number) => {
          console.log(`\n[${idx + 1}] ${line.DetailType} (QB ID: ${line.Id})`);
          console.log(`  Description: ${line.Description !== undefined ? `"${line.Description}"` : '(empty)'}`);
          console.log(`  Amount: ${line.Amount !== undefined ? line.Amount : 'N/A'}`);
          if (line.DetailType === 'DescriptionOnly') {
            const hasTaxCode = !!line.DescriptionLineDetail?.TaxCodeRef;
            console.log(`  DescriptionLineDetail: ${JSON.stringify(line.DescriptionLineDetail)}`);
            console.log(`  🔍 ${hasTaxCode ? 'HAS' : 'NO'} TaxCodeRef`);
          }
        });

        console.log('\n🔬 ANALYSIS:');
        const returnedDescOnly = response.data.debug.returnedLines.filter((l: any) => l.DetailType === 'DescriptionOnly');
        returnedDescOnly.forEach((line: any, idx: number) => {
          const hasTaxCode = !!line.DescriptionLineDetail?.TaxCodeRef;
          const hasDesc = !!line.Description;
          console.log(`\nDescriptionOnly ${idx + 1}:`);
          console.log(`  TaxCodeRef: ${hasTaxCode ? 'YES' : 'NO'}`);
          console.log(`  Description: ${hasDesc ? 'YES' : 'NO'} - "${line.Description || ''}"`);
        });

        console.log('\n═══════════════════════════════════════════\n');
      }

      setTestResult(`✅ Test Complete!

QB Estimate ID: ${response.data.qbEstimateId}
Doc Number: ${response.data.qbDocNumber}

Sent: ${response.data.debug?.linesSent || 0} lines
Returned: ${response.data.debug?.linesReturned || 0} lines

Check browser console for detailed comparison!`);

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
          {testLoading ? '🔄 Testing...' : '🧪 Test Button'}
        </button>

        {testResult && (
          <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-2xl p-6 border-2 border-gray-300 max-w-md">
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
