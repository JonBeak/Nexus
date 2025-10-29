// Validation Context Builder - centralizes derived calculations and context assembly

import { GridRowCore } from '../../types/CoreTypes';
import { ValidationContext } from '../templates/ValidationTemplate';
import { CustomerManufacturingPreferences, ensureSystemDefaultPreferences, getSystemDefaultPreferencesSnapshot } from './useCustomerPreferences';
import { calculateChannelLetterMetrics, ChannelLetterMetrics } from '../utils/channelLetterParser';
import { PricingDataResource } from '../../../../../services/pricingDataResource';

export interface RowCalculatedValues {
  ledCount?: number;
  psCount?: number;
  totalInches?: number;
  totalPerimeter?: number;
  totalWattage?: number;
  savedLedCount?: number;
  defaultLedCount?: number;
  savedPsCount?: number;
  defaultPsCount?: number;
  savedTotalWattage?: number;
  channelLetterMetrics?: ChannelLetterMetrics | null;
  sectionHasUL?: boolean;  // Section-level UL flag for PS optimization
  [key: string]: unknown;
}

export type CalculatedValuesMap = Map<string, RowCalculatedValues>;

export class ValidationContextBuilder {
  static async calculateDerivedValues(
    rows: GridRowCore[],
    customerPreferences?: CustomerManufacturingPreferences
  ): Promise<CalculatedValuesMap> {
    const calculatedValues: CalculatedValuesMap = new Map();

    for (const row of rows) {
      const calculations: RowCalculatedValues = {
        savedLedCount: 0,
        defaultLedCount: 0,
        savedPsCount: 0,
        defaultPsCount: 0,
        savedTotalWattage: 0
      };

      if (row.productTypeId === 1) {
        const metrics = calculateChannelLetterMetrics(row.data.field2);
        const savedLedCount = Math.max(0, metrics?.ledCount || 0);
        const defaultLedCount = customerPreferences?.use_leds ? savedLedCount : 0;
        const ledWattage = await this.resolveLedWattage(row, customerPreferences);
        const savedTotalWattage = this.calculateTotalWattage(savedLedCount, ledWattage);
        const savedPsCount = savedLedCount > 0 ? this.calculatePsCount(savedLedCount, savedTotalWattage) : 0;
        const defaultPsCount = defaultLedCount > 0 && customerPreferences?.pref_power_supply_required ? savedPsCount : 0;

        calculations.channelLetterMetrics = metrics;
        calculations.savedLedCount = savedLedCount;
        calculations.defaultLedCount = defaultLedCount;
        calculations.savedTotalWattage = savedTotalWattage;
        calculations.savedPsCount = savedPsCount;
        calculations.defaultPsCount = defaultPsCount;

        const finalLedCount = this.calculateLedCount(
          row,
          customerPreferences,
          metrics,
          savedLedCount,
          defaultLedCount
        );

        calculations.ledCount = finalLedCount;
        calculations.totalInches = metrics?.totalWidth || 0;
        calculations.totalPerimeter = metrics?.totalPerimeter || 0;
        const finalTotalWattage = this.calculateTotalWattage(finalLedCount, ledWattage);
        calculations.totalWattage = finalTotalWattage;

        // Calculate final PS count with customer preference and user overrides
        // Hierarchy: base calculation → customer preference → user override (field9)
        let finalPsCount = 0;
        if (finalLedCount > 0) {
          // Base calculation
          const basePsCount = this.calculatePsCount(finalLedCount, finalTotalWattage);

          // Parse field9 override (string → number/'yes'/'no'/null)
          const field9Raw = row.data.field9?.toString().trim() || '';
          let psCountOverride: number | 'yes' | 'no' | null = null;

          const numeric = parseFloat(field9Raw);
          if (!isNaN(numeric) && field9Raw !== '') {
            psCountOverride = numeric;
          } else if (field9Raw.toLowerCase() === 'yes') {
            psCountOverride = 'yes';
          } else if (field9Raw.toLowerCase() === 'no') {
            psCountOverride = 'no';
          }

          // Apply override logic
          if (psCountOverride === 'no' || psCountOverride === 0) {
            // User explicitly disabled power supplies
            finalPsCount = 0;
          } else if (typeof psCountOverride === 'number' && psCountOverride > 0) {
            // User specified exact count
            finalPsCount = psCountOverride;
          } else if (psCountOverride === 'yes') {
            // User explicitly wants calculated PSs - OVERRIDE customer preference
            finalPsCount = basePsCount;
          } else {
            // No user input (null) - respect customer preference
            finalPsCount = customerPreferences?.pref_power_supply_required ? basePsCount : 0;
          }
        }
        calculations.psCount = finalPsCount;
      }

      // Blade Sign (Product Type 6) - Calculate derived values
      if (row.productTypeId === 6) {
        const bladeSignCalcs = await this.calculateBladeSignValues(row, customerPreferences);
        Object.assign(calculations, bladeSignCalcs);
      }

      // LED Neon (Product Type 7) - Calculate wattage from linear length
      if (row.productTypeId === 7) {
        const ledNeonCalcs = await this.calculateLedNeonValues(row);
        Object.assign(calculations, ledNeonCalcs);
      }

      // LED (Product Type 26) - Calculate derived values from LED count
      if (row.productTypeId === 26) {
        const ledCalcs = await this.calculateLedValues(row, customerPreferences);
        Object.assign(calculations, ledCalcs);
      }

      // ↳ LED (Product Type 18 - sub-item) - uses same calculation as main LED
      if (row.productTypeId === 18) {
        const ledCalcs = await this.calculateLedValues(row, customerPreferences);
        Object.assign(calculations, ledCalcs);
      }

      // Push Thru (Product Type 5) - Calculate LED count from field5
      if (row.productTypeId === 5) {
        const pushThruCalcs = await this.calculatePushThruValues(row, customerPreferences);
        Object.assign(calculations, pushThruCalcs);
      }

      calculatedValues.set(row.id, calculations);
    }

    // PHASE 2: Calculate section-level UL and propagate to all rows
    this.calculateSectionLevelUL(rows, calculatedValues, customerPreferences);

    return calculatedValues;
  }

