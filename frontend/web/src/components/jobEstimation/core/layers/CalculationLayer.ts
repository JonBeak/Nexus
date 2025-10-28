// Layer 3: Row-level calculation results - builds complete estimate preview data

import { PricingCalculationContext } from '../types/GridTypes';
import { runRowPricingCalculationFromValidationOutput } from '../calculations/CalculationEngine';
import { applySpecialItemsPostProcessing } from '../calculations/utils/SpecialItemsPostProcessor';

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
  ) => Promise<EstimatePreviewData>;
}

export const createCalculationOperations = (): CalculationOperations => {
  return {
    calculatePricing: async (context) => {
      if (!context.validationResultsManager) {
        return createEmptyEstimateData(context);
      }

      const items: EstimateLineItem[] = [];
      const rowMetadata = context.validationResultsManager.getAllRowMetadata();

      // Track whether UL has been added in any previous rows
      let ulExistsInJob = false;

      // Build product lines without estimatePreviewDisplayNumbers
      for (const [rowId, metadata] of rowMetadata) {
        console.log(`[CalculationLayer] Processing row ${rowId}:`, {
          metadata,
          contextCustomerId: context.customerId,
          contextTaxRate: context.taxRate,
          validationManager: !!context.validationResultsManager
        });

        const calculation = await runRowPricingCalculationFromValidationOutput(
          rowId,
          context,
          ulExistsInJob
        );

        console.log(`[CalculationLayer] Calculation result for row ${rowId}:`, {
          status: calculation.status,
          display: calculation.display,
          data: calculation.data,
          error: calculation.error
        });

        if (calculation.status === 'completed' && calculation.data) {
          // All products must return components array
          if (calculation.data.components?.length > 0) {
            const overallQuantity = calculation.data.quantity || 1;
            for (const component of calculation.data.components) {
              const componentUnitPrice = component.price || 0;
              const componentExtendedPrice = Math.round((componentUnitPrice * overallQuantity) * 100) / 100;
              items.push({
                rowId,
                inputGridDisplayNumber: metadata.displayNumber,
                productTypeId: metadata.productTypeId,
                productTypeName: metadata.productTypeName,
                itemName: component.name ?? '',
                description: '', // Blank for now
                calculationDisplay: (component as any).calculationDisplay || '',  // Use component-specific display if available
                calculationComponents: calculation.data.components,
                unitPrice: componentUnitPrice,
                quantity: overallQuantity,
                extendedPrice: componentExtendedPrice,
                // assemblyGroupId: undefined // Unused for now
              });
            }

            // Check if this row added UL - update flag for next rows
            const hasULComponent = calculation.data.components.some(c => c.type === 'ul');
            if (hasULComponent) {
              ulExistsInJob = true;
            }
          } else {
            // No components returned - this is an error
            console.error(`[CalculationLayer] Product calculator for ${metadata.productTypeName} returned no components`, {
              rowId,
              calculation
            });
          }
        }

        // Reset UL tracker at Subtotal lines (Product Type 21)
        // Each section between subtotals tracks UL independently
        if (metadata.productTypeId === 21) {
          ulExistsInJob = false;
          console.log(`[CalculationLayer] Reset UL tracker at Subtotal row ${rowId}`);
        }
      }

      // TODO: Calculate estimatePreviewDisplayNumbers here later
      // assignEstimateDisplayNumbers(items);

      // Apply Special Items Post-Processing ONLY if there are no blocking validation errors
      // If validation errors exist, skip post-processing to avoid incorrect calculations
      const hasBlockingErrors = context.validationResultsManager.hasBlockingErrors();
      const processedItems = hasBlockingErrors
        ? items // Skip post-processing if validation errors exist
        : applySpecialItemsPostProcessing(items, context); // Process in order: Empty Row > Assembly > Divider > Multiplier > Discount/Fee > Subtotal

      // Calculate totals (using processed items with modified quantities)
      // Exclude Subtotal items (productTypeId 21) from final total - they are informational only
      const rawSubtotal = processedItems
        .filter(item => item.productTypeId !== 21)
        .reduce((sum, item) => sum + item.extendedPrice, 0);
      const subtotal = Math.round(rawSubtotal * 100) / 100; // Round to 2 decimal places
      const taxRate = context.taxRate || 4.0; // Default to 400% if not provided (indicates failure)
      const rawTaxAmount = subtotal * taxRate;
      const taxAmount = Math.round(rawTaxAmount * 100) / 100; // Round to 2 decimal places
      const total = Math.round((subtotal + taxAmount) * 100) / 100; // Round to 2 decimal places

      return {
        items: processedItems,
        subtotal,
        taxRate,
        taxAmount,
        total,
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
