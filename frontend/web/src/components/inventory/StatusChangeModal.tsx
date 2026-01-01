import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { jobsApi } from '../../services/api';
import { AutofillComboBox } from '../common/AutofillComboBox';
import { JobSuggestion, StatusChangePayload, VinylItem } from './types';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';

interface StatusChangeFormState {
  disposition: StatusChangePayload['disposition'];
  status_change_date: string;
  notes: string;
  jobs: string[];
  job_ids: number[];
}

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StatusChangePayload) => Promise<void> | void;
  item: VinylItem | null;
}

export const StatusChangeModal: React.FC<StatusChangeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  item
}) => {
  const [formData, setFormData] = useState<StatusChangeFormState>({
    disposition: 'in_stock',
    status_change_date: new Date().toISOString().split('T')[0],
    notes: '',
    jobs: [''],
    job_ids: []
  });

  const [loading, setLoading] = useState(false);
  const [jobSuggestions, setJobSuggestions] = useState<JobSuggestion[]>([]);

  useEffect(() => {
    if (isOpen && item) {
      setFormData({
        disposition: item.disposition || 'in_stock',
        status_change_date: new Date().toISOString().split('T')[0],
        notes: item.notes || '',
        jobs: [''],
        job_ids: []
      });
      loadJobSuggestions();
    }
  }, [isOpen, item]);

  const loadJobSuggestions = async () => {
    try {
      const jobs = await jobsApi.getJobs({ active_only: true }) as JobSuggestion[];
      setJobSuggestions(jobs || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
      setJobSuggestions([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    setLoading(true);
    try {
      const submitData: StatusChangePayload = {
        ...formData,
        job_ids: formData.job_ids.filter(id => id > 0)
      };

      await onSubmit({
        vinyl_id: item.id,
        disposition: submitData.disposition,
        status_change_date: submitData.status_change_date,
        notes: submitData.notes,
        job_ids: submitData.job_ids
      });
      onClose();
    } catch (error) {
      console.error('Error changing item status:', error);
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

  const handleJobChange = (index: number, value: string) => {
    const newJobs = [...formData.jobs];
    newJobs[index] = value;
    setFormData(prev => ({ ...prev, jobs: newJobs }));

    // If this is the last job field and it has content, add a new empty field
    if (index === formData.jobs.length - 1 && value.trim()) {
      setFormData(prev => ({
        ...prev,
        jobs: [...prev.jobs, '']
      }));
    }
  };

  const handleJobSelect = (index: number, selectedValue: string) => {
    // Parse job ID from the selected value (format: "123 - Job Title")
    const jobIdMatch = selectedValue.match(/^(\d+)\s*-/);
    const jobId = jobIdMatch ? parseInt(jobIdMatch[1], 10) : 0;
    
    if (jobId > 0) {
      const newJobs = [...formData.jobs];
      const newJobIds = [...formData.job_ids];
      
      newJobs[index] = selectedValue;
      if (!newJobIds.includes(jobId)) {
        newJobIds.push(jobId);
      }

      setFormData(prev => ({
        ...prev,
        jobs: newJobs,
        job_ids: newJobIds
      }));

      // Add new field if this was the last one
      if (index === formData.jobs.length - 1) {
        setFormData(prev => ({
          ...prev,
          jobs: [...prev.jobs, '']
        }));
      }
    }
  };

  const removeJobField = (index: number) => {
    if (formData.jobs.length <= 1) return;
    
    const newJobs = formData.jobs.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, jobs: newJobs }));
  };

  // Get note prefix suggestion based on disposition
  const getNotePlaceholder = (disposition: string) => {
    switch (disposition) {
      case 'used':
        return 'Usage note: ';
      case 'waste':
        return 'Waste reason: ';
      case 'returned':
        return 'Return note: ';
      case 'damaged':
        return 'Damage reason: ';
      default:
        return '';
    }
  };

  // Smart note prefix - add prefix if changing disposition and notes don't already have it
  const handleDispositionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDisposition = e.target.value;
    const prefix = getNotePlaceholder(newDisposition);
    
    setFormData(prev => {
      let newNotes = prev.notes;
      
      // If changing disposition and we have a prefix suggestion
      if (prefix && newDisposition !== item?.disposition) {
        // Check if notes already start with the prefix or are empty
        if (newNotes && !newNotes.startsWith(prefix)) {
          newNotes = prefix + newNotes;
        } else if (!newNotes) {
          newNotes = prefix;
        }
      }
      
      return {
        ...prev,
        disposition: newDisposition,
        notes: newNotes
      };
    });
  };

  // Shared input classes for consistent styling
  const inputClass = `w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder} rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`;
  const labelClass = `block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`;

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className={`relative top-8 mx-auto p-5 border ${PAGE_STYLES.panel.border} w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md ${PAGE_STYLES.panel.background}`}>
        <div className={`flex justify-between items-center mb-4 pb-4 border-b ${PAGE_STYLES.panel.border}`}>
          <h3 className={`text-lg font-bold ${PAGE_STYLES.panel.text}`}>Change Item Status</h3>
          <button
            onClick={onClose}
            className={`${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.text}`}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Item Details */}
        <div className={`${PAGE_STYLES.header.background} rounded-lg p-4 mb-4 border ${PAGE_STYLES.panel.border}`}>
          <h4 className={`font-medium ${PAGE_STYLES.panel.text} mb-2`}>Item Details</h4>
          <div className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>
            <p><strong>Product:</strong> {item.brand} {item.series} {item.colour}</p>
            <p><strong>Dimensions:</strong> {item.width}" × {item.length_yards} yds</p>
            <p><strong>Location:</strong> {item.location || 'Not specified'}</p>
            <p><strong>Current Status:</strong> {item.disposition}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Status Dropdown */}
          <div>
            <label className={labelClass}>
              Status *
            </label>
            <select
              name="disposition"
              value={formData.disposition}
              onChange={handleDispositionChange}
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

          {/* Status Change Date */}
          <div>
            <label className={labelClass}>
              Date *
            </label>
            <input
              type="date"
              name="status_change_date"
              value={formData.status_change_date}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          {/* Jobs */}
          <div>
            <label className={`${labelClass} mb-2`}>
              Associated Jobs
            </label>
            <div className="space-y-2">
              {formData.jobs.map((job, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="flex-1">
                    <AutofillComboBox
                      label=""
                      value={job}
                      onChange={(value) => {
                        handleJobChange(index, value);
                        // Check if the value matches a suggestion and trigger selection
                        const matchingSuggestion = jobSuggestions.find(j =>
                          `${j.job_number} - ${j.job_title}` === value
                        );
                        if (matchingSuggestion) {
                          handleJobSelect(index, value);
                        }
                      }}
                      suggestions={jobSuggestions.map(j => `${j.job_number} - ${j.job_title}`)}
                      placeholder="Search jobs..."
                      className="w-full"
                    />
                  </div>
                  {formData.jobs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeJobField(index)}
                      className="p-2 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
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
              rows={4}
              className={inputClass}
              placeholder={`Enter notes... ${getNotePlaceholder(formData.disposition)}`}
            />
            {item.notes && item.notes !== formData.notes && (
              <div className={`text-xs ${PAGE_STYLES.panel.textMuted} mt-1`}>
                <strong>Previous notes:</strong> {item.notes}
              </div>
            )}
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
              {loading ? 'Updating Status...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
