// =====================================================
// PRICING CALCULATION TYPES - User-Isolated System
// =====================================================

export interface CalculationInput {
  productType: string;
  category: string;
  inputData: Record<string, any>;
  quantity?: number;
  userId: number;
  sessionId?: string;
}

export interface CalculationResult {
  itemId: string;
  productType: string;
  category: string;
  calculations: {
    basePrice: number;
    quantity: number;
    subtotal: number;
    breakdown: CalculationBreakdown[];
  };
  description: string;
  internalNotes?: string;
  timestamp: Date;
}

export interface CalculationBreakdown {
  component: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  formula?: string;
}

// User session management
export interface EstimationSession {
  sessionId: string;
  userId: number;
  estimateId?: number; // null for new estimates
  draftData: EstimateDraft;
  lastModified: Date;
  isActive: boolean;
}

export interface EstimateDraft {
  estimateInfo: {
    customer_id?: number;
    estimate_name: string;
    notes?: string;
  };
  groups: EstimateGroupDraft[];
  totals: EstimateTotals;
  multipliers: MultiplierApplication[];
  discounts: DiscountApplication[];
}

export interface EstimateGroupDraft {
  tempId: string; // Frontend-generated ID for draft mode
  groupName: string;
  items: EstimateItemDraft[];
  assemblyDescription?: string;
  assemblyCost: number;
}

export interface EstimateItemDraft {
  tempId: string;
  productTypeId: number;
  itemName: string;
  inputData: Record<string, any>;
  calculations: CalculationResult;
  itemOrder: number;
}

export interface EstimateTotals {
  subtotal: number;
  totalMultipliers: number;
  totalDiscounts: number;
  preTaxTotal: number;
  taxRate: number;
  taxAmount: number;
  finalTotal: number;
}

// Conflict detection
export interface SaveConflict {
  conflictType: 'concurrent_modification' | 'estimate_deleted' | 'permissions_changed';
  conflictDetails: {
    lastServerModified: Date;
    currentUserModified: Date;
    conflictingUser?: string;
    conflictingChanges?: string[];
  };
  resolution: 'overwrite' | 'merge' | 'cancel';
}

// Category-specific calculation interfaces
export interface VinylCalculationInput {
  vinyl_type: string;
  dimensions: string; // "12x8,6x4"
  application_method: string;
  quantity: number;
}

export interface ChannelLetterCalculationInput {
  letter_data: string; // Analysis data
  return_depth: string;
  face_material: string;
  return_color: string;
  quantity: number;
  led_type?: string;
  transformer_required?: boolean;
  ul_listing?: boolean;
}

export interface SubstrateCalculationInput {
  substrate_type: string;
  dimensions: string; // "24x18,12x8"
  cutting_required: boolean;
  drilling_holes?: number;
  hardware?: string;
}

export interface BackerCalculationInput {
  material_type: string;
  dimensions: string; // "48x24x6"
  folding_required: boolean;
}

export interface PushThruCalculationInput {
  backer_dimensions: string;
  acrylic_dimensions: string;
  led_type: string;
  transformer_required: boolean;
}

export interface BladeSignCalculationInput {
  frame_dimensions: string; // "48x12"
  shape: 'Rectangle' | 'Circle' | 'Custom';
  led_required: boolean;
}

export interface LEDNeonCalculationInput {
  neon_type: string;
  linear_footage: number;
  welding_joints?: number;
  standoffs_required?: number;
  opacity: string;
}

export interface PaintingCalculationInput {
  face_dimensions: string; // "24x18,12x8"
  return_depth?: string;
  trim_required: boolean;
}

export interface CustomCalculationInput {
  component_a?: number;
  component_b?: number;
  component_c?: number;
  description: string;
}

export interface WiringCalculationInput {
  dc_plugs?: number;
  wall_plugs?: number;
  wire_pieces?: number;
  wire_length_per_piece?: number;
}

export interface MaterialCutCalculationInput {
  material_type: string;
  dimensions: string;
  cutting_required: boolean;
  trim_cutting?: number;
  design_hours?: number;
}

export interface ShippingCalculationInput {
  shipping_type: string;
  weight: number;
  dimensions: string;
  pallet_required: boolean;
  crate_required: boolean;
}

export interface ULCalculationInput {
  ul_type: string;
  set_count: number;
  drawings_required: boolean;
}

// Multiplier and discount applications
export interface MultiplierApplication {
  multiplierCode: string;
  appliedToItems: string[]; // tempIds
  calculatedMultiplier: number;
  description: string;
}

export interface DiscountApplication {
  discountCode: string;
  appliedToItems: string[]; // tempIds
  calculatedDiscount: number;
  discountType: 'percentage' | 'dollar';
  description: string;
}

// Rate lookup interfaces
export interface RateQueryResult {
  found: boolean;
  rates: Record<string, any>;
  effectiveDate: Date;
  rateTable: string | null;
}

// Validation results
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}