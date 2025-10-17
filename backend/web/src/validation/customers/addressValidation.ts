export interface AddressValidationResult {
  isValid: boolean;
  errors: string[];
}

export class AddressValidation {
  static validateAddressData(data: any): AddressValidationResult {
    const errors: string[] = [];

    // Required field validation - only province required
    if (!data.province_state_short || data.province_state_short.trim() === '') {
      errors.push('Province/state is required for tax purposes');
    }

    // Validate tax override percentage
    if (data.tax_override_percent !== null && data.tax_override_percent !== undefined) {
      const taxPercent = Number(data.tax_override_percent);
      if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
        errors.push('Tax override percentage must be between 0 and 100');
      }
    }

    // Validate country (should be a known country)
    const validCountries = ['Canada', 'USA', 'United States'];
    if (data.country && !validCountries.includes(data.country)) {
      errors.push('Invalid country');
    }

    // Postal code format validation removed - no format restrictions

    // Validate province/state code length
    if (data.province_state_short && data.province_state_short.length > 10) {
      errors.push('Province/state code is too long');
    }

    // Validate boolean fields
    const booleanFields = [
      'is_primary', 'is_billing', 'is_shipping', 'is_jobsite',
      'is_mailing'
    ];

    booleanFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null && 
          typeof data[field] !== 'boolean' && 
          data[field] !== 0 && data[field] !== 1 && 
          data[field] !== '0' && data[field] !== '1' &&
          data[field] !== 'true' && data[field] !== 'false') {
        errors.push(`${field} must be a boolean value`);
      }
    });

    // Validate string length limits
    const stringLimits = {
      address_line1: 255,
      address_line2: 255,
      city: 100,
      province_state_long: 100,
      postal_zip: 20,
      tax_override_reason: 255,
      comments: 1000
    };

    Object.entries(stringLimits).forEach(([field, maxLength]) => {
      if (data[field] && data[field].length > maxLength) {
        errors.push(`${field} is too long (max ${maxLength} characters)`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateAddressId(id: any): AddressValidationResult {
    const errors: string[] = [];

    if (!id || isNaN(Number(id)) || Number(id) <= 0) {
      errors.push('Invalid address ID');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateCustomerAndAddressIds(customerId: any, addressId: any): AddressValidationResult {
    const errors: string[] = [];

    if (!customerId || isNaN(Number(customerId)) || Number(customerId) <= 0) {
      errors.push('Invalid customer ID');
    }

    if (!addressId || isNaN(Number(addressId)) || Number(addressId) <= 0) {
      errors.push('Invalid address ID');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

}