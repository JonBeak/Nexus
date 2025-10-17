// Backer Pricing Lookup Tables
// Pre-calculated prices for all category combinations
// Generated once per estimate load for maximum performance
//
// This module generates lookup tables using the EXACT same calculation logic
// as backerPricing.ts but does it upfront for all possible combinations

import { PricingDataResource } from '../../../../services/pricingDataResource';

// Import constants from backerPricing.ts (keep in sync)
const BACKER_CONSTANTS = {
  X_CATEGORIES: [59.5, 119.5, 179.5, 239.5],
  Y_CATEGORIES: [15.5, 23.5, 47.5],
  REFERENCE_WIDTH: 119.5,
  REFERENCE_HEIGHT: 47.5,
  ANGLE_LINEAR_DIVISOR: 240,
  TOTAL_ANGLE_COST: 150,
  PER_ANGLE_CUT: 25
};

const HINGED_RACEWAY_LOOKUP = {
  CATEGORIES: [59.5, 119.5, 179.5, 239.5, 299.5],
  PRICES: [190, 305, 420, 570, 685]
};

const ACM_CONSTANTS = {
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
  },
  ANGLE_LINEAR_DIVISOR: 240,
  TOTAL_ANGLE_COST: 225,
  PER_LENGTH_CUT: 25
};

// Unified pricing config (matches backerPricing.ts interface)
interface BackerPricingConfig {
  perimeterType: 'horizontal-only' | 'full-perimeter';
  referenceWidth: number;
  referenceHeight: number;
  totalSheetCost: number;
  shippingCostPerSheet: number;
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
  const angleCost = perimeter / BACKER_CONSTANTS.ANGLE_LINEAR_DIVISOR * config.totalAngleCost;

  // 5. Angle cuts
  const angleCutCount = Math.ceil(perimeter / BACKER_CONSTANTS.ANGLE_LINEAR_DIVISOR);
  const angleCutCost = angleCutCount * config.perCut;

  const totalCost = areaCost + shippingCost + angleCost + angleCutCost;

  // Round up to nearest $5
  return Math.ceil(totalCost / 5) * 5;
}

/**
 * Load aluminum pricing configuration from database
 */
async function loadAluminumPricingConfig(): Promise<BackerPricingConfig> {
  const substratePricing = await PricingDataResource.getSubstrateCutPricing('Alum 0.040"');
  const basePricingMap = await PricingDataResource.getSubstrateCutBasePricingMap();

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
    totalAngleCost: BACKER_CONSTANTS.TOTAL_ANGLE_COST,
    perCut: BACKER_CONSTANTS.PER_ANGLE_CUT
  };
}

/**
 * Load ACM pricing configuration for a specific panel size
 */
async function loadAcmPricingConfig(
  panelName: string,
  referenceWidth: number,
  referenceHeight: number
): Promise<BackerPricingConfig> {
  const substratePricing = await PricingDataResource.getSubstrateCutPricing(panelName);
  const basePricingMap = await PricingDataResource.getSubstrateCutBasePricingMap();

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
    totalAngleCost: ACM_CONSTANTS.TOTAL_ANGLE_COST,
    perCut: ACM_CONSTANTS.PER_LENGTH_CUT
  };
}

/**
 * Generate all lookup tables for backer pricing
 * Called once when estimate loads or pricing data changes
 */
export async function generateBackerLookupTables(): Promise<BackerLookupTables> {
  console.log('[BackerLookup] Generating lookup tables...');
  const startTime = performance.now();

  // Load pricing configurations (3 database queries total)
  const alumConfig = await loadAluminumPricingConfig();
  const acmSmallConfig = await loadAcmPricingConfig(
    ACM_CONSTANTS.SMALL_PANEL.NAME,
    ACM_CONSTANTS.SMALL_PANEL.WIDTH,
    ACM_CONSTANTS.SMALL_PANEL.HEIGHT
  );
  const acmLargeConfig = await loadAcmPricingConfig(
    ACM_CONSTANTS.LARGE_PANEL.NAME,
    ACM_CONSTANTS.LARGE_PANEL.WIDTH,
    ACM_CONSTANTS.LARGE_PANEL.HEIGHT
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

  // Hinged raceway lookup (hardcoded prices)
  const hingedRaceway: Record<string, number> = {};
  HINGED_RACEWAY_LOOKUP.CATEGORIES.forEach((category, index) => {
    hingedRaceway[category.toString()] = HINGED_RACEWAY_LOOKUP.PRICES[index];
  });

  const elapsed = performance.now() - startTime;
  console.log(
    `[BackerLookup] Generated ${Object.keys(aluminum).length} aluminum + ` +
    `${Object.keys(acmSmall).length} ACM small + ` +
    `${Object.keys(acmLarge).length} ACM large + ` +
    `${Object.keys(hingedRaceway).length} raceway entries in ${elapsed.toFixed(2)}ms`
  );

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
