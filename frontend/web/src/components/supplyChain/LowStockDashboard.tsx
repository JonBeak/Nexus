import React from 'react';

interface LowStockDashboardProps {
  user: any;
  onDataChange: () => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

export const LowStockDashboard: React.FC<LowStockDashboardProps> = ({
  user,
  onDataChange,
  showNotification
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Low Stock Dashboard</h3>
        <p className="text-gray-500">Low stock monitoring coming in Phase 1 completion.</p>
      </div>
    </div>
  );
};