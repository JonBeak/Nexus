/**
 * Order Email Preview Panel
 * Displays the email preview on the right side of the modal during Send phase.
 *
 * Features:
 * - Color-coded recipient badges (To/CC/BCC)
 * - Full HTML email preview fetched from backend
 * - Loading and error states
 * - Navy blue color scheme to match order theme
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import { orderPreparationApi } from '../../../../services/api/orders/orderPreparationApi';
import { OrderEmailContent } from './OrderEmailComposer';
import { RecipientSelection } from './PointPersonSelector';
import { PAGE_STYLES } from '../../../../constants/moduleColors';

interface Props {
  orderNumber: number;
  orderName: string;
  customerName?: string;
  recipients: RecipientSelection;
  emailContent: OrderEmailContent;
  pdfUrls: {
    specsOrderForm: string | null;
    qbEstimate: string | null;
  };
}

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export const OrderEmailPreviewPanel: React.FC<Props> = ({
  orderNumber,
  orderName,
  customerName,
  recipients,
  emailContent,
  pdfUrls
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [iframeHeight, setIframeHeight] = useState(400);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasLoadedOnce = useRef(false);  // Track if we've loaded at least once

  // Resize iframe to fit content
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentDocument?.body) {
      // Get the scroll height of the content
      const contentHeight = iframe.contentDocument.body.scrollHeight;
      // Add some padding and set minimum height
      setIframeHeight(Math.max(400, contentHeight + 20));
    }
  }, []);

  // Reset height when HTML changes so it recalculates on load
  useEffect(() => {
    setIframeHeight(400);
  }, [previewHtml]);

  // Debounce email content changes to avoid too many API calls
  const debouncedEmailContent = useDebounce(emailContent, 500);

  // Fetch email preview from backend
  const fetchPreview = useCallback(async () => {
    // Don't fetch if no recipients
    if (recipients.to.length === 0 && recipients.cc.length === 0 && recipients.bcc.length === 0) {
      setPreviewHtml('');
      setPreviewSubject('');
      setLoading(false);
      return;
    }

    try {
      // Only show loading spinner on initial load, not on updates
      if (!hasLoadedOnce.current) {
        setLoading(true);
      }
      setError(null);

      const response = await orderPreparationApi.getOrderEmailPreview(orderNumber, {
        recipients,
        emailContent: debouncedEmailContent,
        customerName,
        orderName,
        pdfUrls
      });

      setPreviewHtml(response.html);
      setPreviewSubject(response.subject);
      hasLoadedOnce.current = true;  // Mark that we've loaded at least once
    } catch (err) {
      console.error('[OrderEmailPreviewPanel] Error fetching preview:', err);
      setError('Failed to load email preview');
    } finally {
      setLoading(false);
    }
  }, [orderNumber, recipients, debouncedEmailContent, customerName, orderName, pdfUrls]);

  // Fetch preview when dependencies change
  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // Compute total recipient count
  const totalRecipients = recipients.to.length + recipients.cc.length + recipients.bcc.length;

  // Render recipient badges
  const renderRecipientBadges = () => {
    const badges: JSX.Element[] = [];

    if (recipients.to.length > 0) {
      badges.push(
        <div key="to" className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 w-8">To:</span>
          <div className="flex flex-wrap gap-1">
            {recipients.to.map((email, i) => (
              <span
                key={`to-${i}`}
                className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
              >
                {email}
              </span>
            ))}
          </div>
        </div>
      );
    }

    if (recipients.cc.length > 0) {
      badges.push(
        <div key="cc" className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 w-8">CC:</span>
          <div className="flex flex-wrap gap-1">
            {recipients.cc.map((email, i) => (
              <span
                key={`cc-${i}`}
                className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded"
              >
                {email}
              </span>
            ))}
          </div>
        </div>
      );
    }

    // Always show BCC with company email (added server-side)
    const companyBcc = 'info@signhouse.ca';
    const allBcc = [...recipients.bcc];
    if (!allBcc.includes(companyBcc)) {
      allBcc.push(companyBcc);
    }

    badges.push(
      <div key="bcc" className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 w-8">BCC:</span>
        <div className="flex flex-wrap gap-1">
          {allBcc.map((email, i) => (
            <span
              key={`bcc-${i}`}
              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
            >
              {email}
            </span>
          ))}
        </div>
      </div>
    );

    return badges;
  };

  // No recipients selected
  if (totalRecipients === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-gray-400 py-24">
        <Mail className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">Select recipients to see email preview</p>
      </div>
    );
  }

  // Loading state - only show spinner on initial load, not updates
  if (loading && !hasLoadedOnce.current) {
    return (
      <div className="flex flex-col items-center justify-center text-gray-400 py-24">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Loading email preview...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={fetchPreview}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header - Email envelope info */}
      <div className={`${PAGE_STYLES.header.background} border ${PAGE_STYLES.border} rounded-lg p-4`}>
        <h3 className={`text-sm font-semibold ${PAGE_STYLES.header.text} mb-3 pb-2 border-b ${PAGE_STYLES.border}`}>
          Email Preview
        </h3>

        {/* Recipient Badges */}
        <div className="space-y-2">
          {renderRecipientBadges()}
        </div>

        {/* Subject Line */}
        {previewSubject && (
          <div className={`mt-3 pt-3 border-t ${PAGE_STYLES.border}`}>
            <div className="flex items-start gap-2">
              <span className={`text-xs font-semibold ${PAGE_STYLES.panel.textMuted} w-12 flex-shrink-0`}>Subject:</span>
              <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>{previewSubject}</span>
            </div>
          </div>
        )}
      </div>

      {/* Email Body Preview */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden py-4">
        <iframe
          ref={iframeRef}
          srcDoc={previewHtml}
          title="Email Preview"
          className="w-full border-0"
          style={{ height: iframeHeight, display: 'block' }}
          sandbox="allow-same-origin"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
};

export default OrderEmailPreviewPanel;
