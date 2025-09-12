import React from 'react';

interface BulkEditModalProps {
  selectedEntries: number[];
  bulkEditValues: {
    clock_in?: string;
    clock_out?: string;
    break_minutes?: number;
  };
  onBulkEditValuesChange: (values: any) => void;
  onApplyChanges: () => void;
  onClose: () => void;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  selectedEntries,
  bulkEditValues,
  onBulkEditValuesChange,
  onApplyChanges,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            Bulk Edit {selectedEntries.length} Entries
          </h3>
        </div>
        
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clock In (Leave empty to keep current)
            </label>
            <input
              type="datetime-local"
              value={bulkEditValues.clock_in || ''}
              onChange={(e) => onBulkEditValuesChange({ ...bulkEditValues, clock_in: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clock Out (Leave empty to keep current)
            </label>
            <input
              type="datetime-local"
              value={bulkEditValues.clock_out || ''}
              onChange={(e) => onBulkEditValuesChange({ ...bulkEditValues, clock_out: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Break Minutes (Leave empty to keep current)
            </label>
            <input
              type="number"
              min="0"
              max="480"
              placeholder="e.g. 30"
              value={bulkEditValues.break_minutes || ''}
              onChange={(e) => onBulkEditValuesChange({ 
                ...bulkEditValues, 
                break_minutes: e.target.value ? Number(e.target.value) : undefined 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onApplyChanges}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};