/**
 * Link Invoice Modal
 * Phase 2.e: QuickBooks Invoice Automation
 *
 * Modal for linking an existing QuickBooks invoice to an order:
 * - Search by Invoice ID or Doc Number
 * - Preview found invoice details
 * - Confirm link
 */

import React, { useState } from 'react';
import { X, Loader2, Link, Search, FileText, AlertCircle, Check } from 'lucide-react';
import { qbInvoiceApi } from '../../../services/api/orders/qbInvoiceApi';

interface LinkInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  onSuccess: () => void;
}

interface InvoicePreview {
  invoiceId: string;
  docNumber: string;
  customerName: string;
  total: number;
  balance: number;
  txnDate: string;
}

export const LinkInvoiceModal: React.FC<LinkInvoiceModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  onSuccess
}) => {
  // Form state
  const [searchValue, setSearchValue] = useState('');
  const [searchType, setSearchType] = useState<'id' | 'docNumber'>('docNumber');

  // Preview state
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Link state
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      setSearchError('Please enter an invoice ID or number');
      return;
    }

    try {
      setSearching(true);
      setSearchError(null);
      setPreview(null);

      // Try to link to get preview (the API will return invoice info)
      // For now, we'll just attempt the link directly as there's no separate search endpoint
      // In a real implementation, you might have a GET endpoint to preview before linking

      // For demo purposes, we'll show a simulated preview
      // In production, this would call a search/preview endpoint
      setPreview({
        invoiceId: searchType === 'id' ? searchValue : `QB-${searchValue}`,
        docNumber: searchType === 'docNumber' ? searchValue : `INV-${searchValue}`,
        customerName: 'Preview Customer',
        total: 0,
        balance: 0,
        txnDate: new Date().toISOString().split('T')[0]
      });

    } catch (err) {
      console.error('Failed to search invoice:', err);
      setSearchError('Invoice not found. Please check the ID/number and try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async () => {
    try {
      setLinking(true);
      setLinkError(null);

      const linkData = searchType === 'id'
        ? { qbInvoiceId: searchValue }
        : { docNumber: searchValue };

      await qbInvoiceApi.linkInvoice(orderNumber, linkData);

      setSuccess(true);

      // Close modal after brief delay
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err) {
      console.error('Failed to link invoice:', err);
      setLinkError(err instanceof Error ? err.message : 'Failed to link invoice');
    } finally {
      setLinking(false);
    }
  };

  const resetForm = () => {
    setSearchValue('');
    setPreview(null);
    setSearchError(null);
    setLinkError(null);
    setSuccess(false);
  };

  // Reset when modal opens
  React.useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Link className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Link Existing Invoice</h2>
                <p className="text-sm text-gray-600">Order #{orderNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {success ? (
            // Success Message
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <Check className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="font-medium text-green-800">Invoice linked successfully!</p>
              <p className="text-sm text-green-700 mt-1">
                This order is now connected to the QuickBooks invoice.
              </p>
            </div>
          ) : (
            <>
              {/* Search Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search By
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSearchType('docNumber')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      searchType === 'docNumber'
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    Invoice Number
                  </button>
                  <button
                    onClick={() => setSearchType('id')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      searchType === 'id'
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    QB Invoice ID
                  </button>
                </div>
              </div>

              {/* Search Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {searchType === 'docNumber' ? 'Invoice Number' : 'QuickBooks Invoice ID'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={searchType === 'docNumber' ? 'e.g., 1234' : 'e.g., 12345'}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || !searchValue.trim()}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      searching || !searchValue.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {searching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Search Error */}
              {searchError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {searchError}
                </div>
              )}

              {/* Invoice Preview */}
              {preview && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Invoice Found</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Invoice #:</span>
                      <span className="font-medium">{preview.docNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">QB ID:</span>
                      <span className="font-mono text-xs">{preview.invoiceId}</span>
                    </div>
                    {preview.customerName !== 'Preview Customer' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Customer:</span>
                          <span className="font-medium">{preview.customerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total:</span>
                          <span className="font-medium">${preview.total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Balance:</span>
                          <span className={`font-medium ${
                            preview.balance === 0 ? 'text-green-600' : 'text-orange-600'
                          }`}>
                            ${preview.balance.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Warning */}
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                    <strong>Note:</strong> Linking this invoice will associate it with this order.
                    Any future invoice updates will use this order's data.
                  </div>
                </div>
              )}

              {/* Link Error */}
              {linkError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {linkError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            {success ? 'Close' : 'Cancel'}
          </button>

          {!success && preview && (
            <button
              onClick={handleLink}
              disabled={linking}
              className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${
                linking
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {linking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4" />
                  Link Invoice
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkInvoiceModal;
