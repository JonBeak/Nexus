import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, DollarSign } from 'lucide-react';
import { HomeButton } from '../common/HomeButton';
import InvoicesOverview from './InvoicesOverview';
import PaymentsTab from './PaymentsTab';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import '../jobEstimation/JobEstimation.css';

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
    <div className={`${PAGE_STYLES.fullPage} flex flex-col`}>
      {/* Header */}
      <div className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <HomeButton />
            <div>
              <h1 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>Invoices</h1>
              <p className={`text-sm ${PAGE_STYLES.panel.textSecondary} mt-1`}>View invoice status, balances, and record payments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.border} border-b`}>
        <div className="px-6">
          <div className="flex space-x-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`
                  flex items-center space-x-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? `${MODULE_COLORS.invoices.border} ${MODULE_COLORS.invoices.text}`
                    : `border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:border-gray-500`
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
