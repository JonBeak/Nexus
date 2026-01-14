/**
 * PointPersonsEditor Component
 * Manages point person selection and creation for orders
 * Compact linear layout based on ApproveEstimateModal pattern
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { customerContactsApi } from '../../../../services/api';

interface PointPersonEntry {
  id: string;
  mode: 'existing' | 'custom';
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  saveToDatabase?: boolean;
}

interface Contact {
  contact_id: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
}

interface OrderPointPerson {
  id: number;
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
}

interface PointPersonsEditorProps {
  customerId: number;
  orderId: number;
  initialPointPersons: OrderPointPerson[];
  onSave: (pointPersons: PointPersonEntry[]) => Promise<void>;
  disabled?: boolean;
}

const PointPersonsEditor: React.FC<PointPersonsEditorProps> = ({
  customerId,
  orderId,
  initialPointPersons,
  onSave,
  disabled = false
}) => {
  const [pointPersons, setPointPersons] = useState<PointPersonEntry[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load contacts function (reusable)
  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const contacts = await customerContactsApi.getContacts(customerId);
      setAllContacts(contacts || []);
      return contacts || [];
    } catch (error) {
      console.error('Failed to load contacts:', error);
      setAllContacts([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Load contacts on mount
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Initialize point persons from props
  useEffect(() => {
    if (initialPointPersons && initialPointPersons.length > 0) {
      setPointPersons(
        initialPointPersons.map(pp => ({
          id: `existing-${pp.id}`,
          mode: pp.contact_id ? 'existing' as const : 'custom' as const,
          contact_id: pp.contact_id,
          contact_email: pp.contact_email,
          contact_name: pp.contact_name,
          contact_phone: pp.contact_phone,
          contact_role: pp.contact_role
        }))
      );
    }
  }, [initialPointPersons]);

  // Get IDs of contacts already selected as point persons
  const selectedContactIds = pointPersons
    .filter(p => p.contact_id)
    .map(p => p.contact_id);

  // Get available contacts (not already selected)
  const getAvailableContacts = (currentPersonId: string) => {
    const currentPerson = pointPersons.find(p => p.id === currentPersonId);
    return allContacts.filter(c =>
      !selectedContactIds.includes(c.contact_id) ||
      c.contact_id === currentPerson?.contact_id
    );
  };

  // Check if there are any available contacts for a new entry
  const hasAvailableContacts = () => {
    return allContacts.some(c => !selectedContactIds.includes(c.contact_id));
  };

  const handleAddPointPerson = () => {
    const defaultMode = hasAvailableContacts() ? 'existing' : 'custom';
    const newEntry: PointPersonEntry = {
      id: `new-${Date.now()}`,
      mode: defaultMode,
      contact_email: '',
      saveToDatabase: defaultMode === 'custom' ? true : undefined
    };
    setPointPersons([...pointPersons, newEntry]);
    setHasChanges(true);
  };

  const handleRemovePointPerson = (id: string) => {
    setPointPersons(pointPersons.filter(p => p.id !== id));
    setHasChanges(true);
  };

  const handleModeChange = (id: string, mode: 'existing' | 'custom') => {
    setPointPersons(pointPersons.map(person => {
      if (person.id === id) {
        return {
          ...person,
          mode,
          contact_id: undefined,
          contact_email: '',
          contact_name: undefined,
          contact_phone: undefined,
          contact_role: undefined,
          saveToDatabase: mode === 'custom' ? true : undefined
        };
      }
      return person;
    }));
    setHasChanges(true);
  };

  const handleExistingContactChange = (id: string, contactId: number | null) => {
    // If deselecting (empty option), clear the contact fields
    if (!contactId) {
      setPointPersons(pointPersons.map(person => {
        if (person.id === id) {
          return {
            ...person,
            contact_id: undefined,
            contact_email: '',
            contact_name: undefined,
            contact_phone: undefined,
            contact_role: undefined
          };
        }
        return person;
      }));
      setHasChanges(true);
      return;
    }

    const selectedContact = allContacts.find(c => c.contact_id === contactId);
    if (!selectedContact) return;

    setPointPersons(pointPersons.map(person => {
      if (person.id === id) {
        return {
          ...person,
          contact_id: selectedContact.contact_id,
          contact_email: selectedContact.contact_email,
          contact_name: selectedContact.contact_name,
          contact_phone: selectedContact.contact_phone,
          contact_role: selectedContact.contact_role
        };
      }
      return person;
    }));
    setHasChanges(true);
  };

  const handleCustomFieldChange = (id: string, field: keyof PointPersonEntry, value: any) => {
    setPointPersons(pointPersons.map(person => {
      if (person.id === id) {
        return { ...person, [field]: value };
      }
      return person;
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Filter out empty rows (no contact selected for existing, no email for custom)
      const validPointPersons = pointPersons.filter(p => {
        if (p.mode === 'existing') {
          return p.contact_id != null;
        } else {
          return p.contact_email?.trim();
        }
      });

      const hasSaveToDatabase = validPointPersons.some(p => p.saveToDatabase && !p.contact_id);
      await onSave(validPointPersons);

      // Update local state to remove empty rows
      setPointPersons(validPointPersons);
      setHasChanges(false);

      if (hasSaveToDatabase) {
        await loadContacts();
      }
    } catch (error) {
      console.error('Failed to save point persons:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    // Re-initialize from initialPointPersons
    if (initialPointPersons && initialPointPersons.length > 0) {
      setPointPersons(
        initialPointPersons.map(pp => ({
          id: `existing-${pp.id}`,
          mode: pp.contact_id ? 'existing' as const : 'custom' as const,
          contact_id: pp.contact_id,
          contact_email: pp.contact_email,
          contact_name: pp.contact_name,
          contact_phone: pp.contact_phone,
          contact_role: pp.contact_role
        }))
      );
    } else {
      setPointPersons([]);
    }
    setHasChanges(false);
  };

  return (
    <div className="space-y-1.5">
      {/* Point Person List */}
      {pointPersons.map((person, index) => {
        const availableContacts = getAvailableContacts(person.id);
        const canUseExisting = availableContacts.length > 0 || person.mode === 'existing';

        return (
          <div key={person.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
            {/* Left: Mode Toggle (stacked) */}
            <div className="flex flex-col items-start gap-0 ml-1" style={{ minWidth: '50px' }}>
              {canUseExisting && (
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name={`mode-${person.id}`}
                    checked={person.mode === 'existing'}
                    onChange={() => handleModeChange(person.id, 'existing')}
                    disabled={disabled || saving}
                    className="w-3 h-3 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <span className="text-[10px] text-gray-600">Existing</span>
                </label>
              )}
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name={`mode-${person.id}`}
                  checked={person.mode === 'custom'}
                  onChange={() => handleModeChange(person.id, 'custom')}
                  disabled={disabled || saving}
                  className="w-3 h-3 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className="text-[10px] text-gray-600">New</span>
              </label>
            </div>

            {/* Middle: Content */}
            <div className="min-w-0" style={{ width: '340px', marginLeft: '12px' }}>
              {/* Existing Contact Mode */}
              {person.mode === 'existing' && (
                <select
                  value={person.contact_id || ''}
                  onChange={(e) => handleExistingContactChange(person.id, e.target.value ? parseInt(e.target.value) : null)}
                  disabled={disabled || saving}
                  className="w-full px-2 py-1 text-sm font-medium border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 mr-1"
                >
                  <option value="">Select contact...</option>
                  {availableContacts.map(contact => (
                    <option key={contact.contact_id} value={contact.contact_id}>
                      {contact.contact_name}{contact.contact_role && ` (${contact.contact_role})`} - {contact.contact_email}
                    </option>
                  ))}
                </select>
              )}

              {/* Custom Contact Mode */}
              {person.mode === 'custom' && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    <input
                      type="email"
                      value={person.contact_email}
                      onChange={(e) => handleCustomFieldChange(person.id, 'contact_email', e.target.value)}
                      disabled={disabled || saving}
                      className="w-60 px-2 py-1 text-sm font-medium border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                      placeholder="Email *"
                    />
                    <input
                      type="text"
                      value={person.contact_name || ''}
                      onChange={(e) => handleCustomFieldChange(person.id, 'contact_name', e.target.value)}
                      disabled={disabled || saving}
                      className="w-28 px-2 py-1 text-sm font-medium border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                      placeholder="Name"
                    />
                  </div>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={person.saveToDatabase || false}
                      onChange={(e) => handleCustomFieldChange(person.id, 'saveToDatabase', e.target.checked)}
                      disabled={disabled || saving}
                      className="w-3 h-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <span className="text-[10px] text-gray-500">Save to contacts</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {pointPersons.length === 0 && (
        <div className="text-xs text-gray-400 italic py-1">No point persons configured</div>
      )}

      {/* Add Button */}
      <button
        type="button"
        onClick={handleAddPointPerson}
        disabled={disabled || saving}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50 pt-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Point Person
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

export default PointPersonsEditor;
