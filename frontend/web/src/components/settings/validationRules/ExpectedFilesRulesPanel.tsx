/**
 * ExpectedFilesRulesPanel - List and CRUD for expected file rules
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import {
  validationRulesApi,
  ExpectedFileRule,
  StandardFileName,
  ConditionFieldOptions,
  ConditionNode,
} from '../../../services/api/validationRulesApi';
import { ExpectedFileRuleModal } from './ExpectedFileRuleModal';

export const ExpectedFilesRulesPanel: React.FC = () => {
  const [rules, setRules] = useState<ExpectedFileRule[]>([]);
  const [standardFileNames, setStandardFileNames] = useState<StandardFileName[]>([]);
  const [fieldOptions, setFieldOptions] = useState<ConditionFieldOptions>({ specs_display_names: [], applications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<ExpectedFileRule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [rulesData, fileNames, options] = await Promise.all([
        validationRulesApi.getRules(),
        validationRulesApi.getStandardFileNames(),
        validationRulesApi.getConditionFieldOptions(),
      ]);
      setRules(rulesData);
      setStandardFileNames(fileNames);
      setFieldOptions(options);
    } catch (err) {
      console.error('Failed to load validation rules:', err);
      setError('Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (data: {
    rule_name: string;
    expected_filename: string;
    file_name_id: number | null;
    is_required: boolean;
    description: string;
    conditionTree: ConditionNode | null;
  }) => {
    try {
      setSaving(true);
      if (editingRule) {
        await validationRulesApi.updateRule(editingRule.rule_id, data);
      } else {
        await validationRulesApi.createRule(data);
      }
      setEditingRule(null);
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      console.error('Failed to save rule:', err);
      alert(err?.response?.data?.error || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: ExpectedFileRule) => {
    try {
      await validationRulesApi.updateRule(rule.rule_id, { is_active: !rule.is_active });
      await loadData();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleDelete = async (rule: ExpectedFileRule) => {
    if (!confirm(`Delete rule "${rule.rule_name}"? This cannot be undone.`)) return;
    try {
      await validationRulesApi.deleteRule(rule.rule_id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  /** Summarize condition tree for display */
  const summarizeConditions = (tree: ConditionNode | null): string => {
    if (!tree) return 'No conditions';
    if (tree.type === 'condition') {
      return `${tree.field} ${tree.operator} ${tree.value}`;
    }
    const childSummaries = tree.children.map(c => summarizeConditions(c));
    const joiner = tree.logicalOperator === 'AND' ? ' AND ' : ' OR ';
    return childSummaries.join(joiner);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeRules = rules.filter(r => r.is_active);
  const inactiveRules = rules.filter(r => !r.is_active);

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">
            {activeRules.length} active rule{activeRules.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" /> New Rule
          </button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rule Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Expected File</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Conditions</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Required</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeRules.map(rule => (
              <tr key={rule.rule_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-800">{rule.rule_name}</span>
                  {rule.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{rule.expected_filename}</code>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-600">{summarizeConditions(rule.conditionTree)}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {rule.is_required ? (
                    <span className="inline-block px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">Required</span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">Optional</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(rule)}
                      className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                      title="Deactivate"
                    >
                      <ToggleRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {activeRules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No active rules. Click "New Rule" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Inactive rules */}
      {inactiveRules.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Inactive Rules ({inactiveRules.length})</h3>
          <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {inactiveRules.map(rule => (
                  <tr key={rule.rule_id} className="border-b border-gray-100 opacity-60">
                    <td className="px-4 py-2 text-gray-600">{rule.rule_name}</td>
                    <td className="px-4 py-2">
                      <code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{rule.expected_filename}</code>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Reactivate"
                      >
                        <ToggleLeft className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {(showCreateModal || editingRule) && (
        <ExpectedFileRuleModal
          rule={editingRule}
          standardFileNames={standardFileNames}
          fieldOptions={fieldOptions}
          onSave={handleSave}
          onClose={() => { setShowCreateModal(false); setEditingRule(null); }}
        />
      )}
    </div>
  );
};
