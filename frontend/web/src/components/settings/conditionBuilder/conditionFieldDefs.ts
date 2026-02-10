/**
 * Condition Field Definitions
 * Defines available fields, their operators, and value sources for the condition builder
 */

export interface ConditionFieldDef {
  key: string;
  label: string;
  operators: { value: string; label: string }[];
  valueType: 'dropdown' | 'text' | 'multi-select';
  optionsKey?: string; // Key in ConditionFieldOptions to populate dropdown
}

export const CONDITION_FIELDS: ConditionFieldDef[] = [
  {
    key: 'specs_display_name',
    label: 'Product Type',
    operators: [
      { value: 'equals', label: 'equals' },
      { value: 'not_equals', label: 'does not equal' },
      { value: 'in', label: 'is one of' },
    ],
    valueType: 'dropdown',
    optionsKey: 'specs_display_names',
  },
  {
    key: 'application',
    label: 'Vinyl Application',
    operators: [
      { value: 'equals', label: 'equals' },
      { value: 'not_equals', label: 'does not equal' },
    ],
    valueType: 'dropdown',
    optionsKey: 'applications',
  },
  {
    key: 'has_spec',
    label: 'Has Spec Type',
    operators: [
      { value: 'exists', label: 'exists' },
    ],
    valueType: 'text',
  },
];

export function getFieldDef(fieldKey: string): ConditionFieldDef | undefined {
  return CONDITION_FIELDS.find(f => f.key === fieldKey);
}
