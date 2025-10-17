// Validation Context Builder - centralizes derived calculations and context assembly

import { GridRowCore } from '../../types/CoreTypes';
import { ValidationContext } from '../templates/ValidationTemplate';
import { CustomerManufacturingPreferences, ensureSystemDefaultPreferences, getSystemDefaultPreferencesSnapshot } from './useCustomerPreferences';
import { calculateChannelLetterMetrics, ChannelLetterMetrics } from '../utils/channelLetterParser';

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
  [key: string]: unknown;
}

export type CalculatedValuesMap = Map<string, RowCalculatedValues>;

export class ValidationContextBuilder {
  static calculateDerivedValues(
    rows: GridRowCore[],
    customerPreferences?: CustomerManufacturingPreferences
  ): CalculatedValuesMap {
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
        const savedTotalWattage = this.calculateTotalWattage(savedLedCount);
        const savedPsCount = savedLedCount > 0 ? this.calculatePsCount(savedLedCount, savedTotalWattage) : 0;
        const defaultPsCount = defaultLedCount > 0 && customerPreferences?.requires_transformers ? savedPsCount : 0;

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
        const finalTotalWattage = this.calculateTotalWattage(finalLedCount);
        calculations.totalWattage = finalTotalWattage;
        calculations.psCount = this.calculatePsCount(finalLedCount, finalTotalWattage);
      }

      // Blade Sign (Product Type 6) - Calculate derived values
      if (row.productTypeId === 6) {
        const bladeSignCalcs = this.calculateBladeSignValues(row, customerPreferences);
        Object.assign(calculations, bladeSignCalcs);
      }

      // LED Neon (Product Type 7) - Calculate wattage from linear length
      if (row.productTypeId === 7) {
        const ledNeonCalcs = this.calculateLedNeonValues(row);
        Object.assign(calculations, ledNeonCalcs);
      }

      // LED (Product Type 26) - Calculate derived values from LED count
      if (row.productTypeId === 26) {
        const ledCalcs = this.calculateLedValues(row, customerPreferences);
        Object.assign(calculations, ledCalcs);
      }

      // ↳ LED (Product Type 18 - sub-item) - uses same calculation as main LED
      if (row.productTypeId === 18) {
        const ledCalcs = this.calculateLedValues(row, customerPreferences);
        Object.assign(calculations, ledCalcs);
      }

      calculatedValues.set(row.id, calculations);
    }

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

    console.log('calculateLedCount DEBUG:', {
      rowId: row.id,
      rawField3,
      normalizedField3,
      numericOverride,
      savedLedCount,
      defaultLedCount,
      hasChannelData
    });

    if (!hasChannelData) {
      if (numericOverride !== null) {
        console.log('→ Returning numericOverride (no channel data):', numericOverride);
        return numericOverride;
      }
      if (normalizedField3 === 'no') {
        console.log('→ Returning 0 (no)');
        return 0;
      }
      if (normalizedField3 === 'yes') {
        console.log('→ Returning savedLedCount (yes, no channel data):', savedLedCount);
        return savedLedCount;
      }
      console.log('→ Returning 0 (default, no channel data)');
      return 0;
    }

    if (numericOverride !== null) {
      console.log('→ Returning numericOverride (with channel data):', numericOverride);
      return numericOverride;
    }

    if (normalizedField3 === 'no') {
      console.log('→ Returning 0 (no)');
      return 0;
    }

    if (normalizedField3 === 'yes') {
      console.log('→ Returning savedLedCount (yes):', savedLedCount);
      return savedLedCount;
    }

    console.log('→ Returning defaultLedCount:', defaultLedCount);
    return defaultLedCount;
  }

  private static calculateTotalWattage(ledCount: number): number {
    return ledCount * 1.2;
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
   */
  private static calculateBladeSignValues(
    row: GridRowCore,
    customerPreferences?: CustomerManufacturingPreferences
  ): RowCalculatedValues {
    const calculations: RowCalculatedValues = {};

    // Parse dimensions from field2 (can be [width, height] or single float)
    const field2Value = row.data.field2;
    const shape = (row.data.field1 || '').toLowerCase();

    if (!field2Value) {
      return calculations;
    }

    let width: number | null = null;
    let height: number | null = null;
    let sqft = 0;

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
    }

    // Calculate LED count using MAX(area-based, perimeter-based)
    // Formula: MAX(ROUNDUP(sqinches/100*9, 0), ROUNDUP(SQRT(sqinches)*1.4, 0))
    // IMPORTANT: Uses actual shape area (not bounding box)!
    if (sqft > 0) {
      const sqInches = calculations.sqInches as number; // Reuse calculated area
      const areaBasedLeds = Math.ceil((sqInches / 100) * 9);
      const perimeterBasedLeds = Math.ceil(Math.sqrt(sqInches) * 1.4);
      const calculatedLedCount = Math.max(areaBasedLeds, perimeterBasedLeds);

      calculations.savedLedCount = calculatedLedCount;
      calculations.defaultLedCount = customerPreferences?.use_leds ? calculatedLedCount : 0;

      // Apply field3 override logic (similar to Channel Letters)
      const rawField3 = row.data.field3?.trim();
      const normalizedField3 = rawField3?.toLowerCase();
      const numericOverride = rawField3 !== undefined && rawField3 !== '' && !isNaN(Number(rawField3))
        ? Number(rawField3)
        : null;

      let finalLedCount = calculations.defaultLedCount;

      if (numericOverride !== null) {
        finalLedCount = numericOverride;
      } else if (normalizedField3 === 'no') {
        finalLedCount = 0;
      } else if (normalizedField3 === 'yes') {
        finalLedCount = calculatedLedCount;
      }

      calculations.ledCount = finalLedCount;

      // Calculate wattage and PS count
      const totalWattage = this.calculateTotalWattage(finalLedCount);
      calculations.totalWattage = totalWattage;
      const estimatedPsCount = this.calculatePsCount(finalLedCount, totalWattage);
      calculations.psCount = estimatedPsCount;
      calculations.savedPsCount = estimatedPsCount;
      calculations.defaultPsCount = customerPreferences?.requires_transformers ? estimatedPsCount : 0;
    }

    return calculations;
  }

  /**
   * Calculate LED Neon derived values
   * Handles wattage calculation from linear length for ps_override validation
   */
  private static calculateLedNeonValues(row: GridRowCore): RowCalculatedValues {
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

    // PS calculation - estimate based on wattage
    const estimatedPsCount = Math.ceil(totalWattage / 60); // Assuming 60W PS default
    calculations.savedPsCount = estimatedPsCount;
    calculations.defaultPsCount = estimatedPsCount;

    return calculations;
  }

  /**
   * Calculate LED (Product Type 26) derived values
   * Handles LED count from field1, with wattage and PS count calculations
   */
  private static calculateLedValues(
    row: GridRowCore,
    customerPreferences?: CustomerManufacturingPreferences
  ): RowCalculatedValues {
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

    // Calculate wattage (assume 1.2W per LED)
    const totalWattage = this.calculateTotalWattage(ledCount);
    calculations.totalWattage = totalWattage;

    // Calculate PS count
    const estimatedPsCount = this.calculatePsCount(ledCount, totalWattage);
    calculations.savedPsCount = estimatedPsCount;
    calculations.defaultPsCount = customerPreferences?.requires_transformers ? estimatedPsCount : 0;
    calculations.psCount = calculations.defaultPsCount;

    return calculations;
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
