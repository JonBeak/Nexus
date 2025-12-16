/**
 * AccountingEmailsEditor Component
 * Inline CRUD editor for customer accounting emails
 * Used in CustomerDetailsModal - always editable (independent of main edit mode)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, Loader2, Mail } from 'lucide-react';
import {
  customerAccountingEmailsApi,
  CustomerAccountingEmail,
  AccountingEmailType
} from '../../services/api/customerAccountingEmailsApi';

interface EditingEmail {
  id?: number;  // undefined for new emails
  email: string;
  email_type: AccountingEmailType;
  label: string;
}

interface AccountingEmailsEditorProps {
  customerId: number;
}

const EMAIL_TYPE_OPTIONS: { value: AccountingEmailType; label: string }[] = [
  { value: 'to', label: 'To' },
  { value: 'cc', label: 'CC' },
  { value: 'bcc', label: 'BCC' }
];

const EMAIL_TYPE_COLORS: Record<AccountingEmailType, string> = {
  to: 'bg-blue-100 text-blue-800',
  cc: 'bg-purple-100 text-purple-800',
  bcc: 'bg-gray-100 text-gray-800'
};

const AccountingEmailsEditor: React.FC<AccountingEmailsEditorProps> = ({ customerId }) => {
  const [emails, setEmails] = useState<CustomerAccountingEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<EditingEmail>({
    email: '',
    email_type: 'to',
    label: ''
  });

  // Load emails
  const loadEmails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await customerAccountingEmailsApi.getEmails(customerId);
      setEmails(data || []);
    } catch (err) {
      console.error('Failed to load accounting emails:', err);
      setError('Failed to load accounting emails');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Start editing existing email
  const handleEdit = (email: CustomerAccountingEmail) => {
    setEditingId(email.id);
    setEditForm({
      id: email.id,
      email: email.email || '',
      email_type: email.email_type || 'to',
      label: email.label || ''
    });
    setError(null);
  };

  // Start adding new email
  const handleAdd = () => {
    setEditingId('new');
    setEditForm({
      email: '',
      email_type: 'to',
      label: ''
    });
    setError(null);
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingId(null);
    setEditForm({
      email: '',
      email_type: 'to',
      label: ''
    });
    setError(null);
  };

  // Save email (create or update)
  const handleSave = async () => {
    // Validation
    if (!editForm.email.trim()) {
      setError('Email address is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingId === 'new') {
        await customerAccountingEmailsApi.createEmail(customerId, {
          email: editForm.email.trim(),
          email_type: editForm.email_type,
          label: editForm.label.trim() || undefined
        });
      } else if (typeof editingId === 'number') {
        await customerAccountingEmailsApi.updateEmail(customerId, editingId, {
          email: editForm.email.trim(),
          email_type: editForm.email_type,
          label: editForm.label.trim() || undefined
        });
      }

      await loadEmails();
      handleCancel();
    } catch (err: any) {
      console.error('Failed to save accounting email:', err);
      setError(err.response?.data?.message || 'Failed to save accounting email');
    } finally {
      setSaving(false);
    }
  };

  // Delete email
  const handleDelete = async (emailId: number) => {
    if (!confirm('Are you sure you want to delete this accounting email?')) return;

    try {
      setSaving(true);
      setError(null);
      await customerAccountingEmailsApi.deleteEmail(customerId, emailId);
      await loadEmails();
    } catch (err: any) {
      console.error('Failed to delete accounting email:', err);
      setError(err.response?.data?.message || 'Failed to delete accounting email');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading accounting emails...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Error Display */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Emails List */}
      {emails.length === 0 && editingId !== 'new' ? (
        <p className="text-sm text-gray-500 italic">No accounting emails added yet</p>
      ) : (
        <div className="space-y-1">
          {emails.map((email) => (
            <div key={email.id}>
              {editingId === email.id ? (
                // Editing Mode
                <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="Email address *"
                      className="col-span-2 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      disabled={saving}
                    />
                    <select
                      value={editForm.email_type}
                      onChange={(e) => setEditForm({ ...editForm, email_type: e.target.value as AccountingEmailType })}
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      disabled={saving}
                    >
                      {EMAIL_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={editForm.label}
                    onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                    placeholder="Label (e.g., AP Department, Billing Manager)"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    disabled={saving}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">{email.email}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded uppercase font-medium ${EMAIL_TYPE_COLORS[email.email_type]}`}>
                          {email.email_type}
                        </span>
                      </div>
                      {email.label && (
                        <div className="text-xs text-gray-500">{email.label}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleEdit(email)}
                      disabled={saving || editingId !== null}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(email.id)}
                      disabled={saving || editingId !== null}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Email Form */}
      {editingId === 'new' && (
        <div className="bg-green-50 rounded-lg p-3 space-y-2">
          <div className="text-sm font-medium text-green-800 mb-2">Add Accounting Email</div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              placeholder="Email address *"
              className="col-span-2 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500"
              disabled={saving}
              autoFocus
            />
            <select
              value={editForm.email_type}
              onChange={(e) => setEditForm({ ...editForm, email_type: e.target.value as AccountingEmailType })}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500"
              disabled={saving}
            >
              {EMAIL_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={editForm.label}
            onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
            placeholder="Label (e.g., AP Department, Billing Manager)"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500"
            disabled={saving}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Add Email
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Button (show when not editing) */}
      {editingId === null && (
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 mt-2"
        >
          <Plus className="w-4 h-4" />
          Add Accounting Email
        </button>
      )}
    </div>
  );
};

export default AccountingEmailsEditor;
