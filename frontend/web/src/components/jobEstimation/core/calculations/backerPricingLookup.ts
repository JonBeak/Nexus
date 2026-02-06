// Backer Pricing Lookup Tables
// Pre-calculated prices for all category combinations
// Generated once per estimate load for maximum performance
//
// This module generates lookup tables using the EXACT same calculation logic
// as backerPricing.ts but does it upfront for all possible combinations

import { PricingDataResource, MiscPricingMap } from '../../../../services/pricingDataResource';

// Structural constants (categories, panel sizes, reference dimensions)
// These define the grid structure — NOT pricing values
export const BACKER_CONSTANTS = {
  X_CATEGORIES: [59.5, 119.5, 179.5, 239.5],
  Y_CATEGORIES: [15.5, 23.5, 47.5],
  REFERENCE_WIDTH: 119.5,
  REFERENCE_HEIGHT: 47.5
};

export const HINGED_RACEWAY_LOOKUP = {
  CATEGORIES: [59.5, 119.5, 179.5, 239.5, 299.5]
};

export const ACM_CONSTANTS = {
  X_CATEGORIES: [48, 60, 96, 120, 192, 240, 300],
  Y_CATEGORIES: [15.5, 23.5, 29, 48, 60],
  SMALL_PANEL: {
    NAME: 'ACM 3mm',
    WIDTH: 96,
    HEIGHT: 48,
    MAX_X: 96,
    MAX_Y: 48
  },
  LARGE_PANEL: {
    NAME: 'ACM 3mm 5x10',
    WIDTH: 120,
    HEIGHT: 60,
    MAX_X: 300,
    MAX_Y: 60
  }
};

/**
 * Read angle/assembly pricing from misc_pricing DB table.
 * Returns derived totals used by the calculation engine.
 */
function loadMiscPricingValues(misc: MiscPricingMap) {
  const angleLinearDivisor = misc['angle_linear_divisor'] ?? 240;

  // Aluminum: sum individual components → total angle cost
  const alumAngle = misc['alum_angle_cost'] ?? 50;
  const alumAssembly = misc['alum_assembly_cost'] ?? 50;
  const alumMounting = misc['alum_mounting_angle_cost'] ?? 50;
  const alumTotalAngleCost = alumAngle + alumAssembly + alumMounting;
  const alumPerCut = misc['alum_per_angle_cut'] ?? 25;

  // ACM: sum individual components → total angle cost
  const acmAngle = misc['acm_angle_cost'] ?? 75;
  const acmAssembly = misc['acm_assembly_cost'] ?? 100;
  const acmMounting = misc['acm_mounting_angle_cost'] ?? 50;
  const acmTotalAngleCost = acmAngle + acmAssembly + acmMounting;
  const acmPerCut = misc['acm_per_length_cut'] ?? 25;

  return {
    angleLinearDivisor,
    alumTotalAngleCost, alumPerCut,
    acmTotalAngleCost, acmPerCut
  };
}

// Unified pricing config
interface BackerPricingConfig {
  perimeterType: 'horizontal-only' | 'full-perimeter';
  referenceWidth: number;
  referenceHeight: number;
  totalSheetCost: number;
  shippingCostPerSheet: number;
  angleLinearDivisor: number;
  totalAngleCost: number;
  perCut: number;
}

// Lookup table structure
export interface BackerLookupTables {
  aluminum: Record<string, number>;        // "59.5x15.5" → 150
  acmSmall: Record<string, number>;        // "48x15.5" → 200
  acmLarge: Record<string, number>;        // "120x48" → 450
  hingedRaceway: Record<string, number>;   // "59.5" → 190
}

/**
 * Calculate backer price using unified formula (matches backerPricing.ts exactly)
 */
