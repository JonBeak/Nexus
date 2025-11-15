import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { suppliersApi } from '../../services/api';
import { AutofillComboBox } from '../common/AutofillComboBox';
import {
  SupplierSummary,
  VinylAutofillCombination,
  VinylAutofillSuggestions,
  VinylProduct,
  VinylProductFormSubmission
} from './types';

interface ProductFormState {
  brand: string;
  series: string;
  colour_number: string;
  colour_name: string;
  default_width: string;
  supplier_ids: number[];
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VinylProductFormSubmission) => Promise<void> | void;
  title: string;
  initialData?: VinylProduct | null;
  autofillSuggestions?: VinylAutofillSuggestions;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  initialData,
  autofillSuggestions
}) => {
  const [formData, setFormData] = useState<ProductFormState>({
    brand: '',
    series: '',
    colour_number: '',
    colour_name: '',
    default_width: '',
    supplier_ids: []
  });

  const [availableSuppliers, setAvailableSuppliers] = useState<SupplierSummary[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();

      if (initialData) {
        // Extract supplier IDs from either supplier_details or suppliers array
        let supplierIds: number[] = [];
        if (initialData.supplier_details) {
          supplierIds = initialData.supplier_details.map((s) => s.supplier_id);
        } else if (Array.isArray(initialData.suppliers)) {
          supplierIds = (initialData.suppliers as any[]).map((s) => s.supplier_id);
        } else if (initialData.supplier_ids) {
          supplierIds = initialData.supplier_ids;
        }

        setFormData({
          brand: initialData.brand || '',
          series: initialData.series || '',
          colour_number: initialData.colour_number || '',
          colour_name: initialData.colour_name || '',
          default_width: initialData.default_width?.toString() || '',
          supplier_ids: supplierIds
        });
      } else {
        // Reset form for new product
        setFormData({
          brand: '',
          series: '',
          colour_number: '',
          colour_name: '',
          default_width: '',
          supplier_ids: []
        });
      }
    }
  }, [initialData, isOpen]);

  const loadSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const suppliers = await suppliersApi.getSuppliers({ active_only: true }) as SupplierSummary[];
      setAvailableSuppliers(suppliers || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      setAvailableSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Custom validation: either colour_number or colour_name must be provided
    if (!formData.colour_number && !formData.colour_name) {
      alert('Please provide either a Color Number or Color Name (or both).');
      return;
    }
    
    setLoading(true);

    try {
      const submitData: VinylProductFormSubmission = {
        ...formData,
        default_width: formData.default_width ? parseFloat(formData.default_width) : null
      };
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Error submitting product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAutofillChange = (
    field: 'brand' | 'series' | 'colour_number' | 'colour_name',
    value: string
  ) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };

      // Auto-populate any additional fields when we have a complete product combination
      if (newData.brand && newData.series && (newData.colour_number || newData.colour_name)) {
        const matchingProduct = autofillSuggestions?.combinations?.find((combo: VinylAutofillCombination) => {
          const basicMatch = combo.brand === newData.brand && combo.series === newData.series;
          
          if (!basicMatch) return false;

          // Match using new fields or fallback to old field
          if (newData.colour_number && newData.colour_name) {
            // Both fields provided - check if combo matches
            const numberMatch = combo.colour?.match(/^([0-9]+[a-zA-Z]*)/);
            const nameMatch = combo.colour?.match(/^[0-9]+[a-zA-Z]*\s+(.+)$/);
            return (numberMatch?.[1] === newData.colour_number && nameMatch?.[1] === newData.colour_name) ||
                   combo.colour === `${newData.colour_number} ${newData.colour_name}`;
          } else if (newData.colour_number) {
            // Only number provided
            return combo.colour?.startsWith(newData.colour_number);
          } else if (newData.colour_name) {
            // Only name provided
            return combo.colour?.includes(newData.colour_name) || combo.colour === newData.colour_name;
          }
          
          return false;
        });

        if (matchingProduct?.supplier_ids && newData.supplier_ids.length === 0) {
          newData.supplier_ids = [...matchingProduct.supplier_ids];
        }
      }

      return newData;
    });
  };

  const getSuggestions = (field: 'brand' | 'series' | 'colour_number' | 'colour_name') => {
    if (!autofillSuggestions?.combinations) return [];

    let filtered = autofillSuggestions.combinations;
    
    // Filter based on already selected values
    if (field === 'series' && formData.brand) {
      filtered = filtered.filter((combo) => combo.brand === formData.brand);
    } else if ((field === 'colour_number' || field === 'colour_name') && formData.brand && formData.series) {
      filtered = filtered.filter((combo) => 
        combo.brand === formData.brand && combo.series === formData.series
      );
    }
    
    // Extract unique values for the requested field
    let values: string[] = [];
    
    if (field === 'colour_number') {
      // Parse colour numbers from the colour field (e.g., "807 Unknown Color" -> "807")
      values = [...new Set(filtered.map((combo) => {
        if (!combo.colour) return null;
        const match = combo.colour.match(/^([0-9]+[a-zA-Z]*)/);
        return match ? match[1] : null;
      }).filter(Boolean))];
    } else if (field === 'colour_name') {
      // Parse colour names from the colour field (e.g., "807 Unknown Color" -> "Unknown Color")
      values = [...new Set(filtered.map((combo) => {
        if (!combo.colour) return null;
        const match = combo.colour.match(/^[0-9]+[a-zA-Z]*\s+(.+)$/);
        return match ? match[1] : combo.colour; // If no number prefix, use the whole colour
      }).filter(Boolean))];
    } else {
      // For brand, series
      values = [...new Set(filtered.map((combo) => combo[field]).filter(Boolean))];
    }
    
    return values.sort();
  };

  const handleSupplierChange = (supplierId: number, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        supplier_ids: [...formData.supplier_ids, supplierId]
      });
    } else {
      setFormData({
        ...formData,
        supplier_ids: formData.supplier_ids.filter(id => id !== supplierId)
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-8 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <AutofillComboBox
                label="Brand"
                value={formData.brand}
                onChange={(value) => handleAutofillChange('brand', value)}
                suggestions={getSuggestions('brand')}
                placeholder="Select or enter brand"
                required
                className="w-full"
              />
            </div>

            <div>
              <AutofillComboBox
                label="Series"
                value={formData.series}
                onChange={(value) => handleAutofillChange('series', value)}
                suggestions={getSuggestions('series')}
                placeholder="Select or enter series"
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color Number
              </label>
              <input
                type="text"
                name="colour_number"
                value={formData.colour_number}
                onChange={handleChange}
                placeholder="e.g. 807, 123A"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color Name
              </label>
              <input
                type="text"
                name="colour_name"
                value={formData.colour_name}
                onChange={handleChange}
                placeholder="e.g. Unknown Color, Bright Red"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Default Width */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Width (inches)
            </label>
            <input
              type="number"
              name="default_width"
              value={formData.default_width}
              onChange={handleChange}
              step="0.01"
              min="0"
              placeholder="e.g. 48"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Suppliers (Optional)
            </label>
            {loadingSuppliers ? (
              <div className="text-sm text-gray-500">Loading suppliers...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3">
                {availableSuppliers.map((supplier) => (
                  <label key={supplier.supplier_id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.supplier_ids.includes(supplier.supplier_id)}
                      onChange={(e) => handleSupplierChange(supplier.supplier_id, e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-900">{supplier.name}</span>
                  </label>
                ))}
                {availableSuppliers.length === 0 && (
                  <div className="text-sm text-gray-500">No suppliers available</div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : (initialData ? 'Update' : 'Add')} Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
