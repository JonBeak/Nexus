import React from 'react';
import { Customer, Address, LedType, PowerSupplyType, ProvinceState } from '../../../types/index';

export interface CustomerCreateData {
  company_name: string;
  quickbooks_name?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  email?: string;
  phone?: string;
  invoice_email?: string;
  invoice_email_preference?: string;
  payment_terms?: string;
  discount?: number;
  cash_yes_or_no?: boolean;
  notes?: string;
  active?: boolean;
  // QuickBooks integration
  createInQB?: boolean;
  // Product preferences with CORRECTED field names
  leds_yes_or_no?: boolean;
  led_id?: string;
  wire_length?: number;
  powersupply_yes_or_no?: boolean;
  power_supply_id?: string;
  ul_yes_or_no?: boolean;
  drain_holes_yes_or_no?: boolean;
  pattern_yes_or_no?: boolean;
  pattern_type?: string; // CORRECTED: was pattern_paper_or_digital
  wiring_diagram_yes_or_no?: boolean;
  wiring_diagram_type?: string; // CORRECTED: was wiring_diagram_paper_or_digital
  plug_n_play_yes_or_no?: boolean; // CORRECTED: was plug_and_play_yes_or_no
  // Shipping
  shipping_yes_or_no?: boolean;
  shipping_multiplier?: number;
  shipping_flat?: number; // CORRECTED: was flat_shipping_rate
  default_turnaround?: number;
  comments?: string;
  special_instructions?: string;
  // Addresses
  addresses?: Partial<Address>[];
}

export interface CustomerFormCreateProps {
  formData: CustomerCreateData;
  ledTypes: LedType[];
  powerSupplyTypes: PowerSupplyType[];
  onInputChange: <K extends keyof CustomerCreateData>(
    field: K,
    value: CustomerCreateData[K] | null
  ) => void;
}

export interface AddressManagerCreateProps {
  addresses: Partial<Address>[];
  setAddresses: React.Dispatch<React.SetStateAction<Partial<Address>[]>>;
  provincesStates: ProvinceState[];
}

export interface ProvinceState {
  province_short: string;
  province_long: string;
  country_group: string;
}

export interface CustomerCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
  ledTypes: LedType[];
  powerSupplyTypes: PowerSupplyType[];
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// QuickBooks creation result from backend
export interface QBCreationResult {
  success: boolean;
  qbCustomerId?: string;
  existingCustomer?: boolean;
  error?: {
    type: 'VALIDATION' | 'DUPLICATE' | 'CONNECTION' | 'NOT_CONNECTED' | 'UNKNOWN';
    message: string;
    canRetry: boolean;
    canProceedLocal: boolean;
  };
}

// Default values aligned with database schema
export const DEFAULT_CUSTOMER_VALUES: CustomerCreateData = {
  company_name: '',
  quickbooks_name: '',
  contact_first_name: '',
  contact_last_name: '',
  email: '',
  phone: '',
  invoice_email: '',
  invoice_email_preference: '',
  payment_terms: 'Due on Receipt',
  discount: 0,
  cash_yes_or_no: false,
  notes: '',
  active: true,
  // QuickBooks - checked by default
  createInQB: true,
  // Product preferences - CORRECTED defaults to match DB
  leds_yes_or_no: true, // DB default: 1
  led_id: '',
  wire_length: undefined,
  powersupply_yes_or_no: true, // DB default: 1
  power_supply_id: '',
  ul_yes_or_no: true, // DB default: 1
  drain_holes_yes_or_no: true, // DB default: 1
  pattern_yes_or_no: true, // DB default: 1
  pattern_type: 'Paper', // DB default: 'Paper'
  wiring_diagram_yes_or_no: true, // DB default: 1
  wiring_diagram_type: 'Paper', // DB default: 'Paper'
  plug_n_play_yes_or_no: false, // DB default: 0
  // Shipping
  shipping_yes_or_no: false,
  shipping_multiplier: 1.5, // DB default: 1.50000
  shipping_flat: 0,
  default_turnaround: 10,
  comments: '',
  special_instructions: ''
};
