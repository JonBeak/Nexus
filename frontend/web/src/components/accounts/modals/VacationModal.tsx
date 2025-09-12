import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';

interface User {
  user_id: number;
  first_name: string;
  last_name: string;
}

interface VacationPeriod {
  vacation_id?: number;
  user_id: number;
  start_date: string;
  end_date: string;
  description: string;
}

interface VacationModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  selectedUser?: User | null;
  vacation?: VacationPeriod | null;
  onSave: (vacationData: VacationPeriod) => void;
}

export const VacationModal: React.FC<VacationModalProps> = ({ 
  isOpen, 
  onClose, 
  users,
  selectedUser,
  vacation,
  onSave 
}) => {
  const [formData, setFormData] = useState<VacationPeriod>({
    user_id: 0,
    start_date: '',
    end_date: '',
    description: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (vacation) {
        // Editing existing vacation
        setFormData({
          vacation_id: vacation.vacation_id,
          user_id: vacation.user_id,
          start_date: vacation.start_date.split('T')[0], // Convert to YYYY-MM-DD format
          end_date: vacation.end_date.split('T')[0],
          description: vacation.description
        });
      } else {
        // Creating new vacation
        setFormData({
          user_id: selectedUser?.user_id || (users.length > 0 ? users[0].user_id : 0),
          start_date: '',
          end_date: '',
          description: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, vacation, selectedUser, users]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.user_id || formData.user_id === 0) {
      newErrors.user_id = 'Please select a user';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'End date is required';
    }

    if (formData.start_date && formData.end_date && 
        new Date(formData.start_date) > new Date(formData.end_date)) {
      newErrors.end_date = 'End date must be after start date';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  const handleInputChange = (field: keyof VacationPeriod, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getSelectedUser = () => {
    return users.find(u => u.user_id === formData.user_id);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const calculateDays = () => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
      return diffDays;
    }
    return 0;
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={vacation ? 'Edit Vacation Period' : 'Add Vacation Period'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* User Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Employee *
          </label>
          <select
            value={formData.user_id}
            onChange={(e) => handleInputChange('user_id', parseInt(e.target.value))}
            disabled={!!selectedUser || !!vacation}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.user_id ? 'border-red-500' : 'border-gray-300'
            } ${(!!selectedUser || !!vacation) ? 'bg-gray-100' : ''}`}
          >
            <option value={0}>Select an employee...</option>
            {users.map(user => (
              <option key={user.user_id} value={user.user_id}>
                {user.first_name} {user.last_name}
              </option>
            ))}
          </select>
          {errors.user_id && (
            <p className="text-red-500 text-sm mt-1">{errors.user_id}</p>
          )}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date *
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => handleInputChange('start_date', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.start_date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.start_date && (
              <p className="text-red-500 text-sm mt-1">{errors.start_date}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date *
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => handleInputChange('end_date', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.end_date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.end_date && (
              <p className="text-red-500 text-sm mt-1">{errors.end_date}</p>
            )}
          </div>
        </div>

        {/* Vacation Summary */}
        {formData.start_date && formData.end_date && calculateDays() > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-900">
                  Vacation Duration: {calculateDays()} day{calculateDays() !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-purple-700">
                  {formatDate(formData.start_date)} to {formatDate(formData.end_date)}
                </p>
              </div>
              {getSelectedUser() && (
                <div className="text-right">
                  <p className="text-sm font-medium text-purple-900">
                    {getSelectedUser()?.first_name} {getSelectedUser()?.last_name}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.description ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter vacation details (e.g., Annual leave, Personal time off, etc.)"
          />
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">{errors.description}</p>
          )}
        </div>

        {/* Info Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Time entries during this vacation period will automatically be marked as "Excused" absences.
          </p>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            {vacation ? 'Update Vacation' : 'Add Vacation'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
};