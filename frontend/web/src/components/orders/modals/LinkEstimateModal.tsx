/**
 * @deprecated Use LinkDocumentModal from './document' with documentType="estimate" instead.
 * This component will be removed in a future release.
 *
 * Link Estimate Modal
 * Cash Job Conflict Resolution
 *
 * Modal for linking an existing QuickBooks estimate to an order:
 * - Shows list of customer's QB estimates
 * - Allows search by Estimate # or Transaction ID
 * - Links selected estimate to the order
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Link, Search, FileText, AlertCircle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { orderPreparationApi } from '../../../services/api';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

interface CustomerEstimate {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  TotalAmt: number;
  CustomerRef: { value: string; name?: string };
}

interface LinkEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  onSuccess: () => void;
}

export const LinkEstimateModal: React.FC<LinkEstimateModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  onSuccess
}) => {
  // List state
  const [estimates, setEstimates] = useState<CustomerEstimate[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Selected estimate
  const [selectedEstimate, setSelectedEstimate] = useState<CustomerEstimate | null>(null);

  // Link state
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Refs for backdrop click handling
  const modalContentRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);

  // Mobile detection
  const isMobile = useIsMobile();
  useBodyScrollLock(isOpen && isMobile);

  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(estimates.length / PAGE_SIZE);
  const paginatedEstimates = estimates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Load customer estimates
  const loadEstimates = async () => {
    try {
      setLoadingList(true);
      setListError(null);
      const result = await orderPreparationApi.getCustomerEstimates(orderNumber);
      setEstimates(result.estimates || []);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Failed to load customer estimates:', err);
      setListError(err?.response?.data?.message || err?.message || 'Failed to load estimates');
    } finally {
      setLoadingList(false);
    }
  };

  // Load estimates when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
      loadEstimates();
    }
  }, [isOpen, orderNumber]);

  // Handle ESC key - stop propagation to prevent parent modals from closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle backdrop click - only close if both mousedown and mouseup are outside modal content
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownOutsideRef.current = modalContentRef.current ? !modalContentRef.current.contains(e.target as Node) : false;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (mouseDownOutsideRef.current && modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
      onClose();
    }
    mouseDownOutsideRef.current = false;
  };

  const handleLink = async () => {
    if (!selectedEstimate) return;

    try {
      setLinking(true);
      setLinkError(null);

      await orderPreparationApi.linkExistingEstimate(orderNumber, selectedEstimate.Id);

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error('Failed to link estimate:', err);
      setLinkError(err?.response?.data?.message || err?.message || 'Failed to link estimate');
    } finally {
      setLinking(false);
    }
  };

  const resetForm = () => {
    setEstimates([]);
    setCurrentPage(1);
    setSelectedEstimate(null);
    setListError(null);
    setLinkError(null);
    setSuccess(false);
  };

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
        isMobile
          ? 'overflow-y-auto'
          : 'flex items-center justify-center'
      }`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div ref={modalContentRef} className={`bg-white rounded-lg shadow-xl w-full flex flex-col ${
        isMobile
          ? 'min-h-full'
          : 'max-w-2xl mx-4 max-h-[85vh] overflow-hidden'
      }`}>
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-blue-50">
          <div className="flex items-center space-x-3">
            <Link className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-blue-900">Link Existing Estimate</h2>
              <p className="text-sm text-gray-600">Order #{orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State */}
        {success && (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Estimate Linked Successfully</h3>
            <p className="text-sm text-gray-600">
              QB Estimate #{selectedEstimate?.DocNumber} is now linked to this order.
            </p>
          </div>
        )}

        {/* Content */}
        {!success && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Loading State */}
            {loadingList && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                <p className="text-sm text-gray-600">Loading customer estimates...</p>
              </div>
            )}

            {/* Error State */}
            {listError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800 font-medium">Error Loading Estimates</p>
                    <p className="text-sm text-red-700 mt-1">{listError}</p>
                    <button
                      onClick={loadEstimates}
                      className="text-sm text-red-600 hover:text-red-800 underline mt-2"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* No Estimates */}
            {!loadingList && !listError && estimates.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No estimates found for this customer.</p>
                <p className="text-sm text-gray-500 mt-1">
                  Create a new estimate or check that the customer is linked to QuickBooks.
                </p>
              </div>
            )}

            {/* Estimate List */}
            {!loadingList && !listError && estimates.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Customer Estimates ({estimates.length} total)
                </h3>

                {paginatedEstimates.map((estimate) => {
                  const isSelected = selectedEstimate?.Id === estimate.Id;
                  return (
                    <button
                      key={estimate.Id}
                      onClick={() => setSelectedEstimate(isSelected ? null : estimate)}
                      className={`w-full text-left p-4 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      } ${isMobile ? 'min-h-[60px] active:bg-gray-100' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">#{estimate.DocNumber}</span>
                            <span className="text-gray-500 text-sm ml-2">{formatDate(estimate.TxnDate)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-gray-900">${estimate.TotalAmt.toFixed(2)}</span>
                        </div>
                      </div>
                      {estimate.CustomerRef.name && (
                        <p className="text-sm text-gray-600 mt-1 ml-8">{estimate.CustomerRef.name}</p>
                      )}
                    </button>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous</span>
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Link Error */}
            {linkError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{linkError}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!success && (
          <div className={`px-6 py-4 border-t bg-gray-50 flex ${
            isMobile ? 'flex-col-reverse gap-2' : 'justify-end space-x-3'
          }`}>
            <button
              onClick={onClose}
              disabled={linking}
              className={`px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 ${
                isMobile ? 'min-h-[44px]' : ''
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleLink}
              disabled={linking || !selectedEstimate}
              className={`flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed ${
                isMobile ? 'min-h-[44px]' : ''
              }`}
            >
              {linking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Linking...</span>
                </>
              ) : (
                <>
                  <Link className="w-4 h-4" />
                  <span>Link Estimate</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkEstimateModal;
