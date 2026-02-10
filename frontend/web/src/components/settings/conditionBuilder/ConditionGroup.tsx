/**
 * ConditionGroup - AND/OR group with children
 */

import React from 'react';
import { Plus, FolderPlus, X } from 'lucide-react';
import { ConditionNode, ConditionGroupNode, ConditionFieldOptions } from '../../../services/api/validationRulesApi';
import { ConditionLeaf } from './ConditionLeaf';
import { createEmptyLeaf, createEmptyGroup, nodeKey } from './conditionTreeUtils';

interface Props {
  node: ConditionGroupNode;
  fieldOptions: ConditionFieldOptions;
  onChange: (updated: ConditionGroupNode) => void;
  onRemove?: () => void;
  isRoot?: boolean;
  depth?: number;
}

export const ConditionGroup: React.FC<Props> = ({
  node, fieldOptions, onChange, onRemove, isRoot = false, depth = 0,
}) => {
  const handleChildChange = (index: number, updated: ConditionNode) => {
    const newChildren = [...node.children];
    newChildren[index] = updated;
    onChange({ ...node, children: newChildren });
  };

  const handleChildRemove = (index: number) => {
    const newChildren = node.children.filter((_, i) => i !== index);
    onChange({ ...node, children: newChildren });
  };

  const addCondition = () => {
    onChange({ ...node, children: [...node.children, createEmptyLeaf()] });
  };

  const addGroup = () => {
    const group = createEmptyGroup(node.logicalOperator === 'AND' ? 'OR' : 'AND');
    onChange({ ...node, children: [...node.children, { ...group, children: [createEmptyLeaf()] }] });
  };

  const toggleOperator = () => {
    onChange({ ...node, logicalOperator: node.logicalOperator === 'AND' ? 'OR' : 'AND' });
  };

  const borderColor = depth === 0 ? 'border-blue-200' : depth === 1 ? 'border-amber-200' : 'border-gray-200';
  const bgColor = depth === 0 ? 'bg-blue-50/50' : depth === 1 ? 'bg-amber-50/50' : 'bg-gray-50/50';

  return (
    <div className={`border ${borderColor} rounded-lg ${bgColor} p-3 ${depth > 0 ? 'ml-4' : ''}`}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={toggleOperator}
          className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
            node.logicalOperator === 'AND'
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
          }`}
          title={`Click to switch to ${node.logicalOperator === 'AND' ? 'OR' : 'AND'}`}
        >
          {node.logicalOperator}
        </button>
        <span className="text-xs text-gray-500">
          {node.logicalOperator === 'AND' ? 'All conditions must match' : 'Any condition must match'}
        </span>
        {!isRoot && onRemove && (
          <button
            onClick={onRemove}
            className="ml-auto p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="Remove group"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Children */}
      <div className="space-y-1">
        {node.children.map((child, index) => (
          <div key={nodeKey(child)}>
            {child.type === 'condition' ? (
              <ConditionLeaf
                node={child}
                fieldOptions={fieldOptions}
                onChange={updated => handleChildChange(index, updated)}
                onRemove={() => handleChildRemove(index)}
              />
            ) : (
              <ConditionGroup
                node={child}
                fieldOptions={fieldOptions}
                onChange={updated => handleChildChange(index, updated)}
                onRemove={() => handleChildRemove(index)}
                depth={depth + 1}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200/50">
        <button
          onClick={addCondition}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          <Plus className="h-3 w-3" /> Add Condition
        </button>
        {depth < 2 && (
          <button
            onClick={addGroup}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
          >
            <FolderPlus className="h-3 w-3" /> Add Group
          </button>
        )}
      </div>
    </div>
  );
};
