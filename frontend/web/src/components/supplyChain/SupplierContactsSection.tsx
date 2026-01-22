// Phase 4.a: Supplier Contacts Section
// Created: 2025-12-18
import React, { useCallback, useEffect, useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Plus,
  Edit,
  Trash2,
  Star,
  X
} from 'lucide-react';
import api from '../../services/api';
import { useAlert } from '../../contexts/AlertContext';

type ContactRole = 'sales' | 'accounts_payable' | 'customer_service' | 'technical' | 'general';

interface SupplierContact {
  contact_id: number;
  supplier_id: number;
  name: string;
  email?: string;
  phone?: string;
  role: ContactRole;
  is_primary: boolean;
  notes?: string;
  is_active: boolean;
}

interface SupplierContactsSectionProps {
  supplierId: number;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

const ROLE_OPTIONS: { value: ContactRole; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'sales', label: 'Sales' },
  { value: 'accounts_payable', label: 'Accounts Payable' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'technical', label: 'Technical Support' }
];

const ROLE_COLORS: Record<ContactRole, string> = {
  general: 'bg-gray-100 text-gray-700',
  sales: 'bg-green-100 text-green-700',
  accounts_payable: 'bg-blue-100 text-blue-700',
  customer_service: 'bg-yellow-100 text-yellow-700',
  technical: 'bg-purple-100 text-purple-700'
};

export const SupplierContactsSection: React.FC<SupplierContactsSectionProps> = ({
  supplierId,
  showNotification
}) => {
  const { showConfirmation } = useAlert();
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<SupplierContact | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'general' as ContactRole,
    is_primary: false,
    notes: ''
  });

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<SupplierContact[]>(`/suppliers/${supplierId}/contacts`);
      setContacts(response.data);
    } catch (error) {
      console.error('Error loading contacts:', error);
      showNotification('Failed to load contacts', 'error');
    } finally {
      setLoading(false);
    }
  }, [supplierId, showNotification]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const handleSaveContact = async () => {
    if (!formData.name.trim()) {
      showNotification('Contact name is required', 'error');
      return;
    }

    try {
      if (editingContact) {
        await api.put(`/suppliers/${supplierId}/contacts/${editingContact.contact_id}`, formData);
        showNotification(`Updated contact: ${formData.name}`, 'success');
      } else {
        await api.post(`/suppliers/${supplierId}/contacts`, formData);
        showNotification(`Created contact: ${formData.name}`, 'success');
      }

      resetForm();
      void loadContacts();
    } catch (error) {
      console.error('Error saving contact:', error);
      showNotification('Failed to save contact', 'error');
    }
  };

  const handleEditContact = (contact: SupplierContact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      email: contact.email || '',
      phone: contact.phone || '',
      role: contact.role,
      is_primary: contact.is_primary,
      notes: contact.notes || ''
    });
    setShowModal(true);
  };

  const handleDeleteContact = async (contactId: number, name: string) => {
    const confirmed = await showConfirmation({
      title: 'Delete Contact',
      message: `Are you sure you want to delete contact "${name}"?`,
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
      await api.delete(`/suppliers/${supplierId}/contacts/${contactId}`);
      showNotification(`Deleted contact: ${name}`, 'success');
      void loadContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      showNotification('Failed to delete contact', 'error');
    }
  };

  const handleSetPrimary = async (contactId: number) => {
    try {
      await api.post(`/suppliers/${supplierId}/contacts/${contactId}/set-primary`);
      showNotification('Primary contact updated', 'success');
      void loadContacts();
    } catch (error) {
      console.error('Error setting primary contact:', error);
      showNotification('Failed to update primary contact', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'general',
      is_primary: false,
      notes: ''
    });
    setEditingContact(null);
    setShowModal(false);
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Loading contacts...
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-sm font-medium text-gray-700">Contacts</h5>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-1 text-sm text-purple-600 hover:text-purple-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Contact</span>
        </button>
      </div>

      {/* Contacts List */}
      {contacts.length === 0 ? (
        <p className="text-sm text-gray-500">No contacts added yet.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.contact_id}
              className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
            >
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-gray-100 rounded">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 text-sm">{contact.name}</span>
                    {contact.is_primary && (
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    )}
                    <span className={`px-1.5 py-0.5 text-xs rounded ${ROLE_COLORS[contact.role]}`}>
                      {ROLE_OPTIONS.find(r => r.value === contact.role)?.label || contact.role}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-gray-500 mt-0.5">
                    {contact.email && (
                      <span className="flex items-center space-x-1">
                        <Mail className="w-3 h-3" />
                        <span>{contact.email}</span>
                      </span>
                    )}
                    {contact.phone && (
                      <span className="flex items-center space-x-1">
                        <Phone className="w-3 h-3" />
                        <span>{contact.phone}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {!contact.is_primary && (
                  <button
                    onClick={() => handleSetPrimary(contact.contact_id)}
                    className="p-1.5 text-gray-400 hover:text-yellow-500 rounded"
                    title="Set as primary"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleEditContact(contact)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteContact(contact.contact_id, contact.name)}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingContact ? 'Edit Contact' : 'Add Contact'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="Contact name"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="email@example.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as ContactRole })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {ROLE_OPTIONS.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>

              {/* Is Primary */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_primary"
                  checked={formData.is_primary}
                  onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="is_primary" className="text-sm text-gray-700">
                  Primary contact for this supplier
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-4 border-t border-gray-200">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContact}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                disabled={!formData.name.trim()}
              >
                {editingContact ? 'Update' : 'Create'} Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
