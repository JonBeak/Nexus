// Layer 3: Row-level calculation results - builds complete estimate preview data

import { PricingCalculationContext } from '../types/GridTypes';
import { runRowPricingCalculationFromValidationOutput } from '../calculations/CalculationEngine';
import { applySpecialItemsPostProcessing } from '../calculations/utils/SpecialItemsPostProcessor';

export interface EstimateLineItem {
  // Grid reference
  rowId: string;
  inputGridDisplayNumber: string;      // From row metadata
  estimatePreviewDisplayNumber?: string; // Calculate later (separate task)
  isParent?: boolean;                  // TRUE for first component in each group (e.g., "1", "2"), FALSE for sub-parts (e.g., "1a", "1b")

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

  // Special rendering flags
  isDescriptionOnly?: boolean;         // True for description-only items (display like Empty Row)

  // QB Description (populated when sending to QuickBooks)
  qbDescription?: string;
}

export interface EstimatePreviewData {
  items: EstimateLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;

  // Customer/Estimate metadata
  customerId?: number;
  customerName?: string | null; // QuickBooks DisplayName - null if not configured
  estimateId?: number;
  cashCustomer?: boolean;
}

export interface CalculationOperations {
  calculatePricing: (
    context: PricingCalculationContext
  ) => Promise<EstimatePreviewData>;
}

/**
 * Assigns estimate preview display numbers to items with sequential base numbering.
 * Handles Sub-Item rows by continuing their parent's letter sequence.
 * Renumbers base numbers sequentially (1, 2, 3...) regardless of input grid gaps.
 *
 * Example:
 *   Input Grid Row 1 (main): Channel Letters → generates Letter(1), LEDs(1a), PS(1b)
 *   Input Grid Row 2 (subItem, parent=Row1): Vinyl → generates Vinyl(1c)
 *   Input Grid Row 5 (main): ACM Panel → generates ACM(2)  [Note: "2" not "5"]
 *
 * @param items - Array of estimate line items (without numbers assigned)
 * @param rowMetadata - Metadata map for looking up rowType and parentId
 * @returns Items with estimatePreviewDisplayNumber and isParent set
 */
function assignEstimatePreviewNumbers(
  items: EstimateLineItem[],
  rowMetadata: Map<string, any>
): EstimateLineItem[] {
  // Step 1: Helper to find logical parent's display number
  const findLogicalParentDisplayNumber = (rowId: string, visitedIds = new Set<string>()): string => {
    // Prevent infinite loops
    if (visitedIds.has(rowId)) {
      console.warn('[assignEstimatePreviewNumbers] Circular parent reference detected', rowId);
      return '1';
    }
    visitedIds.add(rowId);

    const metadata = rowMetadata.get(rowId);
    if (!metadata) {
      return '1'; // Fallback if metadata missing
    }

    // If this row has a parent (Sub-Item row), traverse up
    if (metadata.parentId) {
      return findLogicalParentDisplayNumber(metadata.parentId, visitedIds);
    }

    // This is a root row - use its display number
    return metadata.displayNumber || '1';
  };

  // Step 2: Group items by their logical parent display number
  const itemsByLogicalParent: Map<string, EstimateLineItem[]> = new Map();

  items.forEach(item => {
    const logicalParentNumber = findLogicalParentDisplayNumber(item.rowId);
    const group = itemsByLogicalParent.get(logicalParentNumber) || [];
    group.push(item);
    itemsByLogicalParent.set(logicalParentNumber, group);
  });

  // Step 3: Sort parent display numbers to maintain order
  const sortedParentNumbers = Array.from(itemsByLogicalParent.keys()).sort((a, b) => {
    // Handle display numbers like "1", "1.a", "2", "10"
    // Extract numeric part for comparison
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    return numA - numB;
  });

  // Step 4: Assign sequential base numbers to each group (1, 2, 3, 4...)
  sortedParentNumbers.forEach((oldParentNumber, groupIndex) => {
    const newBaseNumber = String(groupIndex + 1); // Sequential: 1, 2, 3, 4...
    const groupItems = itemsByLogicalParent.get(oldParentNumber)!;

    groupItems.forEach((item, itemIndex) => {
      if (itemIndex === 0) {
        // First component: use sequential base number (e.g., "1", "2", "3")
        item.estimatePreviewDisplayNumber = newBaseNumber;
        item.isParent = true;
      } else {
        // Subsequent components: add letter suffix (a, b, c, ...)
        const letter = String.fromCharCode(96 + itemIndex); // 97='a', 98='b', 99='c'
        item.estimatePreviewDisplayNumber = `${newBaseNumber}${letter}`;
        item.isParent = false;
      }
    });
  });

  return items;
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
        const calculation = await runRowPricingCalculationFromValidationOutput(
          rowId,
          context,
          ulExistsInJob
        );

        if (calculation.status === 'completed' && calculation.data) {
          // All products must return components array
          if (calculation.data.components?.length > 0) {
            const overallQuantity = calculation.data.quantity || 1;
            for (const component of calculation.data.components) {
              const isDescriptionOnly = component.type === 'description';
              const componentUnitPrice = Math.round((component.price || 0) * 100) / 100;
              // Use component-specific quantity if defined (e.g., UL with quantity=1),
              // otherwise use the parent row's overall quantity
              const componentQuantity = component.quantity ?? overallQuantity;
              const componentExtendedPrice = Math.round((componentUnitPrice * componentQuantity) * 100) / 100;
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
                quantity: componentQuantity,
                extendedPrice: componentExtendedPrice,
                isDescriptionOnly: isDescriptionOnly,  // Flag description-only items
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
        }
      }

      // Assign preview display numbers using helper function
      // Handles Sub-Item rows by continuing their parent's letter sequence
      // Renumbers base numbers sequentially (1, 2, 3...) regardless of input grid gaps
      assignEstimatePreviewNumbers(items, rowMetadata);

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
