// Material Cut Pricing Calculator
// Dedicated pricing logic for Material Cut products (Product Type 11)
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, ComponentItem, PricingCalculationData } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { formatPrice } from './utils/priceFormatter';

// Material Cut pricing rates interface (raw from database - may be strings)
interface MaterialCutRatesRaw {
  return_3in_material_only: number | string;
  return_3in_material_cut: number | string;
  return_3in_prime_ret: number | string;
  return_4in_material_only: number | string;
  return_4in_material_cut: number | string;
  return_4in_prime_ret: number | string;
  return_5in_material_only: number | string;
  return_5in_material_cut: number | string;
  return_5in_prime_ret: number | string;
  trim_cap_material_only: number | string;
  trim_cap_material_cut: number | string;
  pc_base_cost: number | string;
  pc_length_cost: number | string;
  acm_base_cost: number | string;
  acm_length_cost: number | string;
  design_fee: number | string;
}

// Material Cut pricing rates interface (parsed to numbers)
interface MaterialCutRates {
  return_3in_material_only: number;
  return_3in_material_cut: number;
  return_3in_prime_ret: number;
  return_4in_material_only: number;
  return_4in_material_cut: number;
  return_4in_prime_ret: number;
  return_5in_material_only: number;
  return_5in_material_cut: number;
  return_5in_prime_ret: number;
  trim_cap_material_only: number;
  trim_cap_material_cut: number;
  pc_base_cost: number;
  pc_length_cost: number;
  acm_base_cost: number;
  acm_length_cost: number;
  design_fee: number;
}

/**
 * Fetch material cut pricing rates from PricingDataResource
 * No fallbacks - fails clearly if data missing
 */
async function fetchMaterialCutRates(): Promise<MaterialCutRates> {
  // Get material cut rates using PricingDataResource (cached)
  const rateData = await PricingDataResource.getMaterialCutRates();

  if (!rateData) {
    throw new Error('Material Cut pricing rates not found in database');
  }

  // Parse all values to numbers (database may return strings)
  return {
    return_3in_material_only: parseFloat(rateData.return_3in_material_only as any),
    return_3in_material_cut: parseFloat(rateData.return_3in_material_cut as any),
    return_3in_prime_ret: parseFloat(rateData.return_3in_prime_ret as any),
    return_4in_material_only: parseFloat(rateData.return_4in_material_only as any),
    return_4in_material_cut: parseFloat(rateData.return_4in_material_cut as any),
    return_4in_prime_ret: parseFloat(rateData.return_4in_prime_ret as any),
    return_5in_material_only: parseFloat(rateData.return_5in_material_only as any),
    return_5in_material_cut: parseFloat(rateData.return_5in_material_cut as any),
    return_5in_prime_ret: parseFloat(rateData.return_5in_prime_ret as any),
    trim_cap_material_only: parseFloat(rateData.trim_cap_material_only as any),
    trim_cap_material_cut: parseFloat(rateData.trim_cap_material_cut as any),
    pc_base_cost: parseFloat(rateData.pc_base_cost as any),
    pc_length_cost: parseFloat(rateData.pc_length_cost as any),
    acm_base_cost: parseFloat(rateData.acm_base_cost as any),
    acm_length_cost: parseFloat(rateData.acm_length_cost as any),
    design_fee: parseFloat(rateData.design_fee as any)
  };
}

/**
 * Calculate pricing for Material Cut products
 * Implements the ProductCalculator interface for product type ID 11
 *
 * Field mapping:
 * - field1: Material Type dropdown ("Material Only" or "Material + Cut")
 * - field2: Prime Ret dropdown ("Yes" or "No")
 * - field4: 3" Return (linear feet - float)
 * - field5: 4" Return (linear feet - float)
 * - field6: 5" Return (linear feet - float)
 * - field7: Trim Cap (linear feet - float)
 * - field8: PC (length - float)
 * - field9: ACM (length - float)
 * - field10: Design (hours - float, multiplied by design fee)
 */