  static buildContextsMap(
    allRows: GridRowCore[],
    customerPreferences?: CustomerManufacturingPreferences,
    calculatedValues?: CalculatedValuesMap
  ): Map<string, ValidationContext> {
    const contexts = new Map<string, ValidationContext>();

    const gridContext = {
      totalWattage: this.getTotalWattage(allRows, calculatedValues),
      rowCount: allRows.length
    };

    for (const row of allRows) {
      const rowCalculations: RowCalculatedValues = calculatedValues?.get(row.id) ?? {};

      const context: ValidationContext = {
        rowData: row.data,
        customerPreferences: customerPreferences || this.getDefaultPreferences(),
        gridContext,
        calculatedValues: rowCalculations
      };

      contexts.set(row.id, context);
    }

    return contexts;
  }

  private static calculateLedCount(
    row: GridRowCore,
    _customerPreferences: CustomerManufacturingPreferences | undefined,
    _metrics: ChannelLetterMetrics | null | undefined,
    savedLedCount: number,
    defaultLedCount: number
  ): number {
    const rawField3 = row.data.field3?.trim();
    const normalizedField3 = rawField3?.toLowerCase();
    const numericOverride = rawField3 !== undefined && rawField3 !== '' && !isNaN(Number(rawField3))
      ? Number(rawField3)
      : null;

    const hasChannelData = savedLedCount > 0;

    if (!hasChannelData) {
      if (numericOverride !== null) {
        return numericOverride;
      }
      if (normalizedField3 === 'no') {
        return 0;
      }
      if (normalizedField3 === 'yes') {
        return savedLedCount;
      }
      return 0;
    }

    if (numericOverride !== null) {
      return numericOverride;
    }

    if (normalizedField3 === 'no') {
      return 0;
    }

    if (normalizedField3 === 'yes') {
      return savedLedCount;
    }

    return defaultLedCount;
  }

