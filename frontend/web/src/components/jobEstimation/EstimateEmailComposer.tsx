/**
 * EstimateEmailComposer Component
 * 3-part email editor: Beginning + Estimate Summary + End
 * Summary section shows live preview of included fields
 *
 * IMPORTANT: Summary field order and labels MUST match backend definition:
 * See: backend/web/src/services/estimate/estimateEmailService.ts (SUMMARY_FIELDS constant)
 * Order: Job Name, Customer Ref #, QB Estimate #, Estimate Date, Valid Until, Subtotal, Tax, Total
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { jobVersioningApi } from '../../services/jobVersioningApi';
import { PAGE_STYLES } from '../../constants/moduleColors';
import {
  EmailSummaryConfig,
  DEFAULT_EMAIL_SUMMARY_CONFIG,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_EMAIL_BEGINNING,
  DEFAULT_EMAIL_END,
  EstimateEmailData
} from './types';
import { formatDate, formatCurrency, calculateValidUntilDate } from './utils/emailFormatUtils';

// Valid variable names that will be highlighted
const VALID_VARIABLES = [
  'customerName',
  'jobName',
  'customerJobNumber',
  'jobNameWithRef',
  'qbEstimateNumber',
  'estimateNumber',
  'total'
];

// Highlight valid {{variables}} in text - returns React elements
const highlightVariables = (text: string): React.ReactNode[] => {
  const regex = /(\{\{[^}]+\}\})/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    // Check if this part is a variable pattern
    const match = part.match(/^\{\{([^}]+)\}\}$/);
    if (match) {
      const varName = match[1];
      const isValid = VALID_VARIABLES.includes(varName);
      return (
        <span
          key={index}
          className={isValid ? 'text-blue-600 font-medium' : 'text-red-500'}
        >
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

// Highlighted input component with overlay
const HighlightedInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, disabled, placeholder, className }) => {
  return (
    <div className="relative">
      {/* Highlight layer (behind) */}
      <div
        className={`absolute inset-0 px-2 py-1.5 text-xs pointer-events-none whitespace-pre overflow-hidden ${className}`}
        style={{ color: 'transparent' }}
        aria-hidden="true"
      >
        <span className="invisible">{value || placeholder}</span>
      </div>
      {/* Visible highlight overlay */}
      <div
        className="absolute inset-0 px-2 py-1.5 text-xs pointer-events-none whitespace-pre overflow-hidden"
        aria-hidden="true"
      >
        {highlightVariables(value)}
      </div>
      {/* Actual input (transparent text, visible caret) */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-2 py-1.5 text-xs border ${PAGE_STYLES.input.border} focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60 bg-transparent ${className}`}
        style={{ color: 'transparent', caretColor: 'black' }}
        placeholder={placeholder}
      />
    </div>
  );
};

// Highlighted textarea component with overlay
const HighlightedTextarea: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  minHeight?: string;
}> = ({ value, onChange, disabled, placeholder, textareaRef, minHeight = '60px' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(minHeight);

  // Auto-resize
  useEffect(() => {
    if (textareaRef?.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.style.height = newHeight;
      setHeight(newHeight);
    }
  }, [value, textareaRef]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Visible highlight overlay */}
      <div
        className="absolute inset-0 px-2 py-1.5 text-xs pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
        style={{ minHeight }}
        aria-hidden="true"
      >
        {highlightVariables(value)}
      </div>
      {/* Actual textarea (transparent text, visible caret) */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={1}
        className={`w-full px-2 py-1.5 text-xs border ${PAGE_STYLES.input.border} focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60 resize-none overflow-hidden bg-transparent`}
        style={{ color: 'transparent', caretColor: 'black', minHeight }}
        placeholder={placeholder}
      />
    </div>
  );
};

interface EstimateEmailComposerProps {
  initialSubject?: string;
  initialBeginning?: string;
  initialEnd?: string;
  initialSummaryConfig?: EmailSummaryConfig;
  estimateData?: EstimateEmailData;
  onChange: (
    subject: string,
    beginning: string,
    end: string,
    summaryConfig: EmailSummaryConfig
  ) => void;
  disabled?: boolean;
}

// formatCurrency, formatDate, calculateValidUntilDate imported from ./utils/emailFormatUtils

const EstimateEmailComposer: React.FC<EstimateEmailComposerProps> = ({
  initialSubject = '',
  initialBeginning = '',
  initialEnd = '',
  initialSummaryConfig,
  estimateData,
  onChange,
  disabled = false
}) => {
  const [subject, setSubject] = useState(initialSubject);
  const [beginning, setBeginning] = useState(initialBeginning || DEFAULT_EMAIL_BEGINNING);
  const [end, setEnd] = useState(initialEnd || DEFAULT_EMAIL_END);
  const [summaryConfig, setSummaryConfig] = useState<EmailSummaryConfig>(
    initialSummaryConfig || DEFAULT_EMAIL_SUMMARY_CONFIG
  );
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

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
  }, [beginning]);

  useEffect(() => {
    autoResize(endRef.current);
  }, [end]);

  // Calculate if any summary fields are enabled
  const anySummaryEnabled = Object.values(summaryConfig).some(v => v);

  // Sync with initial values when they change
  useEffect(() => {
    setSubject(initialSubject);
  }, [initialSubject]);

  useEffect(() => {
    setBeginning(initialBeginning || DEFAULT_EMAIL_BEGINNING);
  }, [initialBeginning]);

  useEffect(() => {
    setEnd(initialEnd || DEFAULT_EMAIL_END);
  }, [initialEnd]);

  useEffect(() => {
    if (initialSummaryConfig) {
      setSummaryConfig(initialSummaryConfig);
    }
  }, [initialSummaryConfig]);

  // Notify parent of changes
  const notifyChange = useCallback((
    newSubject: string,
    newBeginning: string,
    newEnd: string,
    newConfig: EmailSummaryConfig
  ) => {
    onChange(newSubject, newBeginning, newEnd, newConfig);
  }, [onChange]);

  const handleSubjectChange = (value: string) => {
    setSubject(value);
    notifyChange(value, beginning, end, summaryConfig);
  };

  const handleBeginningChange = (value: string) => {
    setBeginning(value);
    notifyChange(subject, value, end, summaryConfig);
  };

  const handleEndChange = (value: string) => {
    setEnd(value);
    notifyChange(subject, beginning, value, summaryConfig);
  };

  const handleConfigChange = (key: keyof EmailSummaryConfig, value: boolean) => {
    const newConfig = { ...summaryConfig, [key]: value };
    setSummaryConfig(newConfig);
    notifyChange(subject, beginning, end, newConfig);
  };

  const handleToggleAllSummary = (enabled: boolean) => {
    const newConfig: EmailSummaryConfig = {
      includeJobName: enabled,
      includeCustomerRef: enabled,
      includeQbEstimateNumber: enabled,
      includeSubtotal: enabled,
      includeTax: enabled,
      includeTotal: enabled,
      includeEstimateDate: enabled,
      includeValidUntilDate: enabled
    };
    setSummaryConfig(newConfig);
    notifyChange(subject, beginning, end, newConfig);
  };

  // Reset to default template
  const reloadTemplate = async () => {
    try {
      setLoadingTemplate(true);
      const response = await jobVersioningApi.getEstimateSendTemplate();

      // Get values from database template, with frontend defaults as fallback
      const templateSubject = (response.success && response.data?.subject) || DEFAULT_EMAIL_SUBJECT;
      const templateBeginning = (response.success && response.data?.body_beginning) || DEFAULT_EMAIL_BEGINNING;
      const templateEnd = (response.success && response.data?.body_end) || DEFAULT_EMAIL_END;

      // Build smart summary config - only include Customer Ref if job has one
      const smartConfig: EmailSummaryConfig = {
        ...DEFAULT_EMAIL_SUMMARY_CONFIG,
        includeCustomerRef: !!estimateData?.customerJobNumber
      };

      // Reset to database values (with smart Customer Ref handling)
      setSubject(templateSubject);
      setBeginning(templateBeginning);
      setEnd(templateEnd);
      setSummaryConfig(smartConfig);
      notifyChange(templateSubject, templateBeginning, templateEnd, smartConfig);
    } catch (error) {
      console.error('Failed to reload template:', error);
      // Build smart summary config even on error
      const smartConfig: EmailSummaryConfig = {
        ...DEFAULT_EMAIL_SUMMARY_CONFIG,
        includeCustomerRef: !!estimateData?.customerJobNumber
      };
      // On error, fall back to frontend defaults
      setSubject(DEFAULT_EMAIL_SUBJECT);
      setBeginning(DEFAULT_EMAIL_BEGINNING);
      setEnd(DEFAULT_EMAIL_END);
      setSummaryConfig(smartConfig);
      notifyChange(DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BEGINNING, DEFAULT_EMAIL_END, smartConfig);
    } finally {
      setLoadingTemplate(false);
    }
  };

  // Calculate valid until date (30 days from estimate date)
  const validUntilDate = calculateValidUntilDate(estimateData?.estimateDate);

  return (
    <div className="space-y-3">
      {/* Subject */}
      <div>
        <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
          Email Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          disabled={disabled || loadingTemplate}
          className={`w-full px-2 py-1.5 text-xs ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder} focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50`}
          placeholder="Enter email subject..."
        />
      </div>

      {/* Beginning (Greeting) */}
      <div>
        <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
          Opening Message
        </label>
        <textarea
          ref={beginningRef}
          value={beginning}
          onChange={(e) => handleBeginningChange(e.target.value)}
          disabled={disabled || loadingTemplate}
          rows={1}
          className={`w-full px-2 py-1.5 text-xs ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder} focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 resize-none overflow-hidden`}
          placeholder="Enter opening message..."
          style={{ minHeight: '60px' }}
        />
      </div>

      {/* Estimate Summary Section */}
      <div className={`border ${PAGE_STYLES.border} rounded-lg overflow-hidden`}>
        {/* Summary Header */}
        <div
          className={`flex items-center justify-between px-3 py-2 ${PAGE_STYLES.header.background} cursor-pointer ${PAGE_STYLES.interactive.hoverOnHeader}`}
          onClick={() => setSummaryExpanded(!summaryExpanded)}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={anySummaryEnabled}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleAllSummary(e.target.checked);
              }}
              disabled={disabled}
              className={`rounded ${PAGE_STYLES.input.border} text-indigo-600 focus:ring-indigo-500`}
            />
            <span className={`text-xs font-medium ${PAGE_STYLES.panel.textSecondary}`}>Include Estimate Summary</span>
          </div>
          {summaryExpanded ? (
            <ChevronUp className={`w-4 h-4 ${PAGE_STYLES.panel.text}`} />
          ) : (
            <ChevronDown className={`w-4 h-4 ${PAGE_STYLES.panel.text}`} />
          )}
        </div>

        {/* Summary Content */}
        {summaryExpanded && (
          <div className={`p-3 border-t ${PAGE_STYLES.border}`}>
            <div className="flex gap-4">
              {/* Checkboxes - Left Side (Single Column) */}
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeJobName}
                    onChange={(e) => handleConfigChange('includeJobName', e.target.checked)}
                    disabled={disabled}
                    className={`rounded ${PAGE_STYLES.input.border} text-indigo-600 focus:ring-indigo-500`}
                  />
                  <span>Job Name</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeCustomerRef}
                    onChange={(e) => handleConfigChange('includeCustomerRef', e.target.checked)}
                    disabled={disabled}
                    className={`rounded ${PAGE_STYLES.input.border} text-indigo-600 focus:ring-indigo-500`}
                  />
                  <span>Customer Ref #</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeQbEstimateNumber}
                    onChange={(e) => handleConfigChange('includeQbEstimateNumber', e.target.checked)}
                    disabled={disabled}
                    className={`rounded ${PAGE_STYLES.input.border} text-indigo-600 focus:ring-indigo-500`}
                  />
                  <span>QB Estimate #</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeEstimateDate}
                    onChange={(e) => handleConfigChange('includeEstimateDate', e.target.checked)}
                    disabled={disabled}
                    className={`rounded ${PAGE_STYLES.input.border} text-indigo-600 focus:ring-indigo-500`}
                  />
                  <span>Estimate Date</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeValidUntilDate}
                    onChange={(e) => handleConfigChange('includeValidUntilDate', e.target.checked)}
                    disabled={disabled}
                    className={`rounded ${PAGE_STYLES.input.border} text-indigo-600 focus:ring-indigo-500`}
                  />
                  <span>Valid Until</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeSubtotal}
                    onChange={(e) => handleConfigChange('includeSubtotal', e.target.checked)}
                    disabled={disabled}
                    className={`rounded ${PAGE_STYLES.input.border} text-indigo-600 focus:ring-indigo-500`}
                  />
                  <span>Subtotal</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeTax}
                    onChange={(e) => handleConfigChange('includeTax', e.target.checked)}
                    disabled={disabled}
                    className={`rounded ${PAGE_STYLES.input.border} text-indigo-600 focus:ring-indigo-500`}
                  />
                  <span>Tax</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeTotal}
                    onChange={(e) => handleConfigChange('includeTotal', e.target.checked)}
                    disabled={disabled}
                    className={`rounded ${PAGE_STYLES.input.border} text-indigo-600 focus:ring-indigo-500`}
                  />
                  <span>Total</span>
                </label>
              </div>

              {/* Live Preview - Right Side */}
              {anySummaryEnabled && estimateData && (
                <div className={`w-64 ml-auto p-2 ${PAGE_STYLES.input.background} rounded ${PAGE_STYLES.panel.border} text-xs`}>
                  <div className={`${PAGE_STYLES.panel.textMuted} mb-1.5 font-medium`}>Preview</div>
                  <div className="space-y-0.5">
                    {summaryConfig.includeJobName && (
                      <div className="flex justify-between">
                        <span className={PAGE_STYLES.panel.textMuted}>Job Name:</span>
                        <span className="font-medium">{estimateData.jobName || '-'}</span>
                      </div>
                    )}
                    {summaryConfig.includeCustomerRef && (
                      <div className="flex justify-between">
                        <span className={PAGE_STYLES.panel.textMuted}>Customer Ref #:</span>
                        <span className="font-medium">{estimateData.customerJobNumber || '-'}</span>
                      </div>
                    )}
                    {summaryConfig.includeQbEstimateNumber && estimateData.qbEstimateNumber && (
                      <div className="flex justify-between">
                        <span className={PAGE_STYLES.panel.textMuted}>QB Estimate #:</span>
                        <span className="font-medium">{estimateData.qbEstimateNumber}</span>
                      </div>
                    )}
                    {summaryConfig.includeEstimateDate && (
                      <div className="flex justify-between">
                        <span className={PAGE_STYLES.panel.textMuted}>Estimate Date:</span>
                        <span className="font-medium">{formatDate(estimateData.estimateDate)}</span>
                      </div>
                    )}
                    {summaryConfig.includeValidUntilDate && (
                      <div className="flex justify-between">
                        <span className={PAGE_STYLES.panel.textMuted}>Valid Until:</span>
                        <span className="font-medium">{validUntilDate}</span>
                      </div>
                    )}
                    {summaryConfig.includeSubtotal && (
                      <div className="flex justify-between">
                        <span className={PAGE_STYLES.panel.textMuted}>Subtotal:</span>
                        <span className="font-medium">{formatCurrency(estimateData.subtotal)}</span>
                      </div>
                    )}
                    {summaryConfig.includeTax && (
                      <div className="flex justify-between">
                        <span className={PAGE_STYLES.panel.textMuted}>Tax:</span>
                        <span className="font-medium">{formatCurrency(estimateData.tax)}</span>
                      </div>
                    )}
                    {summaryConfig.includeTotal && (
                      <div className={`flex justify-between border-t ${PAGE_STYLES.border} pt-1 mt-1`}>
                        <span className={`${PAGE_STYLES.panel.textSecondary} font-medium`}>Total:</span>
                        <span className={`font-bold ${PAGE_STYLES.panel.text}`}>{formatCurrency(estimateData.total)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* End (Closing) */}
      <div>
        <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
          Closing Message
        </label>
        <textarea
          ref={endRef}
          value={end}
          onChange={(e) => handleEndChange(e.target.value)}
          disabled={disabled || loadingTemplate}
          rows={1}
          className={`w-full px-2 py-1.5 text-xs ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder} focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 resize-none overflow-hidden`}
          placeholder="Enter closing message..."
          style={{ minHeight: '60px' }}
        />
      </div>

      {/* Template Actions */}
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={reloadTemplate}
          disabled={disabled || loadingTemplate}
          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        >
          <Mail className="w-3.5 h-3.5" />
          {loadingTemplate ? 'Loading...' : 'Reset to Default'}
        </button>

        <button
          type="button"
          onClick={() => setShowVariables(!showVariables)}
          className={`flex items-center gap-1 ${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.textSecondary}`}
        >
          <Info className="w-3.5 h-3.5" />
          Variables
        </button>
      </div>

      {/* Variables Help */}
      {showVariables && (
        <div className={`p-2 ${PAGE_STYLES.header.background} rounded text-xs ${PAGE_STYLES.panel.textMuted}`}>
          <div className="font-medium mb-1">Available variables (for subject line):</div>
          <div className="grid grid-cols-2 gap-1">
            <span><code className={`${PAGE_STYLES.input.background} px-1 rounded`}>{'{{customerName}}'}</code></span>
            <span><code className={`${PAGE_STYLES.input.background} px-1 rounded`}>{'{{jobName}}'}</code></span>
            <span><code className={`${PAGE_STYLES.input.background} px-1 rounded`}>{'{{customerJobNumber}}'}</code></span>
            <span><code className={`${PAGE_STYLES.input.background} px-1 rounded`}>{'{{jobNameWithRef}}'}</code></span>
            <span><code className={`${PAGE_STYLES.input.background} px-1 rounded`}>{'{{qbEstimateNumber}}'}</code></span>
            <span><code className={`${PAGE_STYLES.input.background} px-1 rounded`}>{'{{estimateNumber}}'}</code></span>
            <span><code className={`${PAGE_STYLES.input.background} px-1 rounded`}>{'{{total}}'}</code></span>
          </div>
          <div className={`mt-1 ${PAGE_STYLES.panel.textMuted} italic`}>
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

export default EstimateEmailComposer;
