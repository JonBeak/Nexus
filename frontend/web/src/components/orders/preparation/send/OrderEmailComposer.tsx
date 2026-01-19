/**
 * Order Email Composer Component
 * 3-part email editor for order confirmation emails:
 * - Beginning text (editable)
 * - Action Required checkbox (toggleable)
 * - Attachments checkbox (toggleable, dynamic based on available PDFs)
 * - End text (editable)
 *
 * Matches the pattern from EstimateEmailComposer but simplified for orders.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Info, AlertTriangle, Paperclip } from 'lucide-react';
import { PAGE_STYLES } from '../../../../constants/moduleColors';

// Valid template variables for order confirmation emails
const VALID_VARIABLES = [
  'customerName',
  'orderNumber',
  'orderName'
];

// Default email content
export const DEFAULT_ORDER_SUBJECT = '[Requires Confirmation] {{orderName}} - #{{orderNumber}}';
export const DEFAULT_ORDER_BEGINNING = `Dear {{customerName}},

The details for your order
#{{orderNumber}} - {{orderName}}
have been prepared and are ready for your review and confirmation.`;
export const DEFAULT_ORDER_END = `If you have any questions or need changes, please reply to this email or contact us directly.

Thank you for your business!

Best regards,
The Sign House Team`;

// Individual attachment selection state
export interface AttachmentSelections {
  specsOrderForm: boolean;
  qbEstimate: boolean;
}

export interface OrderEmailContent {
  subject: string;
  beginning: string;
  includeActionRequired: boolean;
  attachments: AttachmentSelections;
  end: string;
}

export const DEFAULT_ORDER_EMAIL_CONTENT: OrderEmailContent = {
  subject: DEFAULT_ORDER_SUBJECT,
  beginning: DEFAULT_ORDER_BEGINNING,
  includeActionRequired: true,
  attachments: {
    specsOrderForm: true,
    qbEstimate: true
  },
  end: DEFAULT_ORDER_END
};

interface OrderEmailComposerProps {
  initialContent?: Partial<OrderEmailContent>;
  availableAttachments: {
    specsOrderForm: boolean;
    qbEstimate: boolean;
    qbEstimateSkipped: boolean;  // True if QB estimate step was skipped
  };
  onChange: (content: OrderEmailContent) => void;
  disabled?: boolean;
}

export const OrderEmailComposer: React.FC<OrderEmailComposerProps> = ({
  initialContent,
  availableAttachments,
  onChange,
  disabled = false
}) => {
  // Determine initial attachment selections based on what's available
  const getInitialAttachments = (): AttachmentSelections => {
    const base = initialContent?.attachments || DEFAULT_ORDER_EMAIL_CONTENT.attachments;

    // If QB estimate was skipped, don't include it
    if (availableAttachments.qbEstimateSkipped) {
      return {
        specsOrderForm: base.specsOrderForm && availableAttachments.specsOrderForm,
        qbEstimate: false  // Skipped, so don't include
      };
    }

    return {
      specsOrderForm: base.specsOrderForm && availableAttachments.specsOrderForm,
      qbEstimate: base.qbEstimate && availableAttachments.qbEstimate
    };
  };

  const [content, setContent] = useState<OrderEmailContent>(() => ({
    ...DEFAULT_ORDER_EMAIL_CONTENT,
    ...initialContent,
    attachments: getInitialAttachments()
  }));
  const [showVariables, setShowVariables] = useState(false);

  // Refs for auto-resizing textareas
  const beginningRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea helper
  const autoResize = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Auto-resize on content change
  useEffect(() => {
    autoResize(beginningRef.current);
  }, [content.beginning]);

  useEffect(() => {
    autoResize(endRef.current);
  }, [content.end]);

  // Notify parent of changes
  const handleChange = useCallback((updates: Partial<OrderEmailContent>) => {
    const newContent = { ...content, ...updates };
    setContent(newContent);
    onChange(newContent);
  }, [content, onChange]);

  // Reset to defaults
  const handleReset = () => {
    const defaultContent = { ...DEFAULT_ORDER_EMAIL_CONTENT };
    setContent(defaultContent);
    onChange(defaultContent);
  };

  // Count available and selected attachments
  const hasAnyAvailableAttachments = availableAttachments.specsOrderForm ||
                                     availableAttachments.qbEstimate;

  const selectedAttachmentCount = (content.attachments.specsOrderForm && availableAttachments.specsOrderForm ? 1 : 0) +
                                   (content.attachments.qbEstimate && availableAttachments.qbEstimate ? 1 : 0);

  // Helper to toggle individual attachment
  const handleAttachmentToggle = (key: keyof AttachmentSelections, checked: boolean) => {
    handleChange({
      attachments: {
        ...content.attachments,
        [key]: checked
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Subject */}
      <div>
        <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
          Email Subject
        </label>
        <input
          type="text"
          value={content.subject}
          onChange={(e) => handleChange({ subject: e.target.value })}
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm border ${PAGE_STYLES.input.border} rounded-lg ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50`}
          placeholder="Enter email subject..."
        />
      </div>

      {/* Beginning (Opening) */}
      <div>
        <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
          Opening Message
        </label>
        <textarea
          ref={beginningRef}
          value={content.beginning}
          onChange={(e) => handleChange({ beginning: e.target.value })}
          disabled={disabled}
          rows={4}
          className={`w-full px-3 py-2 text-sm border ${PAGE_STYLES.input.border} rounded-lg ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-none overflow-hidden`}
          placeholder="Enter opening message..."
          style={{ minHeight: '80px' }}
        />
      </div>

      {/* Action Required Section Toggle */}
      <div className={`border ${PAGE_STYLES.border} rounded-lg overflow-hidden`}>
        <label className={`flex items-center gap-3 px-4 py-3 ${PAGE_STYLES.header.background} cursor-pointer ${PAGE_STYLES.interactive.hoverOnHeader} transition-colors`}>
          <input
            type="checkbox"
            checked={content.includeActionRequired}
            onChange={(e) => handleChange({ includeActionRequired: e.target.checked })}
            disabled={disabled}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <div className="flex-1">
            <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
              Include "Action Required" Section
            </span>
          </div>
        </label>
        {content.includeActionRequired && (
          <div className="px-4 py-3 bg-red-50 border-t border-red-100">
            <div className="text-sm text-red-800">
              <strong>Action Required:</strong> Please review and confirm your order promptly so we can begin production.
            </div>
          </div>
        )}
      </div>

      {/* Attachments Section */}
      <div className={`border ${PAGE_STYLES.border} rounded-lg overflow-hidden`}>
        <div className={`flex items-center gap-3 px-4 py-3 ${PAGE_STYLES.header.background}`}>
          <Paperclip className="w-4 h-4 text-blue-600" />
          <div className="flex-1">
            <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
              Attached Documents
            </span>
            <span className={`ml-2 text-xs ${PAGE_STYLES.panel.textMuted}`}>
              ({selectedAttachmentCount} selected)
            </span>
          </div>
        </div>

        {/* Individual attachment checkboxes */}
        <div className="divide-y divide-blue-100">
          {/* Specs Order Form */}
          {availableAttachments.specsOrderForm && (
            <label className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors`}>
              <input
                type="checkbox"
                checked={content.attachments.specsOrderForm}
                onChange={(e) => handleAttachmentToggle('specsOrderForm', e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className={`text-sm text-blue-800`}>
                Specifications Order Form
              </span>
            </label>
          )}

          {/* QuickBooks Estimate - only show if available (not skipped) */}
          {availableAttachments.qbEstimate && !availableAttachments.qbEstimateSkipped && (
            <label className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors`}>
              <input
                type="checkbox"
                checked={content.attachments.qbEstimate}
                onChange={(e) => handleAttachmentToggle('qbEstimate', e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className={`text-sm text-blue-800`}>
                QuickBooks Estimate
              </span>
            </label>
          )}

          {/* No attachments available message */}
          {!hasAnyAvailableAttachments && (
            <div className="px-4 py-3 text-sm text-gray-500 italic bg-blue-50">
              No attachments available
            </div>
          )}
        </div>
      </div>

      {/* End (Closing) */}
      <div>
        <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
          Closing Message
        </label>
        <textarea
          ref={endRef}
          value={content.end}
          onChange={(e) => handleChange({ end: e.target.value })}
          disabled={disabled}
          rows={4}
          className={`w-full px-3 py-2 text-sm border ${PAGE_STYLES.input.border} rounded-lg ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-none overflow-hidden`}
          placeholder="Enter closing message..."
          style={{ minHeight: '80px' }}
        />
      </div>

      {/* Template Actions */}
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          <Mail className="w-3.5 h-3.5" />
          Reset to Default
        </button>

        <button
          type="button"
          onClick={() => setShowVariables(!showVariables)}
          className={`flex items-center gap-1.5 ${PAGE_STYLES.panel.textMuted} hover:text-gray-700`}
        >
          <Info className="w-3.5 h-3.5" />
          Variables
        </button>
      </div>

      {/* Variables Help */}
      {showVariables && (
        <div className={`p-3 ${PAGE_STYLES.header.background} rounded-lg text-xs ${PAGE_STYLES.panel.textMuted}`}>
          <div className="font-medium mb-2">Available variables:</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200">{'{{customerName}}'}</code>
              <span>Customer's name</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200">{'{{orderNumber}}'}</code>
              <span>Order number</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200">{'{{orderName}}'}</code>
              <span>Order name/title</span>
            </div>
          </div>
          <div className="mt-2 text-gray-500 italic">
            Variables are replaced with actual values when email is sent
          </div>
        </div>
      )}

      {/* Footer Note */}
      <div className={`text-xs ${PAGE_STYLES.panel.textMuted} italic`}>
        Company contact information will be added to the footer automatically.
      </div>
    </div>
  );
};

export default OrderEmailComposer;
