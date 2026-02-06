/**
 * Pricing Configuration - Frontend section and column definitions
 *
 * Drives the PricingManager UI with 13 grouped sections.
 * Each section has one or more tables with column definitions
 * and an editor type (table, form, or keyvalue).
 */

export type EditorType = 'table' | 'form' | 'keyvalue' | 'custom';
export type ColumnType = 'string' | 'decimal' | 'integer' | 'boolean' | 'date' | 'text' | 'enum' | 'json';

export interface ColumnConfig {
  key: string;
  label: string;
  type: ColumnType;
  required?: boolean;
  editable?: boolean;
  width?: string;
  decimalPlaces?: number;
  enumValues?: string[];
  /** Hide from table display (still sent in forms) */
  hidden?: boolean;
}

export interface TableConfig {
  tableKey: string;
  title: string;
  editorType: EditorType;
  columns: ColumnConfig[];
  primaryKey?: string;
  hasActiveFilter?: boolean;
  customComponent?: string;
}

export interface PricingSection {
  id: string;
  title: string;
  description: string;
  tables: TableConfig[];
}

export const pricingSections: PricingSection[] = [
  // 1. Channel Letters
  {
    id: 'channel-letters',
    title: 'Channel Letters',
    description: 'Letter type rates per inch, LED defaults, and pin requirements',
    tables: [{
      tableKey: 'channel_letter_types',
      title: 'Channel Letter Types',
      editorType: 'table',
      hasActiveFilter: true,
      columns: [
        { key: 'type_name', label: 'Type Name', type: 'string', required: true, width: '180px' },
        { key: 'type_code', label: 'Code', type: 'string', required: true, width: '100px' },
        { key: 'base_rate_per_inch', label: 'Rate/Inch ($)', type: 'decimal', required: true, width: '110px', decimalPlaces: 4 },
        { key: 'led_default', label: 'LED Default', type: 'integer', width: '100px' },
        { key: 'led_multiplier', label: 'LED Multiplier', type: 'decimal', width: '110px', decimalPlaces: 2 },
        { key: 'requires_pins', label: 'Requires Pins', type: 'boolean', width: '100px' },
        { key: 'effective_date', label: 'Effective Date', type: 'date', required: true, width: '130px' }
      ]
    }]
  },

  // 2. Substrate & Cutting
  {
    id: 'substrate-cutting',
    title: 'Substrate & Cutting',
    description: 'Substrate material costs, cutting rates, and base pricing constants',
    tables: [
      {
        tableKey: 'substrate_cut_pricing',
        title: 'Substrate Cut Pricing',
        editorType: 'table',
        hasActiveFilter: true,
        columns: [
          { key: 'substrate_name', label: 'Substrate', type: 'string', required: true, width: '180px' },
          { key: 'material_cost_per_sheet', label: 'Material $/Sheet', type: 'decimal', required: true, width: '130px', decimalPlaces: 4 },
          { key: 'cutting_rate_per_sheet', label: 'Cutting $/Sheet', type: 'decimal', width: '130px', decimalPlaces: 4 },
          { key: 'sheet_size_sqft', label: 'Sheet Size (sqft)', type: 'decimal', width: '130px', decimalPlaces: 4 },
          { key: 'effective_date', label: 'Effective Date', type: 'date', required: true, width: '130px' }
        ]
      },
      {
        tableKey: 'substrate_cut_base_pricing',
        title: 'Base Pricing Constants',
        editorType: 'keyvalue',
        primaryKey: 'Index',
        hasActiveFilter: false,
        columns: [
          { key: 'name', label: 'Name', type: 'string', required: true, editable: false },
          { key: 'Value', label: 'Value', type: 'decimal', required: true, decimalPlaces: 4 }
        ]
      }
    ]
  },

  // 3. Vinyl
  {
    id: 'vinyl',
    title: 'Vinyl',
    description: 'Vinyl component pricing for faces, returns, and trim caps',
    tables: [{
      tableKey: 'vinyl_pricing',
      title: 'Vinyl Pricing',
      editorType: 'table',
      hasActiveFilter: true,
      columns: [
        { key: 'vinyl_component', label: 'Component', type: 'string', required: true, width: '180px' },
        { key: 'component_code', label: 'Code', type: 'string', required: true, width: '100px' },
        { key: 'componentl_type', label: 'Type', type: 'string', required: true, width: '100px' },
        { key: 'price', label: 'Price ($)', type: 'decimal', required: true, width: '100px', decimalPlaces: 4 },
        { key: 'effective_date', label: 'Effective Date', type: 'date', width: '130px' }
      ]
    }]
  },

  // 4. Painting
  {
    id: 'painting',
    title: 'Painting',
    description: 'Paint rates per sqft and prep rates',
    tables: [{
      tableKey: 'painting_pricing',
      title: 'Painting Rates',
      editorType: 'form',
      hasActiveFilter: true,
      columns: [
        { key: 'sqft_price', label: 'Price per SqFt ($)', type: 'decimal', required: true, decimalPlaces: 4 },
        { key: 'prep_rate_per_hour', label: 'Prep Rate per Hour ($)', type: 'decimal', required: true, decimalPlaces: 4 },
        { key: 'return_3in_sqft_per_length', label: '3" Return SqFt/Length', type: 'decimal', required: true, decimalPlaces: 4 },
        { key: 'return_4in_sqft_per_length', label: '4" Return SqFt/Length', type: 'decimal', required: true, decimalPlaces: 4 },
        { key: 'return_5in_sqft_per_length', label: '5" Return SqFt/Length', type: 'decimal', required: true, decimalPlaces: 4 },
        { key: 'trim_cap_sqft_per_length', label: 'Trim Cap SqFt/Length', type: 'decimal', required: true, decimalPlaces: 4 },
        { key: 'effective_date', label: 'Effective Date', type: 'date', required: true }
      ]
    }]
  },

  // 5. Materials & Returns
  {
    id: 'materials-returns',
    title: 'Materials & Returns',
    description: 'Return material costs, trim cap costs, polycarbonate/ACM costs, and design fees',
    tables: [{
      tableKey: 'material_cut_pricing',
      title: 'Material Cut Pricing',
      editorType: 'form',
      hasActiveFilter: true,
      columns: [
        { key: 'return_3in_material_only', label: '3" Return Material Only ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'return_3in_material_cut', label: '3" Return Material+Cut ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'return_3in_prime_ret', label: '3" Prime Return ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'return_4in_material_only', label: '4" Return Material Only ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'return_4in_material_cut', label: '4" Return Material+Cut ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'return_4in_prime_ret', label: '4" Prime Return ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'return_5in_material_only', label: '5" Return Material Only ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'return_5in_material_cut', label: '5" Return Material+Cut ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'return_5in_prime_ret', label: '5" Prime Return ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'trim_cap_material_only', label: 'Trim Cap Material Only ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'trim_cap_material_cut', label: 'Trim Cap Material+Cut ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'pc_base_cost', label: 'PC Base Cost ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'pc_length_cost', label: 'PC Length Cost ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'acm_base_cost', label: 'ACM Base Cost ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'acm_length_cost', label: 'ACM Length Cost ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'design_fee', label: 'Design Fee ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'effective_date', label: 'Effective Date', type: 'date', required: true }
      ]
    }]
  },

  // 6. Backer Panels (read-only calculated display)
  {
    id: 'backer-panels',
    title: 'Backer Panels',
    description: 'Calculated backer pricing from substrate costs + manufacturing constants',
    tables: [{
      tableKey: 'backer_pricing_display',
      title: 'Backer Pricing',
      editorType: 'custom',
      customComponent: 'BackerPricingDisplay',
      columns: []
    }]
  },

  // 7. Push Thru
  {
    id: 'push-thru',
    title: 'Push Thru',
    description: 'Push thru letter pricing and assembly costs',
    tables: [
      {
        tableKey: 'push_thru_pricing',
        title: 'Push Thru Pricing',
        editorType: 'table',
        hasActiveFilter: true,
        columns: [
          { key: 'push_thru_type', label: 'Type', type: 'string', required: true, width: '140px' },
          { key: 'push_thru_code', label: 'Code', type: 'string', required: true, width: '100px' },
          { key: 'backer_rate_per_sqft', label: 'Backer $/SqFt', type: 'decimal', required: true, width: '110px', decimalPlaces: 4 },
          { key: 'acrylic_rate_per_sqft', label: 'Acrylic $/SqFt', type: 'decimal', required: true, width: '110px', decimalPlaces: 4 },
          { key: 'led_rate_per_sqft', label: 'LED $/SqFt', type: 'decimal', required: true, width: '110px', decimalPlaces: 4 },
          { key: 'transformer_base_cost', label: 'Transformer ($)', type: 'decimal', required: true, width: '120px', decimalPlaces: 2 },
          { key: 'effective_date', label: 'Effective Date', type: 'date', required: true, width: '130px' }
        ]
      },
      {
        tableKey: 'push_thru_assembly_pricing',
        title: 'Assembly Pricing',
        editorType: 'form',
        hasActiveFilter: true,
        columns: [
          { key: 'base_cost_per_sheet', label: 'Base Cost per Sheet ($)', type: 'decimal', required: true, decimalPlaces: 2 },
          { key: 'size_cost_per_32sqft', label: 'Size Cost per 32sqft ($)', type: 'decimal', required: true, decimalPlaces: 2 }
        ]
      }
    ]
  },

  // 8. Blade Signs
  {
    id: 'blade-signs',
    title: 'Blade Signs',
    description: 'Blade sign configuration values and rates',
    tables: [{
      tableKey: 'blade_sign_pricing',
      title: 'Blade Sign Config',
      editorType: 'keyvalue',
      hasActiveFilter: true,
      columns: [
        { key: 'config_name', label: 'Config Name', type: 'string', required: true, editable: false },
        { key: 'config_value', label: 'Value', type: 'decimal', required: true, decimalPlaces: 4 },
        { key: 'config_description', label: 'Description', type: 'string' }
      ]
    }]
  },

  // 9. Wiring & UL
  {
    id: 'wiring-ul',
    title: 'Wiring & UL',
    description: 'Wiring costs (DC plugs, wall plugs, wire per foot) and UL listing fees',
    tables: [
      {
        tableKey: 'wiring_pricing',
        title: 'Wiring Pricing',
        editorType: 'form',
        hasActiveFilter: true,
        columns: [
          { key: 'wiring_type', label: 'Type', type: 'string', required: true },
          { key: 'wiring_code', label: 'Code', type: 'string', required: true },
          { key: 'dc_plug_cost_per_unit', label: 'DC Plug Cost ($)', type: 'decimal', required: true, decimalPlaces: 2 },
          { key: 'wall_plug_cost_per_unit', label: 'Wall Plug Cost ($)', type: 'decimal', required: true, decimalPlaces: 2 },
          { key: 'wire_cost_per_ft', label: 'Wire Cost per Ft ($)', type: 'decimal', required: true, decimalPlaces: 4 },
          { key: 'effective_date', label: 'Effective Date', type: 'date', required: true }
        ]
      },
      {
        tableKey: 'ul_listing_pricing',
        title: 'UL Listing Pricing',
        editorType: 'form',
        hasActiveFilter: true,
        columns: [
          { key: 'ul_type', label: 'Type', type: 'string', required: true },
          { key: 'ul_code', label: 'Code', type: 'string', required: true },
          { key: 'base_fee', label: 'Base Fee ($)', type: 'decimal', required: true, decimalPlaces: 2 },
          { key: 'per_set_fee', label: 'Per Set Fee ($)', type: 'decimal', decimalPlaces: 2 },
          { key: 'minimum_sets', label: 'Minimum Sets', type: 'integer' },
          { key: 'effective_date', label: 'Effective Date', type: 'date', required: true }
        ]
      }
    ]
  },

  // 10. Shipping
  {
    id: 'shipping',
    title: 'Shipping',
    description: 'Shipping rates for different box sizes and delivery methods',
    tables: [{
      tableKey: 'shipping_rates_pricing',
      title: 'Shipping Rates',
      editorType: 'form',
      hasActiveFilter: true,
      columns: [
        { key: 'shipping_type', label: 'Type', type: 'string', required: true },
        { key: 'shipping_code', label: 'Code', type: 'string', required: true },
        { key: 'base_rate', label: 'Base Rate ($)', type: 'decimal', required: true, decimalPlaces: 2 },
        { key: 'pallet_rate', label: 'Pallet Rate ($)', type: 'decimal', decimalPlaces: 2 },
        { key: 'crate_rate', label: 'Crate Rate ($)', type: 'decimal', decimalPlaces: 2 },
        { key: 'b_rate', label: 'B Rate ($)', type: 'decimal', decimalPlaces: 2 },
        { key: 'bb_rate', label: 'BB Rate ($)', type: 'decimal', decimalPlaces: 2 },
        { key: 'big_b_rate', label: 'Big B Rate ($)', type: 'decimal', decimalPlaces: 2 },
        { key: 'big_bb_rate', label: 'Big BB Rate ($)', type: 'decimal', decimalPlaces: 2 },
        { key: 'tailgate_rate', label: 'Tailgate Rate ($)', type: 'decimal', decimalPlaces: 2 },
        { key: 'effective_date', label: 'Effective Date', type: 'date', required: true }
      ]
    }]
  },

  // 11. LED Neon
  {
    id: 'led-neon',
    title: 'LED Neon',
    description: 'LED neon solder type pricing',
    tables: [{
      tableKey: 'led_neon_pricing',
      title: 'LED Neon Pricing',
      editorType: 'table',
      hasActiveFilter: true,
      columns: [
        { key: 'solder_type', label: 'Solder Type', type: 'string', required: true, width: '200px' },
        { key: 'price', label: 'Price ($)', type: 'decimal', required: true, width: '120px', decimalPlaces: 2 }
      ]
    }]
  },

  // 12. Pin Types
  {
    id: 'pin-types',
    title: 'Pin Types',
    description: 'Pin types and base costs for channel letter mounting',
    tables: [{
      tableKey: 'pin_types',
      title: 'Pin Types',
      editorType: 'table',
      hasActiveFilter: true,
      columns: [
        { key: 'type_name', label: 'Type Name', type: 'string', required: true, width: '160px' },
        { key: 'description', label: 'Description', type: 'string', width: '200px' },
        { key: 'base_cost', label: 'Base Cost ($)', type: 'decimal', width: '120px', decimalPlaces: 2 },
        { key: 'display_order', label: 'Display Order', type: 'integer', width: '100px' }
      ]
    }]
  },

  // 13. Miscellaneous
  {
    id: 'miscellaneous',
    title: 'Miscellaneous',
    description: 'Angle, assembly, mounting, and hinged raceway pricing constants',
    tables: [{
      tableKey: 'misc_pricing',
      title: 'Misc Pricing',
      editorType: 'keyvalue',
      hasActiveFilter: true,
      columns: [
        { key: 'config_name', label: 'Config Name', type: 'string', required: true, editable: false },
        { key: 'config_value', label: 'Value', type: 'decimal', required: true, decimalPlaces: 4 },
        { key: 'config_description', label: 'Description', type: 'string' }
      ]
    }]
  },

  // 14. System Config
  {
    id: 'system-config',
    title: 'System Config',
    description: 'Global pricing system configuration values',
    tables: [{
      tableKey: 'pricing_system_config',
      title: 'Pricing System Config',
      editorType: 'keyvalue',
      hasActiveFilter: false,
      columns: [
        { key: 'config_key', label: 'Config Key', type: 'string', required: true, editable: false },
        { key: 'config_value', label: 'Value', type: 'text', required: true },
        { key: 'config_type', label: 'Type', type: 'string', editable: false },
        { key: 'description', label: 'Description', type: 'text', editable: false }
      ]
    }]
  }
];