function calculateBackerPrice(
  categoryX: number,
  categoryY: number,
  config: BackerPricingConfig
): number {
  const refArea = config.referenceWidth * config.referenceHeight;
  const categoryArea = categoryX * categoryY;

  // 1. Area cost
  const areaCost = (categoryArea / refArea) * config.totalSheetCost;

  // 2. Shipping
  const sheetCount = Math.ceil(categoryArea / refArea);
  const shippingCost = sheetCount * config.shippingCostPerSheet;

  // 3. Calculate perimeter based on type
  const perimeter = config.perimeterType === 'horizontal-only'
    ? categoryX * 2                      // Aluminum: top and bottom only
    : (categoryX + categoryY) * 2;       // ACM: full perimeter

  // 4. Angle linear footage
  const angleCost = perimeter / config.angleLinearDivisor * config.totalAngleCost;

  // 5. Angle cuts
  const angleCutCount = Math.ceil(perimeter / config.angleLinearDivisor);
  const angleCutCost = angleCutCount * config.perCut;

  const totalCost = areaCost + shippingCost + angleCost + angleCutCost;

  // Round up to nearest $5
  return Math.ceil(totalCost / 5) * 5;
}

/**
 * Load aluminum pricing configuration from database
 */
async function loadAluminumPricingConfig(
  basePricingMap: Record<string, number>,
  miscValues: ReturnType<typeof loadMiscPricingValues>
): Promise<BackerPricingConfig> {
  const substratePricing = await PricingDataResource.getSubstrateCutPricing('Alum 0.040"');

  if (!substratePricing) {
    throw new Error('Alum 0.040" pricing not found in database');
  }

  const materialCostPerSheet = Number(substratePricing.material_cost_per_sheet);
  const cuttingCost = Number(substratePricing.cutting_rate_per_sheet);
  const markupMultiplier = Number(basePricingMap['material_markup_multiplier']) || 1.25;
  const shippingCostPerSheet = Number(basePricingMap['material_base_cost']) || 50;
  const totalSheetCost = (materialCostPerSheet * markupMultiplier) + cuttingCost;

  return {
    perimeterType: 'horizontal-only',
    referenceWidth: BACKER_CONSTANTS.REFERENCE_WIDTH,
    referenceHeight: BACKER_CONSTANTS.REFERENCE_HEIGHT,
    totalSheetCost,
    shippingCostPerSheet,
    angleLinearDivisor: miscValues.angleLinearDivisor,
    totalAngleCost: miscValues.alumTotalAngleCost,
    perCut: miscValues.alumPerCut
  };
}

/**
 * Load ACM pricing configuration for a specific panel size
 */
async function loadAcmPricingConfig(
  panelName: string,
  referenceWidth: number,
  referenceHeight: number,
  basePricingMap: Record<string, number>,
  miscValues: ReturnType<typeof loadMiscPricingValues>
): Promise<BackerPricingConfig> {
  const substratePricing = await PricingDataResource.getSubstrateCutPricing(panelName);

  if (!substratePricing) {
    throw new Error(`${panelName} pricing not found in database`);
  }

  const materialCostPerSheet = Number(substratePricing.material_cost_per_sheet);
  const cuttingCost = Number(substratePricing.cutting_rate_per_sheet);
  const markupMultiplier = Number(basePricingMap['material_markup_multiplier']) || 1.25;
  const shippingCostPerSheet = Number(basePricingMap['material_base_cost']) || 50;
  const totalSheetCost = (materialCostPerSheet * markupMultiplier) + cuttingCost;

  return {
    perimeterType: 'full-perimeter',
    referenceWidth,
    referenceHeight,
    totalSheetCost,
    shippingCostPerSheet,
    angleLinearDivisor: miscValues.angleLinearDivisor,
    totalAngleCost: miscValues.acmTotalAngleCost,
    perCut: miscValues.acmPerCut
  };
}

/**
 * Generate all lookup tables for backer pricing
 * Called once when estimate loads or pricing data changes
 * Reads angle/assembly costs from misc_pricing DB table
 */
