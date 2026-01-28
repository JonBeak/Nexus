/**
 * @deprecated Use DocumentActionModal from './document' with documentType="estimate" instead.
 * This component will be removed in a future release.
 *
 * Estimate Action Modal
 * Cash Job Estimate Email Workflow
 *
 * Combined modal for Send/View estimate flow with:
 * - Estimate PDF preview
 * - Email editor (recipients, subject, body)
 * - Schedule option for delayed send
 * - Email history in view mode
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, Calendar, Send, FileText, Clock, Mail, Eye, CheckCircle } from 'lucide-react';
import { Order } from '../../../types/orders';
import { orderPreparationApi } from '../../../services/api';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

interface EstimateActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  mode: 'send' | 'view';
  onSuccess: () => void;
  onReassign?: () => void;
}

interface RecipientEntry {
  id: string;
  email: string;
  name?: string;
  label?: string;
  emailType: 'to' | 'cc' | 'bcc' | null;
}

interface EmailHistoryItem {
  id: number;
  emailType: string;
  recipientEmails: string[];
  subject: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  scheduledFor: string;
  sentAt: string | null;
  createdAt: string;
}

const DEFAULT_BEGINNING = 'Please find attached the estimate for your review.';
const DEFAULT_END = 'Please let us know if you have any questions or need any modifications.\n\nThank you for your business!';

export const EstimateActionModal: React.FC<EstimateActionModalProps> = ({
  isOpen,
  onClose,
  order,
  mode,
  onSuccess,
  onReassign
}) => {
  // Form State
  const [recipientEntries, setRecipientEntries] = useState<RecipientEntry[]>([]);
  const [subject, setSubject] = useState('');
  const [beginning, setBeginning] = useState(DEFAULT_BEGINNING);
  const [end, setEnd] = useState(DEFAULT_END);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  // UI State
  const [loading, setLoading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [previewTab, setPreviewTab] = useState<'email' | 'pdf'>('email');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // PDF state
  const [estimatePdf, setEstimatePdf] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Email history
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Success state
  const [showSuccess, setShowSuccess] = useState(false);

  // Mobile responsiveness
  const isMobile = useIsMobile();
  useBodyScrollLock(isOpen && isMobile);

  // Refs
  const modalContentRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);
  const hasStartedInitRef = useRef(false);

  // Build default subject
  const defaultSubject = useMemo(() => {
    if (order.qb_estimate_doc_number) {
      return `${order.order_name} | Estimate #${order.qb_estimate_doc_number}`;
    }
    return `${order.order_name} | Estimate`;
  }, [order.order_name, order.qb_estimate_doc_number]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showScheduleModal) {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showScheduleModal]);

  // Handle backdrop click
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownOutsideRef.current = modalContentRef.current
      ? !modalContentRef.current.contains(e.target as Node)
      : false;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (showScheduleModal) {
      mouseDownOutsideRef.current = false;
      return;
    }
    if (mouseDownOutsideRef.current && modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
      onClose();
    }
    mouseDownOutsideRef.current = false;
  };

  // Initialize modal
  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setIsInitialized(false);
      setError(null);
      setScheduleEnabled(false);
      setScheduledDate('');
      setScheduledTime('09:00');
      setShowScheduleModal(false);
      setEstimatePdf(null);
      setPdfError(null);
      setEmailHistory([]);
      setRecipientEntries([]);
      setShowSuccess(false);
      setBeginning(DEFAULT_BEGINNING);
      setEnd(DEFAULT_END);
      hasStartedInitRef.current = false;
      return;
    }

    const initializeModal = async () => {
      if (hasStartedInitRef.current) return;
      hasStartedInitRef.current = true;

      try {
        // Initialize recipients from accounting emails
        const entries: RecipientEntry[] = [];
        const addedEmails = new Set<string>();

        if (order.accounting_emails?.length > 0) {
          order.accounting_emails.forEach((ae, idx) => {
            entries.push({
              id: `accounting-${idx}`,
              email: ae.email,
              name: ae.label || 'Accounting',
              label: 'Accounting',
              emailType: ae.email_type || 'to'
            });
            addedEmails.add(ae.email.toLowerCase());
          });
        }

        if (order.point_persons?.length > 0) {
          order.point_persons.forEach((pp, idx) => {
            if (pp.contact_email && !addedEmails.has(pp.contact_email.toLowerCase())) {
              entries.push({
                id: `pp-${pp.id || idx}`,
                email: pp.contact_email,
                name: pp.contact_name,
                label: pp.contact_role || 'Point Person',
                emailType: 'to'
              });
              addedEmails.add(pp.contact_email.toLowerCase());
            }
          });
        }

        setRecipientEntries(entries);
        setSubject(defaultSubject);

        // Load PDF
        if (order.qb_estimate_id) {
          try {
            setLoadingPdf(true);
            const result = await orderPreparationApi.getEstimatePdf(order.order_number);
            setEstimatePdf(result.pdf);
          } catch (err) {
            console.error('Failed to load estimate PDF:', err);
            setPdfError(err instanceof Error ? err.message : 'Failed to load PDF');
          } finally {
            setLoadingPdf(false);
          }
        }

        // Load email history for view mode
        if (mode === 'view') {
          try {
            setLoadingHistory(true);
            const history = await orderPreparationApi.getEstimateEmailHistory(order.order_number);
            setEmailHistory(history);
          } catch (err) {
            console.error('Failed to load email history:', err);
          } finally {
            setLoadingHistory(false);
          }
        }

        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize modal:', err);
        setSubject(defaultSubject);
        setRecipientEntries([]);
        setIsInitialized(true);
      }
    };

    initializeModal();
  }, [isOpen, mode, order, defaultSubject]);

  // Get selected recipients by type
  const getRecipientsByType = (type: 'to' | 'cc' | 'bcc') => {
    return recipientEntries.filter(r => r.emailType === type).map(r => r.email);
  };

  // Handle recipient email type change
  const handleRecipientTypeChange = (id: string, emailType: 'to' | 'cc' | 'bcc' | null) => {
    setRecipientEntries(entries =>
      entries.map(entry =>
        entry.id === id ? { ...entry, emailType } : entry
      )
    );
  };

  // Build email body HTML
  const buildEmailBody = () => {
    const beginningHtml = beginning ? `<p>${beginning.replace(/\n/g, '<br>')}</p>` : '';
    const endHtml = end ? `<p>${end.replace(/\n/g, '<br>')}</p>` : '';
    return `${beginningHtml}${endHtml}`;
  };

  // Send email
  const handleSend = async () => {
    const toEmails = getRecipientsByType('to');
    const ccEmails = getRecipientsByType('cc');
    const bccEmails = getRecipientsByType('bcc');

    if (toEmails.length === 0) {
      setError('Please select at least one recipient');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await orderPreparationApi.sendEstimateEmail(order.order_number, {
        recipientEmails: toEmails,
        ccEmails,
        bccEmails,
        subject,
        body: buildEmailBody(),
        attachEstimatePdf: true
      });

      setShowSuccess(true);
      setTimeout(() => {
        onClose();
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Failed to send estimate email:', err);
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  // Schedule email
  const handleSchedule = async () => {
    const toEmails = getRecipientsByType('to');
    const ccEmails = getRecipientsByType('cc');
    const bccEmails = getRecipientsByType('bcc');

    if (toEmails.length === 0) {
      setError('Please select at least one recipient');
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      setError('Please select a date and time');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);
      await orderPreparationApi.scheduleEstimateEmail(order.order_number, {
        recipientEmails: toEmails,
        ccEmails,
        bccEmails,
        subject,
        body: buildEmailBody(),
        attachEstimatePdf: true,
        scheduledFor: scheduledFor.toISOString()
      });

      setShowScheduleModal(false);
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Failed to schedule estimate email:', err);
      setError(err instanceof Error ? err.message : 'Failed to schedule email');
    } finally {
      setLoading(false);
    }
  };

  // Mark as sent
  const handleMarkAsSent = async () => {
    setLoading(true);
    setError(null);

    try {
      await orderPreparationApi.markEstimateAsSent(order.order_number);
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Failed to mark estimate as sent:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark as sent');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Success state
  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl p-8 max-w-md w-full text-center`}>
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text} mb-2`}>
            {scheduleEnabled ? 'Email Scheduled!' : 'Email Sent!'}
          </h2>
          <p className={PAGE_STYLES.panel.textMuted}>
            {scheduleEnabled
              ? 'The estimate email has been scheduled for delivery.'
              : 'The estimate email has been sent successfully.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-[60] ${isMobile ? 'overflow-y-auto' : 'flex items-center justify-center'}`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl w-full flex flex-col ${
          isMobile ? 'min-h-full' : 'max-w-4xl mx-4 max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${PAGE_STYLES.panel.border} flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-3">
            {mode === 'send' ? (
              <Send className="w-5 h-5 text-blue-600" />
            ) : (
              <Eye className="w-5 h-5 text-gray-600" />
            )}
            <div>
              <h2 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
                {mode === 'send' ? 'Send Estimate' : 'View Estimate'}
              </h2>
              <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
                Order #{order.order_number} &bull; {order.customer_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 ${PAGE_STYLES.panel.textMuted} hover:text-gray-700 rounded transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!isInitialized ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className={`${isMobile ? 'flex flex-col' : 'grid grid-cols-2'} h-full`}>
              {/* Left: Email Setup */}
              <div className={`p-6 ${isMobile ? '' : 'border-r'} ${PAGE_STYLES.panel.border}`}>
                {/* Recipients */}
                <div className="mb-6">
                  <h3 className={`text-sm font-medium ${PAGE_STYLES.panel.text} mb-3`}>Recipients</h3>
                  {recipientEntries.length === 0 ? (
                    <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
                      No recipients configured. Please add accounting emails to the customer.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recipientEntries.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${PAGE_STYLES.panel.text} truncate`}>
                              {entry.name || entry.email}
                            </p>
                            {entry.name && (
                              <p className={`text-xs ${PAGE_STYLES.panel.textMuted} truncate`}>{entry.email}</p>
                            )}
                          </div>
                          <select
                            value={entry.emailType || ''}
                            onChange={(e) => handleRecipientTypeChange(entry.id, (e.target.value || null) as any)}
                            className="ml-2 text-xs border rounded px-2 py-1"
                          >
                            <option value="">Skip</option>
                            <option value="to">To</option>
                            <option value="cc">CC</option>
                            <option value="bcc">BCC</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subject */}
                <div className="mb-6">
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.text} mb-2`}>Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className={`w-full px-3 py-2 border ${PAGE_STYLES.panel.border} rounded-lg text-sm`}
                    placeholder="Email subject..."
                  />
                </div>

                {/* Beginning Text */}
                <div className="mb-6">
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.text} mb-2`}>Opening Message</label>
                  <textarea
                    value={beginning}
                    onChange={(e) => setBeginning(e.target.value)}
                    rows={3}
                    className={`w-full px-3 py-2 border ${PAGE_STYLES.panel.border} rounded-lg text-sm resize-none`}
                    placeholder="Opening message..."
                  />
                </div>

                {/* End Text */}
                <div className="mb-6">
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.text} mb-2`}>Closing Message</label>
                  <textarea
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    rows={3}
                    className={`w-full px-3 py-2 border ${PAGE_STYLES.panel.border} rounded-lg text-sm resize-none`}
                    placeholder="Closing message..."
                  />
                </div>

                {/* Email History (view mode) */}
                {mode === 'view' && (
                  <div className="mb-6">
                    <h3 className={`text-sm font-medium ${PAGE_STYLES.panel.text} mb-3`}>Email History</h3>
                    {loadingHistory ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading history...
                      </div>
                    ) : emailHistory.length === 0 ? (
                      <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>No emails sent yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {emailHistory.map(item => (
                          <div key={item.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-medium ${PAGE_STYLES.panel.text}`}>
                                {item.subject.substring(0, 40)}...
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                item.status === 'sent' ? 'bg-green-100 text-green-800' :
                                item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {item.status}
                              </span>
                            </div>
                            <p className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>
                              {item.sentAt
                                ? `Sent: ${new Date(item.sentAt).toLocaleString()}`
                                : `Scheduled: ${new Date(item.scheduledFor).toLocaleString()}`
                              }
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}
              </div>

              {/* Right: Preview */}
              <div className="p-6 flex flex-col">
                {/* Preview Tabs */}
                <div className="flex border-b mb-4">
                  <button
                    onClick={() => setPreviewTab('email')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      previewTab === 'email'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email Preview
                  </button>
                  <button
                    onClick={() => setPreviewTab('pdf')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      previewTab === 'pdf'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FileText className="w-4 h-4 inline mr-2" />
                    Estimate PDF
                  </button>
                </div>

                {/* Preview Content */}
                <div className="flex-1 min-h-[300px] border rounded-lg overflow-hidden">
                  {previewTab === 'email' ? (
                    <div className="p-4 h-full overflow-y-auto bg-white">
                      <div className="text-sm">
                        <div className="mb-4 pb-4 border-b">
                          <p className="text-gray-500 mb-1">
                            <strong>To:</strong> {getRecipientsByType('to').join(', ') || '(none selected)'}
                          </p>
                          {getRecipientsByType('cc').length > 0 && (
                            <p className="text-gray-500 mb-1">
                              <strong>CC:</strong> {getRecipientsByType('cc').join(', ')}
                            </p>
                          )}
                          <p className="text-gray-500">
                            <strong>Subject:</strong> {subject}
                          </p>
                        </div>
                        <div className="prose prose-sm max-w-none">
                          {beginning && <p className="whitespace-pre-wrap">{beginning}</p>}
                          <p className="text-blue-600 my-4">[Estimate PDF Attached]</p>
                          {end && <p className="whitespace-pre-wrap">{end}</p>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gray-100">
                      {loadingPdf ? (
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Loading PDF...</p>
                        </div>
                      ) : pdfError ? (
                        <div className="text-center p-4">
                          <p className="text-red-600 mb-2">{pdfError}</p>
                          <button
                            onClick={async () => {
                              setLoadingPdf(true);
                              setPdfError(null);
                              try {
                                const result = await orderPreparationApi.getEstimatePdf(order.order_number);
                                setEstimatePdf(result.pdf);
                              } catch (err) {
                                setPdfError(err instanceof Error ? err.message : 'Failed to load PDF');
                              } finally {
                                setLoadingPdf(false);
                              }
                            }}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Retry
                          </button>
                        </div>
                      ) : estimatePdf ? (
                        <iframe
                          src={`data:application/pdf;base64,${estimatePdf}`}
                          className="w-full h-full"
                          title="Estimate PDF Preview"
                        />
                      ) : (
                        <p className="text-gray-500">No PDF available</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${PAGE_STYLES.panel.border} flex justify-between items-center flex-shrink-0`}>
          <div className="flex items-center gap-3">
            {mode === 'view' && onReassign && (
              <button
                onClick={onReassign}
                className={`px-4 py-2 text-sm font-medium ${PAGE_STYLES.panel.text} ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.interactive.hover}`}
              >
                Reassign Estimate
              </button>
            )}
            {mode === 'send' && (
              <button
                onClick={handleMarkAsSent}
                disabled={loading}
                className={`px-4 py-2 text-sm font-medium ${PAGE_STYLES.panel.text} ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.interactive.hover} disabled:opacity-50`}
              >
                Mark as Sent
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium ${PAGE_STYLES.panel.text} ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.interactive.hover}`}
            >
              Cancel
            </button>
            {mode === 'send' && (
              <>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  disabled={loading || getRecipientsByType('to').length === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Clock className="w-4 h-4" />
                  Schedule
                </button>
                <button
                  onClick={handleSend}
                  disabled={loading || getRecipientsByType('to').length === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Now
                </button>
              </>
            )}
            {mode === 'view' && (
              <button
                onClick={handleSend}
                disabled={loading || getRecipientsByType('to').length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Resend
              </button>
            )}
          </div>
        </div>

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
            <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl p-6 max-w-md w-full`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>Schedule Email</h3>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className={`p-2 ${PAGE_STYLES.panel.textMuted} hover:text-gray-700 rounded`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.text} mb-2`}>Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={`w-full px-3 py-2 border ${PAGE_STYLES.panel.border} rounded-lg`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.text} mb-2`}>Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className={`w-full px-3 py-2 border ${PAGE_STYLES.panel.border} rounded-lg`}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className={`px-4 py-2 text-sm font-medium ${PAGE_STYLES.panel.text} ${PAGE_STYLES.header.background} rounded-lg`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={loading || !scheduledDate || !scheduledTime}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EstimateActionModal;
