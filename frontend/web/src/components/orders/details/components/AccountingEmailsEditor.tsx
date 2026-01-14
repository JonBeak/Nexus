/**
 * AccountingEmailsEditor Component
 * Manages accounting email selection and creation for orders
 * Compact linear layout based on PointPersonsEditor pattern
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { customerAccountingEmailsApi, CustomerAccountingEmail } from '../../../../services/api';

interface AccountingEmailEntry {
  id: string;
  mode: 'existing' | 'custom';
  email_id?: number;  // ID from customer_accounting_emails if selecting existing
  email: string;
  email_type: 'to' | 'cc' | 'bcc';
  label?: string;
  saveToDatabase?: boolean;
}

interface OrderAccountingEmail {
  email: string;
  email_type: 'to' | 'cc' | 'bcc';
  label?: string;
}

interface AccountingEmailsEditorProps {
  customerId: number;
  orderId: number;
  initialAccountingEmails: OrderAccountingEmail[];
  onSave: (accountingEmails: AccountingEmailEntry[]) => Promise<void>;
  disabled?: boolean;
}

const AccountingEmailsEditor: React.FC<AccountingEmailsEditorProps> = ({
  customerId,
  orderId,
  initialAccountingEmails,
  onSave,
  disabled = false
}) => {
  const [accountingEmails, setAccountingEmails] = useState<AccountingEmailEntry[]>([]);
  const [allCustomerEmails, setAllCustomerEmails] = useState<CustomerAccountingEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load customer accounting emails (reusable)
  const loadCustomerEmails = useCallback(async () => {
    try {
      setLoading(true);
      const emails = await customerAccountingEmailsApi.getEmails(customerId);
      setAllCustomerEmails(emails || []);
      return emails || [];
    } catch (error) {
      console.error('Failed to load customer accounting emails:', error);
      setAllCustomerEmails([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Load customer emails on mount
  useEffect(() => {
    loadCustomerEmails();
  }, [loadCustomerEmails]);

  // Initialize accounting emails from props - match against customer emails to preserve "existing" mode
  useEffect(() => {
    if (initialAccountingEmails && initialAccountingEmails.length > 0 && !loading) {
      setAccountingEmails(
        initialAccountingEmails.map((ae, idx) => {
          // Try to find matching customer email by email address
          const matchedCustomerEmail = allCustomerEmails.find(
            ce => ce.email.toLowerCase() === ae.email.toLowerCase()
          );

          if (matchedCustomerEmail) {
            // Match found - set as existing
            return {
              id: `existing-${idx}`,
              mode: 'existing' as const,
              email_id: matchedCustomerEmail.id,
              email: matchedCustomerEmail.email,
              email_type: matchedCustomerEmail.email_type,
              label: matchedCustomerEmail.label
            };
          } else {
            // No match - treat as custom
            return {
              id: `existing-${idx}`,
              mode: 'custom' as const,
              email: ae.email,
              email_type: ae.email_type,
              label: ae.label
            };
          }
        })
      );
    }
  }, [initialAccountingEmails, allCustomerEmails, loading]);

  // Get emails already selected (to filter dropdown)
  const selectedEmails = accountingEmails.map(e => e.email.toLowerCase());

  // Get available customer emails (not already selected)
  const getAvailableEmails = (currentEntryId: string) => {
    const currentEntry = accountingEmails.find(e => e.id === currentEntryId);
    return allCustomerEmails.filter(ce =>
      !selectedEmails.includes(ce.email.toLowerCase()) ||
      ce.email.toLowerCase() === currentEntry?.email.toLowerCase()
    );
  };

  // Check if there are any available customer emails for a new entry
  const hasAvailableEmails = () => {
    return allCustomerEmails.some(ce => !selectedEmails.includes(ce.email.toLowerCase()));
  };

  const handleAddAccountingEmail = () => {
    const defaultMode = hasAvailableEmails() ? 'existing' : 'custom';
    const newEntry: AccountingEmailEntry = {
      id: `new-${Date.now()}`,
      mode: defaultMode,
      email: '',
      email_type: 'to',
      saveToDatabase: defaultMode === 'custom' ? true : undefined
    };
    setAccountingEmails([...accountingEmails, newEntry]);
    setHasChanges(true);
  };

  const handleModeChange = (id: string, mode: 'existing' | 'custom') => {
    setAccountingEmails(accountingEmails.map(entry => {
      if (entry.id === id) {
        return {
          ...entry,
          mode,
          email_id: undefined,
          email: '',
          email_type: 'to' as const,
          label: undefined,
          saveToDatabase: mode === 'custom' ? true : undefined
        };
      }
      return entry;
    }));
    setHasChanges(true);
  };

  const handleExistingEmailChange = (id: string, emailId: number | null) => {
    // If deselecting (empty option), clear the fields
    if (!emailId) {
      setAccountingEmails(accountingEmails.map(entry => {
        if (entry.id === id) {
          return {
            ...entry,
            email_id: undefined,
            email: '',
            email_type: 'to' as const,
            label: undefined
          };
        }
        return entry;
      }));
      setHasChanges(true);
      return;
    }

    const selectedEmail = allCustomerEmails.find(ce => ce.id === emailId);
    if (!selectedEmail) return;

    setAccountingEmails(accountingEmails.map(entry => {
      if (entry.id === id) {
        return {
          ...entry,
          email_id: selectedEmail.id,
          email: selectedEmail.email,
          email_type: selectedEmail.email_type,
          label: selectedEmail.label
        };
      }
      return entry;
    }));
    setHasChanges(true);
  };

  const handleCustomFieldChange = (id: string, field: keyof AccountingEmailEntry, value: any) => {
    setAccountingEmails(accountingEmails.map(entry => {
      if (entry.id === id) {
        return { ...entry, [field]: value };
      }
      return entry;
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Filter out empty rows (no email)
      const validEmails = accountingEmails.filter(e => e.email?.trim());

      const hasSaveToDatabase = validEmails.some(e => e.saveToDatabase && !e.email_id);
      await onSave(validEmails);

      // Update local state to remove empty rows
      setAccountingEmails(validEmails);
      setHasChanges(false);

      if (hasSaveToDatabase) {
        await loadCustomerEmails();
      }
    } catch (error) {
      console.error('Failed to save accounting emails:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    // Re-initialize from initialAccountingEmails, matching against customer emails
    if (initialAccountingEmails && initialAccountingEmails.length > 0) {
      setAccountingEmails(
        initialAccountingEmails.map((ae, idx) => {
          const matchedCustomerEmail = allCustomerEmails.find(
            ce => ce.email.toLowerCase() === ae.email.toLowerCase()
          );

          if (matchedCustomerEmail) {
            return {
              id: `existing-${idx}`,
              mode: 'existing' as const,
              email_id: matchedCustomerEmail.id,
              email: matchedCustomerEmail.email,
              email_type: matchedCustomerEmail.email_type,
              label: matchedCustomerEmail.label
            };
          } else {
            return {
              id: `existing-${idx}`,
              mode: 'custom' as const,
              email: ae.email,
              email_type: ae.email_type,
              label: ae.label
            };
          }
        })
      );
    } else {
      setAccountingEmails([]);
    }
    setHasChanges(false);
  };

  const emailTypeLabel = (type: 'to' | 'cc' | 'bcc') => {
    return type.toUpperCase();
  };

  return (
    <div className="space-y-1.5">
      {/* Accounting Email List */}
      {accountingEmails.map((entry) => {
        const availableEmails = getAvailableEmails(entry.id);
        const canUseExisting = availableEmails.length > 0 || entry.mode === 'existing';

        return (
          <div key={entry.id} className="flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0">
            {/* Left: Mode Toggle (stacked) */}
            <div className="flex flex-col items-start gap-0 ml-1" style={{ minWidth: '50px' }}>
              {canUseExisting && (
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name={`mode-${entry.id}`}
                    checked={entry.mode === 'existing'}
                    onChange={() => handleModeChange(entry.id, 'existing')}
                    disabled={disabled || saving}
                    className="w-3 h-3 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <span className="text-[10px] text-gray-600">Existing</span>
                </label>
              )}
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name={`mode-${entry.id}`}
                  checked={entry.mode === 'custom'}
                  onChange={() => handleModeChange(entry.id, 'custom')}
                  disabled={disabled || saving}
                  className="w-3 h-3 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className="text-[10px] text-gray-600">New</span>
              </label>
            </div>

            {/* Middle: Content */}
            <div className="min-w-0 flex-1" style={{ marginLeft: '12px' }}>
              {/* Existing Email Mode */}
              {entry.mode === 'existing' && (
                <select
                  value={entry.email_id || ''}
                  onChange={(e) => handleExistingEmailChange(entry.id, e.target.value ? parseInt(e.target.value) : null)}
                  disabled={disabled || saving}
                  className="w-full px-2 py-1 text-sm font-medium border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">Select email...</option>
                  {availableEmails.map(ce => (
                    <option key={ce.id} value={ce.id}>
                      {ce.label && `${ce.label}: `}{ce.email} ({emailTypeLabel(ce.email_type)})
                    </option>
                  ))}
                </select>
              )}

              {/* Custom Email Mode */}
              {entry.mode === 'custom' && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    <input
                      type="email"
                      value={entry.email}
                      onChange={(e) => handleCustomFieldChange(entry.id, 'email', e.target.value)}
                      disabled={disabled || saving}
                      className="flex-1 px-2 py-1 text-sm font-medium border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                      placeholder="Email *"
                    />
                    <select
                      value={entry.email_type}
                      onChange={(e) => handleCustomFieldChange(entry.id, 'email_type', e.target.value)}
                      disabled={disabled || saving}
                      className="w-16 px-1 py-1 text-sm font-medium border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                    >
                      <option value="to">TO</option>
                      <option value="cc">CC</option>
                      <option value="bcc">BCC</option>
                    </select>
                    <input
                      type="text"
                      value={entry.label || ''}
                      onChange={(e) => handleCustomFieldChange(entry.id, 'label', e.target.value)}
                      disabled={disabled || saving}
                      className="w-24 px-2 py-1 text-sm font-medium border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                      placeholder="Label"
                    />
                  </div>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.saveToDatabase || false}
                      onChange={(e) => handleCustomFieldChange(entry.id, 'saveToDatabase', e.target.checked)}
                      disabled={disabled || saving}
                      className="w-3 h-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <span className="text-[10px] text-gray-500">Save to customer</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {accountingEmails.length === 0 && (
        <div className="text-xs text-gray-400 italic py-1">No accounting emails configured</div>
      )}

      {/* Add Button */}
      <button
        type="button"
        onClick={handleAddAccountingEmail}
        disabled={disabled || saving}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50 pt-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Accounting Email
      </button>

      {/* Save/Revert Buttons (only show if changes) */}
      {hasChanges && (
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={handleRevert}
            disabled={disabled || saving}
            className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 disabled:opacity-50"
          >
            Revert
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || saving}
            className="flex-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountingEmailsEditor;
