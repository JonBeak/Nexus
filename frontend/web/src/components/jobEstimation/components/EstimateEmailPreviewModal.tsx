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
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { COMPANY_BCC_EMAIL, RecipientType } from '../../../constants/emailSettings';

export interface EmailRecipients {
  to: string[];
  cc: string[];
  bcc: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (recipients: EmailRecipients) => void;
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
  // Track recipient type for each email: 'to', 'cc', 'bcc', or undefined (not selected)
  const [recipientTypes, setRecipientTypes] = useState<Map<string, RecipientType>>(
    new Map(pointPersons.filter(p => p.contact_email).map(p => [p.contact_email, 'to' as RecipientType]))
  );
  const [pdfLoadError, setPdfLoadError] = useState(false);

  // Sync recipientTypes when pointPersons changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipientTypes(
        new Map(pointPersons.filter(p => p.contact_email).map(p => [p.contact_email, 'to' as RecipientType]))
      );
    }
  }, [isOpen, pointPersons]);

  // Compute recipients by type
  const { toRecipients, ccRecipients, bccRecipients, allSelectedEmails } = useMemo(() => {
    const to: string[] = [];
    const cc: string[] = [];
    const bcc: string[] = [];

    recipientTypes.forEach((type, email) => {
      if (email && email.trim()) {
        if (type === 'to') to.push(email);
        else if (type === 'cc') cc.push(email);
        else if (type === 'bcc') bcc.push(email);
      }
    });

    return {
      toRecipients: to,
      ccRecipients: cc,
      bccRecipients: bcc,
      allSelectedEmails: [...to, ...cc, ...bcc]
    };
  }, [recipientTypes]);

  const handleSetRecipientType = (email: string, type: RecipientType | null) => {
    const newTypes = new Map(recipientTypes);
    if (type === null) {
      newTypes.delete(email);
    } else {
      newTypes.set(email, type);
    }
    setRecipientTypes(newTypes);
  };

  const handleSelectAllTo = () => {
    const newTypes = new Map<string, RecipientType>();
    pointPersons.filter(p => p.contact_email).forEach(p => {
      newTypes.set(p.contact_email, 'to');
    });
    setRecipientTypes(newTypes);
  };

  const handleDeselectAll = () => {
    setRecipientTypes(new Map());
  };

  const handleConfirm = () => {
    if (toRecipients.length === 0) {
      alert('Please select at least one recipient in the To: field');
      return;
    }
    // Always include company BCC email
    const finalBcc = [...bccRecipients];
    if (COMPANY_BCC_EMAIL && !finalBcc.includes(COMPANY_BCC_EMAIL)) {
      finalBcc.push(COMPANY_BCC_EMAIL);
    }
    onConfirm({
      to: toRecipients,
      cc: ccRecipients,
      bcc: finalBcc
    });
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
        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl w-full max-h-[92vh] overflow-hidden flex ${hasQbEstimate ? 'max-w-[1600px]' : 'max-w-3xl flex-col'}`}>

          {hasQbEstimate ? (
            <>
              {/* Left Column: Header + Content + Footer */}
              <div className={`w-[700px] flex-shrink-0 flex flex-col border-r ${PAGE_STYLES.border}`}>
                {/* Header */}
                <div className={`flex items-center justify-between border-b ${PAGE_STYLES.border} p-5`}>
                  <div>
                    <h2 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
                      Send Estimate to Customer
                    </h2>
                    <p className={`text-sm ${PAGE_STYLES.panel.textMuted} mt-0.5`}>
                      Review and confirm before sending
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className={`${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.text} transition-colors`}
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
                  <div className={`border ${PAGE_STYLES.border} rounded-lg p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`font-medium ${PAGE_STYLES.panel.text} text-sm`}>Select Recipients</h3>
                      <div className="space-x-2 text-xs">
                        <button
                          onClick={handleSelectAllTo}
                          className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          All To
                        </button>
                        <span className={PAGE_STYLES.panel.textMuted}>|</span>
                        <button
                          onClick={handleDeselectAll}
                          className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {pointPersonsWithEmail.length > 0 ? (
                      <div className="space-y-1">
                        {/* Header row with column labels */}
                        <div className={`flex items-center gap-2 px-1.5 pb-1 border-b ${PAGE_STYLES.border}`}>
                          <div className="flex-1" />
                          <div className={`flex items-center gap-4 text-xs font-medium ${PAGE_STYLES.panel.textMuted}`}>
                            <span className={`w-8 text-center ${PAGE_STYLES.panel.textMuted}`}>To</span>
                            <span className={`w-8 text-center ${PAGE_STYLES.panel.textMuted}`}>CC</span>
                            <span className={`w-8 text-center ${PAGE_STYLES.panel.textMuted}`}>BCC</span>
                          </div>
                        </div>
                        {pointPersonsWithEmail.map((person) => {
                          const currentType = recipientTypes.get(person.contact_email);
                          return (
                            <div key={person.id} className={`flex items-center gap-2 p-1.5 ${PAGE_STYLES.interactive.hover} rounded`}>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                                  {person.contact_name || person.contact_email}
                                </p>
                                {person.contact_name && person.contact_name !== person.contact_email && (
                                  <p className={`text-xs ${PAGE_STYLES.panel.textMuted} truncate`}>
                                    {person.contact_email}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <label className="w-8 flex justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={currentType === 'to'}
                                    onChange={() => handleSetRecipientType(person.contact_email, currentType === 'to' ? null : 'to')}
                                    className={`rounded ${PAGE_STYLES.border}`}
                                  />
                                </label>
                                <label className="w-8 flex justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={currentType === 'cc'}
                                    onChange={() => handleSetRecipientType(person.contact_email, currentType === 'cc' ? null : 'cc')}
                                    className={`rounded ${PAGE_STYLES.border}`}
                                  />
                                </label>
                                <label className="w-8 flex justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={currentType === 'bcc'}
                                    onChange={() => handleSetRecipientType(person.contact_email, currentType === 'bcc' ? null : 'bcc')}
                                    className={`rounded ${PAGE_STYLES.border}`}
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className={`text-sm ${PAGE_STYLES.panel.textMuted} py-2`}>
                        No point persons with email addresses
                      </p>
                    )}
                  </div>

                  {/* Email Preview - Always in DOM to prevent screen shake */}
                  <div className={`border-t ${PAGE_STYLES.border} pt-4 transition-opacity duration-200 ${allSelectedEmails.length > 0 ? 'opacity-100' : 'hidden'}`}>
                    <h3 className={`font-medium ${PAGE_STYLES.panel.text} text-sm mb-2`}>Email Preview</h3>
                    {allSelectedEmails.length > 0 && (
                      <EstimateEmailPreview
                        estimateId={estimate.id}
                        estimateName={estimate.estimate_name}
                        recipients={allSelectedEmails}
                        toRecipients={toRecipients}
                        ccRecipients={ccRecipients}
                        bccRecipients={bccRecipients}
                        companyBccEmail={COMPANY_BCC_EMAIL}
                        emailSubject={emailSubject}
                        emailBeginning={emailBeginning}
                        emailEnd={emailEnd}
                        emailSummaryConfig={emailSummaryConfig}
                        estimateData={estimateData}
                      />
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className={`border-t ${PAGE_STYLES.border} p-4 ${PAGE_STYLES.header.background} flex items-center justify-end gap-3`}>
                  <button
                    onClick={onClose}
                    disabled={isSending}
                    className={`px-4 py-2 text-sm font-medium ${PAGE_STYLES.panel.text} ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.border} rounded-lg ${PAGE_STYLES.interactive.hover} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isSending || toRecipients.length === 0}
                    className={`px-5 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${
                      isSending || toRecipients.length === 0
                        ? `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textMuted} cursor-not-allowed opacity-50`
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
              <div className={`flex-1 overflow-y-auto ${PAGE_STYLES.header.background} p-4`}>
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
              <div className={`flex items-center justify-between border-b ${PAGE_STYLES.border} p-6`}>
                <div>
                  <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text}`}>
                    Send Estimate to Customer
                  </h2>
                  <p className={`text-sm ${PAGE_STYLES.panel.textMuted} mt-1`}>
                    Review and confirm the estimate email before sending
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className={`${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.text} transition-colors`}
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
                <div className={`border ${PAGE_STYLES.border} rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`font-medium ${PAGE_STYLES.panel.text}`}>Select Recipients</h3>
                    <div className="space-x-2">
                      <button
                        onClick={handleSelectAllTo}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        All To
                      </button>
                      <span className={PAGE_STYLES.panel.textMuted}>|</span>
                      <button
                        onClick={handleDeselectAll}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {pointPersonsWithEmail.length > 0 ? (
                    <div className="space-y-2">
                      {/* Header row with column labels */}
                      <div className={`flex items-center gap-3 px-2 pb-2 border-b ${PAGE_STYLES.border}`}>
                        <div className="flex-1" />
                        <div className={`flex items-center gap-4 text-xs font-medium ${PAGE_STYLES.panel.textMuted}`}>
                          <span className={`w-8 text-center ${PAGE_STYLES.panel.textMuted}`}>To</span>
                          <span className={`w-8 text-center ${PAGE_STYLES.panel.textMuted}`}>CC</span>
                          <span className={`w-8 text-center ${PAGE_STYLES.panel.textMuted}`}>BCC</span>
                        </div>
                      </div>
                      {pointPersonsWithEmail.map((person) => {
                        const currentType = recipientTypes.get(person.contact_email);
                        return (
                          <div key={person.id} className={`flex items-center gap-3 p-2 ${PAGE_STYLES.interactive.hover} rounded`}>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                                {person.contact_name || person.contact_email}
                              </p>
                              {person.contact_name && person.contact_name !== person.contact_email && (
                                <p className={`text-xs ${PAGE_STYLES.panel.textMuted} truncate`}>
                                  {person.contact_email}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <label className="w-8 flex justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={currentType === 'to'}
                                  onChange={() => handleSetRecipientType(person.contact_email, currentType === 'to' ? null : 'to')}
                                  className={`rounded ${PAGE_STYLES.border}`}
                                />
                              </label>
                              <label className="w-8 flex justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={currentType === 'cc'}
                                  onChange={() => handleSetRecipientType(person.contact_email, currentType === 'cc' ? null : 'cc')}
                                  className={`rounded ${PAGE_STYLES.border}`}
                                />
                              </label>
                              <label className="w-8 flex justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={currentType === 'bcc'}
                                  onChange={() => handleSetRecipientType(person.contact_email, currentType === 'bcc' ? null : 'bcc')}
                                  className={`rounded ${PAGE_STYLES.border}`}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={`text-sm ${PAGE_STYLES.panel.textMuted} py-2`}>
                      No point persons with email addresses
                    </p>
                  )}
                </div>

                {/* Email Preview - Always in DOM to prevent screen shake */}
                <div className={`transition-opacity duration-200 ${allSelectedEmails.length > 0 ? 'opacity-100' : 'hidden'}`}>
                  <div className={`border-t ${PAGE_STYLES.border} pt-6`}>
                    <h3 className={`font-medium ${PAGE_STYLES.panel.text} mb-3`}>Email Preview</h3>
                    {allSelectedEmails.length > 0 && (
                      <EstimateEmailPreview
                        estimateId={estimate.id}
                        estimateName={estimate.estimate_name}
                        recipients={allSelectedEmails}
                        toRecipients={toRecipients}
                        ccRecipients={ccRecipients}
                        bccRecipients={bccRecipients}
                        companyBccEmail={COMPANY_BCC_EMAIL}
                        emailSubject={emailSubject}
                        emailBeginning={emailBeginning}
                        emailEnd={emailEnd}
                        emailSummaryConfig={emailSummaryConfig}
                        estimateData={estimateData}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={`border-t ${PAGE_STYLES.border} p-6 ${PAGE_STYLES.header.background} flex items-center justify-end gap-3`}>
                <button
                  onClick={onClose}
                  disabled={isSending}
                  className={`px-4 py-2 text-sm font-medium ${PAGE_STYLES.panel.text} ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.border} rounded-lg ${PAGE_STYLES.interactive.hover} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isSending || toRecipients.length === 0}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    isSending || toRecipients.length === 0
                      ? `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textMuted} cursor-not-allowed opacity-50`
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
