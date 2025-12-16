/**
 * SettingsPage - Main Layout Component
 * Parent component with header and Outlet for nested settings routes
 */

import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we're on a sub-page (not the index)
  const isSubPage = location.pathname !== '/settings';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-gray-500">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(isSubPage ? '/settings' : '/dashboard')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title={isSubPage ? 'Back to Settings' : 'Back to Dashboard'}
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="w-12 h-12 bg-gray-600 rounded-xl flex items-center justify-center shadow-lg">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
              <p className="text-gray-600">Configure system settings and business rules</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Outlet for nested routes */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </div>
    </div>
  );
};

export default SettingsPage;
