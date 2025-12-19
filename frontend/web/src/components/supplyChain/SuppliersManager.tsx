// Phase 4.a: Updated for extended supplier fields + contacts
// Updated: 2025-12-18
import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Globe,
  Edit,
  Trash2,
  Plus,
  FileText,
  Users,
  ChevronDown,
  ChevronRight,
  MapPin,
  Clock,
  CreditCard,
  Hash
} from 'lucide-react';
import api from '../../services/api';
import { SupplierContactsSection } from './SupplierContactsSection';

interface Supplier {
  supplier_id: number;
  name: string;
  website?: string;
  notes?: string;
  payment_terms?: string;
  default_lead_days?: number;
  account_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  is_active: boolean;
  contact_count?: number;
  created_at: string;
  updated_at: string;
}

interface SuppliersManagerProps {
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

const PAYMENT_TERMS_OPTIONS = [
  'Net 15', 'Net 30', 'Net 45', 'Net 60', 'COD', 'Credit Card', 'Prepaid', 'Other'
];

export const SuppliersManager: React.FC<SuppliersManagerProps> = ({
  showNotification
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    notes: '',
    payment_terms: '',
    default_lead_days: '',
    account_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    province: '',
    postal_code: '',
    country: 'Canada'
  });

  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<Supplier[]>('/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      showNotification('Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const handleSaveSupplier = async () => {
    if (!formData.name.trim()) {
      showNotification('Supplier name is required', 'error');
      return;
    }

    try {
      const payload = {
        ...formData,
        default_lead_days: formData.default_lead_days ? parseInt(formData.default_lead_days) : null
      };

      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.supplier_id}`, payload);
        showNotification(`Updated supplier: ${formData.name}`, 'success');
      } else {
        await api.post('/suppliers', payload);
        showNotification(`Created supplier: ${formData.name}`, 'success');
      }

      resetForm();
      void loadSuppliers();
    } catch (error) {
      console.error('Error saving supplier:', error);
      showNotification('Failed to save supplier', 'error');
    }
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      website: supplier.website || '',
      notes: supplier.notes || '',
      payment_terms: supplier.payment_terms || '',
      default_lead_days: supplier.default_lead_days?.toString() || '',
      account_number: supplier.account_number || '',
      address_line1: supplier.address_line1 || '',
      address_line2: supplier.address_line2 || '',
      city: supplier.city || '',
      province: supplier.province || '',
      postal_code: supplier.postal_code || '',
      country: supplier.country || 'Canada'
    });
    setShowModal(true);
  };

  const handleDeleteSupplier = async (supplierId: number, name: string) => {
    if (!confirm(`Are you sure you want to delete supplier "${name}"?`)) return;

    try {
      await api.delete(`/suppliers/${supplierId}`);
      showNotification(`Deleted supplier: ${name}`, 'success');
      void loadSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      showNotification('Failed to delete supplier', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      website: '',
      notes: '',
      payment_terms: '',
      default_lead_days: '',
      account_number: '',
      address_line1: '',
      address_line2: '',
      city: '',
      province: '',
      postal_code: '',
      country: 'Canada'
    });
    setEditingSupplier(null);
    setShowModal(false);
  };

  const toggleExpanded = (supplierId: number) => {
    setExpandedSupplier(expandedSupplier === supplierId ? null : supplierId);
  };

  const formatAddress = (supplier: Supplier) => {
    const parts = [
      supplier.city,
      supplier.province,
      supplier.country
    ].filter(Boolean);
    return parts.join(', ') || null;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        <p className="mt-2 text-sm text-gray-600">Loading suppliers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Suppliers</h3>
          <p className="text-sm text-gray-500">Manage supplier information and contacts</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Suppliers List */}
      {suppliers.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Building2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No suppliers found</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Add Your First Supplier
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {suppliers.map((supplier) => (
            <div key={supplier.supplier_id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Supplier Header Row */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpanded(supplier.supplier_id)}
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{supplier.name}</h4>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                      {formatAddress(supplier) && (
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>{formatAddress(supplier)}</span>
                        </span>
                      )}
                      {supplier.payment_terms && (
                        <span className="flex items-center space-x-1">
                          <CreditCard className="w-3 h-3" />
                          <span>{supplier.payment_terms}</span>
                        </span>
                      )}
                      {supplier.default_lead_days && (
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{supplier.default_lead_days} days</span>
                        </span>
                      )}
                      <span className="flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        <span>{supplier.contact_count || 0} contacts</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditSupplier(supplier); }}
                    className="p-2 text-gray-400 hover:text-blue-600 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSupplier(supplier.supplier_id, supplier.name); }}
                    className="p-2 text-gray-400 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedSupplier === supplier.supplier_id ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedSupplier === supplier.supplier_id && (
                <div className="border-t border-gray-200 bg-gray-50">
                  {/* Supplier Details */}
                  <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {supplier.website && (
                      <div>
                        <span className="text-gray-500 flex items-center space-x-1">
                          <Globe className="w-3 h-3" />
                          <span>Website</span>
                        </span>
                        <a href={supplier.website} target="_blank" rel="noopener noreferrer"
                           className="text-blue-600 hover:underline truncate block">
                          {supplier.website}
                        </a>
                      </div>
                    )}
                    {supplier.account_number && (
                      <div>
                        <span className="text-gray-500 flex items-center space-x-1">
                          <Hash className="w-3 h-3" />
                          <span>Account #</span>
                        </span>
                        <span className="text-gray-900">{supplier.account_number}</span>
                      </div>
                    )}
                    {(supplier.address_line1 || supplier.address_line2) && (
                      <div className="col-span-2">
                        <span className="text-gray-500 flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>Address</span>
                        </span>
                        <div className="text-gray-900">
                          {supplier.address_line1 && <div>{supplier.address_line1}</div>}
                          {supplier.address_line2 && <div>{supplier.address_line2}</div>}
                          <div>
                            {[supplier.city, supplier.province, supplier.postal_code].filter(Boolean).join(', ')}
                          </div>
                          {supplier.country && supplier.country !== 'Canada' && <div>{supplier.country}</div>}
                        </div>
                      </div>
                    )}
                    {supplier.notes && (
                      <div className="col-span-2 md:col-span-4">
                        <span className="text-gray-500 flex items-center space-x-1">
                          <FileText className="w-3 h-3" />
                          <span>Notes</span>
                        </span>
                        <span className="text-gray-900">{supplier.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Contacts Section */}
                  <div className="border-t border-gray-200">
                    <SupplierContactsSection
                      supplierId={supplier.supplier_id}
                      showNotification={showNotification}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Enter supplier name..."
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="https://supplier.com"
                  />
                </div>

                {/* Payment Terms */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="">Select...</option>
                    {PAYMENT_TERMS_OPTIONS.map(term => (
                      <option key={term} value={term}>{term}</option>
                    ))}
                  </select>
                </div>

                {/* Lead Days */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Lead Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.default_lead_days}
                    onChange={(e) => setFormData({ ...formData, default_lead_days: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="e.g., 5"
                  />
                </div>

                {/* Account Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Your account # with supplier"
                  />
                </div>

                {/* Address Line 1 */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Street address"
                  />
                </div>

                {/* Address Line 2 */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Suite, unit, etc."
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                {/* Province */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Province/State</label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                {/* Postal Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSupplier}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  disabled={!formData.name.trim()}
                >
                  {editingSupplier ? 'Update' : 'Create'} Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
