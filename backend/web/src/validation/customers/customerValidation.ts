import { isValidEmail, isValidPhone } from '../../utils/validation';

export interface CustomerValidationResult {
  isValid: boolean;
  errors: string[];
}

export class CustomerValidation {
  static validateCustomerData(data: any): CustomerValidationResult {
    const errors: string[] = [];

    // Required field validation
    if (!data.company_name || data.company_name.trim() === '') {
      errors.push('Company name is required');
    }

    // Optional field validation with type checking
    if (data.email && !isValidEmail(data.email)) {
      errors.push('Invalid email format');
    }

    if (data.invoice_email && !isValidEmail(data.invoice_email)) {
      errors.push('Invalid invoice email format');
    }

    if (data.phone && !isValidPhone(data.phone)) {
      errors.push('Invalid phone number format');
    }

    // Numeric field validation
    if (data.discount && (isNaN(Number(data.discount)) || Number(data.discount) < 0 || Number(data.discount) > 100)) {
      errors.push('Discount must be a number between 0 and 100');
    }

    if (data.default_turnaround && (isNaN(Number(data.default_turnaround)) || Number(data.default_turnaround) < 0)) {
      errors.push('Default turnaround must be a positive number');
    }

    if (data.wire_length && (isNaN(Number(data.wire_length)) || Number(data.wire_length) < 0)) {
      errors.push('Wire length must be a positive number');
    }

    if (data.shipping_multiplier && (isNaN(Number(data.shipping_multiplier)) || Number(data.shipping_multiplier) < 0)) {
      errors.push('Shipping multiplier must be a positive number');
    }

    if (data.shipping_flat && (isNaN(Number(data.shipping_flat)) || Number(data.shipping_flat) < 0)) {
      errors.push('Shipping flat rate must be a positive number');
    }

    // Foreign key validation
    if (data.led_id && (isNaN(Number(data.led_id)) || Number(data.led_id) <= 0)) {
      errors.push('LED ID must be a valid positive number');
    }

    if (data.power_supply_id && (isNaN(Number(data.power_supply_id)) || Number(data.power_supply_id) <= 0)) {
      errors.push('Power Supply ID must be a valid positive number');
    }

    // Enum validation
    const validInvoicePreferences = ['PDF', 'Paper', 'Both', null, undefined];
    if (data.invoice_email_preference && !validInvoicePreferences.includes(data.invoice_email_preference)) {
      errors.push('Invalid invoice email preference');
    }

    const validPatternTypes = ['PDF', 'Paper', 'Both', null, undefined];
    if (data.pattern_type && !validPatternTypes.includes(data.pattern_type)) {
      errors.push('Invalid pattern type');
    }

    const validWiringTypes = ['PDF', 'Paper', 'Both', null, undefined];
    if (data.wiring_diagram_type && !validWiringTypes.includes(data.wiring_diagram_type)) {
      errors.push('Invalid wiring diagram type');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateCustomerId(id: any): CustomerValidationResult {
    const errors: string[] = [];

    if (!id || isNaN(Number(id)) || Number(id) <= 0) {
      errors.push('Invalid customer ID');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}