export async function generateBackerLookupTables(): Promise<BackerLookupTables> {
  // Load shared data once (all cached — no redundant queries)
  const [basePricingMap, miscPricingMap, racewayRows] = await Promise.all([
    PricingDataResource.getSubstrateCutBasePricingMap(),
    PricingDataResource.getMiscPricingMap(),
    PricingDataResource.getHingedRacewayPricing()
  ]);
  const miscValues = loadMiscPricingValues(miscPricingMap);

  // Load pricing configurations
  const alumConfig = await loadAluminumPricingConfig(basePricingMap, miscValues);
  const acmSmallConfig = await loadAcmPricingConfig(
    ACM_CONSTANTS.SMALL_PANEL.NAME,
    ACM_CONSTANTS.SMALL_PANEL.WIDTH,
    ACM_CONSTANTS.SMALL_PANEL.HEIGHT,
    basePricingMap, miscValues
  );
  const acmLargeConfig = await loadAcmPricingConfig(
    ACM_CONSTANTS.LARGE_PANEL.NAME,
    ACM_CONSTANTS.LARGE_PANEL.WIDTH,
    ACM_CONSTANTS.LARGE_PANEL.HEIGHT,
    basePricingMap, miscValues
  );

  // Pre-calculate aluminum lookup table (4 x 3 = 12 combinations)
  const aluminum: Record<string, number> = {};
  for (const x of BACKER_CONSTANTS.X_CATEGORIES) {
    for (const y of BACKER_CONSTANTS.Y_CATEGORIES) {
      const price = calculateBackerPrice(x, y, alumConfig);
      aluminum[`${x}x${y}`] = price;
    }
  }

  // Pre-calculate ACM Small panel lookup table (combinations that fit small panel)
  const acmSmall: Record<string, number> = {};
  for (const x of ACM_CONSTANTS.X_CATEGORIES) {
    if (x > ACM_CONSTANTS.SMALL_PANEL.MAX_X) continue;
    for (const y of ACM_CONSTANTS.Y_CATEGORIES) {
      if (y > ACM_CONSTANTS.SMALL_PANEL.MAX_Y) continue;
      const price = calculateBackerPrice(x, y, acmSmallConfig);
      acmSmall[`${x}x${y}`] = price;
    }
  }

  // Pre-calculate ACM Large panel lookup table (7 x 5 = 35 combinations)
  const acmLarge: Record<string, number> = {};
  for (const x of ACM_CONSTANTS.X_CATEGORIES) {
    for (const y of ACM_CONSTANTS.Y_CATEGORIES) {
      const price = calculateBackerPrice(x, y, acmLargeConfig);
      acmLarge[`${x}x${y}`] = price;
    }
  }

  // Hinged raceway lookup (prices from hinged_raceway_pricing DB table)
  const hingedRaceway: Record<string, number> = {};
  for (const row of racewayRows) {
    hingedRaceway[Number(row.category_max_width).toString()] = Number(row.price);
  }

  return { aluminum, acmSmall, acmLarge, hingedRaceway };
}

/**
 * Lookup aluminum backer price from pre-calculated table
 */
export function lookupAluminumPrice(
  categoryX: number,
  categoryY: number,
  lookupTables: BackerLookupTables
): number | null {
  const key = `${categoryX}x${categoryY}`;
  return lookupTables.aluminum[key] ?? null;
}

/**
 * Lookup ACM backer price from pre-calculated table
 * Automatically selects correct panel size based on dimensions
 */
export function lookupAcmPrice(
  categoryX: number,
  categoryY: number,
  lookupTables: BackerLookupTables
): number | null {
  const key = `${categoryX}x${categoryY}`;

  // Try small panel first (more common)
  if (categoryX <= ACM_CONSTANTS.SMALL_PANEL.MAX_X && categoryY <= ACM_CONSTANTS.SMALL_PANEL.MAX_Y) {
    const price = lookupTables.acmSmall[key];
    if (price !== undefined) return price;
  }

  // Fall back to large panel
  return lookupTables.acmLarge[key] ?? null;
}

/**
 * Lookup hinged raceway price from pre-calculated table
 */
export function lookupHingedRacewayPrice(
  category: number,
  lookupTables: BackerLookupTables
): number | null {
  return lookupTables.hingedRaceway[category.toString()] ?? null;
}
