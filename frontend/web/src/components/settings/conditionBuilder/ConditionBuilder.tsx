/**
 * ConditionBuilder - Top-level controlled component for AND/OR condition trees
 * Used by expected file rules and geometry validation profiles
 */

import React from 'react';
import { ConditionNode, ConditionGroupNode, ConditionFieldOptions } from '../../../services/api/validationRulesApi';
import { ConditionGroup } from './ConditionGroup';
import { createDefaultTree } from './conditionTreeUtils';

interface Props {
  value: ConditionNode | null;
  onChange: (tree: ConditionNode | null) => void;
  fieldOptions: ConditionFieldOptions;
}

export const ConditionBuilder: React.FC<Props> = ({ value, onChange, fieldOptions }) => {
  // Ensure we always have a root group to work with
  const rootNode: ConditionGroupNode = value?.type === 'group'
    ? value
    : value?.type === 'condition'
      ? { type: 'group', logicalOperator: 'AND', children: [value] }
      : createDefaultTree();

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        When Conditions
      </label>
      <ConditionGroup
        node={rootNode}
        fieldOptions={fieldOptions}
        onChange={updated => onChange(updated)}
        isRoot
        depth={0}
      />
    </div>
  );
};