export const calculateMaterialCut = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
  // Skip calculation if validation errors exist
  if (input.hasValidationErrors) {
    return {
      status: 'pending',
      display: 'Fix validation errors first',
      data: null
    };
  }

  try {
    // Extract parsed field values
    const quantityRaw = input.parsedValues.quantity as string;
    const quantity = quantityRaw ? parseFloat(quantityRaw) : null;

    if (!quantity || quantity <= 0) {
      return {
        status: 'pending',
        display: 'Quantity required',
        data: null
      };
    }

    // Get field values
    const materialType = input.parsedValues.field1 as string | undefined; // "Material Only" or "Material + Cut"
    const primeRet = input.parsedValues.field2 as string | undefined; // "Yes" or "No"
    const return3in = input.parsedValues.field4 as number | undefined;
    const return4in = input.parsedValues.field5 as number | undefined;
    const return5in = input.parsedValues.field6 as number | undefined;
    const trimCap = input.parsedValues.field7 as number | undefined;
    const pc = input.parsedValues.field8 as number | undefined;
    const acm = input.parsedValues.field9 as number | undefined;
    const design = input.parsedValues.field10 as number | undefined;

    // Fetch pricing rates
    const rates = await fetchMaterialCutRates();

    // Arrays to collect component items
    const components: ComponentItem[] = [];
    let totalPrice = 0;

    // ========== FIELD 4: 3" Return ==========
    if (return3in && return3in > 0) {
      // Round up to multiples of 100
      const roundedLength = Math.ceil(return3in / 100) * 100;

      // Select price based on Material Type and Prime Ret
      let pricePerHundred: number;
      let priceType: string;

      if (primeRet === 'Yes') {
        pricePerHundred = rates.return_3in_prime_ret;
        priceType = 'Prime Ret';
      } else if (materialType === 'Material + Cut') {
        pricePerHundred = rates.return_3in_material_cut;
        priceType = 'Material + Cut';
      } else {
        pricePerHundred = rates.return_3in_material_only;
        priceType = 'Material Only';
      }

      const itemPrice = (roundedLength / 100) * pricePerHundred;
      totalPrice += itemPrice;

      components.push({
        name: '3" Return',
        price: itemPrice,
        type: 'material_cut_return',
        calculationDisplay: `${return3in}′ → ${roundedLength}′ (${priceType}) @ $${formatPrice(pricePerHundred)}/100′ = $${formatPrice(itemPrice)}`
      });
    }

    // ========== FIELD 5: 4" Return ==========
    if (return4in && return4in > 0) {
      const roundedLength = Math.ceil(return4in / 100) * 100;

      let pricePerHundred: number;
      let priceType: string;

      if (primeRet === 'Yes') {
        pricePerHundred = rates.return_4in_prime_ret;
        priceType = 'Prime Ret';
      } else if (materialType === 'Material + Cut') {
        pricePerHundred = rates.return_4in_material_cut;
        priceType = 'Material + Cut';
      } else {
        pricePerHundred = rates.return_4in_material_only;
        priceType = 'Material Only';
      }

      const itemPrice = (roundedLength / 100) * pricePerHundred;
      totalPrice += itemPrice;

      components.push({
        name: '4" Return',
        price: itemPrice,
        type: 'material_cut_return',
        calculationDisplay: `${return4in}′ → ${roundedLength}′ (${priceType}) @ $${formatPrice(pricePerHundred)}/100′ = $${formatPrice(itemPrice)}`
      });
    }

    // ========== FIELD 6: 5" Return ==========
    if (return5in && return5in > 0) {
      const roundedLength = Math.ceil(return5in / 100) * 100;

      let pricePerHundred: number;
      let priceType: string;

      if (primeRet === 'Yes') {
        pricePerHundred = rates.return_5in_prime_ret;
        priceType = 'Prime Ret';
      } else if (materialType === 'Material + Cut') {
        pricePerHundred = rates.return_5in_material_cut;
        priceType = 'Material + Cut';
      } else {
        pricePerHundred = rates.return_5in_material_only;
        priceType = 'Material Only';
      }

      const itemPrice = (roundedLength / 100) * pricePerHundred;
      totalPrice += itemPrice;

      components.push({
        name: '5" Return',
        price: itemPrice,
        type: 'material_cut_return',
        calculationDisplay: `${return5in}′ → ${roundedLength}′ (${priceType}) @ $${formatPrice(pricePerHundred)}/100′ = $${formatPrice(itemPrice)}`
      });
    }

    // ========== FIELD 7: Trim Cap ==========
    if (trimCap && trimCap > 0) {
      const roundedLength = Math.ceil(trimCap / 100) * 100;

      // Trim Cap does not have Prime Ret option
      let pricePerHundred: number;
      let priceType: string;

      if (materialType === 'Material + Cut') {
        pricePerHundred = rates.trim_cap_material_cut;
        priceType = 'Material + Cut';
      } else {
        pricePerHundred = rates.trim_cap_material_only;
        priceType = 'Material Only';
      }

      const itemPrice = (roundedLength / 100) * pricePerHundred;
      totalPrice += itemPrice;

      components.push({
        name: 'Trim Cap',
        price: itemPrice,
        type: 'material_cut_trim',
        calculationDisplay: `${trimCap}′ → ${roundedLength}′ (${priceType}) @ $${formatPrice(pricePerHundred)}/100′ = $${formatPrice(itemPrice)}`
      });
    }

    // ========== FIELD 8: PC (Polycarbonate) ==========
    if (pc && pc > 0) {
      // Formula: ceil(length/96) * base_cost + (length/96) * length_cost
      const baseCost = Math.ceil(pc / 96) * rates.pc_base_cost;
      const lengthCost = (pc / 96) * rates.pc_length_cost;
      const itemPrice = baseCost + lengthCost;
      totalPrice += itemPrice;

      components.push({
        name: 'PC',
        price: itemPrice,
        type: 'material_cut_sheet',
        calculationDisplay: `${pc}″ [⌈${pc}/96⌉×$${formatPrice(rates.pc_base_cost)} + (${pc}/96)×$${formatPrice(rates.pc_length_cost)}] = $${formatPrice(itemPrice)}`
      });
    }

    // ========== FIELD 9: ACM (Aluminum Composite Material) ==========
    if (acm && acm > 0) {
      // Formula: ceil(length/96) * base_cost + (length/96) * length_cost
      const baseCost = Math.ceil(acm / 96) * rates.acm_base_cost;
      const lengthCost = (acm / 96) * rates.acm_length_cost;
      const itemPrice = baseCost + lengthCost;
      totalPrice += itemPrice;

      components.push({
        name: 'ACM',
        price: itemPrice,
        type: 'material_cut_sheet',
        calculationDisplay: `${acm}″ [⌈${acm}/96⌉×$${formatPrice(rates.acm_base_cost)} + (${acm}/96)×$${formatPrice(rates.acm_length_cost)}] = $${formatPrice(itemPrice)}`
      });
    }

    // ========== FIELD 10: Design ==========
    if (design && design > 0) {
      const itemPrice = design * rates.design_fee;
      totalPrice += itemPrice;

      components.push({
        name: 'Design',
        price: itemPrice,
        type: 'material_cut_design',
        calculationDisplay: `${design} hrs @ $${formatPrice(rates.design_fee)}/hr = $${formatPrice(itemPrice)}`
      });
    }

    // ========== FINAL RESULT ==========
    if (totalPrice === 0 || components.length === 0) {
      return {
        status: 'pending',
        display: 'Enter material specifications',
        data: null
      };
    }

    const calculationData: PricingCalculationData = {
      productTypeId: 11,
      rowId: input.rowId,
      itemName: 'Material Cut',
      unitPrice: totalPrice,
      quantity: quantity,
      components: components,
      hasCompleteSet: true
    };

    return {
      status: 'completed',
      display: '', // Not used - components have their own calculationDisplay
      data: calculationData
    };

  } catch (error) {
    console.error('Material Cut pricing calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};
