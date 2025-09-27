// Validation Context Builder - centralizes derived calculations and context assembly

import { GridRowCore } from '../../types/CoreTypes';
import { ValidationContext } from '../templates/ValidationTemplate';
import { CustomerManufacturingPreferences } from './useCustomerPreferences';
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
      hasAnyUL: this.hasAnyUL(allRows),
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

  private static calculateTotalWattage(ledCount: number): number {
    return ledCount * 1.2;
  }

  private static calculatePsCount(ledCount: number, totalWattage: number): number {
    if (ledCount === 0) return 0;
    return Math.ceil(totalWattage / 60);
  }

  private static hasAnyUL(rows: GridRowCore[]): boolean {
    return rows.some(row => {
      const ulField = row.data.field4?.trim()?.toLowerCase();
      return ulField === 'yes' || (ulField && ulField !== 'no');
    });
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

  private static getDefaultPreferences(): CustomerManufacturingPreferences {
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
      pref_power_supply_type: 'DC-60W',
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
      requires_transformers: false,
      default_transformer: 'DC-60W',
      default_ul_requirement: false
    };
  }
}
