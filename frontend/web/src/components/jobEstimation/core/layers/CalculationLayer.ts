// Layer 3: Row-level calculation results - builds complete estimate preview data

import { PricingCalculationContext } from '../types/GridTypes';
import { runRowPricingCalculationFromValidationOutput } from '../calculations/CalculationEngine';

export interface EstimateLineItem {
  // Grid reference
  rowId: string;
  inputGridDisplayNumber: string;      // From row metadata
  estimatePreviewDisplayNumber?: string; // Calculate later (separate task)

  // Product info
  productTypeId: number;
  productTypeName: string;
  itemName: string;
  description: string;                 // Blank for now, future lookup

  // Calculation details
  calculationDisplay: string;          // "8 Letters × $45/letter"
  calculationComponents?: any[];       // Detailed breakdown from pricing engine

  // Pricing
  unitPrice: number;
  quantity: number;
  extendedPrice: number;

  // Assembly (unused for now)
  assemblyGroupId?: string;
}

export interface EstimatePreviewData {
  items: EstimateLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;

  // Customer/Estimate metadata
  customerId?: number;
  customerName?: string;
  estimateId?: number;
  cashCustomer?: boolean;
}

export interface CalculationOperations {
  calculatePricing: (
    context: PricingCalculationContext
  ) => EstimatePreviewData;
}

export const createCalculationOperations = (): CalculationOperations => {
  return {
    calculatePricing: (context) => {
      if (!context.validationResultsManager) {
        return createEmptyEstimateData(context);
      }

      const items: EstimateLineItem[] = [];
      const rowMetadata = context.validationResultsManager.getAllRowMetadata();

      // Build product lines without estimatePreviewDisplayNumbers
      for (const [rowId, metadata] of rowMetadata) {
        const calculation = runRowPricingCalculationFromValidationOutput(
          rowId,
          context
        );

        if (calculation.status === 'completed' && calculation.data) {
          // Handle multi-component products (like Channel Letters)
          if (calculation.data.components?.length > 0) {
            for (const component of calculation.data.components) {
              items.push({
                rowId,
                inputGridDisplayNumber: metadata.displayNumber,
                productTypeId: metadata.productTypeId,
                productTypeName: metadata.productTypeName,
                itemName: component.description || 'Component',
                description: '', // Blank for now
                calculationDisplay: calculation.display,
                calculationComponents: calculation.data.components,
                unitPrice: component.price || 0,
                quantity: 1,
                extendedPrice: component.price || 0,
                // assemblyGroupId: undefined // Unused for now
              });
            }
          } else {
            // Single line item
            items.push({
              rowId,
              inputGridDisplayNumber: metadata.displayNumber,
              productTypeId: metadata.productTypeId,
              productTypeName: metadata.productTypeName,
              itemName: calculation.data.itemName || metadata.productTypeName || 'Line Item',
              description: '', // Blank for now
              calculationDisplay: calculation.display,
              calculationComponents: undefined,
              unitPrice: calculation.data.unitPrice || 0,
              quantity: calculation.data.quantity || 1,
              extendedPrice: (calculation.data.unitPrice || 0) * (calculation.data.quantity || 1),
              // assemblyGroupId: undefined // Unused for now
            });
          }
        }
      }

      // TODO: Calculate estimatePreviewDisplayNumbers here later
      // assignEstimateDisplayNumbers(items);

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.extendedPrice, 0);
      const taxRate = context.taxRate || 4.0; // Default to 400% if not provided (indicates failure)
      const taxAmount = subtotal * taxRate;

      return {
        items,
        subtotal,
        taxRate,
        taxAmount,
        total: subtotal + taxAmount,
        customerId: context.customerId,
        customerName: context.customerName,
        estimateId: context.estimateId,
        cashCustomer: context.cashCustomer
      };
    }
  };
};

function createEmptyEstimateData(context: PricingCalculationContext): EstimatePreviewData {
  return {
    items: [],
    subtotal: 0,
    taxRate: context.taxRate || 4.0,
    taxAmount: 0,
    total: 0,
    customerId: context.customerId,
    customerName: context.customerName,
    estimateId: context.estimateId,
    cashCustomer: context.cashCustomer
  };
}
