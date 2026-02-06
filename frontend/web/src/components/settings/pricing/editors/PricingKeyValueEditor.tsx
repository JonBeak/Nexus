/**
 * PricingKeyValueEditor - Key-value config editor
 *
 * Name/value/description rows with inline editing of values.
 * Used for blade_sign_pricing, substrate_cut_base_pricing, pricing_system_config.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { pricingManagementApi, PricingRow } from '../../../../services/api/pricingManagementApi';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { Notification } from '../../../inventory/Notification';
import { TableConfig, ColumnConfig } from '../pricingConfig';

interface Props {
  config: TableConfig;
}

interface NotificationState {
  message: string;
  type: 'success' | 'error';
}

export const PricingKeyValueEditor: React.FC<Props> = ({ config }) => {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const pk = config.primaryKey || 'id';

  // Identify editable vs read-only columns
  const editableColumns = config.columns.filter(c => c.editable !== false);
  const allDisplayColumns = config.columns;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await pricingManagementApi.getRows(config.tableKey, true);
      setRows(data);
    } catch (err) {
      console.error('Failed to load data:', err);
      setNotification({ message: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [config.tableKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const startEdit = (row: PricingRow) => {
    const values: Record<string, any> = {};
    editableColumns.forEach(col => {
      values[col.key] = row[col.key];
    });
    setEditingId(row[pk]);
    setEditValues(values);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async (row: PricingRow) => {
    setSaving(true);
    try {
      await pricingManagementApi.updateRow(config.tableKey, row[pk], editValues);
      PricingDataResource.clearCache();
      setNotification({ message: 'Updated successfully', type: 'success' });
      setEditingId(null);
      await loadData();
    } catch (err: any) {
      setNotification({ message: err?.response?.data?.error || 'Failed to save', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const formatValue = (value: any, col: ColumnConfig): string => {
    if (value === null || value === undefined) return '-';
    if (col.type === 'decimal' && col.decimalPlaces !== undefined) {
      return Number(value).toFixed(col.decimalPlaces);
    }
    return String(value);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
      )}

      <div className="text-sm text-gray-500 mb-3">{rows.length} config value{rows.length !== 1 ? 's' : ''}</div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {allDisplayColumns.map(col => (
                <th key={col.key} className="px-4 py-2 text-left font-medium text-gray-600">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-medium text-gray-600 w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isEditing = editingId === row[pk];
              return (
                <tr key={row[pk] ?? idx} className="border-b border-gray-100 hover:bg-gray-50">
                  {allDisplayColumns.map(col => (
                    <td key={col.key} className="px-4 py-2.5">
                      {isEditing && col.editable !== false ? (
                        col.type === 'text' ? (
                          <textarea
                            value={editValues[col.key] ?? ''}
                            onChange={e => setEditValues(prev => ({ ...prev, [col.key]: e.target.value }))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none"
                            rows={2}
                          />
                        ) : (
                          <input
                            type={col.type === 'decimal' || col.type === 'integer' ? 'number' : 'text'}
                            step={col.type === 'decimal' ? 'any' : undefined}
                            value={editValues[col.key] ?? ''}
                            onChange={e => setEditValues(prev => ({ ...prev, [col.key]: e.target.value }))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        )
                      ) : (
                        <span className={col.editable === false ? 'text-gray-500' : 'font-medium'}>
                          {formatValue(row[col.key], col)}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-gray-600" title="Cancel">
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => saveEdit(row)}
                          disabled={saving}
                          className="p-1 text-green-500 hover:text-green-700"
                          title="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(row)} className="p-1 text-gray-400 hover:text-blue-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={allDisplayColumns.length + 1} className="px-4 py-8 text-center text-gray-400">No config values found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
