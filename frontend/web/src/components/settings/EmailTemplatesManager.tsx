/**
 * EmailTemplatesManager - Edit email templates with live preview
 * Allows customizing subject and body with variable placeholders
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Mail, Eye, Save, X, Code, ChevronRight } from 'lucide-react';
import { settingsApi, EmailTemplate } from '../../services/api/settings';
import { Notification } from '../inventory/Notification';

// =============================================================================
// Template Editor Component
// =============================================================================

interface TemplateEditorProps {
  template: EmailTemplate;
  onSave: (templateKey: string, subject: string, body: string) => Promise<boolean>;
  onClose: () => void;
  saving?: boolean;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSave, onClose, saving = false }) => {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setHasChanges(subject !== template.subject || body !== template.body);
  }, [subject, body, template]);

  const handlePreview = async () => {
    setLoadingPreview(true);
    try {
      const result = await settingsApi.previewEmailTemplate(template.template_key, { subject, body });
      setPreview(result);
      setShowPreview(true);
    } catch (err) {
      console.error('Preview failed:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSave = async () => {
    const success = await onSave(template.template_key, subject, body);
    if (success) onClose();
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = body.substring(0, start) + `{${variable}}` + body.substring(end);
      setBody(newBody);
      // Restore cursor position after variable
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length + 2;
        textarea.focus();
      }, 0);
    } else {
      setBody(body + `{${variable}}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50">
      <div className="flex items-start justify-center min-h-screen p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl my-8">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{template.template_name}</h3>
                <p className="text-sm text-gray-500">Key: {template.template_key}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex">
            {/* Editor Panel */}
            <div className="flex-1 p-6 border-r border-gray-200">
              {/* Subject */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={saving}
                />
              </div>

              {/* Body */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Body (HTML)</label>
                <textarea
                  id="template-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  rows={16}
                  disabled={saving}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button
                  onClick={handlePreview}
                  disabled={loadingPreview || saving}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {loadingPreview ? 'Loading...' : 'Preview'}
                </button>
                <div className="flex gap-3">
                  <button onClick={onClose} disabled={saving}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving || !hasChanges}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>

            {/* Variables Panel */}
            <div className="w-72 p-6 bg-gray-50">
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Available Variables
                </h4>
                <p className="text-xs text-gray-500 mt-1">Click to insert at cursor</p>
              </div>
              <div className="space-y-2">
                {template.variables.map(variable => (
                  <button
                    key={variable}
                    onClick={() => insertVariable(variable)}
                    className="w-full text-left px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm font-mono group"
                  >
                    <span className="text-blue-600">{`{${variable}}`}</span>
                    <ChevronRight className="w-4 h-4 float-right text-gray-400 group-hover:text-blue-500 mt-0.5" />
                  </button>
                ))}
              </div>
              {template.variables.length === 0 && (
                <p className="text-sm text-gray-500 italic">No variables available for this template</p>
              )}
            </div>
          </div>

          {/* Preview Modal */}
          {showPreview && preview && (
            <div className="absolute inset-0 bg-white rounded-xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Email Preview (with sample data)
                </h4>
                <button onClick={() => setShowPreview(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className="max-w-2xl mx-auto">
                  <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                    <span className="text-xs text-gray-500 uppercase">Subject:</span>
                    <p className="font-medium text-gray-900">{preview.subject}</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="p-1 bg-gray-100 border-b border-gray-200 text-xs text-gray-500">Email Body</div>
                    <div
                      className="p-6 bg-white"
                      dangerouslySetInnerHTML={{ __html: preview.body }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main EmailTemplatesManager Component
// =============================================================================

export const EmailTemplatesManager: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; show: boolean }>({
    message: '', type: 'success', show: false
  });

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type, show: true });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await settingsApi.getEmailTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load email templates:', err);
      setError('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleSaveTemplate = async (templateKey: string, subject: string, body: string): Promise<boolean> => {
    setSaving(true);
    try {
      await settingsApi.updateEmailTemplate(templateKey, { subject, body });
      setTemplates(prev => prev.map(t =>
        t.template_key === templateKey ? { ...t, subject, body } : t
      ));
      showNotification('Template saved successfully', 'success');
      return true;
    } catch {
      showNotification('Failed to save template', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Email Templates</h2>
              <p className="text-sm text-gray-500 mt-1">Customize automated email notifications</p>
            </div>
            <button onClick={loadTemplates} disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Template Cards */}
        <div className="p-6">
          {templates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No email templates configured.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(template => (
                <div
                  key={template.template_key}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => setEditingTemplate(template)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <Mail className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{template.template_name}</h3>
                        <p className="text-xs text-gray-500">{template.template_key}</p>
                      </div>
                    </div>
                    {!template.is_active && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Inactive</span>
                    )}
                  </div>
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 truncate">
                      <span className="font-medium">Subject:</span> {template.subject}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{template.variables.length} variable{template.variables.length !== 1 ? 's' : ''}</span>
                    <span className="text-blue-600 group-hover:underline">Edit template →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => setEditingTemplate(null)}
          saving={saving}
        />
      )}

      <Notification
        message={notification.message}
        type={notification.type}
        show={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default EmailTemplatesManager;
