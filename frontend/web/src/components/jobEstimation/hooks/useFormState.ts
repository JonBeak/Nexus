import { useState, useCallback } from 'react';

interface FormField {
  name: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  label: string;
  required?: boolean;
  default_value?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface UseFormStateReturn {
  formData: Record<string, any>;
  validationErrors: Record<string, string>;
  overriddenFields: Set<string>;
  updateField: (fieldName: string, value: any) => void;
  setCustomerDefaults: (defaults: Record<string, any>) => void;
  initializeForm: (fields: FormField[], initialData?: any, customerDefaults?: Record<string, any>) => void;
  validateForm: (fields: FormField[], itemName: string) => boolean;
  clearValidationError: (fieldName: string) => void;
  resetForm: () => void;
}

export const useFormState = (): UseFormStateReturn => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [overriddenFields, setOverriddenFields] = useState<Set<string>>(new Set());
  const [customerDefaults, setCustomerDefaultsState] = useState<Record<string, any>>({});

  const updateField = useCallback((fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Track if this field was manually overridden from customer default
    if (customerDefaults[fieldName] !== undefined && value !== customerDefaults[fieldName]) {
      setOverriddenFields(prev => new Set([...prev, fieldName]));
    } else {
      setOverriddenFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
    }

    // Clear validation error for this field
    clearValidationError(fieldName);
  }, [customerDefaults]);

  const setCustomerDefaults = useCallback((defaults: Record<string, any>) => {
    setCustomerDefaultsState(defaults);
  }, []);

  const initializeForm = useCallback((
    fields: FormField[], 
    initialData?: any, 
    customerDefaults?: Record<string, any>
  ) => {
    const initialFormData: Record<string, any> = {};
    
    fields.forEach(field => {
      if (initialData?.input_data && initialData.input_data[field.name] !== undefined) {
        // Editing existing item
        initialFormData[field.name] = initialData.input_data[field.name];
      } else if (customerDefaults && customerDefaults[field.name] !== undefined) {
        // Apply customer preference
        initialFormData[field.name] = customerDefaults[field.name];
      } else if (field.default_value !== undefined) {
        // Use default value
        initialFormData[field.name] = field.default_value;
      } else {
        // Set empty value based on field type
        initialFormData[field.name] = field.type === 'number' ? 0 : '';
      }
    });

    setFormData(initialFormData);
    setValidationErrors({});
    setOverriddenFields(new Set());
  }, []);

  const validateForm = useCallback((fields: FormField[], itemName: string): boolean => {
    const errors: Record<string, string> = {};

    fields.forEach(field => {
      const value = formData[field.name];
      
      // Required field validation
      if (field.required && (!value || value === '')) {
        errors[field.name] = `${field.label} is required`;
        return;
      }

      // Type-specific validation
      if (value && field.type === 'number') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors[field.name] = `${field.label} must be a number`;
          return;
        }
        if (field.validation?.min !== undefined && numValue < field.validation.min) {
          errors[field.name] = `${field.label} must be at least ${field.validation.min}`;
          return;
        }
        if (field.validation?.max !== undefined && numValue > field.validation.max) {
          errors[field.name] = `${field.label} must be no more than ${field.validation.max}`;
          return;
        }
      }

      // Pattern validation for text fields
      if (value && field.type === 'text' && field.validation?.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          errors[field.name] = `${field.label} format is invalid`;
        }
      }
    });

    // Item name validation
    if (!itemName.trim()) {
      errors['item_name'] = 'Item name is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const clearValidationError = useCallback((fieldName: string) => {
    setValidationErrors(prev => {
      if (prev[fieldName]) {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      }
      return prev;
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData({});
    setValidationErrors({});
    setOverriddenFields(new Set());
    setCustomerDefaultsState({});
  }, []);

  return {
    formData,
    validationErrors,
    overriddenFields,
    updateField,
    setCustomerDefaults,
    initializeForm,
    validateForm,
    clearValidationError,
    resetForm
  };
};