  /**
   * Resolve LED wattage from database based on row data and customer preferences
   * Follows same logic as channelLettersPricing.ts for consistency
   * Priority: field8 (LED Type override) → customer preference → system default
   */
  private static async resolveLedWattage(
    row: GridRowCore,
    customerPreferences?: CustomerManufacturingPreferences
  ): Promise<number> {
    let ledPricing = null;
    let effectiveLedType: string | null = null;

    // Check for field8 LED type override (varies by product type)
    // Channel Letters (1): field8
    // Blade Sign (6): field7 (but not LED type - this is PS override)
    // LED Neon (7): uses fixed wattage per foot
    // LED (26/18): field2
    // Push Thru (5): field6
    let ledTypeField: unknown = null;

    switch (row.productTypeId) {
      case 1: // Channel Letters
        ledTypeField = row.data.field8;
        break;
      case 26: // LED
      case 18: // LED (sub-item)
        ledTypeField = row.data.field2;
        break;
      case 5: // Push Thru
        ledTypeField = row.data.field6;
        break;
      case 6: // Blade Sign - uses same LED type as Channel Letters
        ledTypeField = row.data.field7;
        break;
      default:
        ledTypeField = null;
    }

    if (ledTypeField && typeof ledTypeField === 'string') {
      // Parse the product_code from format: "product_code [colour]"
      const productCodeMatch = ledTypeField.match(/^([^[]+)(?:\s*\[.*\])?$/);
      const productCode = productCodeMatch ? productCodeMatch[1].trim() : ledTypeField;

      effectiveLedType = productCode;
      ledPricing = await PricingDataResource.getLed(productCode);

      if (!ledPricing) {
        console.warn(`LED type '${productCode}' not found in database (from '${ledTypeField}')`);
      }
    }

    if (!ledPricing) {
      // Fall back to customer preference LED
      const customerPrefLedCode = customerPreferences?.pref_led_product_code;
      if (customerPrefLedCode) {
        ledPricing = await PricingDataResource.getLed(customerPrefLedCode);
        if (ledPricing) {
          effectiveLedType = customerPrefLedCode;
        }
      }
    }

    if (!ledPricing) {
      // Fall back to system default LED
      const defaultLed = await PricingDataResource.getDefaultLed();
      if (defaultLed) {
        ledPricing = defaultLed;
        effectiveLedType = defaultLed.product_code;
      }
    }

    if (ledPricing && ledPricing.watts) {
      return ledPricing.watts;
    }

    // Fallback to hardcoded 1.2W if nothing found (should never happen)
    console.warn('No LED wattage found, falling back to 1.2W default');
    return 1.2;
  }

  private static calculateTotalWattage(ledCount: number, ledWattage: number): number {
    return ledCount * ledWattage;
  }

  private static calculatePsCount(ledCount: number, totalWattage: number): number {
    if (ledCount === 0) return 0;
    return Math.ceil(totalWattage / 60);
  }

  private static getTotalWattage(
    rows: GridRowCore[],
    calculatedValues?: CalculatedValuesMap
  ): number {
    let total = 0;
    for (const row of rows) {
      const calculations = calculatedValues?.get(row.id);
      if (calculations?.totalWattage) {
        total += calculations.totalWattage;
      }
    }
    return total;
  }

  /**
   * Calculate Blade Sign derived values
   * Handles dimensions parsing, sqft calculation with circle logic, and LED count
   * LED calculations work independently of dimensions to support LED-only rows
   */
  private static async calculateBladeSignValues(
    row: GridRowCore,
    customerPreferences?: CustomerManufacturingPreferences
  ): Promise<RowCalculatedValues> {
    const calculations: RowCalculatedValues = {};

    // Parse dimensions from field2 (can be [width, height] or single float)
    const field2Value = row.data.field2;
    const shape = (row.data.field1 || '').toLowerCase();

    let width: number | null = null;
    let height: number | null = null;
    let sqft = 0;
    let dimensionBasedLedCount = 0;

    // PART 1: Calculate dimension-based values (if field2 is provided)
    if (field2Value) {
      // Parse dimensions - field2 will already be validated by floatordimensions template
      // So we just need to extract the parsed result
      if (typeof field2Value === 'string') {
        const parts = field2Value.split('x').map(p => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          width = parts[0];
          height = parts[1];
        } else if (parts.length === 1 && !isNaN(parts[0])) {
          width = parts[0];
          height = parts[0]; // Square
        }
      }

      if (width && height) {
        // Calculate actual area in square inches based on shape
        let sqInches: number;
        const rectangleSqInches = width * height;

        if (shape === 'circle') {
          // Ellipse: area = π × (X/2) × (Y/2) = π × X × Y / 4
          const ellipseSqInches = (Math.PI * width * height) / 4;

          // Average of ellipse and rectangle (business rule: circle should be cheaper)
          sqInches = (ellipseSqInches + rectangleSqInches) / 2;
        } else {
          // Rectangle (default)
          sqInches = rectangleSqInches;
        }

        sqft = sqInches / 144;

        calculations.sqft = sqft;
        calculations.sqInches = sqInches;  // Store actual area for reuse
        calculations.width = width;
        calculations.height = height;

        // Calculate LED count from dimensions using MAX(area-based, perimeter-based)
        // Formula: MAX(ROUNDUP(sqinches/100*9, 0), ROUNDUP(SQRT(sqinches)*1.4, 0))
        // IMPORTANT: Uses actual shape area (not bounding box)!
        const areaBasedLeds = Math.ceil((sqInches / 100) * 9);
        const perimeterBasedLeds = Math.ceil(Math.sqrt(sqInches) * 1.4);
        dimensionBasedLedCount = Math.max(areaBasedLeds, perimeterBasedLeds);
      }
    }

    // PART 2: Calculate LED-related values (works independently of dimensions)
    // This allows LEDs#, PS#, and UL to work even without field2
    const rawField3 = row.data.field3?.trim();
    const normalizedField3 = rawField3?.toLowerCase();
    const numericOverride = rawField3 !== undefined && rawField3 !== '' && !isNaN(Number(rawField3))
      ? Number(rawField3)
      : null;

    // Determine savedLedCount (from dimensions if available, otherwise 0)
    const savedLedCount = dimensionBasedLedCount;

    // Determine defaultLedCount (apply customer preference)
    const defaultLedCount = customerPreferences?.use_leds ? savedLedCount : 0;

    calculations.savedLedCount = savedLedCount;
    calculations.defaultLedCount = defaultLedCount;

    // Calculate final LED count based on field3 override logic
    let finalLedCount = defaultLedCount;

    if (numericOverride !== null) {
      // Explicit numeric override (works even without dimensions)
      finalLedCount = numericOverride;
    } else if (normalizedField3 === 'no') {
      // Explicitly disable LEDs
      finalLedCount = 0;
    } else if (normalizedField3 === 'yes') {
      // Use saved LED count (from dimensions if available, or customer preference)
      finalLedCount = savedLedCount;
    }
    // Otherwise use defaultLedCount (already set above)

    calculations.ledCount = finalLedCount;

    // Calculate wattage and PS count (if any LEDs)
    if (finalLedCount > 0) {
      const ledWattage = await this.resolveLedWattage(row, customerPreferences);
      const totalWattage = this.calculateTotalWattage(finalLedCount, ledWattage);
      calculations.totalWattage = totalWattage;
      const basePsCount = this.calculatePsCount(finalLedCount, totalWattage);
      calculations.savedPsCount = basePsCount;
      calculations.defaultPsCount = customerPreferences?.pref_power_supply_required ? basePsCount : 0;

      // Calculate final PS count with customer preference and user overrides
      // Hierarchy: base calculation → customer preference → user override (field4)
      let finalPsCount = 0;

      // Parse field4 override (string → number/'yes'/'no'/null)
      const field4Raw = row.data.field4?.toString().trim() || '';
      let psCountOverride: number | 'yes' | 'no' | null = null;

      const numeric = parseFloat(field4Raw);
      if (!isNaN(numeric) && field4Raw !== '') {
        psCountOverride = numeric;
      } else if (field4Raw.toLowerCase() === 'yes') {
        psCountOverride = 'yes';
      } else if (field4Raw.toLowerCase() === 'no') {
        psCountOverride = 'no';
      }

      // Apply override logic
      if (psCountOverride === 'no' || psCountOverride === 0) {
        // User explicitly disabled power supplies
        finalPsCount = 0;
      } else if (typeof psCountOverride === 'number' && psCountOverride > 0) {
        // User specified exact count
        finalPsCount = psCountOverride;
      } else if (psCountOverride === 'yes') {
        // User explicitly wants calculated PSs - OVERRIDE customer preference
        finalPsCount = basePsCount;
      } else {
        // No user input (null) - respect customer preference
        finalPsCount = customerPreferences?.pref_power_supply_required ? basePsCount : 0;
      }
      calculations.psCount = finalPsCount;
    } else {
      // No LEDs - zero out wattage and PS count
      calculations.totalWattage = 0;
      calculations.psCount = 0;
      calculations.savedPsCount = 0;
      calculations.defaultPsCount = 0;
    }

    return calculations;
  }

  /**
   * Calculate LED Neon derived values
   * Handles wattage calculation from linear length for ps_override validation
   */
  private static async calculateLedNeonValues(row: GridRowCore): Promise<RowCalculatedValues> {
    const calculations: RowCalculatedValues = {};

    // Extract field3 (Length in inches)
    const field3Value = row.data.field3;
    if (!field3Value || field3Value.trim() === '') {
      return calculations;
    }

    const lengthInches = parseFloat(field3Value);
    if (isNaN(lengthInches) || lengthInches <= 0) {
      return calculations;
    }

    // Convert to feet
    const lengthFeet = lengthInches / 12;

    // LED Neon wattage: 4.80W per foot (from leds table)
    const wattsPerFoot = 4.80;
    const totalWattage = lengthFeet * wattsPerFoot;

    // For ps_override validation to work, we need actualLedCount or totalWattage
    // We'll provide totalWattage and a fake ledCount = 1 to pass the ps_override checks
    calculations.totalWattage = totalWattage;
    calculations.ledCount = 1; // Fake LED count to satisfy ps_override validation (actualLedCount > 0)
    calculations.savedLedCount = 1;
    calculations.defaultLedCount = 1;

    // Calculate PS count with customer preference and user overrides
    // Hierarchy: base calculation → customer preference → user override (field7)
    const basePsCount = Math.ceil(totalWattage / 60); // Assuming 60W PS default
    calculations.savedPsCount = basePsCount;
    calculations.defaultPsCount = customerPreferences?.pref_power_supply_required ? basePsCount : 0;

    let finalPsCount = 0;

    // Parse field7 override (string → number/'yes'/'no'/null)
    const field7Raw = row.data.field7?.toString().trim() || '';
    let psCountOverride: number | 'yes' | 'no' | null = null;

    const numeric = parseFloat(field7Raw);
    if (!isNaN(numeric) && field7Raw !== '') {
      psCountOverride = numeric;
    } else if (field7Raw.toLowerCase() === 'yes') {
      psCountOverride = 'yes';
    } else if (field7Raw.toLowerCase() === 'no') {
      psCountOverride = 'no';
    }

    // Apply override logic
    if (psCountOverride === 'no' || psCountOverride === 0) {
      // User explicitly disabled power supplies
      finalPsCount = 0;
    } else if (typeof psCountOverride === 'number' && psCountOverride > 0) {
      // User specified exact count
      finalPsCount = psCountOverride;
    } else if (psCountOverride === 'yes') {
      // User explicitly wants calculated PSs - OVERRIDE customer preference
      finalPsCount = basePsCount;
    } else {
      // No user input (null) - respect customer preference
      finalPsCount = customerPreferences?.pref_power_supply_required ? basePsCount : 0;
    }
    calculations.psCount = finalPsCount;

    return calculations;
  }

  /**
   * Calculate LED (Product Type 26) derived values
   * Handles LED count from field1, with wattage and PS count calculations
   */
  private static async calculateLedValues(
    row: GridRowCore,
    customerPreferences?: CustomerManufacturingPreferences
  ): Promise<RowCalculatedValues> {
    const calculations: RowCalculatedValues = {};

    // Extract field1 (LED #)
    const field1Value = row.data.field1;
    if (!field1Value || field1Value.trim() === '') {
      return calculations;
    }

    const ledCount = parseFloat(field1Value);
    if (isNaN(ledCount) || ledCount <= 0) {
      return calculations;
    }

    // Store LED count
    calculations.ledCount = ledCount;
    calculations.savedLedCount = ledCount;
    calculations.defaultLedCount = ledCount;

    // Calculate wattage using actual LED wattage from database
    const ledWattage = await this.resolveLedWattage(row, customerPreferences);
    const totalWattage = this.calculateTotalWattage(ledCount, ledWattage);
    calculations.totalWattage = totalWattage;

    // Calculate PS count with customer preference and user overrides
    // Hierarchy: base calculation → customer preference → user override (field4)
    const basePsCount = this.calculatePsCount(ledCount, totalWattage);
    calculations.savedPsCount = basePsCount;
    calculations.defaultPsCount = customerPreferences?.pref_power_supply_required ? basePsCount : 0;

    let finalPsCount = 0;

    // Parse field4 override (string → number/'yes'/'no'/null)
    const field4Raw = row.data.field4?.toString().trim() || '';
    let psCountOverride: number | 'yes' | 'no' | null = null;

    const numeric = parseFloat(field4Raw);
    if (!isNaN(numeric) && field4Raw !== '') {
      psCountOverride = numeric;
    } else if (field4Raw.toLowerCase() === 'yes') {
      psCountOverride = 'yes';
    } else if (field4Raw.toLowerCase() === 'no') {
      psCountOverride = 'no';
    }

    // Apply override logic
    if (psCountOverride === 'no' || psCountOverride === 0) {
      // User explicitly disabled power supplies
      finalPsCount = 0;
    } else if (typeof psCountOverride === 'number' && psCountOverride > 0) {
      // User specified exact count
      finalPsCount = psCountOverride;
    } else if (psCountOverride === 'yes') {
      // User explicitly wants calculated PSs - OVERRIDE customer preference
      finalPsCount = basePsCount;
    } else {
      // No user input (null) - respect customer preference
      finalPsCount = customerPreferences?.pref_power_supply_required ? basePsCount : 0;
    }
    calculations.psCount = finalPsCount;

    return calculations;
  }

  /**
   * Calculate Push Thru derived values (Product Type 5)
   * Handles LED count from field5 and PS count calculation
   * Field5: LEDs XY (2D dimensions or float)
   * Field7: PS # (power supply count override)
   */
  private static async calculatePushThruValues(
    row: GridRowCore,
    customerPreferences?: CustomerManufacturingPreferences
  ): Promise<RowCalculatedValues> {
    const calculations: RowCalculatedValues = {};

    // Extract field5 (LED dimensions/count)
    const field5Value = row.data.field5;
    let ledCount = 0;

    if (field5Value) {
      // Parse field5 - can be float or dimensions (X×Y)
      if (typeof field5Value === 'string') {
        const trimmed = field5Value.trim();
        if (trimmed.includes('x')) {
          // Dimensions format: X×Y
          const parts = trimmed.split('x').map(p => parseFloat(p.trim()));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            // Calculate LED count from dimensions
            // Formula: (X+2) × (Y+2) × (5 LEDs / 100 sq.in.)
            const adjustedX = parts[0] + 2;
            const adjustedY = parts[1] + 2;
            const squareInches = adjustedX * adjustedY;
            ledCount = Math.ceil((squareInches / 100) * 5);
          }
        } else {
          // Float format: direct LED count
          const parsed = parseFloat(trimmed);
          if (!isNaN(parsed)) {
            ledCount = Math.ceil(parsed);
          }
        }
      } else if (typeof field5Value === 'number') {
        ledCount = Math.ceil(field5Value);
      }
    }

    // Store LED count
    calculations.ledCount = ledCount;
    calculations.savedLedCount = ledCount;
    calculations.defaultLedCount = ledCount;

    // Calculate wattage and PS count (if any LEDs)
    if (ledCount > 0) {
      const ledWattage = await this.resolveLedWattage(row, customerPreferences);
      const totalWattage = this.calculateTotalWattage(ledCount, ledWattage);
      calculations.totalWattage = totalWattage;

      const basePsCount = this.calculatePsCount(ledCount, totalWattage);
      calculations.savedPsCount = basePsCount;
      calculations.defaultPsCount = customerPreferences?.pref_power_supply_required ? basePsCount : 0;

      // Calculate final PS count with customer preference and user overrides
      // Hierarchy: base calculation → customer preference → user override (field7)
      let finalPsCount = 0;

      // Parse field7 override (string → number/'yes'/'no'/null)
      const field7Raw = row.data.field7?.toString().trim() || '';
      let psCountOverride: number | 'yes' | 'no' | null = null;

      const numeric = parseFloat(field7Raw);
      if (!isNaN(numeric) && field7Raw !== '') {
        psCountOverride = numeric;
      } else if (field7Raw.toLowerCase() === 'yes') {
        psCountOverride = 'yes';
      } else if (field7Raw.toLowerCase() === 'no') {
        psCountOverride = 'no';
      }

      // Apply override logic
      if (psCountOverride === 'no' || psCountOverride === 0) {
        // User explicitly disabled power supplies
        finalPsCount = 0;
      } else if (typeof psCountOverride === 'number' && psCountOverride > 0) {
        // User specified exact count
        finalPsCount = psCountOverride;
      } else if (psCountOverride === 'yes') {
        // User explicitly wants calculated PSs - OVERRIDE customer preference
        finalPsCount = basePsCount;
      } else {
        // No user input (null) - respect customer preference
        finalPsCount = customerPreferences?.pref_power_supply_required ? basePsCount : 0;
      }
      calculations.psCount = finalPsCount;
    } else {
      // No LEDs - zero out wattage and PS count
      calculations.totalWattage = 0;
      calculations.psCount = 0;
      calculations.savedPsCount = 0;
      calculations.defaultPsCount = 0;
    }

    return calculations;
  }

