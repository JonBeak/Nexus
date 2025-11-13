/**
 * Part Column Builder Utility
 *
 * Handles grouping of order parts into parent + sub-items column structure
 * for PDF generation. Parts are organized based on display_number matching
 * and parent/child relationships.
 *
 * Extracted from orderFormGenerator.ts Phase 5 refactoring
 */

import { FormType } from '../generators/pdfCommonGenerator';

export interface PartColumn {
  parent: any;
  subItems: any[];
}

/**
 * Build part columns from parts list
 * Groups parts into parent + sub-items structure based on:
 * - Parent parts: is_parent = 1 (checked via shouldStartNewColumn)
 * - Sub-items: Match display_number prefix (e.g., "1a" matches parent "1")
 * - Fallback: Add to last column if no parent match
 *
 * @param parts - Array of order parts
 * @param formType - Type of form being generated ('master' | 'customer' | 'shop' | 'packing')
 * @param shouldIncludePart - Function to determine if part should be included for this form type
 * @param shouldStartNewColumn - Function to determine if part should start a new column (parent check)
 * @returns Array of part columns with parent and sub-items
 *
 * @example
 * const columns = buildPartColumns(
 *   orderParts,
 *   'master',
 *   (part, formType) => !!(part.specs_display_name || hasSpecTemplates(part)),
 *   (part) => !!part.is_parent
 * );
 */
export function buildPartColumns(
  parts: any[],
  formType: FormType,
  shouldIncludePart: (part: any, formType: FormType) => boolean,
  shouldStartNewColumn: (part: any) => boolean
): PartColumn[] {
  const partColumns: PartColumn[] = [];

  console.log(`[${formType.toUpperCase()} Form PDF] Total parts:`, parts.length);

  parts.forEach((part, index) => {
    // Skip parts with no meaningful data
    if (!shouldIncludePart(part, formType)) {
      console.log(`[${formType.toUpperCase()} Form PDF] ✓ SKIPPING empty part ${index + 1} (no display name or spec templates)`);
      return;
    }

    console.log(`[${formType.toUpperCase()} Form PDF] ✓ INCLUDING part ${index + 1}`);

    if (shouldStartNewColumn(part)) {
      // This is a parent or regular base item - create new column
      partColumns.push({ parent: part, subItems: [] });
      console.log(`[${formType.toUpperCase()} Form PDF] Created column ${partColumns.length} for:`, part.specs_display_name || part.product_type);
    } else {
      // This is a sub-item - find the matching parent column by display number prefix
      const parentNumber = part.display_number?.replace(/[a-zA-Z]/g, '');
      const matchingColumn = partColumns.find(col => col.parent.display_number === parentNumber);

      if (matchingColumn) {
        matchingColumn.subItems.push(part);
        console.log(`[${formType.toUpperCase()} Form PDF] Added sub-item to column (matched by number ${parentNumber}):`, part.specs_display_name || part.product_type);
      } else if (partColumns.length > 0) {
        // Fallback: append to last column if no match found
        partColumns[partColumns.length - 1].subItems.push(part);
        console.log(`[${formType.toUpperCase()} Form PDF] Added sub-item to last column (fallback):`, part.specs_display_name || part.product_type);
      }
    }
  });

  console.log(`[${formType.toUpperCase()} Form PDF] Final column count: ${partColumns.length}`);

  return partColumns;
}
