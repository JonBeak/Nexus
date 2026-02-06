/**
 * PricingTableEditor - Reusable tabular CRUD editor
 *
 * Displays rows in a table driven by column definitions.
 * Inline add row form at bottom, edit modal for existing rows.
 * Show/hide inactive toggle for tables with is_active.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, X, Check, Eye, EyeOff } from 'lucide-react';
import { pricingManagementApi, PricingRow } from '../../../../services/api/pricingManagementApi';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { Notification } from '../../../inventory/Notification';
import { useAlert } from '../../../../contexts/AlertContext';
import { TableConfig, ColumnConfig } from '../pricingConfig';

interface Props {
  config: TableConfig;
}

interface NotificationState {
  message: string;
  type: 'success' | 'error';
}

/** Format a value for display based on column type */
function formatValue(value: any, col: ColumnConfig): string {
  if (value === null || value === undefined) return '-';
  if (col.type === 'boolean') return value ? 'Yes' : 'No';
  if (col.type === 'decimal' && col.decimalPlaces !== undefined) {
    return Number(value).toFixed(col.decimalPlaces);
  }
  if (col.type === 'date' && value) {
    return new Date(value).toLocaleDateString('en-CA');
  }
  return String(value);
}

/** Get default value for a column type */
function getDefaultValue(col: ColumnConfig): any {
  switch (col.type) {
    case 'decimal': return '';
    case 'integer': return '';
    case 'boolean': return false;
    case 'date': return new Date().toISOString().split('T')[0];
    default: return '';
  }
}

