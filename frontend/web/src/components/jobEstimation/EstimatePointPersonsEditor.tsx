/**
 * EstimatePointPersonsEditor Component
 * Phase 4c - Manage point persons for estimates
 * Based on orders/details/components/PointPersonsEditor.tsx
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { customerContactsApi } from '../../services/api';

export interface PointPersonEntry {
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

interface EstimatePointPerson {
  id: number;
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
}

export interface EstimatePointPersonsEditorHandle {
  hasChanges: () => boolean;
  save: () => Promise<void>;
}

interface EstimatePointPersonsEditorProps {
  customerId: number;
  initialPointPersons?: EstimatePointPerson[];
  onSave: (pointPersons: PointPersonEntry[]) => Promise<void>;
  disabled?: boolean;
}

const EstimatePointPersonsEditor = React.forwardRef<EstimatePointPersonsEditorHandle, EstimatePointPersonsEditorProps>(({
  customerId,
  initialPointPersons = [],
  onSave,
  disabled = false
}, ref) => {
  const [pointPersons, setPointPersons] = useState<PointPersonEntry[]>([]);
  const [savedPointPersons, setSavedPointPersons] = useState<PointPersonEntry[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load contacts function
  const loadContacts = useCallback(async () => {
    if (!customerId) return;
    try {
      setLoading(true);
      const contacts = await customerContactsApi.getContacts(customerId);
      setAllContacts(contacts || []);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      setAllContacts([]);
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
      const transformedPersons = initialPointPersons.map(pp => ({
        id: `existing-${pp.id}`,
        mode: pp.contact_id ? 'existing' as const : 'custom' as const,
        contact_id: pp.contact_id,
        contact_email: pp.contact_email,
        contact_name: pp.contact_name,
        contact_phone: pp.contact_phone,
        contact_role: pp.contact_role
      }));
      setPointPersons(transformedPersons);
      setSavedPointPersons(transformedPersons);
    }
  }, [initialPointPersons]);

  // Handle save - filter out empty rows and notify parent
  const handleSave = async () => {
    try {
      setSaving(true);
      // Filter out empty rows
      const validPointPersons = pointPersons.filter(p => {
        if (p.mode === 'existing') return p.contact_id != null;
        return p.contact_email?.trim();
      });

      const hasSaveToDatabase = validPointPersons.some(p => p.saveToDatabase && !p.contact_id);
      await onSave(validPointPersons);

      // Update local state to remove empty rows and reset saved state
      setPointPersons(validPointPersons);
      setSavedPointPersons(validPointPersons);
      setHasChanges(false);

      // Reload contacts if any were saved to database
      if (hasSaveToDatabase) {
        await loadContacts();
      }
    } catch (error) {
      console.error('Failed to save point persons:', error);
    } finally {
      setSaving(false);
    }
  };

  // Handle reset - revert to last saved state
  const handleReset = () => {
    setPointPersons(savedPointPersons);
    setHasChanges(false);
  };

  // Expose methods via ref (after handleSave is defined)
  React.useImperativeHandle(ref, () => ({
    hasChanges: () => hasChanges,
    save: handleSave
  }), [hasChanges, handleSave]);

  // Get IDs of contacts already selected
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

  if (loading) {
    return <div className="text-xs text-gray-500">Loading contacts...</div>;
  }

  return (
    <div className="space-y-2">
      {pointPersons.length === 0 ? (
        <div className="text-xs text-gray-500 italic">No point persons added</div>
      ) : (
        pointPersons.map((person) => {
          const availableContacts = getAvailableContacts(person.id);
          const canUseExisting = availableContacts.length > 0 || person.mode === 'existing';

          return (
            <div key={person.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded text-xs">
              {/* Mode Toggle */}
              <div className="flex flex-col gap-0.5 min-w-[55px]">
                {canUseExisting && (
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`mode-${person.id}`}
                      checked={person.mode === 'existing'}
                      onChange={() => handleModeChange(person.id, 'existing')}
                      disabled={disabled || saving}
                      className="w-3 h-3 text-indigo-600"
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
                    className="w-3 h-3 text-indigo-600"
                  />
                  <span className="text-[10px] text-gray-600">New</span>
                </label>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {person.mode === 'existing' ? (
                  <select
                    value={person.contact_id || ''}
                    onChange={(e) => handleExistingContactChange(person.id, e.target.value ? parseInt(e.target.value) : null)}
                    disabled={disabled || saving}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select contact...</option>
                    {availableContacts.map(contact => (
                      <option key={contact.contact_id} value={contact.contact_id}>
                        {contact.contact_name}{contact.contact_role && ` (${contact.contact_role})`} - {contact.contact_email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      <input
                        type="email"
                        value={person.contact_email}
                        onChange={(e) => handleCustomFieldChange(person.id, 'contact_email', e.target.value)}
                        disabled={disabled || saving}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                        placeholder="Email *"
                      />
                      <input
                        type="text"
                        value={person.contact_name || ''}
                        onChange={(e) => handleCustomFieldChange(person.id, 'contact_name', e.target.value)}
                        disabled={disabled || saving}
                        className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                        placeholder="Name"
                      />
                    </div>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={person.saveToDatabase || false}
                        onChange={(e) => handleCustomFieldChange(person.id, 'saveToDatabase', e.target.checked)}
                        disabled={disabled || saving}
                        className="w-3 h-3 text-indigo-600 rounded"
                      />
                      <span className="text-[10px] text-gray-500">Save to contacts</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => handleRemovePointPerson(person.id)}
                disabled={disabled || saving}
                className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })
      )}

      {/* Add Button */}
      <button
        type="button"
        onClick={handleAddPointPerson}
        disabled={disabled || saving}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Point Person
      </button>

      {/* Save and Reset Buttons (only show if changes) */}
      {hasChanges && (
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || saving}
            className="flex-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled || saving}
            className="flex-1 px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 disabled:opacity-50"
          >
            Reset Changes
          </button>
        </div>
      )}
    </div>
  );
});

EstimatePointPersonsEditor.displayName = 'EstimatePointPersonsEditor';

export default EstimatePointPersonsEditor;
