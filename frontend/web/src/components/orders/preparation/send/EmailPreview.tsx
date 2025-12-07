/**
 * Email Preview Component
 * Phase 1.5.c.6.3: Send to Customer
 *
 * Fetches email preview HTML from backend to ensure 100% accuracy
 * between preview and actual email sent.
 *
 * SINGLE SOURCE OF TRUTH: Backend gmailService.ts owns the email template.
 */

import React, { useState, useEffect } from 'react';
import { Mail, Paperclip, AlertCircle, Loader2 } from 'lucide-react';
import { orderPreparationApi } from '../../../../services/api/orders/orderPreparationApi';

interface Props {
  orderNumber: number;
  orderName: string;
  recipients: string[];
  specsOrderFormUrl: string | null;
  qbEstimateUrl: string | null;
  qbEstimateNumber: string | null;
}

export const EmailPreview: React.FC<Props> = ({
  orderNumber,
  recipients,
  specsOrderFormUrl,
  qbEstimateUrl
}) => {
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load email preview from backend
  useEffect(() => {
    loadPreview();
  }, [orderNumber, recipients]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await orderPreparationApi.getEmailPreview(orderNumber, recipients);

      setSubject(response.subject);
      setHtmlContent(response.html);
    } catch (err) {
      console.error('Error loading email preview:', err);
      setError('Failed to load email preview');
    } finally {
      setLoading(false);
    }
  };

  // Extract filename from URL
  const getFilename = (url: string | null) => {
    if (!url) return null;
    const parts = url.split('/');
    const filenameWithQuery = parts[parts.length - 1];
    return filenameWithQuery.split('?')[0];
  };

  const attachments = [
    getFilename(specsOrderFormUrl),
    getFilename(qbEstimateUrl)
  ].filter(Boolean) as string[];

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
      {/* Warning Notice */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-900">
            Gmail API Integration Pending
          </p>
          <p className="text-xs text-yellow-800 mt-1">
            Email preview is shown below. Actual email sending will be implemented in Phase 2
            when Gmail API is integrated. For now, email details will be logged to the console.
          </p>
        </div>
      </div>

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

          {attachments.length > 0 && (
            <div className="flex items-start gap-3">
              <Paperclip className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <span className="text-xs font-medium text-gray-500">Attachments:</span>
                <ul className="mt-1 space-y-1">
                  {attachments.map((attachment, index) => (
                    <li key={index} className="text-xs text-gray-700">
                      📎 {attachment}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
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