  /**
   * Calculate section-level UL flag for consistent power supply optimization
   *
   * Sections are defined by Subtotal rows (Product Type 21)
   * If ANY row in a section has UL (via field override OR customer pref),
   * ALL rows in that section get sectionHasUL=true for consistent PS selection
   */
  private static calculateSectionLevelUL(
    rows: GridRowCore[],
    calculatedValues: CalculatedValuesMap,
    customerPreferences?: CustomerManufacturingPreferences
  ): void {
    let sectionHasUL = false;
    let currentSectionRowIds: string[] = [];

    for (const row of rows) {
      // Determine if THIS row will have a UL component
      const rowHasUL = this.determineRowUL(row, calculatedValues, customerPreferences);

      // Add row to current section
      currentSectionRowIds.push(row.id);
      if (rowHasUL) {
        sectionHasUL = true;
      }

      // Check if this is a Subtotal row (Product Type 21) - marks end of section
      if (row.productTypeId === 21) {
        // Apply section's UL status to all rows in this section
        for (const rowId of currentSectionRowIds) {
          const calc = calculatedValues.get(rowId);
          if (calc) {
            calc.sectionHasUL = sectionHasUL;
          }
        }

        // Reset for next section
        sectionHasUL = false;
        currentSectionRowIds = [];
      }
    }

    // Handle last section (if no final Subtotal)
    for (const rowId of currentSectionRowIds) {
      const calc = calculatedValues.get(rowId);
      if (calc) {
        calc.sectionHasUL = sectionHasUL;
      }
    }
  }

