import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface CustomerListHeaderProps {
  activeCustomerCount: number;
  showDeactivatedCustomers: boolean;
  setShowDeactivatedCustomers: (show: boolean) => void;
  onAddCustomerClick: () => void;
}

export const CustomerListHeader: React.FC<CustomerListHeaderProps> = ({
  activeCustomerCount,
  showDeactivatedCustomers,
  setShowDeactivatedCustomers,
  onAddCustomerClick
}) => {
  const navigate = useNavigate();

  return (
    <header className="bg-white shadow-lg border-b-4 border-primary-red">
      <div className="max-w-full mx-auto px-2 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              title="Return to Dashboard"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-red rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white font-bold text-lg md:text-xl">👥</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-3xl font-bold text-gray-800">Customers</h1>
              <p className="text-sm md:text-lg text-gray-600">{activeCustomerCount} active</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center space-x-1 md:space-x-2 text-xs md:text-sm">
              <input
                type="checkbox"
                checked={showDeactivatedCustomers}
                onChange={(e) => setShowDeactivatedCustomers(e.target.checked)}
                className="rounded w-3 h-3 md:w-4 md:h-4"
              />
              <span className="text-gray-600 whitespace-nowrap">Show Deactivated</span>
            </label>
            <button
              onClick={onAddCustomerClick}
              className="bg-green-600 hover:bg-green-700 text-white px-3 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-colors shadow-lg text-sm md:text-base whitespace-nowrap"
            >
              + Add
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};