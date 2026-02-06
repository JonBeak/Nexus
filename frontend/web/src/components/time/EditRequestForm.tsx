import React from 'react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { formatDate } from '../../utils/dateUtils';
import '../jobEstimation/JobEstimation.css';

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

type EditRequestField = keyof EditRequest;
type DeleteRequestField = keyof DeleteRequest;

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
  onEditRequestChange: <K extends EditRequestField>(field: K, value: EditRequest[K]) => void;
  onDeleteRequestChange: <K extends DeleteRequestField>(field: K, value: DeleteRequest[K]) => void;
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

  return (
    <>
      {/* Edit Request Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${PAGE_STYLES.panel.background} rounded-2xl shadow-2xl max-w-lg w-full p-8 border ${PAGE_STYLES.panel.border}`}>
            <h3 className={`text-2xl font-bold ${PAGE_STYLES.panel.text} mb-6`}>Request Time Edit</h3>

            <form onSubmit={onEditRequest} className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold ${PAGE_STYLES.panel.textSecondary} mb-2`}>Clock In</label>
                <input
                  type="datetime-local"
                  value={editRequest?.clockIn || ''}
                  onChange={(e) => onEditRequestChange('clockIn', e.target.value)}
                  className={`w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-500`}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-semibold ${PAGE_STYLES.panel.textSecondary} mb-2`}>Clock Out</label>
                <input
                  type="datetime-local"
                  value={editRequest?.clockOut || ''}
                  onChange={(e) => onEditRequestChange('clockOut', e.target.value)}
                  className={`w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-500`}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-semibold ${PAGE_STYLES.panel.textSecondary} mb-2`}>Break Minutes</label>
                <input
                  type="number"
                  value={editRequest?.breakMinutes || 0}
                  onChange={(e) => onEditRequestChange('breakMinutes', Number(e.target.value))}
                  className={`w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-500`}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-semibold ${PAGE_STYLES.panel.textSecondary} mb-2`}>Reason for Edit</label>
                <textarea
                  value={editRequest?.reason || ''}
                  onChange={(e) => onEditRequestChange('reason', e.target.value)}
                  className={`w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-500`}
                  rows={3}
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onCloseEdit}
                  className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.interactive.hover} ${PAGE_STYLES.panel.text} px-6 py-2 rounded-lg font-semibold transition-colors border ${PAGE_STYLES.panel.border}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
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
          <div className={`${PAGE_STYLES.panel.background} rounded-2xl shadow-2xl max-w-lg w-full p-8 border ${PAGE_STYLES.panel.border}`}>
            <h3 className={`text-2xl font-bold ${PAGE_STYLES.panel.text} mb-6`}>Request Time Entry Deletion</h3>

            {selectedEntry && (
              <div className={`${PAGE_STYLES.header.background} p-4 rounded-lg mb-6 border ${PAGE_STYLES.panel.border}`}>
                <p className={`text-sm ${PAGE_STYLES.panel.textSecondary} mb-2`}>Entry to be deleted:</p>
                <p className={`font-semibold ${PAGE_STYLES.panel.text}`}>
                  {formatDate(selectedEntry.clock_in)} - {formatTime(selectedEntry.clock_in)} to {formatTime(selectedEntry.clock_out)}
                </p>
                <p className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                  Total Hours: {selectedEntry.total_hours}, Break: {selectedEntry.break_minutes} minutes
                </p>
              </div>
            )}

            <form onSubmit={onDeleteRequest} className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold ${PAGE_STYLES.panel.textSecondary} mb-2`}>Reason for Deletion</label>
                <textarea
                  value={deleteRequest?.reason || ''}
                  onChange={(e) => onDeleteRequestChange('reason', e.target.value)}
                  className={`w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} rounded-md focus:outline-none focus:ring-1 focus:ring-red-500`}
                  rows={3}
                  placeholder="Please explain why this entry should be deleted..."
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onCloseDelete}
                  className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.interactive.hover} ${PAGE_STYLES.panel.text} px-6 py-2 rounded-lg font-semibold transition-colors border ${PAGE_STYLES.panel.border}`}
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
