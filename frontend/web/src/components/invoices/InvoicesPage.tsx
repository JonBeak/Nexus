import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, DollarSign, Home } from 'lucide-react';
import InvoicesOverview from './InvoicesOverview';
import PaymentsTab from './PaymentsTab';

type TabId = 'overview' | 'payments';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: <FileText className="w-5 h-5" />, path: '/invoices' },
  { id: 'payments', label: 'Payments', icon: <DollarSign className="w-5 h-5" />, path: '/invoices/payments' }
];

// Map URL paths to tab IDs
const pathToTab: Record<string, TabId> = {
  '/invoices': 'overview',
  '/invoices/payments': 'payments'
};

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab from URL
  const activeTab = pathToTab[location.pathname] || 'overview';

  const handleTabClick = (tab: Tab) => {
    navigate(tab.path);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              <Home className="w-7 h-7" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
              <p className="text-sm text-gray-600 mt-1">View invoice status, balances, and record payments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex space-x-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`
                  flex items-center space-x-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && <InvoicesOverview />}
        {activeTab === 'payments' && <PaymentsTab />}
      </div>
    </div>
  );
};

export default InvoicesPage;
