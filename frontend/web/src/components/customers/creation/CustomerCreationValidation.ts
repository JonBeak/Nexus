import { CustomerCreateData, ValidationResult, ValidationError } from './CustomerCreationTypes';
import { Address } from '../../../types';

export class CustomerCreationValidation {
  static validateCustomerData(formData: CustomerCreateData, addresses: Partial<Address>[]): ValidationResult {
    const errors: ValidationError[] = [];

    // Required field validation
    this.validateRequiredFields(formData, errors);
    
    // Address validation
    this.validateAddresses(addresses, errors);
    
    // Business logic validation
    this.validateBusinessRules(formData, errors);
    
    // Data format validation
    this.validateDataFormats(formData, errors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static validateRequiredFields(formData: CustomerCreateData, errors: ValidationError[]): void {
    if (!formData.company_name?.trim()) {
      errors.push({
        field: 'company_name',
        message: 'Company name is required'
      });
    }
  }

  private static validateAddresses(addresses: Partial<Address>[], errors: ValidationError[]): void {
    const validAddresses = addresses.filter(addr => 
      addr.province_state_short?.trim()
    );

    if (validAddresses.length === 0) {
      errors.push({
        field: 'addresses',
        message: 'At least one address with a Province/State is required'
      });
    }

    // Validate primary address requirement
    const primaryAddresses = addresses.filter(addr => addr.is_primary);
    if (addresses.length > 1 && primaryAddresses.length === 0) {
      errors.push({
        field: 'addresses',
        message: 'One address must be marked as primary when multiple addresses exist'
      });
    }

    // Validate email format in addresses if provided
    addresses.forEach((addr, index) => {
      if (addr.email && !this.isValidEmail(addr.email)) {
        errors.push({
          field: `address_${index}_email`,
          message: `Invalid email format in address ${index + 1}`
        });
      }
    });
  }

  private static validateBusinessRules(formData: CustomerCreateData, errors: ValidationError[]): void {
    // Discount validation
    if (formData.discount !== undefined && (formData.discount < 0 || formData.discount > 100)) {
      errors.push({
        field: 'discount',
        message: 'Discount must be between 0 and 100 percent'
      });
    }

    // Wire length validation
    if (formData.wire_length !== undefined && formData.wire_length < 0) {
      errors.push({
        field: 'wire_length',
        message: 'Wire length must be a positive number'
      });
    }

    // Turnaround time validation
    if (formData.default_turnaround !== undefined && formData.default_turnaround < 0) {
      errors.push({
        field: 'default_turnaround',
        message: 'Default turnaround must be a positive number'
      });
    }

    // Shipping multiplier validation
    if (formData.shipping_multiplier !== undefined && formData.shipping_multiplier <= 0) {
      errors.push({
        field: 'shipping_multiplier',
        message: 'Shipping multiplier must be greater than 0'
      });
    }

  }

  private static validateDataFormats(formData: CustomerCreateData, errors: ValidationError[]): void {
    // Email validation
    if (formData.email && !this.isValidEmail(formData.email)) {
      errors.push({
        field: 'email',
        message: 'Invalid email format'
      });
    }

    if (formData.invoice_email && !this.isValidEmail(formData.invoice_email)) {
      errors.push({
        field: 'invoice_email',
        message: 'Invalid invoice email format'
      });
    }

    // Phone validation (basic)
    if (formData.phone && formData.phone.trim() && !this.isValidPhone(formData.phone)) {
      errors.push({
        field: 'phone',
        message: 'Invalid phone number format'
      });
    }
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  private static isValidPhone(phone: string): boolean {
    // Basic phone validation - allows optional +country code and common separators
    const normalized = phone.replace(/\s/g, '');
    const phoneRegex = /^(\+?[1-9]\d{0,15}|[+(]?[1-9][\d\s().-]{6,20})$/;
    return phoneRegex.test(normalized);
  }

  // Field-specific validation helpers
  static validateField<K extends keyof CustomerCreateData>(
    fieldName: K,
    value: CustomerCreateData[K] | null | undefined
  ): string | null {
    switch (fieldName) {
      case 'company_name':
        return typeof value === 'string' && value.trim()
          ? null
          : 'Company name is required';

      case 'email':
      case 'invoice_email':
        return value && typeof value === 'string' && !this.isValidEmail(value)
          ? 'Invalid email format'
          : null;

      case 'phone':
        return value && typeof value === 'string' && !this.isValidPhone(value)
          ? 'Invalid phone number format'
          : null;

      case 'discount':
        return value !== undefined && value !== null && typeof value === 'number' && (value < 0 || value > 100)
          ? 'Discount must be between 0-100%'
          : null;

      case 'wire_length':
        return value !== undefined && value !== null && typeof value === 'number' && value < 0
          ? 'Wire length must be positive'
          : null;

      case 'default_turnaround':
        return value !== undefined && value !== null && typeof value === 'number' && value < 0
          ? 'Turnaround must be positive'
          : null;

      case 'shipping_multiplier':
        return value !== undefined && value !== null && typeof value === 'number' && value <= 0
          ? 'Multiplier must be greater than 0'
          : null;

      default:
        return null;
    }
  }

  // Get validation styling for form fields
  static getValidationClass<K extends keyof CustomerCreateData>(
    fieldName: K,
    value: CustomerCreateData[K] | null | undefined,
    hasError: boolean = false
  ): string {
    const baseClass = "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500";

    if (hasError) {
      return `${baseClass} border-red-500 focus:border-red-500 focus:ring-red-200`;
    }

    const requiredFields: Array<keyof CustomerCreateData> = ['company_name'];
    const stringValue = typeof value === 'string' ? value : '';

    if (requiredFields.includes(fieldName) && !stringValue.trim()) {
      return `${baseClass} border-gray-300 focus:border-purple-500`;
    }

    return `${baseClass} border-gray-300 focus:border-purple-500`;
  }
}
