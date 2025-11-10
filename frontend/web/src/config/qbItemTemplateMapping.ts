/**
 * QuickBooks Item Name to Specification Template Mapping
 * Phase 1.5.d - Maps QB item names to specification templates
 *
 * This mapping determines which specification template to use
 * when a QB item is selected for an order part.
 */

/**
 * QB Item Name → Template Name mapping
 *
 * Add new mappings as QB items are created.
 * Template names must match those defined in orderProductTemplates.ts
 */
export const QB_ITEM_TEMPLATE_MAP: Record<string, string> = {
  // Return templates
  'Return': 'Return',
  'Returns': 'Return',

  // Trim templates
  'Trim': 'Trim',

  // Face templates
  'Face': 'Face',
  'Faces': 'Face',

  // Vinyl templates
  'Face Vinyl': 'Vinyl',
  'Vinyl': 'Vinyl',

  // LED templates
  'LEDs': 'LEDs',
  'LED': 'LEDs',
  'LED Modules': 'LEDs',

  // Power Supply templates
  'Power Supply': 'Power Supply',
  'Power Supplies': 'Power Supply',
  'Transformer': 'Power Supply',

  // Wire Length templates
  'Wire Length': 'Wire Length',
  'Wiring': 'Wire Length',
  'Wire': 'Wire Length',

  // UL templates
  'UL': 'UL',
  'UL Listing': 'UL',

  // Drain Holes templates
  'Drain Holes': 'Drain Holes',
  'Drainage': 'Drain Holes'
};

/**
 * Get specification template name for a QuickBooks item
 *
 * @param qbItemName - QuickBooks item name from order_parts.qb_item_name
 * @returns Template name or undefined if no mapping exists
 *
 * @example
 * getTemplateForQBItem('Return') // Returns 'Return'
 * getTemplateForQBItem('LEDs') // Returns 'LEDs'
 * getTemplateForQBItem('Unknown Item') // Returns undefined
 */
export function getTemplateForQBItem(qbItemName: string | null | undefined): string | undefined {
  if (!qbItemName) return undefined;
  return QB_ITEM_TEMPLATE_MAP[qbItemName];
}

/**
 * Check if a QB item has a specification template
 *
 * @param qbItemName - QuickBooks item name
 * @returns True if template exists
 */
export function hasSpecificationTemplate(qbItemName: string | null | undefined): boolean {
  return !!getTemplateForQBItem(qbItemName);
}
