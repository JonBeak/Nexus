/**
 * Email Preview Modal Component for Estimates
 * Phase 4.2 - Email Preview Modal Wrapper
 * Phase 4.c - Added PDF Preview Panel
 *
 * Modal wrapper with:
 * - Two-column layout: Email preview (left) + PDF preview (right)
 * - Header/footer contained to left column
 * - Full-height PDF preview
 * - Recipient selection (checkboxes)
 * - Email preview display
 * - QuickBooks estimate PDF preview
 * - Send/Cancel buttons
 * - Resend confirmation
 */

import React, { useState, useMemo, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { EstimateEmailPreview } from './EstimateEmailPreview';
import { EstimatePdfPreview } from './EstimatePdfPreview';
import { EstimateVersion } from '../../../types';
import { PointPersonEntry } from '../../../types/estimatePointPerson';
import { EmailSummaryConfig, EstimateEmailData } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  estimate: EstimateVersion;
  pointPersons: PointPersonEntry[];
  isSending: boolean;
  // Email content props
  emailSubject?: string;
  emailBeginning?: string;
  emailEnd?: string;
  emailSummaryConfig?: EmailSummaryConfig;
  estimateData?: EstimateEmailData;
}

export const EstimateEmailPreviewModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  estimate,
  pointPersons,
  isSending,
  emailSubject,
  emailBeginning,
  emailEnd,
  emailSummaryConfig,
  estimateData
}) => {
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(
    new Set(pointPersons.filter(p => p.contact_email).map(p => p.contact_email))
  );
  const [pdfLoadError, setPdfLoadError] = useState(false);

  // Sync selectedRecipients when pointPersons changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedRecipients(
        new Set(pointPersons.filter(p => p.contact_email).map(p => p.contact_email))
      );
    }
  }, [isOpen, pointPersons]);

  const selectedEmails = useMemo(() => {
    return Array.from(selectedRecipients).filter(email => email && email.trim());
  }, [selectedRecipients]);

  const handleToggleRecipient = (email: string) => {
    const newSelected = new Set(selectedRecipients);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedRecipients(newSelected);
  };

  const handleSelectAll = () => {
    const allEmails = pointPersons
      .filter(p => p.contact_email)
      .map(p => p.contact_email);
    setSelectedRecipients(new Set(allEmails));
  };

  const handleDeselectAll = () => {
    setSelectedRecipients(new Set());
  };

  const handleConfirm = () => {
    if (selectedEmails.length === 0) {
      alert('Please select at least one recipient');
      return;
    }
    onConfirm();
  };

  if (!isOpen) return null;

  const pointPersonsWithEmail = pointPersons.filter(p => p.contact_email);
  const hasQbEstimate = !!estimate.qb_estimate_id;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal - wider layout with side-by-side columns */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className={`bg-white rounded-lg shadow-xl w-full max-h-[92vh] overflow-hidden flex ${hasQbEstimate ? 'max-w-[1400px]' : 'max-w-2xl flex-col'}`}>

          {hasQbEstimate ? (
            <>
              {/* Left Column: Header + Content + Footer */}
              <div className="w-[500px] flex-shrink-0 flex flex-col border-r border-gray-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 p-5">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Send Estimate to Customer
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Review and confirm before sending
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* Resend Warning */}
                  {!!estimate.is_sent && (
                    <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        This estimate was previously sent. Sending again will use the same QuickBooks estimate.
                      </p>
                    </div>
                  )}

                  {/* PDF Error Warning */}
                  {pdfLoadError && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        PDF preview unavailable. The email will still include a link to view the estimate in QuickBooks.
                      </p>
                    </div>
                  )}

                  {/* Recipient Selection */}
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 text-sm">Select Recipients</h3>
                      <div className="space-x-2 text-xs">
                        <button
                          onClick={handleSelectAll}
                          className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Select All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={handleDeselectAll}
                          className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {pointPersonsWithEmail.length > 0 ? (
                      <div className="space-y-1">
                        {pointPersonsWithEmail.map((person) => (
                          <label key={person.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedRecipients.has(person.contact_email)}
                              onChange={() => handleToggleRecipient(person.contact_email)}
                              className="rounded border-gray-300"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {person.contact_name || person.contact_email}
                              </p>
                              {person.contact_name && (
                                <p className="text-xs text-gray-500 truncate">
                                  {person.contact_email}
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-2">
                        No point persons with email addresses
                      </p>
                    )}
                  </div>

                  {/* Email Preview */}
                  {selectedEmails.length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="font-medium text-gray-900 text-sm mb-2">Email Preview</h3>
                      <EstimateEmailPreview
                        estimateId={estimate.id}
                        estimateName={estimate.estimate_name}
                        recipients={selectedEmails}
                        emailSubject={emailSubject}
                        emailBeginning={emailBeginning}
                        emailEnd={emailEnd}
                        emailSummaryConfig={emailSummaryConfig}
                        estimateData={estimateData}
                      />
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 bg-gray-50 flex items-center justify-end gap-3">
                  <button
                    onClick={onClose}
                    disabled={isSending}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isSending || selectedEmails.length === 0}
                    className={`px-5 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${
                      isSending || selectedEmails.length === 0
                        ? 'bg-gray-400 text-white cursor-not-allowed opacity-50'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Estimate
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Full-height PDF Preview */}
              <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
                <EstimatePdfPreview
                  estimateId={estimate.id}
                  onLoadError={() => setPdfLoadError(true)}
                />
              </div>
            </>
          ) : (
            /* No QB Estimate - Single column layout */
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Send Estimate to Customer
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Review and confirm the estimate email before sending
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Resend Warning */}
                {!!estimate.is_sent && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      This estimate was previously sent. Sending again will use the same QuickBooks estimate.
                    </p>
                  </div>
                )}

                {/* Recipient Selection */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">Select Recipients</h3>
                    <div className="space-x-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={handleDeselectAll}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {pointPersonsWithEmail.length > 0 ? (
                    <div className="space-y-2">
                      {pointPersonsWithEmail.map((person) => (
                        <label key={person.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedRecipients.has(person.contact_email)}
                            onChange={() => handleToggleRecipient(person.contact_email)}
                            className="rounded border-gray-300"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {person.contact_name || person.contact_email}
                            </p>
                            {person.contact_name && (
                              <p className="text-xs text-gray-500 truncate">
                                {person.contact_email}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-2">
                      No point persons with email addresses
                    </p>
                  )}
                </div>

                {/* Email Preview */}
                {selectedEmails.length > 0 && (
                  <div className="border-t pt-6">
                    <h3 className="font-medium text-gray-900 mb-3">Email Preview</h3>
                    <EstimateEmailPreview
                      estimateId={estimate.id}
                      estimateName={estimate.estimate_name}
                      recipients={selectedEmails}
                      emailSubject={emailSubject}
                      emailBeginning={emailBeginning}
                      emailEnd={emailEnd}
                      emailSummaryConfig={emailSummaryConfig}
                      estimateData={estimateData}
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  disabled={isSending}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isSending || selectedEmails.length === 0}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    isSending || selectedEmails.length === 0
                      ? 'bg-gray-400 text-white cursor-not-allowed opacity-50'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Estimate
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};
