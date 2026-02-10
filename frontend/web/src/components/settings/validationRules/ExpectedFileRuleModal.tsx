/**
 * ExpectedFileRuleModal - Add/edit modal for expected file rules
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ExpectedFileRule, StandardFileName, ConditionNode, ConditionFieldOptions } from '../../../services/api/validationRulesApi';
import { ConditionBuilder } from '../conditionBuilder/ConditionBuilder';
import { createDefaultTree } from '../conditionBuilder/conditionTreeUtils';

interface Props {
  rule: ExpectedFileRule | null; // null = create mode
  standardFileNames: StandardFileName[];
  fieldOptions: ConditionFieldOptions;
  onSave: (data: {
    rule_name: string;
    expected_filename: string;
    file_name_id: number | null;
    is_required: boolean;
    description: string;
    conditionTree: ConditionNode | null;
  }) => void;
  onClose: () => void;
}

export const ExpectedFileRuleModal: React.FC<Props> = ({
  rule, standardFileNames, fieldOptions, onSave, onClose,
}) => {
  const [ruleName, setRuleName] = useState(rule?.rule_name || '');
  const [fileNameId, setFileNameId] = useState<number | null>(rule?.file_name_id || null);
  const [customFilename, setCustomFilename] = useState(rule?.expected_filename || '');
  const [isRequired, setIsRequired] = useState(rule?.is_required ?? true);
  const [description, setDescription] = useState(rule?.description || '');
  const [conditionTree, setConditionTree] = useState<ConditionNode | null>(
    rule?.conditionTree || createDefaultTree()
  );
  const [useCustom, setUseCustom] = useState(!rule?.file_name_id);

  // Sync filename when standard file name changes
  useEffect(() => {
    if (fileNameId && !useCustom) {
      const found = standardFileNames.find(f => f.file_name_id === fileNameId);
      if (found) setCustomFilename(found.name);
    }
  }, [fileNameId, useCustom, standardFileNames]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !customFilename.trim()) return;

    onSave({
      rule_name: ruleName.trim(),
      expected_filename: customFilename.trim(),
      file_name_id: useCustom ? null : fileNameId,
      is_required: isRequired,
      description: description.trim(),
      conditionTree,
    });
  };

  const activeFileNames = standardFileNames.filter(f => f.is_active);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {rule ? 'Edit Rule' : 'New Expected File Rule'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Rule Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
            <input
              type="text"
              value={ruleName}
              onChange={e => setRuleName(e.target.value)}
              placeholder="e.g., Front Lit - Return File"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Expected File */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected File</label>
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  checked={!useCustom}
                  onChange={() => setUseCustom(false)}
                  className="text-blue-600"
                />
                From catalog
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  checked={useCustom}
                  onChange={() => setUseCustom(true)}
                  className="text-blue-600"
                />
                Custom filename
              </label>
            </div>

            {useCustom ? (
              <input
                type="text"
                value={customFilename}
                onChange={e => setCustomFilename(e.target.value)}
                placeholder="e.g., Return.ai"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            ) : (
              <select
                value={fileNameId || ''}
                onChange={e => setFileNameId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                required
              >
                <option value="">Select a file...</option>
                {activeFileNames.map(f => (
                  <option key={f.file_name_id} value={f.file_name_id}>
                    {f.name} {f.description ? `— ${f.description}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Required toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-required"
              checked={isRequired}
              onChange={e => setIsRequired(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="is-required" className="text-sm text-gray-700">
              Required file (missing = error, not just info)
            </label>
          </div>

          {/* Conditions */}
          <ConditionBuilder
            value={conditionTree}
            onChange={setConditionTree}
            fieldOptions={fieldOptions}
          />

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this rule..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!ruleName.trim() || !customFilename.trim()}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {rule ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
