/**
 * Condition Tree Utilities
 * Immutable update helpers for condition tree state management
 */

import { ConditionNode, ConditionGroupNode, ConditionLeafNode } from '../../../services/api/validationRulesApi';

let nextTempId = -1;
export function genTempId(): number {
  return nextTempId--;
}

export function createEmptyGroup(operator: 'AND' | 'OR' = 'AND'): ConditionGroupNode {
  return { type: 'group', conditionId: genTempId(), logicalOperator: operator, children: [] };
}

export function createEmptyLeaf(): ConditionLeafNode {
  return { type: 'condition', conditionId: genTempId(), field: 'specs_display_name', operator: 'equals', value: '' };
}

/** Get a stable key for a node */
export function nodeKey(node: ConditionNode): string {
  return `node-${node.conditionId ?? Math.random()}`;
}

/** Update a node in the tree by conditionId (immutable) */
export function updateNodeInTree(
  tree: ConditionNode,
  targetId: number,
  updater: (node: ConditionNode) => ConditionNode
): ConditionNode {
  if (tree.conditionId === targetId) return updater(tree);
  if (tree.type === 'group') {
    return {
      ...tree,
      children: tree.children.map(child => updateNodeInTree(child, targetId, updater)),
    };
  }
  return tree;
}

/** Remove a node from the tree by conditionId */
export function removeNodeFromTree(tree: ConditionNode, targetId: number): ConditionNode | null {
  if (tree.conditionId === targetId) return null;
  if (tree.type === 'group') {
    const filtered = tree.children
      .map(child => removeNodeFromTree(child, targetId))
      .filter((child): child is ConditionNode => child !== null);
    return { ...tree, children: filtered };
  }
  return tree;
}

/** Add a child to a group node */
export function addChildToGroup(
  tree: ConditionNode,
  parentId: number,
  newChild: ConditionNode
): ConditionNode {
  return updateNodeInTree(tree, parentId, node => {
    if (node.type !== 'group') return node;
    return { ...node, children: [...node.children, newChild] };
  });
}

/** Create a default root condition tree (AND group with one empty condition) */
export function createDefaultTree(): ConditionGroupNode {
  const root = createEmptyGroup('AND');
  return { ...root, children: [createEmptyLeaf()] };
}
