/**
 * Pricing Table Definitions - Server-side whitelist
 *
 * Defines all pricing tables that can be managed via the generic CRUD API.
 * All table/column names come from this hardcoded config, NEVER from user input.
 * This prevents SQL injection by design.
 */

export type ColumnType = 'string' | 'decimal' | 'integer' | 'boolean' | 'date' | 'text' | 'enum' | 'json';

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  required?: boolean;
  enumValues?: string[];
  /** Column name needs backtick quoting (e.g., reserved words like `Index`, `Value`) */
  needsQuoting?: boolean;
}

export interface PricingTableDefinition {
  tableName: string;
  primaryKey: string;
  /** Primary key needs backtick quoting */
  primaryKeyNeedsQuoting?: boolean;
  autoIncrement: boolean;
  columns: ColumnDefinition[];
  hasActiveFilter: boolean;
  hasEffectiveDate: boolean;
  /** Default ORDER BY clause */
  orderBy?: string;
}

const pricingTableDefinitions: Record<string, PricingTableDefinition> = {
  channel_letter_types: {
    tableName: 'channel_letter_types',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: true,
    orderBy: 'type_name ASC',
    columns: [
      { name: 'type_name', type: 'string', required: true },
      { name: 'type_code', type: 'string', required: true },
      { name: 'base_rate_per_inch', type: 'decimal', required: true },
      { name: 'led_default', type: 'integer' },
      { name: 'led_multiplier', type: 'decimal' },
      { name: 'requires_pins', type: 'boolean' },
      { name: 'effective_date', type: 'date', required: true },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  substrate_cut_pricing: {
    tableName: 'substrate_cut_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: true,
    orderBy: 'substrate_name ASC',
    columns: [
      { name: 'substrate_name', type: 'string', required: true },
      { name: 'material_cost_per_sheet', type: 'decimal', required: true },
      { name: 'cutting_rate_per_sheet', type: 'decimal' },
      { name: 'sheet_size_sqft', type: 'decimal' },
      { name: 'effective_date', type: 'date', required: true },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  substrate_cut_base_pricing: {
    tableName: 'substrate_cut_base_pricing',
    primaryKey: 'Index',
    primaryKeyNeedsQuoting: true,
    autoIncrement: false,
    hasActiveFilter: false,
    hasEffectiveDate: false,
    orderBy: '`Index` ASC',
    columns: [
      { name: 'Index', type: 'integer', required: true, needsQuoting: true },
      { name: 'name', type: 'string', required: true },
      { name: 'Value', type: 'decimal', required: true, needsQuoting: true }
    ]
  },

  vinyl_pricing: {
    tableName: 'vinyl_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: true,
    orderBy: 'vinyl_component ASC',
    columns: [
      { name: 'vinyl_component', type: 'string', required: true },
      { name: 'component_code', type: 'string', required: true },
      { name: 'componentl_type', type: 'string', required: true },
      { name: 'price', type: 'decimal', required: true },
      { name: 'effective_date', type: 'date' },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  painting_pricing: {
    tableName: 'painting_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: true,
    orderBy: 'id ASC',
    columns: [
      { name: 'sqft_price', type: 'decimal', required: true },
      { name: 'prep_rate_per_hour', type: 'decimal', required: true },
      { name: 'return_3in_sqft_per_length', type: 'decimal', required: true },
      { name: 'return_4in_sqft_per_length', type: 'decimal', required: true },
      { name: 'return_5in_sqft_per_length', type: 'decimal', required: true },
      { name: 'trim_cap_sqft_per_length', type: 'decimal', required: true },
      { name: 'effective_date', type: 'date', required: true },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  material_cut_pricing: {
    tableName: 'material_cut_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: true,
    orderBy: 'id ASC',
    columns: [
      { name: 'return_3in_material_only', type: 'decimal', required: true },
      { name: 'return_3in_material_cut', type: 'decimal', required: true },
      { name: 'return_3in_prime_ret', type: 'decimal', required: true },
      { name: 'return_4in_material_only', type: 'decimal', required: true },
      { name: 'return_4in_material_cut', type: 'decimal', required: true },
      { name: 'return_4in_prime_ret', type: 'decimal', required: true },
      { name: 'return_5in_material_only', type: 'decimal', required: true },
      { name: 'return_5in_material_cut', type: 'decimal', required: true },
      { name: 'return_5in_prime_ret', type: 'decimal', required: true },
      { name: 'trim_cap_material_only', type: 'decimal', required: true },
      { name: 'trim_cap_material_cut', type: 'decimal', required: true },
      { name: 'pc_base_cost', type: 'decimal', required: true },
      { name: 'pc_length_cost', type: 'decimal', required: true },
      { name: 'acm_base_cost', type: 'decimal', required: true },
      { name: 'acm_length_cost', type: 'decimal', required: true },
      { name: 'design_fee', type: 'decimal', required: true },
      { name: 'effective_date', type: 'date', required: true },
      { name: 'expires_date', type: 'date' },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  push_thru_pricing: {
    tableName: 'push_thru_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: true,
    orderBy: 'push_thru_type ASC',
    columns: [
      { name: 'push_thru_type', type: 'string', required: true },
      { name: 'push_thru_code', type: 'string', required: true },
      { name: 'backer_rate_per_sqft', type: 'decimal', required: true },
      { name: 'acrylic_rate_per_sqft', type: 'decimal', required: true },
      { name: 'led_rate_per_sqft', type: 'decimal', required: true },
      { name: 'transformer_base_cost', type: 'decimal', required: true },
      { name: 'multi_component_rules', type: 'json' },
      { name: 'transformer_sizing_rules', type: 'json' },
      { name: 'effective_date', type: 'date', required: true },
      { name: 'expires_date', type: 'date' },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  push_thru_assembly_pricing: {
    tableName: 'push_thru_assembly_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: false,
    orderBy: 'id ASC',
    columns: [
      { name: 'base_cost_per_sheet', type: 'decimal', required: true },
      { name: 'size_cost_per_32sqft', type: 'decimal', required: true },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  blade_sign_pricing: {
    tableName: 'blade_sign_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: false,
    orderBy: 'config_name ASC',
    columns: [
      { name: 'config_name', type: 'string', required: true },
      { name: 'config_value', type: 'decimal', required: true },
      { name: 'config_description', type: 'string' },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  wiring_pricing: {
    tableName: 'wiring_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: true,
    orderBy: 'wiring_type ASC',
    columns: [
      { name: 'wiring_type', type: 'string', required: true },
      { name: 'wiring_code', type: 'string', required: true },
      { name: 'dc_plug_cost_per_unit', type: 'decimal', required: true },
      { name: 'wall_plug_cost_per_unit', type: 'decimal', required: true },
      { name: 'wire_cost_per_ft', type: 'decimal', required: true },
      { name: 'effective_date', type: 'date', required: true },
      { name: 'expires_date', type: 'date' },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  ul_listing_pricing: {
    tableName: 'ul_listing_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: true,
    orderBy: 'ul_type ASC',
    columns: [
      { name: 'ul_type', type: 'string', required: true },
      { name: 'ul_code', type: 'string', required: true },
      { name: 'base_fee', type: 'decimal', required: true },
      { name: 'per_set_fee', type: 'decimal' },
      { name: 'minimum_sets', type: 'integer' },
      { name: 'effective_date', type: 'date', required: true },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  shipping_rates_pricing: {
    tableName: 'shipping_rates_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: true,
    orderBy: 'shipping_type ASC',
    columns: [
      { name: 'shipping_type', type: 'string', required: true },
      { name: 'shipping_code', type: 'string', required: true },
      { name: 'base_rate', type: 'decimal', required: true },
      { name: 'pallet_rate', type: 'decimal' },
      { name: 'crate_rate', type: 'decimal' },
      { name: 'b_rate', type: 'decimal' },
      { name: 'bb_rate', type: 'decimal' },
      { name: 'big_b_rate', type: 'decimal' },
      { name: 'big_bb_rate', type: 'decimal' },
      { name: 'tailgate_rate', type: 'decimal' },
      { name: 'effective_date', type: 'date', required: true },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  led_neon_pricing: {
    tableName: 'led_neon_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: false,
    orderBy: 'solder_type ASC',
    columns: [
      { name: 'solder_type', type: 'string', required: true },
      { name: 'price', type: 'decimal', required: true },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  pin_types: {
    tableName: 'pin_types',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: false,
    orderBy: 'display_order ASC, type_name ASC',
    columns: [
      { name: 'type_name', type: 'string', required: true },
      { name: 'description', type: 'string' },
      { name: 'base_cost', type: 'decimal' },
      { name: 'is_active', type: 'boolean' },
      { name: 'display_order', type: 'integer' }
    ]
  },

  hinged_raceway_pricing: {
    tableName: 'hinged_raceway_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: false,
    orderBy: 'category_max_width ASC',
    columns: [
      { name: 'category_max_width', type: 'decimal', required: true },
      { name: 'price', type: 'decimal', required: true },
      { name: 'config_description', type: 'string' },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  misc_pricing: {
    tableName: 'misc_pricing',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: true,
    hasEffectiveDate: false,
    orderBy: 'config_name ASC',
    columns: [
      { name: 'config_name', type: 'string', required: true },
      { name: 'config_value', type: 'decimal', required: true },
      { name: 'config_description', type: 'string' },
      { name: 'is_active', type: 'boolean' }
    ]
  },

  pricing_system_config: {
    tableName: 'pricing_system_config',
    primaryKey: 'id',
    autoIncrement: true,
    hasActiveFilter: false,
    hasEffectiveDate: false,
    orderBy: 'config_key ASC',
    columns: [
      { name: 'config_key', type: 'string', required: true },
      { name: 'config_value', type: 'text', required: true },
      { name: 'config_type', type: 'string' },
      { name: 'description', type: 'text' }
    ]
  }
};

/**
 * Get table definition by key. Returns undefined if not whitelisted.
 */
export function getTableDefinition(tableKey: string): PricingTableDefinition | undefined {
  return pricingTableDefinitions[tableKey];
}

/**
 * Get all table keys (for listing available tables)
 */
export function getAllTableKeys(): string[] {
  return Object.keys(pricingTableDefinitions);
}

/**
 * Quote a column name with backticks if it needs quoting
 */
export function quoteColumn(col: ColumnDefinition): string {
  return col.needsQuoting ? `\`${col.name}\`` : col.name;
}

/**
 * Quote the primary key column if needed
 */
export function quotePrimaryKey(def: PricingTableDefinition): string {
  return def.primaryKeyNeedsQuoting ? `\`${def.primaryKey}\`` : def.primaryKey;
}

export default pricingTableDefinitions;
