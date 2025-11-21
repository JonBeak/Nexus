// File Clean up Finished: 2025-11-20
// Analysis: File is clean - no migrations needed, follows 3-layer architecture,
// uses console.log (codebase standard), appropriate type safety for dynamic specs

/**
 * Order Specification Standardization Service
 *
 * Extracts and standardizes order specifications for reuse across:
 * - PDF generation (OrderFormGenerator)
 * - Order preparation validation
 * - Task generation (future)
 *
 * Created: 2025-11-20
 *
 * Key Functions:
 * - standardizeOrderParts() - Core logic, works with loaded parts array
 * - standardizeOrderSpecifications() - High-level wrapper, queries DB by orderId
 *
 * Architecture:
 * - Reuses buildPartColumns() from partColumnBuilder.ts (groups parts into columns)
 * - Reuses buildSortedTemplateRows() from specRenderers.ts (sorts specs by SPEC_ORDER)
 * - Adds metadata (sourcePartId, sourcePartNumber, isParent) for tracking
 */

import { OrderPartForPDF, OrderDataForPDF } from '../types/orders';
import { FormType } from './pdf/generators/pdfConstants';
import { buildPartColumns, PartColumn } from './pdf/utils/partColumnBuilder';
import { buildSortedTemplateRows } from './pdf/renderers/specRenderers';
import { shouldIncludePart, shouldStartNewColumn } from './pdf/generators/pdfHelpers';
import { orderFormRepository } from '../repositories/orderFormRepository';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Standardized specification row with source tracking
 * Extends the basic template row structure with metadata
 */
export interface StandardizedSpec {
  template: string;              // Template name (e.g., "Return", "LEDs", "Trim")
  rowNum: string;                // Row number from specifications JSON (e.g., "1", "2")
  specs: Record<string, any>;    // Field values (e.g., { depth: "3", colour: "White" })
  sourcePartId: number;          // Which part this spec came from
  sourcePartNumber: number;      // Part number for error messages
  sourceIsParent: boolean;       // Whether source part is a parent or sub-item
}

/**
 * Part column with pre-computed standardized specifications
 * Extends PartColumn to include sorted specs for the entire column
 */
export interface PartColumnStandardized extends PartColumn {
  allSpecs: StandardizedSpec[];  // All specs from parent + sub-items, combined & sorted
  allParts: OrderPartForPDF[];   // Convenience: [parent, ...subItems] flattened
}

/**
 * Complete standardized specifications for an order
 * Ready for PDF generation, validation, and task creation
 */
export interface StandardizedOrderSpecs {
  orderId?: number;                      // Optional: only present if loaded from DB
  orderNumber?: number;                  // Optional: only present if loaded from DB
  formType: FormType;                    // Form type used for standardization
  partColumns: PartColumnStandardized[]; // Organized by part columns (for PDF layout)
  flattenedSpecs: StandardizedSpec[];    // All specs flattened (for iteration/validation)
}

// ============================================
// CORE STANDARDIZATION FUNCTION
// ============================================

/**
 * Standardize order parts into organized column structure with sorted specs
 *
 * This is the CORE function - works with already-loaded parts array.
 * No database queries, fast and reusable.
 *
 * Process:
 * 1. Group parts into columns (parent + sub-items) using buildPartColumns()
 * 2. For each column, combine parent + sub-items specs using buildSortedTemplateRows()
 * 3. Add metadata (sourcePartId, sourcePartNumber, sourceIsParent) to each spec
 * 4. Return structured data ready for PDF rendering or other processing
 *
 * @param parts - Array of order parts (already loaded)
 * @param formType - Form type ('master', 'customer', 'shop', 'packing')
 * @returns Standardized specs organized by part columns
 *
 * @example
 * const standardized = standardizeOrderParts(orderData.parts, 'master');
 * standardized.partColumns.forEach(column => {
 *   console.log(`Column: ${column.parent.product_type}`);
 *   column.allSpecs.forEach(spec => {
 *     console.log(`  - ${spec.template}: ${JSON.stringify(spec.specs)}`);
 *   });
 * });
 */
