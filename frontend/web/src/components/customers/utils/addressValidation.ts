import { Address } from '../../../types';

export interface ValidationError {
  field: string;
  message: string;
}

export const validateAddress = (address: Address): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Required field validations
  if (!address.address_line1?.trim()) {
    errors.push({ field: 'address_line1', message: 'Address line 1 is required' });
  }

  if (!address.city?.trim()) {
    errors.push({ field: 'city', message: 'City is required' });
  }

  if (!address.province_state_short?.trim()) {
    errors.push({ field: 'province_state_short', message: 'Province/State is required for tax purposes' });
  }

  // Postal/Zip code format validation
  if (address.postal_zip) {
    const trimmedPostalZip = address.postal_zip.trim();
    if (address.country === 'Canada') {
      // Canadian postal code format: A1A 1A1 (with or without space)
      const canadianPostalCodeRegex = /^[A-Za-z]\d[A-Za-z][\s]?\d[A-Za-z]\d$/;
      if (!canadianPostalCodeRegex.test(trimmedPostalZip)) {
        errors.push({ 
          field: 'postal_zip', 
          message: 'Invalid Canadian postal code format (expected: A1A 1A1)' 
        });
      }
    } else if (address.country === 'USA') {
      // US zip code format: 12345 or 12345-6789
      const usZipCodeRegex = /^\d{5}(-\d{4})?$/;
      if (!usZipCodeRegex.test(trimmedPostalZip)) {
        errors.push({ 
          field: 'postal_zip', 
          message: 'Invalid US zip code format (expected: 12345 or 12345-6789)' 
        });
      }
    }
  }

  // Tax validation
  if (address.tax_override_percent !== undefined && address.tax_override_percent !== null) {
    const taxPercent = parseFloat(address.tax_override_percent.toString());
    if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 1) {
      errors.push({ 
        field: 'tax_override_percent', 
        message: 'Tax percentage must be between 0 and 100%' 
      });
    }
  }

  // Business logic validations
  if (address.tax_override_percent && !address.tax_override_reason?.trim()) {
    errors.push({ 
      field: 'tax_override_reason', 
      message: 'Tax override reason is required when overriding tax percentage' 
    });
  }

  return errors;
};

export const hasValidationErrors = (address: Address): boolean => {
  return validateAddress(address).length > 0;
};

export const getFieldError = (address: Address, fieldName: string): string | null => {
  const errors = validateAddress(address);
  const fieldError = errors.find(error => error.field === fieldName);
  return fieldError ? fieldError.message : null;
};

export const formatPostalCode = (postalCode: string, country: string): string => {
  if (!postalCode) return postalCode;
  
  const cleaned = postalCode.replace(/\s/g, '').toUpperCase();
  
  if (country === 'Canada' && cleaned.length === 6) {
    // Format Canadian postal code: A1A1A1 -> A1A 1A1
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
  }
  
  return cleaned;
};

export const sanitizeAddressData = (address: Address): Address => {
  return {
    ...address,
    address_line1: address.address_line1?.trim() || '',
    address_line2: address.address_line2?.trim() || '',
    city: address.city?.trim() || '',
    province_state_short: address.province_state_short?.trim() || '',
    postal_zip: address.postal_zip ? formatPostalCode(address.postal_zip, address.country) : '',
    tax_override_reason: address.tax_override_reason?.trim() || '',
    comments: address.comments?.trim() || ''
  };
};