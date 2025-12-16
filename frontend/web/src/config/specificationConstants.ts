/**
 * Specification Constants
 * Type definitions for specification data from API
 *
 * NOTE: Dropdown options are now fetched from database via SpecificationOptionsCache.
 * Hardcoded arrays were removed 2025-12-16 to ensure single source of truth.
 */

/**
 * Types for LED data from API
 */
export interface LEDType {
  led_id: number;
  product_code: string;
  colour: string;
  watts: number;
  volts: number;
  brand: string;
  model: string;
  is_default: boolean;
}

/**
 * Types for Power Supply data from API
 */
export interface PowerSupplyType {
  power_supply_id: number;
  transformer_type: string;
  watts: number;
  rated_watts: number;
  volts: number;
  ul_listed: boolean;
  is_default_non_ul: boolean;
  is_default_ul: boolean;
}
