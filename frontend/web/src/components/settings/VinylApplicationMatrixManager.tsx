/**
 * VinylApplicationMatrixManager - Configure vinyl tasks by product type and application
 * List-based editor for assigning task names to application entries
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Plus, X, Check, Minus, Layers } from 'lucide-react';
import { settingsApi, VinylMatrixEntry, ProductType, TaskDefinition } from '../../services/api/settings';
import { Notification } from '../inventory/Notification';

// Available vinyl-related tasks (these are the task_name values)
const VINYL_TASKS = [
  'Vinyl Plotting',
  'Vinyl Face Before Cutting',
  'Vinyl Face After Cutting',
  'Vinyl Wrap Return/Trim',
  'Vinyl after Fabrication'
];

// =============================================================================
// Cell Editor Modal
// =============================================================================

interface CellEditorProps {
  entry: VinylMatrixEntry;
  onSave: (matrixId: number, taskNames: string[]) => Promise<boolean>;
  onClose: () => void;
  saving?: boolean;
}

const CellEditor: React.FC<CellEditorProps> = ({ entry, onSave, onClose, saving = false }) => {
  const [selectedTasks, setSelectedTasks] = useState<string[]>(entry.task_names || []);

  const toggleTask = (taskName: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskName) ? prev.filter(t => t !== taskName) : [...prev, taskName]
    );
  };

  const handleSave = async () => {
    const success = await onSave(entry.matrix_id, selectedTasks);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Edit Tasks</h3>
              <p className="text-sm text-gray-500 mt-1">{entry.application}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">Select tasks to generate for this application:</p>
            <div className="space-y-2">
              {VINYL_TASKS.map(taskName => (
                <button
                  key={taskName}
                  onClick={() => toggleTask(taskName)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                    selectedTasks.includes(taskName)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-medium text-gray-900">{taskName}</span>
                  {selectedTasks.includes(taskName) && (
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
// Add Application Modal
// =============================================================================

interface AddApplicationModalProps {
  productType: string;
  productTypeKey: string;
  onSave: (application: string, taskNames: string[]) => Promise<boolean>;
  onClose: () => void;
  saving?: boolean;
}

const AddApplicationModal: React.FC<AddApplicationModalProps> = ({
  productType,
  productTypeKey,
  onSave,
  onClose,
  saving = false
}) => {
  const [applicationName, setApplicationName] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  const toggleTask = (taskName: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskName) ? prev.filter(t => t !== taskName) : [...prev, taskName]
    );
  };

  const handleSave = async () => {
    if (!applicationName.trim()) return;
    const success = await onSave(applicationName.trim(), selectedTasks);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Add Application</h3>
              <p className="text-sm text-gray-500 mt-1">Product Type: {productType}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Application Name
              </label>
              <input
                type="text"
                value={applicationName}
                onChange={(e) => setApplicationName(e.target.value)}
                placeholder="e.g., Face & Return, Full"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tasks to Generate
              </label>
              <div className="space-y-2">
                {VINYL_TASKS.map(taskName => (
                  <button
                    key={taskName}
                    onClick={() => toggleTask(taskName)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                      selectedTasks.includes(taskName)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900">{taskName}</span>
                    {selectedTasks.includes(taskName) && (
                      <Check className="w-5 h-5 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
            <button onClick={onClose} disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !applicationName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Application'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main VinylApplicationMatrixManager Component
// =============================================================================

export const VinylApplicationMatrixManager: React.FC = () => {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [selectedProductType, setSelectedProductType] = useState<string>('');
  const [selectedProductTypeName, setSelectedProductTypeName] = useState<string>('');
  const [matrixEntries, setMatrixEntries] = useState<VinylMatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<VinylMatrixEntry | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; show: boolean }>({
    message: '', type: 'success', show: false
  });

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type, show: true });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
  }, []);

  // Load product types
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const typesData = await settingsApi.getVinylMatrixProductTypes();
      setProductTypes(typesData);
      if (typesData.length > 0) {
        setSelectedProductType(typesData[0].product_type_key);
        setSelectedProductTypeName(typesData[0].product_type);
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
      const data = await settingsApi.getVinylMatrix(selectedProductType);
      setMatrixEntries(data);
    } catch (err) {
      console.error('Failed to load matrix:', err);
      setError('Failed to load vinyl matrix');
    } finally {
      setLoadingMatrix(false);
    }
  }, [selectedProductType]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);
  useEffect(() => { loadMatrix(); }, [loadMatrix]);

  const handleProductTypeChange = (key: string) => {
    setSelectedProductType(key);
    const pt = productTypes.find(p => p.product_type_key === key);
    setSelectedProductTypeName(pt?.product_type || '');
  };

  const handleSaveCell = async (matrixId: number, taskNames: string[]): Promise<boolean> => {
    setSaving(true);
    try {
      await settingsApi.updateVinylMatrixEntry(matrixId, taskNames);
      setMatrixEntries(prev => prev.map(e =>
        e.matrix_id === matrixId ? { ...e, task_names: taskNames } : e
      ));
      showNotification('Tasks updated', 'success');
      return true;
    } catch {
      showNotification('Failed to update tasks', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddApplication = async (applicationName: string, taskNames: string[]): Promise<boolean> => {
    setSaving(true);
    try {
      // Generate key from application name
      const applicationKey = applicationName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      await settingsApi.createVinylMatrixEntry({
        product_type: selectedProductTypeName,
        product_type_key: selectedProductType,
        application: applicationName,
        application_key: applicationKey,
        task_names: taskNames
      });

      // Reload the matrix
      await loadMatrix();
      showNotification('Application added', 'success');
      return true;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to add application';
      showNotification(message, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

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
              <h2 className="text-xl font-semibold text-gray-800">Vinyl Application Matrix</h2>
              <p className="text-sm text-gray-500 mt-1">Configure which tasks are generated for each vinyl application</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedProductType}
                onChange={(e) => handleProductTypeChange(e.target.value)}
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
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Application
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

        {/* Matrix List */}
        <div className="p-6">
          {loadingMatrix ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : matrixEntries.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No applications configured for this product type.</p>
              <p className="text-sm text-gray-400 mt-1">Click "Add Application" to create one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matrixEntries.map(entry => (
                <div
                  key={entry.matrix_id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{entry.application}</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {entry.task_names && entry.task_names.length > 0 ? (
                        entry.task_names.map(task => (
                          <span
                            key={task}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {task}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400 italic">No tasks assigned</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingEntry(entry)}
                    className="ml-4 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="px-6 pb-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Applications not in this matrix will trigger the unknown application modal during task generation,
              allowing users to select tasks and optionally save the mapping.
            </p>
          </div>
        </div>
      </div>

      {/* Cell Editor Modal */}
      {editingEntry && (
        <CellEditor
          entry={editingEntry}
          onSave={handleSaveCell}
          onClose={() => setEditingEntry(null)}
          saving={saving}
        />
      )}

      {/* Add Application Modal */}
      {showAddModal && (
        <AddApplicationModal
          productType={selectedProductTypeName}
          productTypeKey={selectedProductType}
          onSave={handleAddApplication}
          onClose={() => setShowAddModal(false)}
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

export default VinylApplicationMatrixManager;
