/**
 * PaintingMatrixManager - Configure painting tasks by product type, component, and timing
 * Grid-based editor for assigning task numbers to matrix cells
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Grid3X3, X, Check, Minus } from 'lucide-react';
import { settingsApi, PaintingMatrixEntry, ProductType, TaskDefinition } from '../../services/api/settings';
import { Notification } from '../inventory/Notification';

// =============================================================================
// Matrix Cell Editor Modal
// =============================================================================

interface CellEditorProps {
  entry: PaintingMatrixEntry;
  tasks: TaskDefinition[];
  onSave: (matrixId: number, taskNumbers: number[] | null) => Promise<boolean>;
  onClose: () => void;
  saving?: boolean;
}

const CellEditor: React.FC<CellEditorProps> = ({ entry, tasks, onSave, onClose, saving = false }) => {
  const [selectedTasks, setSelectedTasks] = useState<number[]>(entry.task_numbers || []);

  const toggleTask = (taskId: number) => {
    setSelectedTasks(prev =>
      prev.includes(taskId) ? prev.filter(t => t !== taskId) : [...prev, taskId].sort((a, b) => a - b)
    );
  };

  const handleSave = async () => {
    const taskNumbers = selectedTasks.length > 0 ? selectedTasks : null;
    const success = await onSave(entry.matrix_id, taskNumbers);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Edit Matrix Cell</h3>
              <p className="text-sm text-gray-500 mt-1">
                {entry.component} × {entry.timing}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">Select tasks to assign to this cell:</p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {tasks.filter(t => t.is_active).map(task => (
                <button
                  key={task.task_id}
                  onClick={() => toggleTask(task.task_id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                    selectedTasks.includes(task.task_id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-200 text-xs font-bold flex items-center justify-center">
                      {task.task_id}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{task.task_name}</span>
                  </div>
                  {selectedTasks.includes(task.task_id) && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Selected: </span>
              <span className="text-sm font-medium">
                {selectedTasks.length > 0 ? selectedTasks.join(', ') : 'None'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
            <button onClick={() => setSelectedTasks([])} disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Clear All
            </button>
            <button onClick={onClose} disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Matrix Cell Component
// =============================================================================

interface MatrixCellProps {
  entry: PaintingMatrixEntry;
  onClick: () => void;
}

const MatrixCell: React.FC<MatrixCellProps> = ({ entry, onClick }) => {
  const hasTaskNumbers = entry.task_numbers && entry.task_numbers.length > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full h-full min-h-[60px] p-2 rounded border transition-all text-center ${
        hasTaskNumbers
          ? 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400'
          : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'
      }`}
    >
      {hasTaskNumbers ? (
        <div className="flex flex-wrap gap-1 justify-center">
          {entry.task_numbers!.map(num => (
            <span key={num} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">
              {num}
            </span>
          ))}
        </div>
      ) : (
        <Minus className="w-4 h-4 text-gray-400 mx-auto" />
      )}
    </button>
  );
};

// =============================================================================
// Main PaintingMatrixManager Component
// =============================================================================

export const PaintingMatrixManager: React.FC = () => {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [selectedProductType, setSelectedProductType] = useState<string>('');
  const [matrixEntries, setMatrixEntries] = useState<PaintingMatrixEntry[]>([]);
  const [tasks, setTasks] = useState<TaskDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<PaintingMatrixEntry | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; show: boolean }>({
    message: '', type: 'success', show: false
  });

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type, show: true });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
  }, []);

  // Load product types and tasks
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [typesData, tasksData] = await Promise.all([
        settingsApi.getProductTypes(),
        settingsApi.getTasks()
      ]);
      setProductTypes(typesData);
      setTasks(tasksData);
      if (typesData.length > 0) {
        setSelectedProductType(typesData[0].product_type_key);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError('Failed to load product types');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load matrix for selected product type
  const loadMatrix = useCallback(async () => {
    if (!selectedProductType) return;
    try {
      setLoadingMatrix(true);
      const data = await settingsApi.getPaintingMatrix(selectedProductType);
      setMatrixEntries(data);
    } catch (err) {
      console.error('Failed to load matrix:', err);
      setError('Failed to load painting matrix');
    } finally {
      setLoadingMatrix(false);
    }
  }, [selectedProductType]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);
  useEffect(() => { loadMatrix(); }, [loadMatrix]);

  const handleSaveCell = async (matrixId: number, taskNumbers: number[] | null): Promise<boolean> => {
    setSaving(true);
    try {
      await settingsApi.updatePaintingMatrixEntry(matrixId, taskNumbers);
      setMatrixEntries(prev => prev.map(e =>
        e.matrix_id === matrixId ? { ...e, task_numbers: taskNumbers } : e
      ));
      showNotification('Matrix cell updated', 'success');
      return true;
    } catch {
      showNotification('Failed to update matrix cell', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Build matrix structure
  const components = [...new Set(matrixEntries.map(e => e.component))];
  const timings = [...new Set(matrixEntries.map(e => e.timing))];

  const getEntry = (component: string, timing: string) =>
    matrixEntries.find(e => e.component === component && e.timing === timing);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Painting Matrix</h2>
              <p className="text-sm text-gray-500 mt-1">Configure which tasks apply to each component and timing combination</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedProductType}
                onChange={(e) => setSelectedProductType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white min-w-[200px]"
                disabled={loading}
              >
                {productTypes.map(pt => (
                  <option key={pt.product_type_key} value={pt.product_type_key}>
                    {pt.product_type}
                  </option>
                ))}
              </select>
              <button onClick={loadMatrix} disabled={loadingMatrix}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <RefreshCw className={`w-5 h-5 ${loadingMatrix ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Matrix Grid */}
        <div className="p-6">
          {loadingMatrix ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : matrixEntries.length === 0 ? (
            <div className="text-center py-12">
              <Grid3X3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No matrix data for this product type.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-3 bg-gray-100 border border-gray-200 text-left text-xs font-medium text-gray-500 uppercase w-40">
                      Component / Timing
                    </th>
                    {timings.map(timing => (
                      <th key={timing} className="p-3 bg-gray-100 border border-gray-200 text-center text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                        {timing}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {components.map(component => (
                    <tr key={component}>
                      <td className="p-3 bg-gray-50 border border-gray-200 font-medium text-sm text-gray-700">
                        {component}
                      </td>
                      {timings.map(timing => {
                        const entry = getEntry(component, timing);
                        return (
                          <td key={timing} className="p-2 border border-gray-200">
                            {entry ? (
                              <MatrixCell entry={entry} onClick={() => setEditingEntry(entry)} />
                            ) : (
                              <div className="text-center text-gray-400 text-xs">N/A</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          {matrixEntries.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Task Legend</h4>
              <div className="flex flex-wrap gap-3">
                {tasks.filter(t => t.is_active).map(task => (
                  <div key={task.task_id} className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">
                      {task.task_id}
                    </span>
                    <span className="text-sm text-gray-600">{task.task_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cell Editor Modal */}
      {editingEntry && (
        <CellEditor
          entry={editingEntry}
          tasks={tasks}
          onSave={handleSaveCell}
          onClose={() => setEditingEntry(null)}
          saving={saving}
        />
      )}

      <Notification
        message={notification.message}
        type={notification.type}
        show={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default PaintingMatrixManager;
