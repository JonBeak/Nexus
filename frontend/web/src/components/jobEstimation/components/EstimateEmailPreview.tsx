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

interface Props {
  estimateId: number;
  estimateName: string;
  recipients: string[];
  emailSubject?: string;
  emailBeginning?: string;
  emailEnd?: string;
  emailSummaryConfig?: EmailSummaryConfig;
  estimateData?: EstimateEmailData;
}

export const EstimateEmailPreview: React.FC<Props> = ({
  estimateId,
  recipients,
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
  useEffect(() => {
    loadPreview();
  }, [estimateId, recipients, emailSubject, emailBeginning, emailEnd, emailSummaryConfig, estimateData]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build comma-separated recipient string
      const recipientString = recipients.join(',');

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
        <span className="ml-2 text-sm text-gray-600">Loading email preview...</span>
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

  return (
    <div className="space-y-4">
      {/* Email Preview */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        {/* Email Header */}
        <div className="bg-gray-50 border-b border-gray-200 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">To:</span>
                <div className="flex flex-wrap gap-1">
                  {recipients.length > 0 ? (
                    recipients.map((email, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded"
                      >
                        {email}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">
                      No recipients selected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 w-12">Subject:</span>
            <span className="text-sm text-gray-900">{subject}</span>
          </div>
        </div>

        {/* Email Body - Render HTML from backend */}
        <div
          className="p-6 bg-white prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  );
};
