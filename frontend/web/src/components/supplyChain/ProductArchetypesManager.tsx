// Phase 4.b: Product Types Manager (formerly Materials/Archetypes)
// Created: 2025-12-18
// Updated: Renamed to Product Types, dynamic categories + Key-Value specs editor
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  Settings,
  X,
  GripVertical
} from 'lucide-react';
import api, { suppliersApi } from '../../services/api';
import { useAlert } from '../../contexts/AlertContext';
import { ArchetypeSupplierProducts } from './ArchetypeSupplierProducts';
import { SpecificationEditor } from './SpecificationEditor';

interface Category {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  material_count?: number;
}

interface Archetype {
  archetype_id: number;
  name: string;
  category_id: number;
  category_name: string;
  category_color?: string | null;
  category_icon?: string | null;
  subcategory: string | null;
  unit_of_measure: string;
  specifications: Record<string, any> | null;
  description: string | null;
  reorder_point: number;
  is_active: boolean;
}

interface SpecRow {
  key: string;
  value: string;
}

interface ProductArchetypesManagerProps {
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

const UNIT_OPTIONS = ['each', 'linear_ft', 'sq_ft', 'sheet', 'roll', 'gallon', 'lb', 'oz', 'box', 'pack', 'bag'];

const DEFAULT_COLORS = [
  'bg-yellow-100 text-yellow-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-gray-100 text-gray-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-orange-100 text-orange-700',
  'bg-red-100 text-red-700',
  'bg-slate-100 text-slate-700',
  'bg-cyan-100 text-cyan-700',
  'bg-teal-100 text-teal-700',
];

export const ProductArchetypesManager: React.FC<ProductArchetypesManagerProps> = ({
  showNotification
}) => {
  const { showConfirmation } = useAlert();
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingArchetype, setEditingArchetype] = useState<Archetype | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedArchetype, setExpandedArchetype] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Product type form state
  const [formData, setFormData] = useState({
    name: '',
    category_id: 0,  // Use category_id instead of category name
    subcategory: '',
    unit_of_measure: 'each',
    description: '',
    reorder_point: ''
  });
  const [specRows, setSpecRows] = useState<SpecRow[]>([{ key: '', value: '' }]);

  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    icon: 'box',
    color: 'bg-gray-100 text-gray-700'
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      // selectedCategory stores category name for display, filter by it
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (debouncedSearchTerm) params.search = debouncedSearchTerm;

      const [archetypesRes, categoriesRes, suppliersRes] = await Promise.all([
        api.get<Archetype[]>('/product-types', { params }),
        api.get<Category[]>('/product-types/categories'),
        suppliersApi.getSuppliers({ active_only: true })
      ]);

      setArchetypes(archetypesRes.data);
      setCategories(categoriesRes.data);
      setSuppliers(suppliersRes);

      // Set default category for new product types
      if (categoriesRes.data.length > 0 && !formData.category_id) {
        setFormData(prev => ({ ...prev, category_id: categoriesRes.data[0].id }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Failed to load product types', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification, selectedCategory, debouncedSearchTerm]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Debounce search input - wait 300ms after last keystroke before triggering API calls
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Convert specs object to rows
  const specsToRows = (specs: Record<string, any> | null): SpecRow[] => {
    if (!specs || Object.keys(specs).length === 0) {
      return [{ key: '', value: '' }];
    }
    return Object.entries(specs).map(([key, value]) => ({
      key,
      value: String(value)
    }));
  };

  // Convert rows to specs object
  const rowsToSpecs = (rows: SpecRow[]): Record<string, any> | null => {
    const specs: Record<string, any> = {};
    for (const row of rows) {
      if (row.key.trim()) {
        // Try to parse as number if it looks like one
        const numValue = parseFloat(row.value);
        specs[row.key.trim()] = !isNaN(numValue) && row.value.trim() === String(numValue)
          ? numValue
          : row.value.trim();
      }
    }
    return Object.keys(specs).length > 0 ? specs : null;
  };

  const handleSaveProductType = async () => {
    if (!formData.name.trim()) {
      showNotification('Name is required', 'error');
      return;
    }
    if (!formData.category_id) {
      showNotification('Category is required', 'error');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        category_id: formData.category_id,
        subcategory: formData.subcategory || null,
        unit_of_measure: formData.unit_of_measure,
        specifications: rowsToSpecs(specRows),
        description: formData.description || null,
        reorder_point: formData.reorder_point ? parseInt(formData.reorder_point) : 0
      };

      if (editingArchetype) {
        await api.put(`/product-types/${editingArchetype.archetype_id}`, payload);
        showNotification(`Updated: ${formData.name}`, 'success');
      } else {
        await api.post('/product-types', payload);
        showNotification(`Created: ${formData.name}`, 'success');
      }

      resetProductTypeForm();
      void loadData();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to save product type';
      showNotification(message, 'error');
    }
  };

  const handleEditProductType = (archetype: Archetype) => {
    setEditingArchetype(archetype);
    setFormData({
      name: archetype.name,
      category_id: archetype.category_id,
      subcategory: archetype.subcategory || '',
      unit_of_measure: archetype.unit_of_measure,
      description: archetype.description || '',
      reorder_point: archetype.reorder_point?.toString() || ''
    });
    setSpecRows(specsToRows(archetype.specifications));
    setShowModal(true);
  };

  const handleDeleteProductType = async (archetypeId: number, name: string) => {
    const confirmed = await showConfirmation({
      title: 'Deactivate Product Type',
      message: `Are you sure you want to deactivate "${name}"?`,
      variant: 'danger',
      confirmText: 'Deactivate'
    });
    if (!confirmed) return;

    try {
      await api.delete(`/product-types/${archetypeId}`);
      showNotification(`Deactivated: ${name}`, 'success');
      void loadData();
    } catch (error) {
      showNotification('Failed to deactivate product type', 'error');
    }
  };

  const resetProductTypeForm = (defaultCategoryId?: number) => {
    const categoryId = defaultCategoryId || categories[0]?.id || 0;
    setFormData({
      name: '',
      category_id: categoryId,
      subcategory: '',
      unit_of_measure: 'each',
      description: '',
      reorder_point: ''
    });
    setSpecRows([{ key: '', value: '' }]);
    setEditingArchetype(null);
    setShowModal(false);
  };

  const handleAddProductType = () => {
    // If a specific category is selected, use it as the default
    if (selectedCategory !== 'all') {
      const selectedCat = categories.find(c => c.name === selectedCategory);
      if (selectedCat) {
        setFormData({
          name: '',
          category_id: selectedCat.id,
          subcategory: '',
          unit_of_measure: 'each',
          description: '',
          reorder_point: ''
        });
        setSpecRows([{ key: '', value: '' }]);
        setEditingArchetype(null);
        setShowModal(true);
        return;
      }
    }
    // Otherwise, use default (first category)
    resetProductTypeForm();
    setShowModal(true);
  };

  // Category management
  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      showNotification('Category name is required', 'error');
      return;
    }

    try {
      if (editingCategory) {
        await api.put(`/product-types/categories/${editingCategory.id}`, categoryForm);
        showNotification(`Updated category: ${categoryForm.name}`, 'success');
      } else {
        await api.post('/product-types/categories', categoryForm);
        showNotification(`Created category: ${categoryForm.name}`, 'success');
      }

      resetCategoryForm();
      void loadData();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to save category';
      showNotification(message, 'error');
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      icon: category.icon || 'box',
      color: category.color || 'bg-gray-100 text-gray-700'
    });
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (category: Category) => {
    if (category.material_count && category.material_count > 0) {
      showNotification(`Cannot delete category with ${category.material_count} product types`, 'error');
      return;
    }
    const confirmed = await showConfirmation({
      title: 'Delete Category',
      message: `Are you sure you want to delete "${category.name}"?`,
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
      await api.delete(`/product-types/categories/${category.id}`);
      showNotification(`Deleted category: ${category.name}`, 'success');
      void loadData();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to delete category';
      showNotification(message, 'error');
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '', icon: 'box', color: 'bg-gray-100 text-gray-700' });
    setEditingCategory(null);
    setShowCategoryModal(false);
  };

  // Spec row management is now handled by SpecificationEditor component

  const getTotalCount = () => categories.reduce((sum, c) => sum + (c.material_count || 0), 0);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        <p className="mt-2 text-sm text-gray-600">Loading product types...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Product Types Catalog</h3>
          <p className="text-sm text-gray-500">
            {getTotalCount()} product types across {categories.length} categories
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
          >
            <Settings className="w-4 h-4" />
            <span>Categories</span>
          </button>
          <button
            onClick={handleAddProductType}
            className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product Type</span>
          </button>
        </div>
      </div>

      {/* Search and Category Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search product types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedCategory === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({getTotalCount()})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedCategory === cat.name
                  ? 'bg-purple-600 text-white'
                  : `${cat.color || 'bg-gray-100 text-gray-700'} hover:opacity-80`
              }`}
            >
              {cat.name} ({cat.material_count || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Product Types List */}
      {archetypes.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No product types found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {archetypes.map((archetype) => {
            // Use category color from archetype if available, else look up from categories
            const categoryColor = archetype.category_color || categories.find(c => c.id === archetype.category_id)?.color || 'bg-gray-100 text-gray-700';
            return (
              <div key={archetype.archetype_id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedArchetype(expandedArchetype === archetype.archetype_id ? null : archetype.archetype_id)}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className={`p-1.5 rounded ${categoryColor}`}>
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-gray-900">{archetype.name}</h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${categoryColor}`}>
                          {archetype.category_name}
                        </span>
                        {archetype.subcategory && (
                          <span className="text-xs text-gray-400">{archetype.subcategory}</span>
                        )}
                        <span className="text-xs text-gray-500">{archetype.unit_of_measure}</span>
                      </div>
                      {archetype.description && (
                        <p className="text-sm text-gray-500 truncate mt-0.5">{archetype.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditProductType(archetype); }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProductType(archetype.archetype_id, archetype.name); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {expandedArchetype === archetype.archetype_id ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {expandedArchetype === archetype.archetype_id && (
                  <div className="border-t border-gray-200 bg-gray-50 px-3 py-3 space-y-4">
                    {/* Archetype Details */}
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs">Reorder Point</span>
                        <p className="text-gray-900">{archetype.reorder_point}</p>
                      </div>
                      {archetype.specifications && Object.keys(archetype.specifications).length > 0 && (
                        <div className="flex-1">
                          <span className="text-gray-500 text-xs">Specification Template</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {Object.entries(archetype.specifications).map(([key, value]) => (
                              <span key={key} className="px-1.5 py-0.5 bg-white border rounded text-xs">
                                {key}{value ? `: ${value}` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Supplier Products Section */}
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Supplier Products & Pricing</h4>
                      <ArchetypeSupplierProducts
                        archetypeId={archetype.archetype_id}
                        onUpdate={loadData}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Product Type Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingArchetype ? 'Edit Product Type' : 'Add New Product Type'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                  <input
                    type="text"
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="e.g., acrylic, aluminum"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Units *</label>
                  <select
                    value={formData.unit_of_measure}
                    onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reorder_point}
                    onChange={(e) => setFormData({ ...formData, reorder_point: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                {/* Specifications Key-Value Editor */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specification Template
                    <span className="text-xs text-gray-500 ml-2">(Default values for new supplier products)</span>
                  </label>
                  <SpecificationEditor
                    specRows={specRows}
                    setSpecRows={setSpecRows}
                    mode="supplier"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={resetProductTypeForm} className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                  Cancel
                </button>
                <button
                  onClick={handleSaveProductType}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  disabled={!formData.name.trim() || !formData.category_id}
                >
                  {editingArchetype ? 'Update' : 'Create'} Product Type
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingCategory ? 'Edit Category' : 'Manage Categories'}
                </h3>
                <button onClick={resetCategoryForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Category Form */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Category name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Optional description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setCategoryForm({ ...categoryForm, color })}
                        className={`w-8 h-8 rounded-full ${color} ${categoryForm.color === color ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex space-x-2">
                  {editingCategory && (
                    <button
                      onClick={resetCategoryForm}
                      className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    onClick={handleSaveCategory}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                    disabled={!categoryForm.name.trim()}
                  >
                    {editingCategory ? 'Update' : 'Add'} Category
                  </button>
                </div>
              </div>

              {/* Category List */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Existing Categories</h4>
                <div className="space-y-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded ${cat.color || 'bg-gray-200'}`} />
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-sm text-gray-500">({cat.material_count || 0})</span>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleEditCategory(cat)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          disabled={(cat.material_count || 0) > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
