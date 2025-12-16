/**
 * SpecificationOptionsManager - Main component for managing specification dropdown options
 * Combines category selector, options list, add form, and edit modal
 */

import React, { useState, useCallback } from 'react';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { useSpecificationOptions } from '../../hooks/useSpecificationOptions';
import { EditableOptionsList } from './EditableOptionsList';
import { EditOptionModal } from './EditOptionModal';
import { Notification } from '../inventory/Notification';
import { SpecificationOption } from '../../services/api/settings';

export const SpecificationOptionsManager: React.FC = () => {
  // Hook for managing specification options state
  const {
    categories,
    selectedCategory,
    setSelectedCategory,
    options,
    loading,
    loadingOptions,
    saving,
    error,
    addOption,
    updateOption,
    deactivateOption,
    reorderOptions,
    refreshOptions
  } = useSpecificationOptions();

  // Local state
  const [editingOption, setEditingOption] = useState<SpecificationOption | null>(null);
  const [newOptionValue, setNewOptionValue] = useState('');
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
    show: boolean;
  }>({
    message: '',
    type: 'success',
    show: false
  });

  // Show notification helper
  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type, show: true });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 5000);
  }, []);

  // Handle add option
  const handleAddOption = async () => {
    const trimmedValue = newOptionValue.trim();
    if (!trimmedValue) return;

    const success = await addOption(trimmedValue);
    if (success) {
      setNewOptionValue('');
      showNotification('Option added successfully', 'success');
    } else {
      showNotification('Failed to add option', 'error');
    }
  };

  // Handle update option
  const handleUpdateOption = async (optionId: number, newValue: string): Promise<boolean> => {
    const success = await updateOption(optionId, { option_value: newValue });
    if (success) {
      showNotification('Option updated successfully', 'success');
    } else {
      showNotification('Failed to update option', 'error');
    }
    return success;
  };

  // Handle deactivate option
  const handleDeactivate = async (optionId: number) => {
    const success = await deactivateOption(optionId);
    if (success) {
      showNotification('Option deactivated', 'success');
    } else {
      showNotification('Failed to deactivate option', 'error');
    }
  };

  // Handle reorder
  const handleReorder = async (newOrder: SpecificationOption[]) => {
    const success = await reorderOptions(newOrder);
    if (!success) {
      showNotification('Failed to save new order', 'error');
    }
    // No success notification for reorder to avoid spam during drag operations
  };

  // Get selected category display name
  const selectedCategoryData = categories.find(c => c.category === selectedCategory);

  // Initial loading state
  if (loading && categories.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                Specification Options
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Manage dropdown options that appear in order specifications
              </p>
            </div>

            {/* Category Selector */}
            <div className="flex items-center gap-3">
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[250px]"
                disabled={loading}
              >
                {categories.map(cat => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category_display_name} ({cat.count})
                  </option>
                ))}
              </select>

              <button
                onClick={refreshOptions}
                disabled={loadingOptions}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh options"
              >
                <RefreshCw className={`w-5 h-5 ${loadingOptions ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Options List */}
        <div className="p-6">
          {loadingOptions ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <EditableOptionsList
                options={options}
                onEdit={setEditingOption}
                onDeactivate={handleDeactivate}
                onReorder={handleReorder}
                disabled={saving}
              />

              {/* Add New Option Form */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newOptionValue}
                    onChange={(e) => setNewOptionValue(e.target.value)}
                    placeholder="Enter new option value..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newOptionValue.trim()) {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                    disabled={saving || !selectedCategory}
                  />
                  <button
                    onClick={handleAddOption}
                    disabled={!newOptionValue.trim() || saving || !selectedCategory}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Option
                  </button>
                </div>
              </div>

              {/* Help Text */}
              <p className="mt-4 text-sm text-gray-500">
                Drag rows to reorder. Deactivated options won't appear in dropdowns.
                System options (marked with lock icon) cannot be deleted.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <EditOptionModal
        isOpen={!!editingOption}
        onClose={() => setEditingOption(null)}
        option={editingOption}
        onSave={handleUpdateOption}
        saving={saving}
      />

      {/* Notification */}
      <Notification
        message={notification.message}
        type={notification.type}
        show={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default SpecificationOptionsManager;
