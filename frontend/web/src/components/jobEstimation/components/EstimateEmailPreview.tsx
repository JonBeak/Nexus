/**
 * Email Preview Component for Estimates
 * Phase 4.1 - Email Preview Modal
 *
 * Fetches and displays estimate email preview HTML from backend.
 * Ensures 100% accuracy between preview and actual sent email.
 *
 * SINGLE SOURCE OF TRUTH: Backend gmailService owns the email template.
 */

import React, { useState, useEffect } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { jobVersioningApi } from '../../../services/jobVersioningApi';
import { EmailSummaryConfig, EstimateEmailData } from '../types';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface Props {
  estimateId: number;
  estimateName: string;
  recipients: string[];
  toRecipients?: string[];
  ccRecipients?: string[];
  bccRecipients?: string[];
  companyBccEmail?: string;
  emailSubject?: string;
  emailBeginning?: string;
  emailEnd?: string;
  emailSummaryConfig?: EmailSummaryConfig;
  estimateData?: EstimateEmailData;
}

const EstimateEmailPreviewComponent: React.FC<Props> = ({
  estimateId,
  recipients,
  toRecipients = [],
  ccRecipients = [],
  bccRecipients = [],
  companyBccEmail,
  emailSubject,
  emailBeginning,
  emailEnd,
  emailSummaryConfig,
  estimateData
}) => {
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load email preview from backend
  // Memoize recipients string to prevent unnecessary re-renders
  const recipientString = React.useMemo(() => recipients.join(','), [recipients]);

  // Combine BCC recipients with company BCC (must be before any early returns)
  const allBccRecipients = React.useMemo(() => {
    const bcc = [...bccRecipients];
    if (companyBccEmail && !bcc.includes(companyBccEmail)) {
      bcc.push(companyBccEmail);
    }
    return bcc;
  }, [bccRecipients, companyBccEmail]);

  useEffect(() => {
    loadPreview();
  }, [estimateId, recipientString, emailSubject, emailBeginning, emailEnd, emailSummaryConfig, estimateData]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch preview from backend with email content
      const response = await jobVersioningApi.getEstimateEmailPreview(
        estimateId,
        recipientString,
        {
          subject: emailSubject,
          beginning: emailBeginning,
          end: emailEnd,
          summaryConfig: emailSummaryConfig,
          estimateData: estimateData
        }
      );

      setSubject(response.subject);
      setHtmlContent(response.html);
    } catch (err) {
      console.error('Error loading email preview:', err);
      setError('Failed to load email preview');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
        <span className={`ml-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>Loading email preview...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  // Helper to render recipient badges
  const renderRecipientBadges = (emails: string[], colorClass: string) => (
    <div className="flex flex-wrap gap-1">
      {emails.map((email, index) => (
        <span
          key={index}
          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${colorClass}`}
        >
          {email}
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Email Preview */}
      <div className={`${PAGE_STYLES.panel.border} border rounded-lg overflow-hidden ${PAGE_STYLES.panel.background}`}>
        {/* Email Header */}
        <div className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b p-4 space-y-2`}>
          <div className="flex items-start gap-3">
            <Mail className={`w-5 h-5 ${PAGE_STYLES.panel.textMuted} mt-0.5`} />
            <div className="flex-1 min-w-0 space-y-2">
              {/* To: - Always show */}
              <div className="flex items-start gap-2">
                <span className={`text-xs font-medium ${PAGE_STYLES.panel.textMuted} w-10 flex-shrink-0`}>To:</span>
                {toRecipients.length > 0 ? (
                  renderRecipientBadges(toRecipients, 'bg-indigo-100 text-indigo-700')
                ) : (
                  <span className={`text-xs ${PAGE_STYLES.panel.textMuted} italic`}>No recipients selected</span>
                )}
              </div>

              {/* CC: - Only show if has recipients */}
              {ccRecipients.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className={`text-xs font-medium ${PAGE_STYLES.panel.textMuted} w-10 flex-shrink-0`}>CC:</span>
                  {renderRecipientBadges(ccRecipients, 'bg-blue-100 text-blue-700')}
                </div>
              )}

              {/* BCC: - Always show (company BCC is always included) */}
              <div className="flex items-start gap-2">
                <span className={`text-xs font-medium ${PAGE_STYLES.panel.textMuted} w-10 flex-shrink-0`}>BCC:</span>
                {allBccRecipients.length > 0 ? (
                  renderRecipientBadges(allBccRecipients, `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textSecondary}`)
                ) : (
                  <span className={`text-xs ${PAGE_STYLES.panel.textMuted} italic`}>None</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pl-8">
            <span className={`text-xs font-medium ${PAGE_STYLES.panel.textMuted} w-10 flex-shrink-0`}>Subject:</span>
            <span className={`text-sm ${PAGE_STYLES.panel.text}`}>{subject}</span>
          </div>
        </div>

        {/* Email Body - Render HTML from backend */}
        <div
          className={`p-6 ${PAGE_STYLES.panel.background} prose prose-sm max-w-none`}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  );
};

// Custom comparison: only re-render if actual email content changes, not array reference
export const EstimateEmailPreview = React.memo(
  EstimateEmailPreviewComponent,
  (prevProps, nextProps) => {
    const prevRecipientString = prevProps.recipients.join(',');
    const nextRecipientString = nextProps.recipients.join(',');
    const prevToString = (prevProps.toRecipients || []).join(',');
    const nextToString = (nextProps.toRecipients || []).join(',');
    const prevCcString = (prevProps.ccRecipients || []).join(',');
    const nextCcString = (nextProps.ccRecipients || []).join(',');
    const prevBccString = (prevProps.bccRecipients || []).join(',');
    const nextBccString = (nextProps.bccRecipients || []).join(',');

    // Return true if props are equal (no re-render needed)
    return (
      prevRecipientString === nextRecipientString &&
      prevToString === nextToString &&
      prevCcString === nextCcString &&
      prevBccString === nextBccString &&
      prevProps.companyBccEmail === nextProps.companyBccEmail &&
      prevProps.estimateId === nextProps.estimateId &&
      prevProps.emailSubject === nextProps.emailSubject &&
      prevProps.emailBeginning === nextProps.emailBeginning &&
      prevProps.emailEnd === nextProps.emailEnd &&
      prevProps.estimateName === nextProps.estimateName &&
      JSON.stringify(prevProps.emailSummaryConfig) === JSON.stringify(nextProps.emailSummaryConfig) &&
      JSON.stringify(prevProps.estimateData) === JSON.stringify(nextProps.estimateData)
    );
  }
);
