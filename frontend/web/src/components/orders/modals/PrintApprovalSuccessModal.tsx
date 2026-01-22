/**
 * Print Approval Success Modal
 * Shows success confirmation after printing forms and/or moving order to production queue
 */

import React from 'react';
import { CheckCircle, X, Printer, AlertTriangle, ArrowRight } from 'lucide-react';

export interface PrintSummary {
  master: number;
  estimate: number;
  shop: number;
  packing: number;
  printedCopies: number;
  skipped?: string[];
}

export interface PrintApprovalSuccessData {
  type: 'print_only' | 'print_and_production' | 'production_only';
  printSummary?: PrintSummary;
  jobId?: string;
  movedToProduction?: boolean;
  orderNumber: number;
  orderName: string;
}

interface PrintApprovalSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PrintApprovalSuccessData | null;
}

export const PrintApprovalSuccessModal: React.FC<PrintApprovalSuccessModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  if (!isOpen || !data) return null;

  const { type, printSummary, jobId, movedToProduction, orderNumber, orderName } = data;

  const getTitle = () => {
    if (type === 'production_only') return 'Order Approved!';
    if (type === 'print_and_production') return 'Printed & Approved!';
    return 'Print Successful!';
  };

  const getSubtitle = () => {
    if (movedToProduction) return 'Order moved to Production Queue';
    return 'Forms sent to printer';
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {getTitle()}
                </h3>
                <p className="text-sm text-gray-500">
                  #{orderNumber} - {orderName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Subtitle */}
            <p className="text-sm text-gray-600">{getSubtitle()}</p>

            {/* Print Summary */}
            {printSummary && (type === 'print_only' || type === 'print_and_production') && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Printer className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Print Summary</span>
                </div>

                <div className="space-y-1.5 text-sm">
                  {printSummary.master > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Master Form</span>
                      <span className="font-medium text-gray-900">{printSummary.master} {printSummary.master === 1 ? 'copy' : 'copies'}</span>
                    </div>
                  )}
                  {printSummary.estimate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estimate Form</span>
                      <span className="font-medium text-gray-900">{printSummary.estimate} {printSummary.estimate === 1 ? 'copy' : 'copies'}</span>
                    </div>
                  )}
                  {printSummary.shop > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shop Form</span>
                      <span className="font-medium text-gray-900">{printSummary.shop} {printSummary.shop === 1 ? 'copy' : 'copies'}</span>
                    </div>
                  )}
                  {printSummary.packing > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Packing List</span>
                      <span className="font-medium text-gray-900">{printSummary.packing} {printSummary.packing === 1 ? 'copy' : 'copies'}</span>
                    </div>
                  )}

                  <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between">
                    <span className="text-gray-700 font-medium">Total Printed</span>
                    <span className="font-semibold text-gray-900">{printSummary.printedCopies} {printSummary.printedCopies === 1 ? 'form' : 'forms'}</span>
                  </div>
                </div>

                {jobId && (
                  <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                    Job ID: {jobId}
                  </div>
                )}
              </div>
            )}

            {/* Skipped Files Warning */}
            {printSummary?.skipped && printSummary.skipped.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium text-yellow-800">Note:</span>
                    <span className="text-yellow-700"> {printSummary.skipped.join(', ')} not found and skipped</span>
                  </div>
                </div>
              </div>
            )}

            {/* Production Queue Status */}
            {movedToProduction && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">
                    Order moved to Production Queue
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-5 py-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors min-h-[44px] active:opacity-80"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintApprovalSuccessModal;
