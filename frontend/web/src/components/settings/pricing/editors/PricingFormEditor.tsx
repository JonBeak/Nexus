/**
 * PricingFormEditor - Single-row form editor (edit only, no add/delete)
 *
 * Renders fields as labeled inputs with Edit/Save/Cancel flow.
 * Used for tables that have a single active record (painting, shipping, etc.)
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

function formatDisplayValue(value: any, col: ColumnConfig): string {
  if (value === null || value === undefined) return '-';
  if (col.type === 'boolean') return value ? 'Yes' : 'No';
  if (col.type === 'decimal' && col.decimalPlaces !== undefined) {
    return `$${Number(value).toFixed(col.decimalPlaces)}`;
  }
  if (col.type === 'date' && value) {
    return new Date(value).toLocaleDateString('en-CA');
  }
  return String(value);
}

export const PricingFormEditor: React.FC<Props> = ({ config }) => {
  const [row, setRow] = useState<PricingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await pricingManagementApi.getRows(config.tableKey, false);
      if (data.length > 0) {
        setRow(data[0]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setNotification({ message: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [config.tableKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const startEditing = () => {
    if (!row) return;
    const data: Record<string, any> = {};
    config.columns.forEach(col => {
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
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFormData({});
  };

  const handleSave = async () => {
    if (!row) return;
    setSaving(true);
    try {
      const pk = config.primaryKey || 'id';
      await pricingManagementApi.updateRow(config.tableKey, row[pk], formData);
      PricingDataResource.clearCache();
      setNotification({ message: 'Updated successfully', type: 'success' });
      setEditing(false);
      await loadData();
    } catch (err: any) {
      setNotification({ message: err?.response?.data?.error || 'Failed to save', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!row) {
    return <div className="text-center py-8 text-gray-400">No pricing data found</div>;
  }

  return (
    <div>
      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
      )}

      {/* Header with edit button */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{config.title}</span>
        {!editing ? (
          <button
            onClick={startEditing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 border border-gray-300 rounded-lg hover:border-blue-300"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={cancelEditing} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">
              <X className="h-4 w-4" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        {config.columns.filter(c => !c.hidden).map(col => (
          <div key={col.key} className="space-y-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
              {col.label}
            </label>
            {editing ? (
              col.type === 'boolean' ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!formData[col.key]}
                    onChange={e => setFormData(prev => ({ ...prev, [col.key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">{formData[col.key] ? 'Yes' : 'No'}</span>
                </label>
              ) : col.type === 'enum' && col.enumValues ? (
                <select
                  value={formData[col.key] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [col.key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select...</option>
                  {col.enumValues.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <input
                  type={col.type === 'decimal' || col.type === 'integer' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                  step={col.type === 'decimal' ? 'any' : undefined}
                  value={formData[col.key] ?? ''}
                  onChange={e => setFormData(prev => ({ ...prev, [col.key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              )
            ) : (
              <div className="text-sm font-medium text-gray-800 py-2">
                {formatDisplayValue(row[col.key], col)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
