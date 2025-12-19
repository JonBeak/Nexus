/**
 * EstimateEmailComposer Component
 * Phase 4c - Email subject/body editor for estimates
 * Auto-fills from template with variable substitution
 */
import React, { useState, useEffect } from 'react';
import { Mail, Info } from 'lucide-react';
import { jobVersioningApi } from '../../services/jobVersioningApi';

interface EstimateEmailComposerProps {
  estimateId: number;
  customerName?: string;
  jobName?: string;
  estimateNumber?: string;
  total?: string;
  initialSubject?: string;
  initialBody?: string;
  onChange: (subject: string, body: string) => void;
  disabled?: boolean;
}

const EstimateEmailComposer: React.FC<EstimateEmailComposerProps> = ({
  estimateId,
  customerName = '',
  jobName = '',
  estimateNumber = '',
  total = '',
  initialSubject = '',
  initialBody = '',
  onChange,
  disabled = false
}) => {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  // Template variables for substitution
  const variables: Record<string, string> = {
    customerName,
    jobName,
    estimateNumber,
    total
  };

  // Substitute template variables
  const substituteVariables = (template: string): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] ?? match;
    });
  };

  // Load template on mount if no initial content
  useEffect(() => {
    const loadTemplate = async () => {
      if (initialSubject || initialBody) {
        // Already have content, don't load template
        setSubject(initialSubject);
        setBody(initialBody);
        return;
      }

      try {
        setLoadingTemplate(true);
        const response = await jobVersioningApi.getEstimateSendTemplate();
        if (response.success && response.data) {
          const templateSubject = substituteVariables(response.data.subject || '');
          const templateBody = substituteVariables(response.data.body || '');
          setSubject(templateSubject);
          setBody(templateBody);
          onChange(templateSubject, templateBody);
        }
      } catch (error) {
        console.error('Failed to load email template:', error);
      } finally {
        setLoadingTemplate(false);
      }
    };

    loadTemplate();
  }, [estimateId]); // Only reload when estimate changes

  // Update initial values if they change
  useEffect(() => {
    if (initialSubject) setSubject(initialSubject);
    if (initialBody) setBody(initialBody);
  }, [initialSubject, initialBody]);

  const handleSubjectChange = (value: string) => {
    setSubject(value);
    onChange(value, body);
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    onChange(subject, value);
  };

  // Re-apply template with current values
  const reloadTemplate = async () => {
    try {
      setLoadingTemplate(true);
      const response = await jobVersioningApi.getEstimateSendTemplate();
      if (response.success && response.data) {
        const templateSubject = substituteVariables(response.data.subject || '');
        const templateBody = substituteVariables(response.data.body || '');
        setSubject(templateSubject);
        setBody(templateBody);
        onChange(templateSubject, templateBody);
      }
    } catch (error) {
      console.error('Failed to reload template:', error);
    } finally {
      setLoadingTemplate(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Subject */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Email Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          disabled={disabled || loadingTemplate}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
          placeholder="Enter email subject..."
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Email Body
        </label>
        <textarea
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          disabled={disabled || loadingTemplate}
          rows={5}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 resize-none"
          placeholder="Enter email message..."
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
          {loadingTemplate ? 'Loading...' : 'Reset to Template'}
        </button>

        <button
          type="button"
          onClick={() => setShowVariables(!showVariables)}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
        >
          <Info className="w-3.5 h-3.5" />
          Variables
        </button>
      </div>

      {/* Variables Help */}
      {showVariables && (
        <div className="p-2 bg-gray-50 rounded text-xs text-gray-600">
          <div className="font-medium mb-1">Available variables:</div>
          <div className="grid grid-cols-2 gap-1">
            <span><code className="bg-gray-200 px-1 rounded">{'{{customerName}}'}</code></span>
            <span><code className="bg-gray-200 px-1 rounded">{'{{jobName}}'}</code></span>
            <span><code className="bg-gray-200 px-1 rounded">{'{{estimateNumber}}'}</code></span>
            <span><code className="bg-gray-200 px-1 rounded">{'{{total}}'}</code></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstimateEmailComposer;