  /**
   * Determine if a single row will have a UL component for section-level PS optimization
   * Matches the shouldShowUL logic from product calculators:
   * - Explicit override bypasses LED requirement
   * - Customer preference only applies if ledCount > 0
   * Each product type uses a different field for UL override
   */
  private static determineRowUL(
    row: GridRowCore,
    calculatedValues: CalculatedValuesMap,
    customerPreferences?: CustomerManufacturingPreferences
  ): boolean {
    // Select the correct UL field based on product type
    let ulField: unknown = null;

    switch (row.productTypeId) {
      case 1:  // Channel Letters - uses field4
        ulField = row.data.field4;
        break;
      case 5:  // Push Thru - uses field6
        ulField = row.data.field6;
        break;
      case 6:  // Blade Sign - uses field4
        ulField = row.data.field4;
        break;
      case 7:  // LED Neon - no UL support
        return false;
      case 26: // LED - uses field7
        ulField = row.data.field7;
        break;
      case 18: // LED (sub-item) - uses field7
        ulField = row.data.field7;
        break;
      default:
        // Other product types don't have UL
        return false;
    }

    // Check if there's an explicit override
    const ulExplicitlySet = this.hasExplicitULOverride(ulField);
    const hasUL = ulExplicitlySet
      ? this.parseULField(ulField)
      : (customerPreferences?.pref_ul_required === true);

    // Get calculated LED count for this row
    const rowCalcs = calculatedValues.get(row.id);
    const ledCount = rowCalcs?.ledCount ?? 0;

    // Apply shouldShowUL logic: explicit override bypasses LED requirement
    return ulExplicitlySet ? hasUL : (hasUL && ledCount > 0);
  }

