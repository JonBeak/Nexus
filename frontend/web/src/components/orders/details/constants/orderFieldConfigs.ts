// Field configuration object to centralize all field definitions
export const orderFieldConfigs = {
  // Order Information Fields
  customer_po: {
    type: 'text' as const,
    label: 'Customer PO',
    section: 'order',
    placeholder: 'Enter PO number'
  },
  customer_job_number: {
    type: 'text' as const,
    label: 'Customer Job #',
    section: 'order',
    placeholder: 'Enter job number'
  },
  shipping_required: {
    type: 'select' as const,
    label: 'Shipping Method',
    section: 'order',
    options: [
      { value: 'true', label: 'Shipping' },
      { value: 'false', label: 'Pick Up' }
    ],
    displayFormatter: (val: any) => val ? 'Shipping' : 'Pick Up',
    valueTransform: (val: string) => val === 'true'
  },
  due_date: {
    type: 'date' as const,
    label: 'Due Date',
    section: 'order',
    displayFormatter: (val: any) => {
      if (!val) return '-';
      const [year, month, day] = val.split('T')[0].split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString();
    },
    recalculateDays: true // Triggers turnaround/days until recalculation
  },
  hard_due_date_time: {
    type: 'time' as const,
    label: 'Hard Due Time',
    section: 'order',
    displayFormatter: (val: any) => {
      if (!val) return '-';
      const [hours, minutes] = val.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    },
    valueTransform: (val: string) => val ? `${val.trim()}:00` : null,
    extractValue: (val: string) => val ? val.substring(0, 5) : '' // Extract HH:mm from HH:mm:ss
  },

  // Invoice Fields
  invoice_email: {
    type: 'email' as const,
    label: 'Accounting Email',
    section: 'invoice',
    placeholder: 'accounting@company.com'
  },
  terms: {
    type: 'text' as const,
    label: 'Terms',
    section: 'invoice',
    placeholder: 'Net 30'
  },
  deposit_required: {
    type: 'checkbox' as const,
    label: 'Deposit Required',
    section: 'invoice',
    valueTransform: (val: string) => val === 'true'
  },
  cash: {
    type: 'checkbox' as const,
    label: 'Cash Job',
    section: 'invoice',
    valueTransform: (val: string) => val === 'true'
  },
  discount: {
    type: 'number' as const,
    label: 'Discount',
    section: 'invoice',
    readOnly: true, // Display only field
    displayFormatter: (val: any) => {
      if (val && parseFloat(String(val)) > 0) {
        return `${parseFloat(String(val))}%`;
      }
      return '-';
    }
  },
  tax_name: {
    type: 'select' as const,
    label: 'Tax',
    section: 'invoice',
    customRender: true, // Uses custom dropdown with tax rules
    valueTransform: (val: string) => val
  },

  // Textarea Fields (Notes)
  manufacturing_note: {
    type: 'textarea' as const,
    label: 'Special Instructions',
    section: 'order',
    height: '60px',
    placeholder: 'Enter special manufacturing instructions...'
  },
  internal_note: {
    type: 'textarea' as const,
    label: 'Internal Notes',
    section: 'order',
    height: '60px',
    placeholder: 'Enter internal notes...'
  },
  invoice_notes: {
    type: 'textarea' as const,
    label: 'Invoice Notes',
    section: 'invoice',
    height: '60px',
    placeholder: 'Enter invoice notes...'
  }
} as const;

// Helper function to get field config
export const getFieldConfig = (field: keyof typeof orderFieldConfigs) => {
  return orderFieldConfigs[field];
};

// Export as FIELD_CONFIGS for backward compatibility
export const FIELD_CONFIGS = orderFieldConfigs;

// Type exports for better type safety
export type FieldConfig = typeof FIELD_CONFIGS[keyof typeof FIELD_CONFIGS];
export type FieldName = keyof typeof FIELD_CONFIGS;
export type FieldType = 'text' | 'date' | 'time' | 'email' | 'select' | 'checkbox' | 'textarea' | 'number';
export type FieldSection = 'order' | 'invoice';