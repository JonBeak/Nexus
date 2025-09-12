import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { vinylApi, suppliersApi, jobsApi } from '../../services/api';
import { VinylItem } from './InventoryTab';
import { AutofillComboBox } from '../common/AutofillComboBox';

interface VinylModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  title: string;
  initialData?: VinylItem | null;
  autofillSuggestions?: any;
  products?: any[];
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
  const [formData, setFormData] = useState({
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
    storage_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [availableSuppliers, setAvailableSuppliers] = useState<any[]>([]);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      loadJobs();
      
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
          storage_date: initialData.storage_date ? new Date(initialData.storage_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          notes: initialData.notes || ''
        });
        
        // Load existing job associations for editing
        if (initialData.id) {
          loadExistingJobAssociations(initialData.id);
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
          storage_date: new Date().toISOString().split('T')[0],
          notes: ''
        });
        setSelectedJobs([]);
      }
    }
  }, [isOpen, initialData]);

  const loadSuppliers = async () => {
    try {
      const suppliers = await suppliersApi.getSuppliers({ active_only: true });
      setAvailableSuppliers(suppliers || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      setAvailableSuppliers([]);
    }
  };

  const loadJobs = async () => {
    try {
      const jobs = await jobsApi.getJobs({});
      setAvailableJobs(jobs || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
      setAvailableJobs([]);
    }
  };

  const loadExistingJobAssociations = async (vinylId: number) => {
    try {
      // Use the main vinyl endpoint which now returns unified job_associations
      const vinylData = await vinylApi.getVinylItem(vinylId);
      const jobIds = vinylData.job_associations?.map((link: any) => link.job_id) || [];
      setSelectedJobs(jobIds);
    } catch (error) {
      console.error('Error loading job associations:', error);
      setSelectedJobs([]);
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
      const submitData = {
        ...formData,
        width: parseFloat(formData.width) || 0,
        length_yards: parseFloat(formData.length_yards) || 0,
        supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : null,
        job_ids: selectedJobs
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

  const handleAutofillChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };

      // Auto-populate the corresponding color field when brand, series, and one color field are selected
      if (newData.brand && newData.series && autofillSuggestions?.combinations) {
        const matchingCombination = autofillSuggestions.combinations.find((combo: any) => 
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
        const matchingProduct = products.find((product: any) => {
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

  const handleJobSelection = (jobId: number) => {
    setSelectedJobs(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const removeJob = (jobId: number) => {
    setSelectedJobs(prev => prev.filter(id => id !== jobId));
  };

  const getSuggestions = (field: 'brand' | 'series' | 'colour_number' | 'colour_name') => {
    if (!autofillSuggestions?.combinations) return [];

    let filtered = autofillSuggestions.combinations;
    
    // Filter based on already selected values
    if (field === 'series' && formData.brand) {
      filtered = filtered.filter((combo: any) => combo.brand === formData.brand);
    } else if ((field === 'colour_number' || field === 'colour_name') && formData.brand && formData.series) {
      filtered = filtered.filter((combo: any) => 
        combo.brand === formData.brand && combo.series === formData.series
      );
    }
    
    // Extract unique values for the requested field
    let values: string[] = [];
    
    if (field === 'colour_number') {
      // Use the separate colour_number field from backend
      values = [...new Set(filtered.map((combo: any) => combo.colour_number).filter(Boolean))];
    } else if (field === 'colour_name') {
      // Use the separate colour_name field from backend
      values = [...new Set(filtered.map((combo: any) => combo.colour_name).filter(Boolean))];
    } else {
      // For brand, series
      values = [...new Set(filtered.map((combo: any) => combo[field]).filter(Boolean))];
    }
    
    return values.sort();
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Width (inches) *
              </label>
              <input
                type="number"
                name="width"
                value={formData.width}
                onChange={handleChange}
                required
                step="0.1"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Length (yards) *
              </label>
              <input
                type="number"
                name="length_yards"
                value={formData.length_yards}
                onChange={handleChange}
                required
                step="0.1"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Additional Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                name="disposition"
                value={formData.disposition}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="in_stock">In Stock</option>
                <option value="used">Used</option>
                <option value="waste">Waste</option>
                <option value="returned">Returned</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <select
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Storage Date
              </label>
              <input
                type="date"
                name="storage_date"
                value={formData.storage_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Job Associations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Associated Jobs
            </label>
            
            {/* Selected Jobs */}
            {selectedJobs.length > 0 && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-2">
                  {selectedJobs.map(jobId => {
                    const job = availableJobs.find(j => j.job_id === jobId);
                    return job ? (
                      <div key={jobId} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-md text-sm flex items-center gap-2">
                        <span>{job.job_number} - {job.job_name || 'No Name'}</span>
                        <button
                          type="button"
                          onClick={() => removeJob(jobId)}
                          className="text-purple-600 hover:text-purple-800 ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            
            {/* Job Selection Dropdown */}
            <select
              onChange={(e) => {
                const jobId = parseInt(e.target.value);
                if (jobId && !selectedJobs.includes(jobId)) {
                  handleJobSelection(jobId);
                }
                e.target.value = '';
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Select job to associate...</option>
              {availableJobs
                .filter(job => !selectedJobs.includes(job.job_id))
                .map(job => (
                  <option key={job.job_id} value={job.job_id}>
                    {job.job_number} - {job.job_name || 'No Name'} 
                    {job.customer_name && ` (${job.customer_name})`}
                  </option>
                ))
              }
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              placeholder="Job name, condition, etc."
            />
          </div>

          {/* Buttons */}
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
              {loading ? 'Saving...' : (initialData ? 'Update' : 'Add')} Vinyl
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};