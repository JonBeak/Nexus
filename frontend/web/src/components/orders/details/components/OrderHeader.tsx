import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Printer, FolderOpen, Settings, CheckCircle, FileCheck } from 'lucide-react';
import { Order } from '../../../../types/orders';
import StatusBadge from '../../common/StatusBadge';

interface OrderHeaderProps {
  order: Order;
  activeTab: 'specs' | 'progress';
  onTabChange: (tab: 'specs' | 'progress') => void;
  onGenerateForms: () => void;
  onOpenPrint: () => void;
  onOpenPrintMasterEstimate: () => void;  // NEW: Print Master/Estimate only
  onOpenFolder: () => void;
  onPrepareOrder: () => void;
  onCustomerApproved: () => void;  // NEW: Customer approved transition
  onFilesCreated: () => void;  // NEW: Files created transition
  onApproveFilesAndPrint: () => void;  // NEW: Approve files and print
  generatingForms: boolean;
  printingForm: boolean;
}

const OrderHeader: React.FC<OrderHeaderProps> = ({
  order,
  activeTab,
  onTabChange,
  onGenerateForms,
  onOpenPrint,
  onOpenPrintMasterEstimate,
  onOpenFolder,
  onPrepareOrder,
  onCustomerApproved,
  onFilesCreated,
  onApproveFilesAndPrint,
  generatingForms,
  printingForm
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
            {/* Open Folder - Always visible */}
            <button
              onClick={onOpenFolder}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Open Folder</span>
            </button>

            {/* Phase-Specific Actions */}
            {/* Job Details Setup - Prepare Order */}
            {order.status === 'job_details_setup' && (
              <button
                onClick={onPrepareOrder}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                <Settings className="w-4 h-4" />
                <span>Prepare Order</span>
              </button>
            )}

            {/* Pending Confirmation - Customer Approved */}
            {order.status === 'pending_confirmation' && (
              <button
                onClick={onCustomerApproved}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Customer Approved</span>
              </button>
            )}

            {/* Pending Files Creation - Print Master/Estimate + Files Created */}
            {order.status === 'pending_production_files_creation' && (
              <>
                <button
                  onClick={onOpenPrintMasterEstimate}
                  disabled={printingForm}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <Printer className="w-4 h-4" />
                  <span>{printingForm ? 'Printing...' : 'Print Master/Estimate Forms'}</span>
                </button>
                <button
                  onClick={onFilesCreated}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Files Created</span>
                </button>
              </>
            )}

            {/* Pending Files Approval - Approve Files and Print Forms */}
            {order.status === 'pending_production_files_approval' && (
              <button
                onClick={onApproveFilesAndPrint}
                disabled={printingForm}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Printer className="w-4 h-4" />
                <span>{printingForm ? 'Printing...' : 'Approve Files and Print Forms'}</span>
              </button>
            )}

            {/* All Other Statuses - Print Forms */}
            {!['job_details_setup', 'pending_confirmation', 'pending_production_files_creation', 'pending_production_files_approval'].includes(order.status) && (
              <button
                onClick={onOpenPrint}
                disabled={printingForm}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Printer className="w-4 h-4" />
                <span>{printingForm ? 'Printing...' : 'Print Forms'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderHeader;