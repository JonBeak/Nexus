import React, { useState } from 'react';

interface WeeklyEntry {
  entry_id: number;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number;
  status: string;
  request_id: number | null;
}

interface EditRequest {
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  reason: string;
}

interface DeleteRequest {
  reason: string;
}

interface EditRequestFormProps {
  selectedEntry: WeeklyEntry | null;
  showEditModal: boolean;
  showDeleteModal: boolean;
  editRequest: EditRequest | null;
  deleteRequest: DeleteRequest | null;
  onCloseEdit: () => void;
  onCloseDelete: () => void;
  onEditRequest: (e: React.FormEvent) => void;
  onDeleteRequest: (e: React.FormEvent) => void;
  onEditRequestChange: (field: string, value: any) => void;
  onDeleteRequestChange: (field: string, value: any) => void;
}

function EditRequestForm({
  selectedEntry,
  showEditModal,
  showDeleteModal,
  editRequest,
  deleteRequest,
  onCloseEdit,
  onCloseDelete,
  onEditRequest,
  onDeleteRequest,
  onEditRequestChange,
  onDeleteRequestChange
}: EditRequestFormProps) {
  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Edit Request Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Request Time Edit</h3>
            
            <form onSubmit={onEditRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Clock In</label>
                <input
                  type="datetime-local"
                  value={editRequest?.clockIn || ''}
                  onChange={(e) => onEditRequestChange('clockIn', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Clock Out</label>
                <input
                  type="datetime-local"
                  value={editRequest?.clockOut || ''}
                  onChange={(e) => onEditRequestChange('clockOut', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Break Minutes</label>
                <input
                  type="number"
                  value={editRequest?.breakMinutes || 0}
                  onChange={(e) => onEditRequestChange('breakMinutes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Reason for Edit</label>
                <textarea
                  value={editRequest?.reason || ''}
                  onChange={(e) => onEditRequestChange('reason', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  rows={3}
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onCloseEdit}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary-blue hover:bg-primary-blue-dark text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Request Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Request Time Entry Deletion</h3>
            
            {selectedEntry && (
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-gray-600 mb-2">Entry to be deleted:</p>
                <p className="font-semibold">
                  {formatDate(selectedEntry.clock_in)} - {formatTime(selectedEntry.clock_in)} to {formatTime(selectedEntry.clock_out)}
                </p>
                <p className="text-sm text-gray-600">
                  Total Hours: {selectedEntry.total_hours}, Break: {selectedEntry.break_minutes} minutes
                </p>
              </div>
            )}
            
            <form onSubmit={onDeleteRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Reason for Deletion</label>
                <textarea
                  value={deleteRequest?.reason || ''}
                  onChange={(e) => onDeleteRequestChange('reason', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="Please explain why this entry should be deleted..."
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onCloseDelete}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  Submit Delete Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default EditRequestForm;