/** Render an input field for a column */
function ColumnInput({ col, value, onChange }: { col: ColumnConfig; value: any; onChange: (v: any) => void }) {
  if (col.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
    );
  }
  if (col.type === 'enum' && col.enumValues) {
    return (
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
      >
        <option value="">Select...</option>
        {col.enumValues.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  }
  if (col.type === 'date') {
    return (
      <input
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
      />
    );
  }
  return (
    <input
      type={col.type === 'decimal' || col.type === 'integer' ? 'number' : 'text'}
      step={col.type === 'decimal' ? 'any' : undefined}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
      placeholder={col.label}
    />
  );
}

/** Edit Modal for existing rows */
function EditModal({ row, columns, onSave, onCancel, saving }: {
  row: PricingRow;
  columns: ColumnConfig[];
  onSave: (data: Record<string, any>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    const data: Record<string, any> = {};
    columns.forEach(col => {
      let val = row[col.key];
      if (col.type === 'date' && val) {
        val = new Date(val).toISOString().split('T')[0];
      }
      if (col.type === 'boolean') {
        val = !!val;
      }
      data[col.key] = val;
    });
    setFormData(data);
  }, [row, columns]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Edit Record</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {columns.map(col => (
            <div key={col.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {col.label} {col.required && <span className="text-red-500">*</span>}
              </label>
              <ColumnInput
                col={col}
                value={formData[col.key]}
                onChange={v => setFormData(prev => ({ ...prev, [col.key]: v }))}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const PricingTableEditor: React.FC<Props> = ({ config }) => {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editingRow, setEditingRow] = useState<PricingRow | null>(null);
  const [addFormData, setAddFormData] = useState<Record<string, any>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const { showConfirmation } = useAlert();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await pricingManagementApi.getRows(config.tableKey, showInactive);
      setRows(data);
    } catch (err) {
      console.error('Failed to load data:', err);
      setNotification({ message: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [config.tableKey, showInactive]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetAddForm = () => {
    const defaults: Record<string, any> = {};
    config.columns.forEach(col => { defaults[col.key] = getDefaultValue(col); });
    setAddFormData(defaults);
  };

  useEffect(() => { resetAddForm(); }, [config.columns]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await pricingManagementApi.createRow(config.tableKey, addFormData);
      PricingDataResource.clearCache();
      setNotification({ message: 'Record added successfully', type: 'success' });
      resetAddForm();
      setShowAddForm(false);
      await loadData();
    } catch (err: any) {
      setNotification({ message: err?.response?.data?.error || 'Failed to add record', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: Record<string, any>) => {
    if (!editingRow) return;
    setSaving(true);
    try {
      const pk = config.primaryKey || 'id';
      await pricingManagementApi.updateRow(config.tableKey, editingRow[pk], data);
      PricingDataResource.clearCache();
      setNotification({ message: 'Record updated successfully', type: 'success' });
      setEditingRow(null);
      await loadData();
    } catch (err: any) {
      setNotification({ message: err?.response?.data?.error || 'Failed to update record', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (row: PricingRow) => {
    const confirmed = await showConfirmation(
      'Deactivate Record',
      'Are you sure you want to deactivate this record? It can be reactivated later.'
    );
    if (!confirmed) return;

    try {
      const pk = config.primaryKey || 'id';
      await pricingManagementApi.deactivateRow(config.tableKey, row[pk]);
      PricingDataResource.clearCache();
      setNotification({ message: 'Record deactivated', type: 'success' });
      await loadData();
    } catch (err: any) {
      setNotification({ message: err?.response?.data?.error || 'Failed to deactivate', type: 'error' });
    }
  };

  const handleRestore = async (row: PricingRow) => {
    try {
      const pk = config.primaryKey || 'id';
      await pricingManagementApi.restoreRow(config.tableKey, row[pk]);
      PricingDataResource.clearCache();
      setNotification({ message: 'Record reactivated', type: 'success' });
      await loadData();
    } catch (err: any) {
      setNotification({ message: err?.response?.data?.error || 'Failed to reactivate', type: 'error' });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const pk = config.primaryKey || 'id';

  return (
    <div>
      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
      )}

      {/* Header with toggle and add button */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-3">
          {config.hasActiveFilter && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              {showInactive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="sr-only" />
              {showInactive ? 'Showing inactive' : 'Show inactive'}
            </label>
          )}
          <button
            onClick={() => { setShowAddForm(!showAddForm); if (!showAddForm) resetAddForm(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {config.columns.filter(c => !c.hidden).map(col => (
                <th key={col.key} className="px-3 py-2 text-left font-medium text-gray-600" style={col.width ? { width: col.width } : undefined}>
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-gray-600 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isInactive = config.hasActiveFilter && !row.is_active;
              return (
                <tr key={row[pk] ?? idx} className={`border-b border-gray-100 ${isInactive ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'}`}>
                  {config.columns.filter(c => !c.hidden).map(col => (
                    <td key={col.key} className="px-3 py-2">{formatValue(row[col.key], col)}</td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditingRow(row)} className="p-1 text-gray-400 hover:text-blue-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {config.hasActiveFilter && (
                        isInactive ? (
                          <button onClick={() => handleRestore(row)} className="p-1 text-gray-400 hover:text-green-600" title="Reactivate">
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        ) : (
                          <button onClick={() => handleDeactivate(row)} className="p-1 text-gray-400 hover:text-red-600" title="Deactivate">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={config.columns.filter(c => !c.hidden).length + 1} className="px-3 py-8 text-center text-gray-400">No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Inline Add Form */}
      {showAddForm && (
        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Record</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {config.columns.filter(c => !c.hidden).map(col => (
              <div key={col.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {col.label} {col.required && <span className="text-red-500">*</span>}
                </label>
                <ColumnInput
                  col={col}
                  value={addFormData[col.key]}
                  onChange={v => setAddFormData(prev => ({ ...prev, [col.key]: v }))}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Check className="h-4 w-4" /> {saving ? 'Adding...' : 'Add Record'}
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingRow && (
        <EditModal
          row={editingRow}
          columns={config.columns}
          onSave={handleUpdate}
          onCancel={() => setEditingRow(null)}
          saving={saving}
        />
      )}
    </div>
  );
};