  /**
   * Check if UL field has an explicit override
   */
  private static hasExplicitULOverride(ulField: unknown): boolean {
    if (ulField === null || ulField === undefined || ulField === '') return false;

    // Normalize to string and check
    const normalized = String(ulField).toLowerCase().trim();
    if (normalized === 'yes' || normalized === 'no') return true;

    // Check for numeric values (0, 1, 2, etc.)
    const numeric = parseFloat(normalized);
    if (!isNaN(numeric)) return true;

    if (typeof ulField === 'object') return true; // $amount or float
    return false;
  }

  /**
   * Parse UL field to determine hasUL value
   * Accepts: "yes", "no", 0, 1, 2+ (any positive number = yes, 0 = no)
   */
  private static parseULField(ulField: unknown): boolean {
    // Normalize to string and check
    const normalized = String(ulField).toLowerCase().trim();
    if (normalized === 'yes') return true;
    if (normalized === 'no') return false;

    // Check for numeric values
    const numeric = parseFloat(normalized);
    if (!isNaN(numeric)) {
      return numeric > 0;  // Any positive number = yes, 0 = no
    }

    if (typeof ulField === 'object') return true; // $amount or float means UL
    return false; // No explicit override
  }

  private static getDefaultPreferences(): CustomerManufacturingPreferences {
    const cached = getSystemDefaultPreferencesSnapshot();
    if (!cached) {
      void ensureSystemDefaultPreferences().catch(error => {
        console.warn('Unable to load system default preferences for validation context', error);
      });
    }

    if (cached) {
      return {
        ...cached,
        pref_customer_id: cached.pref_customer_id ?? 0
      };
    }

    return {
      pref_customer_id: 0,
      pref_leds_enabled: false,
      pref_led_id: null,
      pref_led_product_code: null,
      pref_led_brand: null,
      pref_led_colour: null,
      pref_led_watts: null,
      pref_wire_length: null,
      pref_power_supply_required: false,
      pref_power_supply_id: null,
      pref_power_supply_type: null,
      pref_power_supply_watts: null,
      pref_power_supply_volts: null,
      pref_power_supply_is_ul_listed: false,
      pref_ul_required: false,
      pref_drain_holes_required: null,
      pref_pattern_required: null,
      pref_pattern_type: null,
      pref_wiring_diagram_required: null,
      pref_wiring_diagram_type: null,
      pref_plug_and_play_required: null,
      pref_shipping_required: null,
      pref_shipping_multiplier: null,
      pref_shipping_flat: null,
      pref_manufacturing_comments: null,
      pref_special_instructions: null,
      use_leds: false,
      default_led_type: 'Standard LED',
      requires_transformers: false
    };
  }
}
