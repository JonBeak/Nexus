import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  Edit, 
  Trash2, 
  Plus,
  FileText,
  DollarSign,
  Clock,
  Package
} from 'lucide-react';
import api from '../../services/api';

interface Supplier {
  supplier_id: number;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SuppliersManagerProps {
  user: any;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

export const SuppliersManager: React.FC<SuppliersManagerProps> = ({ 
  user, 
  showNotification 
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    notes: ''
  });

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/suppliers');
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      showNotification('Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleSaveSupplier = async () => {
    if (!formData.name.trim()) {
      showNotification('Supplier name is required', 'error');
      return;
    }

    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.supplier_id}`, formData);
        showNotification(`Updated supplier: ${formData.name}`, 'success');
      } else {
        await api.post('/suppliers', formData);
        showNotification(`Created supplier: ${formData.name}`, 'success');
      }
      
      setShowAddModal(false);
      setEditingSupplier(null);
      setFormData({ name: '', contact_email: '', contact_phone: '', website: '', notes: '' });
      loadSuppliers();
    } catch (error) {
      console.error('Error saving supplier:', error);
      showNotification('Failed to save supplier', 'error');
    }
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_email: supplier.contact_email || '',
      contact_phone: supplier.contact_phone || '',
      website: supplier.website || '',
      notes: supplier.notes || ''
    });
    setShowAddModal(true);
  };

  const handleDeleteSupplier = async (supplierId: number, name: string) => {
    if (!confirm(`Are you sure you want to delete supplier "${name}"?`)) return;

    try {
      await api.delete(`/suppliers/${supplierId}`);
      showNotification(`Deleted supplier: ${name}`, 'success');
      loadSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      showNotification('Failed to delete supplier', 'error');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', contact_email: '', contact_phone: '', website: '', notes: '' });
    setEditingSupplier(null);
    setShowAddModal(false);
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
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Suppliers Grid */}
      {suppliers.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Building2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No suppliers found</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Add Your First Supplier
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((supplier) => (
            <div key={supplier.supplier_id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{supplier.name}</h4>
                    <div className="text-xs text-gray-500">
                      ID: {supplier.supplier_id}
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditSupplier(supplier)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(supplier.supplier_id, supplier.name)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                {supplier.contact_email && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{supplier.contact_email}</span>
                  </div>
                )}
                
                {supplier.contact_phone && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{supplier.contact_phone}</span>
                  </div>
                )}
                
                {supplier.website && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Globe className="w-4 h-4" />
                    <span className="truncate">{supplier.website}</span>
                  </div>
                )}

                {supplier.notes && (
                  <div className="flex items-start space-x-2 text-sm text-gray-600">
                    <FileText className="w-4 h-4 mt-0.5" />
                    <span className="line-clamp-2">{supplier.notes}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Added: {new Date(supplier.created_at).toLocaleDateString()}</span>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    supplier.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {supplier.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Enter supplier name..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="orders@supplier.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="https://supplier.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Payment terms, shipping info, etc..."
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
      )}
    </div>
  );
};