/**
 * Live PDF Preview Panel Component
 *
 * Right panel showing live previews of generated PDFs.
 * Displays order form and QB estimate PDFs in iframes.
 */

import React from 'react';
import { FileText, Loader2, AlertCircle } from 'lucide-react';
import { PreparationState } from '@/types/orderPreparation';

interface LivePDFPreviewPanelProps {
  state: PreparationState;
}

export const LivePDFPreviewPanel: React.FC<LivePDFPreviewPanelProps> = ({
  state
}) => {
  const { orderForm, qbEstimate } = state.pdfs;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">PDF Previews</h3>
        <p className="text-sm text-gray-600 mt-1">
          Live previews of generated documents
        </p>
      </div>

      {/* PDF Previews (scrollable) */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Order Form Preview */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Order Form</span>
            </div>
          </div>
          <div className="bg-gray-100">
            {orderForm ? (
              <iframe
                src={orderForm.url}
                className="w-full h-[500px] bg-white"
                title="Order Form Preview"
                onLoad={() => {
                  // Mark as loaded (could update state here)
                }}
              />
            ) : (
              <div className="h-[500px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm font-medium">Not generated yet</p>
                  <p className="text-xs mt-1">Run Step 3 to generate order form PDF</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* QB Estimate Preview */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">QuickBooks Estimate</span>
            </div>
          </div>
          <div className="bg-gray-100">
            {qbEstimate ? (
              <iframe
                src={qbEstimate.url}
                className="w-full h-[600px] bg-white"
                title="QB Estimate Preview"
                onLoad={() => {
                  // Mark as loaded (could update state here)
                }}
              />
            ) : (
              <div className="h-[600px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm font-medium">Not downloaded yet</p>
                  <p className="text-xs mt-1">Run Step 4 to download QB estimate PDF</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
