/**
 * Condition Tree Engine
 * Shared AND/OR condition tree for validation rules system.
 * Builds, flattens, and evaluates condition trees against order data.
 */

// =============================================
// TYPES
// =============================================

/** Raw row from validation_rule_conditions table */
export interface ConditionRow {
  condition_id: number;
  rule_type: string;
  rule_id: number;
  parent_id: number | null;
  node_type: 'group' | 'condition';
  logical_operator: 'AND' | 'OR' | null;
  field: string | null;
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'exists' | null;
  value: string | null;
  sort_order: number;
}

/** A group node (AND/OR) with children */
export interface ConditionGroupNode {
  type: 'group';
  conditionId?: number;
  logicalOperator: 'AND' | 'OR';
  children: ConditionNode[];
}

/** A leaf condition node */
export interface ConditionLeafNode {
  type: 'condition';
  conditionId?: number;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'exists';
  value: string;
}

export type ConditionNode = ConditionGroupNode | ConditionLeafNode;

/** Context built from order data at validation time */
export interface OrderConditionContext {
  specs_display_names: string[];
  applications: string[];
  parts: Array<{
    specs_display_name: string;
    specifications: Record<string, any>;
  }>;
}

// =============================================
// BUILD: flat rows → tree
// =============================================

export function buildConditionTree(rows: ConditionRow[]): ConditionNode | null {
  if (rows.length === 0) return null;

  const byId = new Map<number, ConditionRow>();
  const childrenOf = new Map<number | null, ConditionRow[]>();

  for (const row of rows) {
    byId.set(row.condition_id, row);
    const parentKey = row.parent_id;
    if (!childrenOf.has(parentKey)) childrenOf.set(parentKey, []);
    childrenOf.get(parentKey)!.push(row);
  }

  // Sort children by sort_order
  for (const children of childrenOf.values()) {
    children.sort((a, b) => a.sort_order - b.sort_order);
  }

  function buildNode(row: ConditionRow): ConditionNode {
    if (row.node_type === 'group') {
      const children = (childrenOf.get(row.condition_id) || []).map(buildNode);
      return {
        type: 'group',
        conditionId: row.condition_id,
        logicalOperator: row.logical_operator || 'AND',
        children,
      };
    }
    return {
      type: 'condition',
      conditionId: row.condition_id,
      field: row.field || '',
      operator: row.operator || 'equals',
      value: row.value || '',
    };
  }

  // Root nodes have parent_id = null
  const roots = childrenOf.get(null) || [];
  if (roots.length === 0) return null;
  if (roots.length === 1) return buildNode(roots[0]);

  // Multiple roots — wrap in implicit AND
  return {
    type: 'group',
    logicalOperator: 'AND',
    children: roots.map(buildNode),
  };
}

// =============================================
// FLATTEN: tree → flat rows (for DB insert)
// =============================================

export function flattenConditionTree(
  node: ConditionNode,
  ruleType: string,
  ruleId: number
): Omit<ConditionRow, 'condition_id'>[] {
  const rows: Omit<ConditionRow, 'condition_id'>[] = [];
  let sortCounter = 0;

  function flatten(n: ConditionNode, parentIndex: number | null) {
    const currentIndex = rows.length;

    if (n.type === 'group') {
      rows.push({
        rule_type: ruleType,
        rule_id: ruleId,
        parent_id: parentIndex !== null ? parentIndex : null,
        node_type: 'group',
        logical_operator: n.logicalOperator,
        field: null,
        operator: null,
        value: null,
        sort_order: sortCounter++,
      });
      for (const child of n.children) {
        flatten(child, currentIndex);
      }
    } else {
      rows.push({
        rule_type: ruleType,
        rule_id: ruleId,
        parent_id: parentIndex !== null ? parentIndex : null,
        node_type: 'condition',
        logical_operator: null,
        field: n.field,
        operator: n.operator,
        value: n.value,
        sort_order: sortCounter++,
      });
    }
  }

  flatten(node, null);
  return rows;
}

// =============================================
// EVALUATE: tree + context → boolean
// =============================================

export function evaluateCondition(
  node: ConditionNode | null,
  context: OrderConditionContext
): boolean {
  if (!node) return true; // No conditions = always matches

  if (node.type === 'group') {
    if (node.children.length === 0) return true;
    if (node.logicalOperator === 'AND') {
      return node.children.every(child => evaluateCondition(child, context));
    }
    return node.children.some(child => evaluateCondition(child, context));
  }

  // Leaf condition
  return evaluateLeaf(node, context);
}

function evaluateLeaf(leaf: ConditionLeafNode, context: OrderConditionContext): boolean {
  const { field, operator, value } = leaf;

  switch (field) {
    case 'specs_display_name': {
      const values = context.specs_display_names;
      return evaluateStringList(values, operator, value);
    }
    case 'application': {
      const values = context.applications;
      return evaluateStringList(values, operator, value);
    }
    case 'has_spec': {
      // Check if any part has this spec type in its display name
      return context.specs_display_names.some(name =>
        name.toLowerCase().includes(value.toLowerCase())
      );
    }
    default:
      // Unknown field — check if any part has a matching spec key
      return false;
  }
}

function evaluateStringList(
  values: string[],
  operator: string,
  target: string
): boolean {
  switch (operator) {
    case 'equals':
      return values.some(v => v === target);
    case 'not_equals':
      return !values.some(v => v === target);
    case 'contains':
      return values.some(v => v.toLowerCase().includes(target.toLowerCase()));
    case 'in': {
      const targets = target.split(',').map(t => t.trim());
      return values.some(v => targets.includes(v));
    }
    case 'exists':
      return values.length > 0;
    default:
      return false;
  }
}
