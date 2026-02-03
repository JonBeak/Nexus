import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { vinylApi, suppliersApi, ordersApi } from '../../services/api';
import { useAlert } from '../../contexts/AlertContext';
import { AutofillComboBox } from '../common/AutofillComboBox';
import {
  SupplierSummary,
  VinylAutofillCombination,
  VinylAutofillSuggestions,
  VinylFormSubmission,
  VinylItem,
  VinylProduct
} from './types';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import { getTodayString } from '../../utils/dateUtils';

interface VinylFormState {
  brand: string;
  series: string;
  colour_number: string;
  colour_name: string;
  width: string;
  length_yards: string;
  location: string;
  disposition: 'in_stock' | 'used' | 'waste' | 'returned' | 'damaged';
  supplier_id: string;
  purchase_date: string;
  storage_date: string;
  notes: string;
}

interface VinylModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VinylFormSubmission) => Promise<void> | void;
  title: string;
  initialData?: VinylItem | null;
  autofillSuggestions?: VinylAutofillSuggestions;
  products?: VinylProduct[];
}

export const VinylModal: React.FC<VinylModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  initialData,
  autofillSuggestions,
  products
}) => {
  const { showWarning } = useAlert();
  const [formData, setFormData] = useState<VinylFormState>({
    brand: '',
    series: '',
    colour_number: '',
    colour_name: '',
    width: '',
    length_yards: '',
    location: '',
    disposition: 'in_stock',
    supplier_id: '',
    purchase_date: '',
    storage_date: getTodayString(),
    notes: ''
  });

  const [availableSuppliers, setAvailableSuppliers] = useState<SupplierSummary[]>([]);
  const [availableOrders, setAvailableOrders] = useState<{ order_id: number; order_number: number; order_name?: string; customer_name?: string }[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      loadOrders();

      if (initialData) {
        setFormData({
          brand: initialData.brand || '',
          series: initialData.series || '',
          colour_number: initialData.colour_number || '',
          colour_name: initialData.colour_name || '',
          width: initialData.width?.toString() || '',
          length_yards: initialData.length_yards?.toString() || '',
          location: initialData.location || '',
          disposition: initialData.disposition || 'in_stock',
          supplier_id: initialData.supplier_id?.toString() || '',
          purchase_date: initialData.purchase_date ? new Date(initialData.purchase_date).toISOString().split('T')[0] : '',
          storage_date: initialData.storage_date ? new Date(initialData.storage_date).toISOString().split('T')[0] : getTodayString(),
          notes: initialData.notes || ''
        });

        // Load existing order associations for editing
        if (initialData.id) {
          loadExistingOrderAssociations(initialData.id);
        }
      } else {
        // Reset form for new item
        setFormData({
          brand: '',
          series: '',
          colour_number: '',
          colour_name: '',
          width: '',
          length_yards: '',
          location: '',
          disposition: 'in_stock',
          supplier_id: '',
          purchase_date: '',
          storage_date: getTodayString(),
          notes: ''
        });
        setSelectedOrders([]);
      }
    }
  }, [isOpen, initialData]);

  const loadSuppliers = async () => {
    try {
      const suppliers = await suppliersApi.getSuppliers({ active_only: true }) as SupplierSummary[];
      setAvailableSuppliers(suppliers || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      setAvailableSuppliers([]);
    }
  };

  const loadOrders = async () => {
    try {
      const orders = await ordersApi.getOrders({});
      setAvailableOrders(orders || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      setAvailableOrders([]);
    }
  };

  const loadExistingOrderAssociations = async (vinylId: number) => {
    try {
      // Use the main vinyl endpoint which now returns unified order_associations
      const vinylData = await vinylApi.getVinylItem(vinylId);
      const orderIds = vinylData.order_associations?.map((link: { order_id: number }) => link.order_id) || [];
      setSelectedOrders(orderIds);
    } catch (error) {
      console.error('Error loading order associations:', error);
      setSelectedOrders([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Custom validation: either colour_number or colour_name must be provided
    if (!formData.colour_number && !formData.colour_name) {
      showWarning('Please provide either a Color Number or Color Name (or both).');
      return;
    }

    setLoading(true);

    try {
      const submitData: VinylFormSubmission = {
        ...formData,
        width: parseFloat(formData.width) || 0,
        length_yards: parseFloat(formData.length_yards) || 0,
        supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : null,
        order_ids: selectedOrders
      };

      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Error submitting vinyl:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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

      // Auto-populate the corresponding color field when brand, series, and one color field are selected
      if (newData.brand && newData.series && autofillSuggestions?.combinations) {
        const matchingCombination = autofillSuggestions.combinations.find((combo: VinylAutofillCombination) => 
          combo.brand === newData.brand && 
          combo.series === newData.series &&
          (
            (field === 'colour_number' && combo.colour_number === value) ||
            (field === 'colour_name' && combo.colour_name === value)
          )
        );

        if (matchingCombination) {
          // Auto-populate the other color field if it's empty
          if (field === 'colour_number' && !newData.colour_name && matchingCombination.colour_name) {
            newData.colour_name = matchingCombination.colour_name;
          } else if (field === 'colour_name' && !newData.colour_number && matchingCombination.colour_number) {
            newData.colour_number = matchingCombination.colour_number;
          }
        }
      }

      // Auto-populate width when we have a complete product combination
      if (newData.brand && newData.series && (newData.colour_number || newData.colour_name) && products) {
        const matchingProduct = products.find((product) => {
          const basicMatch = product.brand === newData.brand &&
                            product.series === newData.series &&
                            product.is_active;

          if (!basicMatch) return false;

          // Match using new fields or fallback to old field
          if (newData.colour_number && newData.colour_name) {
            // Both fields provided - match both
            return (product.colour_number === newData.colour_number && 
                   product.colour_name === newData.colour_name) ||
                   (product.colour === `${newData.colour_number} ${newData.colour_name}`);
          } else if (newData.colour_number) {
            // Only number provided
            return product.colour_number === newData.colour_number ||
                   product.colour?.startsWith(newData.colour_number);
          } else if (newData.colour_name) {
            // Only name provided
            return product.colour_name === newData.colour_name ||
                   product.colour?.includes(newData.colour_name);
          }
          
          return false;
        });

        if (matchingProduct) {
          // Only set width if it's currently empty (don't overwrite user input)
          if (!newData.width && matchingProduct.default_width) {
            newData.width = matchingProduct.default_width.toString();
          }
        }
      }

      return newData;
    });
  };

  const handleOrderSelection = (orderId: number) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const removeOrder = (orderId: number) => {
    setSelectedOrders(prev => prev.filter(id => id !== orderId));
  };

  const getSuggestions = (field: 'brand' | 'series' | 'colour_number' | 'colour_name') => {
    if (!autofillSuggestions?.combinations) return [];

    let filtered = [...autofillSuggestions.combinations];
    
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
      // Use the separate colour_number field from backend
      values = [...new Set(filtered.map((combo) => combo.colour_number).filter(Boolean))];
    } else if (field === 'colour_name') {
      // Use the separate colour_name field from backend
      values = [...new Set(filtered.map((combo) => combo.colour_name).filter(Boolean))];
    } else {
      // For brand, series
      values = [...new Set(filtered.map((combo) => combo[field] as string | undefined).filter(Boolean))];
    }
    
    return values.sort();
  };

  // Shared input classes for consistent styling
  const inputClass = `w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder} rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`;
  const labelClass = `block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className={`relative top-8 mx-auto p-5 border ${PAGE_STYLES.panel.border} w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md ${PAGE_STYLES.panel.background}`}>
        <div className={`flex justify-between items-center mb-4 pb-4 border-b ${PAGE_STYLES.panel.border}`}>
          <h3 className={`text-lg font-bold ${PAGE_STYLES.panel.text}`}>{title}</h3>
          <button
            onClick={onClose}
            className={`${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.text}`}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Information */}
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
              <AutofillComboBox
                label="Color Number"
                value={formData.colour_number}
                onChange={(value) => handleAutofillChange('colour_number', value)}
                suggestions={getSuggestions('colour_number')}
                placeholder="e.g. 807, 123A"
                className="w-full"
              />
            </div>

            <div>
              <AutofillComboBox
                label="Color Name"
                value={formData.colour_name}
                onChange={(value) => handleAutofillChange('colour_name', value)}
                suggestions={getSuggestions('colour_name')}
                placeholder="e.g. Unknown Color, Bright Red"
                className="w-full"
              />
            </div>
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Width (inches) *
              </label>
              <input
                type="number"
                name="width"
                value={formData.width}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Length (yards) *
              </label>
              <input
                type="number"
                name="length_yards"
                value={formData.length_yards}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                className={inputClass}
              />
            </div>
          </div>

          {/* Additional Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Status *
              </label>
              <select
                name="disposition"
                value={formData.disposition}
                onChange={handleChange}
                required
                className={inputClass}
              >
                <option value="in_stock">In Stock</option>
                <option value="used">Used</option>
                <option value="waste">Waste</option>
                <option value="returned">Returned</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Supplier
              </label>
              <select
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Select Supplier (Optional)</option>
                {availableSuppliers.map((supplier) => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Purchase Date
              </label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Storage Date
              </label>
              <input
                type="date"
                name="storage_date"
                value={formData.storage_date}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          {/* Order Associations */}
          <div>
            <label className={`${labelClass} mb-2`}>
              Associated Orders
            </label>

            {/* Selected Orders */}
            {selectedOrders.length > 0 && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-2">
                  {selectedOrders.map(orderId => {
                    const order = availableOrders.find(o => o.order_id === orderId);
                    return order ? (
                      <div key={orderId} className={`${MODULE_COLORS.vinyls.light} ${MODULE_COLORS.vinyls.text} px-3 py-1 rounded-md text-sm flex items-center gap-2`}>
                        <span>{order.order_number} - {order.order_name || 'No Name'}</span>
                        <button
                          type="button"
                          onClick={() => removeOrder(orderId)}
                          className={`${MODULE_COLORS.vinyls.text} hover:text-purple-800 ml-1`}
                        >
                          ×
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Order Selection Dropdown */}
            <select
              onChange={(e) => {
                const orderId = parseInt(e.target.value);
                if (orderId && !selectedOrders.includes(orderId)) {
                  handleOrderSelection(orderId);
                }
                e.target.value = '';
              }}
              className={inputClass}
            >
              <option value="">Select order to associate...</option>
              {availableOrders
                .filter(order => !selectedOrders.includes(order.order_id))
                .map(order => (
                  <option key={order.order_id} value={order.order_id}>
                    {order.order_number} - {order.order_name || 'No Name'}
                    {order.customer_name && ` (${order.customer_name})`}
                  </option>
                ))
              }
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className={inputClass}
              placeholder="Job name, condition, etc."
            />
          </div>

          {/* Buttons */}
          <div className={`flex justify-end space-x-3 pt-4 mt-4 border-t ${PAGE_STYLES.panel.border}`}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2 border ${PAGE_STYLES.panel.border} rounded-md text-sm font-medium ${PAGE_STYLES.panel.text} ${PAGE_STYLES.header.background} hover:bg-gray-500 disabled:opacity-50`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${MODULE_COLORS.vinyls.base} ${MODULE_COLORS.vinyls.hover} disabled:opacity-50`}
            >
              {loading ? 'Saving...' : (initialData ? 'Update' : 'Add')} Vinyl
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