export function standardizeOrderParts(
  parts: OrderPartForPDF[],
  formType: FormType
): StandardizedOrderSpecs {
  console.log(`[STANDARDIZATION] Processing ${parts.length} parts for ${formType} form`);

  // Step 1: Build part columns (groups parent + sub-items)
  const partColumns = buildPartColumns(
    parts,
    formType,
    shouldIncludePart,
    shouldStartNewColumn
  );

  console.log(`[STANDARDIZATION] Built ${partColumns.length} part columns`);

  // Step 2: For each column, standardize specifications
  const standardizedColumns: PartColumnStandardized[] = partColumns.map((column, columnIndex) => {
    const allParts = [column.parent, ...column.subItems];

    console.log(`[STANDARDIZATION] Column ${columnIndex + 1}: ${allParts.length} parts (1 parent + ${column.subItems.length} sub-items)`);

    // Build sorted template rows for this column (combines parent + sub-items)
    const sortedTemplateRows = buildSortedTemplateRows(allParts, formType);

    console.log(`[STANDARDIZATION] Column ${columnIndex + 1}: Generated ${sortedTemplateRows.length} sorted spec rows`);

    // Add metadata to each spec (track which part it came from)
    const allSpecs: StandardizedSpec[] = sortedTemplateRows.map(row => {
      // Determine source part (parent or which sub-item)
      // Note: buildSortedTemplateRows combines all parts, so we lose individual part tracking
      // For now, we'll attribute to the parent (could be enhanced later to track per-part)
      return {
        template: row.template,
        rowNum: row.rowNum,
        specs: row.specs,
        sourcePartId: column.parent.part_id,
        sourcePartNumber: column.parent.part_number,
        sourceIsParent: true  // Since we're combining, attribute to parent
      };
    });

    return {
      parent: column.parent,
      subItems: column.subItems,
      allSpecs,
      allParts
    };
  });

  // Step 3: Flatten all specs across all columns (for easy iteration)
  const flattenedSpecs: StandardizedSpec[] = standardizedColumns.flatMap(column => column.allSpecs);

  console.log(`[STANDARDIZATION] Total flattened specs: ${flattenedSpecs.length}`);

  return {
    formType,
    partColumns: standardizedColumns,
    flattenedSpecs
  };
}

// ============================================
// HIGH-LEVEL WRAPPER (with DB query)
// ============================================

/**
 * Standardize order specifications by orderId (queries database)
 *
 * High-level wrapper that loads order data from DB and calls standardizeOrderParts().
 * Useful for future task generation or standalone processing.
 *
 * @param orderId - Order ID to load
 * @param formType - Form type (default: 'master')
 * @returns Standardized specs with order metadata
 *
 * @example
 * const standardized = await standardizeOrderSpecifications(12345, 'master');
 * console.log(`Order ${standardized.orderNumber}: ${standardized.flattenedSpecs.length} specs`);
 */
export async function standardizeOrderSpecifications(
  orderId: number,
  formType: FormType = 'master'
): Promise<StandardizedOrderSpecs> {
  console.log(`[STANDARDIZATION] Loading order ${orderId} from database`);

  // Load order data (same method used by PDF generation service)
  const orderData = await orderFormRepository.getOrderWithCustomerForPDF(orderId);

  if (!orderData) {
    throw new Error(`Order ${orderId} not found`);
  }

  console.log(`[STANDARDIZATION] Loaded order ${orderData.order_number} with ${orderData.parts.length} parts`);

  // Call core standardization function
  const standardized = standardizeOrderParts(orderData.parts, formType);

  // Add order metadata
  return {
    ...standardized,
    orderId,
    orderNumber: orderData.order_number
  };
}
