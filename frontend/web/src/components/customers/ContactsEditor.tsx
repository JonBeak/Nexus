/**
 * ContactsEditor Component
 * Inline CRUD editor for customer contacts
 * Used in CustomerDetailsModal - always editable (independent of main edit mode)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { customerContactsApi } from '../../services/api';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';

interface Contact {
  contact_id: number;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  contact_role?: string;
}

interface EditingContact {
  contact_id?: number;  // undefined for new contacts
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_role: string;
}

interface ContactsEditorProps {
  customerId: number;
}

const ContactsEditor: React.FC<ContactsEditorProps> = ({ customerId }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<EditingContact>({
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    contact_role: ''
  });

  // Load contacts
  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await customerContactsApi.getContacts(customerId);
      setContacts(data || []);
    } catch (err) {
      console.error('Failed to load contacts:', err);
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Start editing existing contact
  const handleEdit = (contact: Contact) => {
    setEditingId(contact.contact_id);
    setEditForm({
      contact_id: contact.contact_id,
      contact_name: contact.contact_name || '',
      contact_email: contact.contact_email || '',
      contact_phone: contact.contact_phone || '',
      contact_role: contact.contact_role || ''
    });
    setError(null);
  };

  // Start adding new contact
  const handleAdd = () => {
    setEditingId('new');
    setEditForm({
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      contact_role: ''
    });
    setError(null);
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingId(null);
    setEditForm({
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      contact_role: ''
    });
    setError(null);
  };

  // Save contact (create or update)
  const handleSave = async () => {
    // Validation
    if (!editForm.contact_name.trim()) {
      setError('Name is required');
      return;
    }
    if (!editForm.contact_email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingId === 'new') {
        await customerContactsApi.createContact(customerId, {
          contact_name: editForm.contact_name.trim(),
          contact_email: editForm.contact_email.trim(),
          contact_phone: editForm.contact_phone.trim() || undefined,
          contact_role: editForm.contact_role.trim() || undefined
        });
      } else if (typeof editingId === 'number') {
        await customerContactsApi.updateContact(customerId, editingId, {
          contact_name: editForm.contact_name.trim(),
          contact_email: editForm.contact_email.trim(),
          contact_phone: editForm.contact_phone.trim() || undefined,
          contact_role: editForm.contact_role.trim() || undefined
        });
      }

      await loadContacts();
      handleCancel();
    } catch (err: any) {
      console.error('Failed to save contact:', err);
      setError(err.response?.data?.message || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  // Delete contact
  const handleDelete = async (contactId: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      setSaving(true);
      setError(null);
      await customerContactsApi.deleteContact(customerId, contactId);
      await loadContacts();
    } catch (err: any) {
      console.error('Failed to delete contact:', err);
      setError(err.response?.data?.message || 'Failed to delete contact');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `px-2 py-1.5 text-sm border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className={`w-5 h-5 animate-spin ${MODULE_COLORS.customers.text}`} />
        <span className={`ml-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>Loading contacts...</span>
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

      {/* Contacts List */}
      {contacts.length === 0 && editingId !== 'new' ? (
        <p className={`text-sm ${PAGE_STYLES.panel.textMuted} italic`}>No contacts added yet</p>
      ) : (
        <div className="space-y-1">
          {contacts.map((contact) => (
            <div key={contact.contact_id}>
              {editingId === contact.contact_id ? (
                // Editing Mode
                <div className="bg-blue-100 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editForm.contact_name}
                      onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                      placeholder="Name *"
                      className={inputClass}
                      disabled={saving}
                    />
                    <input
                      type="email"
                      value={editForm.contact_email}
                      onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                      placeholder="Email *"
                      className={inputClass}
                      disabled={saving}
                    />
                    <input
                      type="text"
                      value={editForm.contact_phone}
                      onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                      placeholder="Phone"
                      className={inputClass}
                      disabled={saving}
                    />
                    <input
                      type="text"
                      value={editForm.contact_role}
                      onChange={(e) => setEditForm({ ...editForm, contact_role: e.target.value })}
                      placeholder="Role"
                      className={inputClass}
                      disabled={saving}
                    />
                  </div>
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
                <div className={`flex items-center justify-between py-2 px-3 ${PAGE_STYLES.header.background} rounded-lg hover:bg-[var(--theme-hover-bg)]`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${PAGE_STYLES.panel.text}`}>{contact.contact_name}</span>
                      {contact.contact_role && (
                        <span className={`text-xs ${PAGE_STYLES.panel.textMuted} ${PAGE_STYLES.header.background} px-1.5 py-0.5 rounded`}>
                          {contact.contact_role}
                        </span>
                      )}
                    </div>
                    <div className={`text-sm ${PAGE_STYLES.panel.textSecondary} truncate`}>
                      {contact.contact_email}
                      {contact.contact_phone && ` | ${contact.contact_phone}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleEdit(contact)}
                      disabled={saving || editingId !== null}
                      className={`p-1.5 ${PAGE_STYLES.panel.textMuted} hover:${MODULE_COLORS.customers.text} hover:${MODULE_COLORS.customers.light} rounded disabled:opacity-50`}
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(contact.contact_id)}
                      disabled={saving || editingId !== null}
                      className={`p-1.5 ${PAGE_STYLES.panel.textMuted} hover:text-red-600 hover:bg-red-100 rounded disabled:opacity-50`}
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

      {/* New Contact Form */}
      {editingId === 'new' && (
        <div className="bg-green-100 rounded-lg p-3 space-y-2">
          <div className="text-sm font-medium text-green-800 mb-2">Add New Contact</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={editForm.contact_name}
              onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
              placeholder="Name *"
              className={inputClass}
              disabled={saving}
              autoFocus
            />
            <input
              type="email"
              value={editForm.contact_email}
              onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
              placeholder="Email *"
              className={inputClass}
              disabled={saving}
            />
            <input
              type="text"
              value={editForm.contact_phone}
              onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
              placeholder="Phone"
              className={inputClass}
              disabled={saving}
            />
            <input
              type="text"
              value={editForm.contact_role}
              onChange={(e) => setEditForm({ ...editForm, contact_role: e.target.value })}
              placeholder="Role"
              className={inputClass}
              disabled={saving}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Add Contact
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
          className={`flex items-center gap-1.5 text-sm ${MODULE_COLORS.customers.text} ${MODULE_COLORS.customers.hover.replace('hover:bg-', 'hover:text-')} disabled:opacity-50 mt-2`}
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      )}
    </div>
  );
};

export default ContactsEditor;
