/**
 * Send to Customer Panel
 * Phase 1.5.c.6.3: Send to Customer
 *
 * Main container for the "Send" phase of order preparation.
 * Responsibilities:
 * - Load point persons from API
 * - Manage recipient selection state (To/CC/BCC)
 * - Manage email content state
 * - Render PointPersonSelector and OrderEmailComposer components
 * - Expose getRecipients() and getEmailContent() via ref
 */

import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { PointPersonSelector, PointPerson, RecipientType, RecipientSelection } from './PointPersonSelector';
import { OrderEmailComposer, OrderEmailContent, DEFAULT_ORDER_EMAIL_CONTENT } from './OrderEmailComposer';
import { orderPreparationApi } from '../../../../services/api/orders/orderPreparationApi';

// Note: Company BCC is added server-side in gmailService

interface Props {
  orderNumber: number;
  orderName: string;
  customerName?: string;
  pdfUrls: {
    specsOrderForm: string | null;
    qbEstimate: string | null;
  };
  qbEstimateNumber: string | null;
  qbEstimateSkipped: boolean;  // True if QB estimate step was skipped
  onRecipientsChange?: (recipients: RecipientSelection) => void;
  onEmailContentChange?: (content: OrderEmailContent) => void;
}

export interface SendToCustomerPanelRef {
  getRecipients: () => RecipientSelection;
  getEmailContent: () => OrderEmailContent;
  hasValidRecipients: () => boolean;
}

export const SendToCustomerPanel = forwardRef<SendToCustomerPanelRef, Props>(({
  orderNumber,
  orderName,
  customerName,
  pdfUrls,
  qbEstimateNumber,
  qbEstimateSkipped,
  onRecipientsChange,
  onEmailContentChange
}, ref) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pointPersons, setPointPersons] = useState<PointPerson[]>([]);
  const [recipientTypes, setRecipientTypes] = useState<Map<string, RecipientType>>(new Map());
  const [emailContent, setEmailContent] = useState<OrderEmailContent>(DEFAULT_ORDER_EMAIL_CONTENT);

  // Load point persons on mount
  useEffect(() => {
    loadPointPersons();
  }, [orderNumber]);

  const loadPointPersons = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[SendToCustomerPanel] Loading point persons for order:', orderNumber);
      const response = await orderPreparationApi.getPointPersons(orderNumber);

      console.log('[SendToCustomerPanel] Raw API response:', response);

      const pointPersonsData = response.pointPersons || [];

      console.log('[SendToCustomerPanel] Point persons data:', pointPersonsData);
      console.log('[SendToCustomerPanel] Point persons count:', pointPersonsData.length);

      // Transform API response to component state
      const persons: PointPerson[] = pointPersonsData.map((pp: any) => ({
        id: pp.id,
        name: pp.contact_name,
        email: pp.contact_email
      }));

      setPointPersons(persons);

      // Default all point persons to "To"
      const defaultRecipientTypes = new Map<string, RecipientType>();
      persons.forEach(p => {
        if (p.email) {
          defaultRecipientTypes.set(p.email, 'to');
        }
      });
      setRecipientTypes(defaultRecipientTypes);

    } catch (err) {
      console.error('[SendToCustomerPanel] Error loading point persons:', err);
      setError('Failed to load point persons');
    } finally {
      setLoading(false);
    }
  };

  // Handle recipient type change
  const handleRecipientTypeChange = (email: string, type: RecipientType | null) => {
    const newTypes = new Map(recipientTypes);
    if (type === null) {
      newTypes.delete(email);
    } else {
      newTypes.set(email, type);
    }
    setRecipientTypes(newTypes);
  };

  // Select all as "To"
  const handleSelectAllTo = () => {
    const newTypes = new Map<string, RecipientType>();
    pointPersons.filter(p => p.email).forEach(p => {
      newTypes.set(p.email, 'to');
    });
    setRecipientTypes(newTypes);
  };

  // Clear all selections
  const handleClearAll = () => {
    setRecipientTypes(new Map());
  };

  // Handle email content change
  const handleEmailContentChange = (content: OrderEmailContent) => {
    setEmailContent(content);
  };

  // Compute recipients by type (company BCC is added server-side)
  const recipients = useMemo((): RecipientSelection => {
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

    return { to, cc, bcc };
  }, [recipientTypes]);

  // Notify parent when recipients change
  useEffect(() => {
    onRecipientsChange?.(recipients);
  }, [recipients, onRecipientsChange]);

  // Notify parent when email content changes
  useEffect(() => {
    onEmailContentChange?.(emailContent);
  }, [emailContent, onEmailContentChange]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getRecipients: () => recipients,
    getEmailContent: () => emailContent,
    hasValidRecipients: () => recipients.to.length > 0
  }));

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800">{error}</p>
        <button
          onClick={loadPointPersons}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Check which attachments are available
  const availableAttachments = {
    specsOrderForm: !!pdfUrls.specsOrderForm,
    qbEstimate: !!pdfUrls.qbEstimate,
    qbEstimateSkipped: qbEstimateSkipped
  };

  return (
    <div className="space-y-6">
      {/* Point Person Selector */}
      <PointPersonSelector
        pointPersons={pointPersons}
        recipientTypes={recipientTypes}
        onRecipientTypeChange={handleRecipientTypeChange}
        onSelectAllTo={handleSelectAllTo}
        onClearAll={handleClearAll}
      />

      {/* Email Content Editor */}
      <OrderEmailComposer
        initialContent={emailContent}
        availableAttachments={availableAttachments}
        onChange={handleEmailContentChange}
      />
    </div>
  );
});

export default SendToCustomerPanel;
