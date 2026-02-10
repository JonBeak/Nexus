/**
 * ConditionLeaf - Single condition row (field / operator / value)
 */

import React from 'react';
import { X } from 'lucide-react';
import { ConditionLeafNode, ConditionFieldOptions } from '../../../services/api/validationRulesApi';
import { CONDITION_FIELDS, getFieldDef } from './conditionFieldDefs';

interface Props {
  node: ConditionLeafNode;
  fieldOptions: ConditionFieldOptions;
  onChange: (updated: ConditionLeafNode) => void;
  onRemove: () => void;
}

export const ConditionLeaf: React.FC<Props> = ({ node, fieldOptions, onChange, onRemove }) => {
  const fieldDef = getFieldDef(node.field);
  const operators = fieldDef?.operators || [{ value: 'equals', label: 'equals' }];

  // Get value options for dropdown fields
  const getValueOptions = (): string[] => {
    if (!fieldDef?.optionsKey) return [];
    const key = fieldDef.optionsKey as keyof ConditionFieldOptions;
    return fieldOptions[key] || [];
  };

  const valueOptions = getValueOptions();

  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Field selector */}
      <select
        value={node.field}
        onChange={e => onChange({
          ...node,
          field: e.target.value,
          operator: 'equals',
          value: '',
        })}
        className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white min-w-[140px]"
      >
        {CONDITION_FIELDS.map(f => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={node.operator}
        onChange={e => onChange({ ...node, operator: e.target.value as any })}
        className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white min-w-[120px]"
      >
        {operators.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Value input */}
      {node.operator === 'exists' ? (
        <span className="text-sm text-gray-500 italic px-2">(any value)</span>
      ) : valueOptions.length > 0 ? (
        <select
          value={node.value}
          onChange={e => onChange({ ...node, value: e.target.value })}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white min-w-[180px] flex-1"
        >
          <option value="">Select...</option>
          {valueOptions.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={node.value}
          onChange={e => onChange({ ...node, value: e.target.value })}
          placeholder="Value..."
          className="px-2 py-1.5 text-sm border border-gray-300 rounded flex-1 min-w-[180px]"
        />
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
        title="Remove condition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
