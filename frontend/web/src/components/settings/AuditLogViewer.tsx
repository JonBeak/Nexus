/**
 * AuditLogViewer - Read-only paginated table of settings changes
 * Shows old vs new values and allows filtering by table/user
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Filter, Clock, User, Database } from 'lucide-react';
import { settingsApi, AuditLogEntry } from '../../services/api/settings';

// Table name to display name mapping
const TABLE_DISPLAY_NAMES: Record<string, string> = {
  task_definitions: 'Task Definitions',
  production_roles: 'Production Roles',
  specification_options: 'Specification Options',
  painting_matrix: 'Painting Matrix',
  email_templates: 'Email Templates',
  settings_categories: 'Settings Categories'
};

// Action badge colors
const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  create: { bg: 'bg-green-100', text: 'text-green-800' },
  update: { bg: 'bg-blue-100', text: 'text-blue-800' },
  delete: { bg: 'bg-red-100', text: 'text-red-800' },
  restore: { bg: 'bg-amber-100', text: 'text-amber-800' }
};

// =============================================================================
// Value Diff Display Component
// =============================================================================

interface ValueDiffProps {
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}

const ValueDiff: React.FC<ValueDiffProps> = ({ oldValues, newValues }) => {
  if (!oldValues && !newValues) return <span className="text-gray-400">No data</span>;

  const allKeys = new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {})
  ]);

  const changedKeys = Array.from(allKeys).filter(key => {
    const oldVal = oldValues?.[key];
    const newVal = newValues?.[key];
    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
  });

  if (changedKeys.length === 0) {
    return <span className="text-gray-400">No changes recorded</span>;
  }

  return (
    <div className="space-y-1 text-xs">
      {changedKeys.slice(0, 3).map(key => {
        const oldVal = oldValues?.[key];
        const newVal = newValues?.[key];
        const displayKey = key.replace(/_/g, ' ');

        return (
          <div key={key} className="flex items-start gap-2">
            <span className="font-medium text-gray-600 min-w-[80px]">{displayKey}:</span>
            <div className="flex-1">
              {oldVal !== undefined && (
                <span className="line-through text-red-600 mr-2">
                  {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)}
                </span>
              )}
              {newVal !== undefined && (
                <span className="text-green-600">
                  {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {changedKeys.length > 3 && (
        <span className="text-gray-400">+{changedKeys.length - 3} more changes</span>
      )}
    </div>
  );
};

// =============================================================================
// Main AuditLogViewer Component
// =============================================================================

export const AuditLogViewer: React.FC = () => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Filters
  const [tableFilter, setTableFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const loadAuditLog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await settingsApi.getAuditLog({
        tableName: tableFilter || undefined,
        limit: pageSize,
        offset: page * pageSize
      });
      setEntries(result.entries);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load audit log:', err);
      setError('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, tableFilter]);

  useEffect(() => { loadAuditLog(); }, [loadAuditLog]);

  // Reset to first page when filter changes
  useEffect(() => { setPage(0); }, [tableFilter]);

  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Settings Audit Log</h2>
              <p className="text-sm text-gray-500 mt-1">Track all changes made to system settings</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                title="Toggle filters"
              >
                <Filter className="w-5 h-5" />
              </button>
              <button onClick={loadAuditLog} disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-gray-400" />
                  <select
                    value={tableFilter}
                    onChange={(e) => setTableFilter(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Tables</option>
                    {Object.entries(TABLE_DISPLAY_NAMES).map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </select>
                </div>
                {tableFilter && (
                  <button
                    onClick={() => setTableFilter('')}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {tableFilter ? 'No audit entries found for this filter.' : 'No audit entries yet.'}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {entries.map(entry => {
                      const actionColor = ACTION_COLORS[entry.action] || ACTION_COLORS.update;
                      return (
                        <tr key={entry.log_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="w-4 h-4 text-gray-400" />
                              {formatDate(entry.changed_at)}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-900">
                                {entry.first_name && entry.last_name
                                  ? `${entry.first_name} ${entry.last_name}`
                                  : `User #${entry.changed_by}`}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium capitalize ${actionColor.bg} ${actionColor.text}`}>
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {TABLE_DISPLAY_NAMES[entry.table_name] || entry.table_name}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">#{entry.record_id}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-700">
                              {entry.change_summary || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <ValueDiff oldValues={entry.old_values} newValues={entry.new_values} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, total)} of {total} entries
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page + 1} of {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogViewer;
