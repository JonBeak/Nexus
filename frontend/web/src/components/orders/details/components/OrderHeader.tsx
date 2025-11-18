import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Printer, ChevronDown, Settings } from 'lucide-react';
import { Order } from '../../../../types/orders';
import StatusBadge from '../../common/StatusBadge';

interface OrderHeaderProps {
  order: Order;
  activeTab: 'specs' | 'progress';
  onTabChange: (tab: 'specs' | 'progress') => void;
  onGenerateForms: () => void;
  onOpenPrint: () => void;
  onViewForms: () => void;
  onPrepareOrder: () => void;  // NEW: Phase 1.5.c.6.1
  generatingForms: boolean;
  printingForm: boolean;
  showFormsDropdown: boolean;
  setShowFormsDropdown: (show: boolean) => void;
  onViewSingleForm: (formType: 'master' | 'estimate' | 'shop' | 'customer' | 'packing') => void;
  formsDropdownRef: React.RefObject<HTMLDivElement>;
}

const OrderHeader: React.FC<OrderHeaderProps> = ({
  order,
  activeTab,
  onTabChange,
  onGenerateForms,
  onOpenPrint,
  onViewForms,
  onPrepareOrder,  // NEW: Phase 1.5.c.6.1
  generatingForms,
  printingForm,
  showFormsDropdown,
  setShowFormsDropdown,
  onViewSingleForm,
  formsDropdownRef
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/orders');
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Order Info */}
          <div className="flex items-center space-x-4 flex-1">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {order.order_name}
                </h1>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-lg font-semibold text-gray-800 mt-1">{order.customer_name}</p>
              <p className="text-sm text-gray-600">Order #{order.order_number}</p>
            </div>
          </div>

          {/* Center: Tab Navigation */}
          <div className="flex items-center space-x-8 flex-1 justify-center">
            <button
              onClick={() => onTabChange('specs')}
              className={`py-4 px-1 font-medium text-base transition-colors ${
                activeTab === 'specs'
                  ? 'border-b-4 border-indigo-600 text-indigo-600'
                  : 'border-b-2 border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400'
              }`}
            >
              Specs & Invoice
            </button>
            <button
              onClick={() => onTabChange('progress')}
              className={`py-4 px-1 font-medium text-base transition-colors ${
                activeTab === 'progress'
                  ? 'border-b-4 border-indigo-600 text-indigo-600'
                  : 'border-b-2 border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400'
              }`}
            >
              Job Progress
            </button>
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center space-x-3 flex-1 justify-end">
            <button
              onClick={onGenerateForms}
              disabled={generatingForms}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              <span>{generatingForms ? 'Generating...' : 'Generate Order Forms'}</span>
            </button>
            <button
              onClick={onOpenPrint}
              disabled={printingForm}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Printer className="w-4 h-4" />
              <span>{printingForm ? 'Printing...' : 'Print Forms'}</span>
            </button>
            {/* Split Button: View Forms with Dropdown */}
            <div ref={formsDropdownRef} className="relative">
              <div className="flex">
                {/* Main Button - Opens All Forms */}
                <button
                  onClick={onViewForms}
                  className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Forms</span>
                </button>

                {/* Dropdown Toggle Button */}
                <button
                  onClick={() => setShowFormsDropdown(!showFormsDropdown)}
                  className="px-2 py-2 bg-white border-t border-r border-b border-gray-300 border-l border-gray-200 rounded-r-lg hover:bg-gray-50 text-gray-700"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Dropdown Menu */}
              {showFormsDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    <button
                      onClick={() => onViewSingleForm('master')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Master Form</span>
                    </button>
                    <button
                      onClick={() => onViewSingleForm('estimate')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Estimate Form</span>
                    </button>
                    <button
                      onClick={() => onViewSingleForm('shop')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Shop Form</span>
                    </button>
                    <button
                      onClick={() => onViewSingleForm('customer')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Specs Form</span>
                    </button>
                    <button
                      onClick={() => onViewSingleForm('packing')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Packing List</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Prepare Order Button - Phase 1.5.c.6.1 */}
            {order.status === 'job_details_setup' && (
              <button
                onClick={onPrepareOrder}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                <Settings className="w-4 h-4" />
                <span>Prepare Order</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderHeader;