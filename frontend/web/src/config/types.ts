/**
 * Order Template Types
 * Phase 1.5.c.2 - Order Template System
 */

export interface OrderTemplateField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  unit?: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface OrderProductTemplate {
  product_type: string;
  category: string;
  fields: OrderTemplateField[];
}
