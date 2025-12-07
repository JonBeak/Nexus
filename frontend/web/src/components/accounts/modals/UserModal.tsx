import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { AccountUser } from '../../../types/user';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: AccountUser | null;
  users?: AccountUser[];
  onSave: (userData: AccountUser) => void;
  currentUser: AccountUser;
}

export const UserModal: React.FC<UserModalProps> = ({ 
  isOpen, 
  onClose, 
  user,
  users = [], 
  onSave,
  currentUser
}) => {
  const [formData, setFormData] = useState<AccountUser>({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'production_staff',
    user_group: '',
    hourly_wage: undefined,
    is_active: true,
    show_in_time_calendar: true,
    auto_clock_in: '',
    auto_clock_out: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [groupType, setGroupType] = useState<'Group A' | 'Group B' | 'custom'>('Group A');
  const [customGroup, setCustomGroup] = useState('');

  // Check if this user is the last active owner
  const isLastActiveOwner = (): boolean => {
    if (!user || user.role !== 'owner' || !user.is_active) return false;
    const activeOwners = users.filter(u => u.role === 'owner' && u.is_active);
    return activeOwners.length === 1 && activeOwners[0].user_id === user.user_id;
  };

  useEffect(() => {
    if (user) {
      const userGroup = user.user_group || '';
      setFormData({
        ...user,
        user_group: userGroup,
        hourly_wage: user.hourly_wage || undefined,
        show_in_time_calendar: user.show_in_time_calendar,
        auto_clock_in: user.auto_clock_in || '',
        auto_clock_out: user.auto_clock_out || ''
      });
      
      // Set group type and custom group based on user_group value
      if (userGroup === 'Group A') {
        setGroupType('Group A');
        setCustomGroup('');
      } else if (userGroup === 'Group B') {
        setGroupType('Group B');
        setCustomGroup('');
      } else {
        setGroupType('custom');
        setCustomGroup(userGroup);
      }
    } else {
      setFormData({
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        role: 'production_staff',
        user_group: '',
        hourly_wage: undefined,
        is_active: true,
        show_in_time_calendar: true,
        auto_clock_in: '',
        auto_clock_out: ''
      });
      setGroupType('Group A');
      setCustomGroup('');
      setPassword('');
      setConfirmPassword('');
    }
    setErrors({});
  }, [user, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }
    
    if (!user) { // Creating new user
      if (!password.trim()) {
        newErrors.password = 'Password is required';
      } else if (password.length < 3) {
        newErrors.password = 'Password must be at least 3 characters';
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const userData: AccountUser = { ...formData };
      if (!user) {
        userData.password = password;
        // Generate default email from username since backend still requires it
        userData.email = `${formData.username}@company.com`;
      }
      onSave(userData);
    }
  };

  const handleInputChange = <K extends keyof AccountUser>(field: K, value: AccountUser[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleGroupTypeChange = (type: 'Group A' | 'Group B' | 'custom') => {
    setGroupType(type);
    if (type === 'Group A') {
      setFormData(prev => ({ ...prev, user_group: 'Group A' }));
      setCustomGroup('');
    } else if (type === 'Group B') {
      setFormData(prev => ({ ...prev, user_group: 'Group B' }));
      setCustomGroup('');
    } else {
      // For custom, keep current customGroup value or empty string
      setFormData(prev => ({ ...prev, user_group: customGroup }));
    }
  };

  const handleCustomGroupChange = (value: string) => {
    setCustomGroup(value);
    if (groupType === 'custom') {
      setFormData(prev => ({ ...prev, user_group: value }));
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'Edit User' : 'Create New User'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Username *
          </label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.username ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.username && (
            <p className="text-red-500 text-sm mt-1">{errors.username}</p>
          )}
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => handleInputChange('first_name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.first_name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.first_name && (
              <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => handleInputChange('last_name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.last_name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.last_name && (
              <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>
            )}
          </div>
        </div>

        {/* Password fields for new users */}
        {!user && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>
          </div>
        )}

        {/* Role and Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => handleInputChange('role', e.target.value as AccountUser['role'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="production_staff">Production Staff</option>
              <option value="designer">Designer</option>
              <option value="manager">Manager</option>
              {currentUser.role === 'owner' && <option value="owner">Owner</option>}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={formData.is_active ? 'active' : 'inactive'}
              onChange={(e) => handleInputChange('is_active', e.target.value === 'active')}
              disabled={isLastActiveOwner() && formData.is_active}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isLastActiveOwner() && formData.is_active ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            >
              <option value="active">Active</option>
              <option value="inactive" disabled={isLastActiveOwner()}>
                Inactive
              </option>
            </select>
            {isLastActiveOwner() && (
              <p className="text-amber-600 text-sm mt-1">
                ⚠️ Cannot deactivate the last owner account. At least one owner must remain active.
              </p>
            )}
          </div>
        </div>

        {/* Time Calendar Visibility */}
        <div className="col-span-2">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.show_in_time_calendar}
              onChange={(e) => handleInputChange('show_in_time_calendar', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Show in Time Tracking Calendar
              </span>
              <p className="text-xs text-gray-500">
                When enabled, this user will appear in the Bi-Weekly Time Calendar for managers
              </p>
            </div>
          </label>
        </div>

        {/* Group */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Group
          </label>
          <div className="space-y-3">
            {/* Group Type Selection */}
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="groupType"
                  value="Group A"
                  checked={groupType === 'Group A'}
                  onChange={(e) => handleGroupTypeChange(e.target.value as 'Group A')}
                  className="mr-2"
                />
                Group A
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="groupType"
                  value="Group B"
                  checked={groupType === 'Group B'}
                  onChange={(e) => handleGroupTypeChange(e.target.value as 'Group B')}
                  className="mr-2"
                />
                Group B
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="groupType"
                  value="custom"
                  checked={groupType === 'custom'}
                  onChange={() => handleGroupTypeChange('custom')}
                  className="mr-2"
                />
                Custom
              </label>
            </div>
            
            {/* Custom Group Text Input */}
            {groupType === 'custom' && (
              <div>
                <input
                  type="text"
                  value={customGroup}
                  onChange={(e) => handleCustomGroupChange(e.target.value)}
                  placeholder="Enter custom group name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
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
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {user ? 'Update User' : 'Create User'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
