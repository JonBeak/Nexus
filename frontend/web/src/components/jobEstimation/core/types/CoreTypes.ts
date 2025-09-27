// Base data structures - foundation of the layered system

export type GridRowType = 'main' | 'continuation' | 'subItem';

export interface GridRowCore {
  // Essential identity
  id: string;
  dbId?: number;

  // Product configuration
  productTypeId?: number;
  productTypeName?: string;

  // Raw field data - all values stored as strings in base layer
  data: Record<string, string>;

  rowType: GridRowType;          // 'main' | 'continuation' | 'subItem'
  parentProductId?: string;      // Links continuation/sub-items to main row
}

export interface GridRowMetadata {
  // Persistence tracking
  tempId?: string;               // Original temp ID before database save
  lastModified?: Date;           // When this row was last changed
  isDirty?: boolean;             // Has unsaved changes

  // User interaction state
  isEditing?: boolean;           // Currently being edited
  editingField?: string;         // Which field is active
}

// Product configuration from database
export interface ProductTypeConfig {
  id: number;
  name: string;
  fields: DynamicField[][];      // 12-column field configuration
  category?: string;
  calculationKey?: string | null;
  pricingRules?: Record<string, unknown> | null;
}

export interface DynamicField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  data_source?: string;
  value_field?: string;
  display_field?: string;
  filter?: Record<string, any>;
  options?: Array<{value: string; label: string}> | string[];
}

// Helper type for generating stable IDs
export interface IdGenerator {
  generateTempId(): string;
  generateStableId(existingIds: string[]): string;
}
