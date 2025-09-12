import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, ChevronDown, ChevronUp, Move, Settings, Package, Layers, Zap, Battery } from 'lucide-react';
import {
  getCategoriesApi,
  createCategoryApi,
  updateCategoryApi,
  deleteCategoryApi,
  reorderCategoriesApi
} from '../../services/categoriesApi';
import type { MaterialCategory, CategoryField } from '../../services/categoriesApi';

interface CategoryManagerProps {
  user: any;
  onDataChange: () => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

interface CategoryFormData {
  name: string;
  description: string;
  icon: string;
  sort_order: number;
  fields: CategoryField[];
}

const fieldTypeOptions = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'date', label: 'Date' }
];

const iconOptions = [
  { value: 'package', label: 'Package', component: Package },
  { value: 'layers', label: 'Layers', component: Layers },
  { value: 'zap', label: 'Lightning', component: Zap },
  { value: 'battery', label: 'Battery', component: Battery },
  { value: 'settings', label: 'Settings', component: Settings }
];

const getIconComponent = (iconName: string) => {
  const icon = iconOptions.find(opt => opt.value === iconName);
  return icon?.component || Package;
};

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  user,
  onDataChange,
  showNotification
}) => {
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MaterialCategory | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);

  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    icon: 'package',
    sort_order: 0,
    fields: []
  });

  const loadCategories = async () => {
    try {
      setLoading(true);
      
      const response = await getCategoriesApi();
      setCategories(response || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      showNotification('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: 'package',
      sort_order: categories.length,
      fields: []
    });
  };

  const handleOpenModal = (category?: MaterialCategory) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        icon: category.icon || 'package',
        sort_order: category.sort_order,
        fields: category.fields || []
      });
    } else {
      setEditingCategory(null);
      resetForm();
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      showNotification('Category name is required', 'error');
      return;
    }

    // Temporary: Mock successful save until backend API is connected
    showNotification('Category save temporarily disabled - Backend API integration pending', 'error');
    handleCloseModal();
  };

  const handleDelete = async (category: MaterialCategory) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }

    try {
      await deleteCategoryApi(category.id);
      showNotification('Category deleted successfully');
      await loadCategories();
      onDataChange();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      showNotification(
        error.response?.data?.error || 'Failed to delete category',
        'error'
      );
    }
  };

  const handleToggleExpand = async (categoryId: number) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(categoryId);
    }
  };

  // Field management functions
  const addField = () => {
    const newField: CategoryField = {
      field_name: '',
      field_label: '',
      field_type: 'text',
      is_required: false,
      sort_order: formData.fields.length
    };
    setFormData(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
  };

  const updateField = (index: number, field: CategoryField) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? field : f)
    }));
  };

  const removeField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }));
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= formData.fields.length) return;
    
    const newFields = [...formData.fields];
    const [movedField] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, movedField);
    
    // Update sort orders
    newFields.forEach((field, index) => {
      field.sort_order = index;
    });
    
    setFormData(prev => ({ ...prev, fields: newFields }));
  };

  if (!user || (user.role !== 'manager' && user.role !== 'owner')) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 text-lg font-medium mb-2">Access Denied</div>
        <p className="text-gray-500">Category management is available to managers and owners only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Category Management</h2>
          <p className="text-gray-600">Manage material categories and their dynamic fields</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Categories List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="mt-2 text-gray-600">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Categories</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first material category.</p>
            <button
              onClick={() => handleOpenModal()}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Create Category
            </button>
          </div>
        ) : (
          categories.map((category) => {
            const IconComponent = getIconComponent(category.icon || 'package');
            return (
              <div key={category.id} className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <IconComponent className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{category.name}</h3>
                        <p className="text-sm text-gray-500">
                          {category.description || 'No description'}
                        </p>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-xs text-gray-400">
                            {category.product_count || 0} products
                          </span>
                          <span className="text-xs text-gray-400">
                            {category.fields?.length || 0} fields
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            category.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {category.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggleExpand(category.id)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                        title="View fields"
                      >
                        {expandedCategory === category.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenModal(category)}
                        className="p-2 text-gray-400 hover:text-blue-600"
                        title="Edit category"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Fields List (Expanded) */}
                  {expandedCategory === category.id && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Category Fields</h4>
                      {category.fields && category.fields.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {category.fields.map((field, index) => (
                            <div key={field.id || index} className="border rounded-lg p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-medium text-sm text-gray-900">
                                    {field.field_label}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {field.field_name} ({field.field_type})
                                    {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                  </div>
                                </div>
                              </div>
                              {field.field_type === 'select' && field.field_options && (
                                <div className="text-xs text-gray-400 mt-1">
                                  Options: {field.field_options.join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No fields defined for this category.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Category Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-screen overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {editingCategory ? 'Edit Category' : 'Add Category'}
                  </h2>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Category Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      placeholder="e.g., Vinyl Materials"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Icon
                    </label>
                    <select
                      value={formData.icon}
                      onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    >
                      {iconOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    rows={3}
                    placeholder="Describe this category..."
                  />
                </div>

                {/* Category Fields */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Category Fields</h3>
                    <button
                      type="button"
                      onClick={addField}
                      className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Field</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.fields.map((field, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-700">Field {index + 1}</span>
                            <div className="flex space-x-1">
                              <button
                                type="button"
                                onClick={() => moveField(index, index - 1)}
                                disabled={index === 0}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                title="Move up"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveField(index, index + 1)}
                                disabled={index === formData.fields.length - 1}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                title="Move down"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeField(index)}
                            className="text-red-400 hover:text-red-600"
                            title="Remove field"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Field Name *
                            </label>
                            <input
                              type="text"
                              value={field.field_name}
                              onChange={(e) => updateField(index, { ...field, field_name: e.target.value })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500"
                              placeholder="field_name"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Display Label *
                            </label>
                            <input
                              type="text"
                              value={field.field_label}
                              onChange={(e) => updateField(index, { ...field, field_label: e.target.value })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500"
                              placeholder="Field Label"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Field Type
                            </label>
                            <select
                              value={field.field_type}
                              onChange={(e) => updateField(index, { 
                                ...field, 
                                field_type: e.target.value as any,
                                field_options: e.target.value === 'select' ? field.field_options : undefined
                              })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500"
                            >
                              {fieldTypeOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center mt-3 space-x-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={field.is_required}
                              onChange={(e) => updateField(index, { ...field, is_required: e.target.checked })}
                              className="mr-2 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-xs text-gray-700">Required</span>
                          </label>
                        </div>

                        {field.field_type === 'select' && (
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Options (one per line)
                            </label>
                            <textarea
                              value={field.field_options?.join('\n') || ''}
                              onChange={(e) => updateField(index, { 
                                ...field, 
                                field_options: e.target.value.split('\n').filter(opt => opt.trim()) 
                              })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500"
                              rows={3}
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {formData.fields.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No fields defined. Click "Add Field" to create fields for this category.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};