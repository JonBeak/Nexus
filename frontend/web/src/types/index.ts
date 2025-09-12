// Working types file with interfaces

export interface Customer {
  customer_id: number;
  company_name: string;
  contact_first_name?: string;
  contact_last_name?: string;
  email?: string;
  phone?: string;
  cash_yes_or_no: boolean;
  
  // Additional fields from database
  quickbooks_name?: string;
  invoice_email?: string;
  invoice_email_preference?: string;
  tax_id?: string;
  active?: boolean;
  comments?: string;
  special_instructions?: string;
  
  // Payment and terms
  payment_terms?: string;
  discount?: number;
  default_turnaround?: number;
  
  // Product preferences
  leds_yes_or_no?: boolean;
  led_id?: number;
  wire_length?: number;
  led_product_code?: string;
  led_brand?: string;
  led_colour?: string;
  led_watts?: string;
  led_price?: string;
  
  powersupply_yes_or_no?: boolean;
  power_supply_id?: number;
  power_supply_type?: string;
  power_supply_watts?: number;
  power_supply_volts?: number;
  power_supply_price?: string;
  power_supply_ul_listed?: boolean;
  
  ul_yes_or_no?: boolean;
  drain_holes_yes_or_no?: boolean;
  pattern_yes_or_no?: boolean;
  pattern_type?: string;
  wiring_diagram_yes_or_no?: boolean;
  wiring_diagram_type?: string;
  plug_n_play_yes_or_no?: boolean;
  
  // Shipping
  shipping_yes_or_no?: boolean;
  shipping_multiplier?: number;
  shipping_flat?: number;
  
  // Metadata
  created_date?: Date;
  updated_date?: Date;
  
  // Related data
  addresses?: Address[];
}

export interface Address {
  address_id: string | number;
  is_primary: boolean;
  is_billing: boolean;
  is_shipping: boolean;
  is_jobsite: boolean;
  is_mailing: boolean;
  address_line1: string;
  address_line2?: string;
  city: string;
  province_state_short: string;
  postal_zip: string;
  country: string;
  tax_override_percent?: number;
  tax_type?: string;
  tax_id?: number;
  tax_override_reason?: string;
  use_province_tax?: boolean;
  comments?: string;
  is_active?: boolean;
  isEditing?: boolean;
}

export interface LedType {
  led_id: number;
  product_code: string;
  price: string;
  watts: string;
  colour: string;
  brand: string;
  is_default: boolean;
}

export interface PowerSupplyType {
  power_supply_id: number;
  transformer_type: string;
  price: string;
  watts: number;
  volts: number;
  ul_listed: boolean;
  is_default_non_ul: boolean;
  is_default_ul: boolean;
}

// Add a runtime export to test
export const TYPE_VERSION = '1.0.0';