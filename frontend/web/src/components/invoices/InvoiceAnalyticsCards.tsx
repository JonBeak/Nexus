import React from 'react';
import { DollarSign, FileX, FileText, AlertTriangle } from 'lucide-react';
import { InvoiceAnalytics } from '../../services/api/invoicesApi';
import { PAGE_STYLES } from '../../constants/moduleColors';

interface Props {
  analytics: InvoiceAnalytics | null;
  loading: boolean;
}

export const InvoiceAnalyticsCards: React.FC<Props> = ({ analytics, loading }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading || !analytics) {
    return (
      <div className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.border} border-b px-6 py-4`}>
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center space-x-3">
              <div className={`${PAGE_STYLES.header.background} rounded-lg p-3 animate-pulse w-12 h-12`} />
              <div className="space-y-2">
                <div className={`h-3 w-24 ${PAGE_STYLES.header.background} rounded animate-pulse`} />
                <div className={`h-6 w-16 ${PAGE_STYLES.header.background} rounded animate-pulse`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.border} border-b px-6 py-4`}>
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          icon={<DollarSign className="w-6 h-6 text-green-600" />}
          label="YTD Total Sales"
          value={formatCurrency(analytics.ytdTotalSales)}
          subValue={`${analytics.ytdOrderCount} orders`}
          color="green"
        />
        <StatCard
          icon={<FileX className="w-6 h-6 text-orange-600" />}
          label="Uninvoiced"
          value={String(analytics.uninvoiced.count)}
          subValue={formatCurrency(analytics.uninvoiced.total)}
          color="orange"
        />
        <StatCard
          icon={<FileText className="w-6 h-6 text-blue-600" />}
          label="Open Invoices"
          value={String(analytics.openInvoices.count)}
          subValue={`${formatCurrency(analytics.openInvoices.balance)} due`}
          color="blue"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6 text-red-600" />}
          label="Overdue"
          value={String(analytics.overdue.count)}
          subValue={formatCurrency(analytics.overdue.balance)}
          color="red"
        />
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: 'indigo' | 'orange' | 'blue' | 'red' | 'green';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subValue, color }) => {
  const colorClasses = {
    indigo: 'bg-indigo-100',
    orange: 'bg-orange-100',
    blue: 'bg-blue-100',
    red: 'bg-red-100',
    green: 'bg-green-100'
  };

  return (
    <div className="flex items-center space-x-3">
      <div className={`${colorClasses[color]} rounded-lg p-3`}>
        {icon}
      </div>
      <div>
        <p className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>{label}</p>
        <p className={`text-2xl font-semibold ${PAGE_STYLES.panel.text}`}>{value}</p>
        {subValue && <p className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>{subValue}</p>}
      </div>
    </div>
  );
};

export default InvoiceAnalyticsCards;
