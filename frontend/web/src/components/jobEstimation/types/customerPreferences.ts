// Type definitions for Customer Preferences Panel and Validation

import { CustomerManufacturingPreferences } from '../core/validation/context/useCustomerPreferences';

export interface CustomerPreferencesData {
  // Customer basic info
  customerId: number;
  customerName: string | null; // QuickBooks DisplayName - null if not configured
  cashCustomer: boolean;
  highStandards: boolean;
  discount?: number;
  defaultTurnaround?: number;

  // Address info
  postalCode?: string;

  // Manufacturing preferences
  preferences: CustomerManufacturingPreferences | null;
}

export interface ValidationError {
  hasError: boolean;
  severity: 'red' | 'yellow';
  subtotalSections?: number[]; // Which subtotal sections have this error
  message?: string;
}

export interface CustomerPreferencesValidationResult {
  ul: ValidationError;
  wireLength: ValidationError;
  plugNPlay: ValidationError;
  shipping: ValidationError;
  discount: ValidationError;
}

export interface SubtotalSection {
  sectionIndex: number;
  startItemIndex: number;
  endItemIndex: number;
  items: any[]; // EstimateLineItem[]
  subtotal: number;
}
