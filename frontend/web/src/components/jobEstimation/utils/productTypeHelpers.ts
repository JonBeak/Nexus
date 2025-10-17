/**
 * Helper functions for product type configuration
 */

/**
 * Converts a product type from the database format to the internal configuration format
 * used by GridEngine.
 *
 * Parses pricing_rules JSON to extract calculation_type for pricing engine lookup.
 *
 * @param productType - Product type object from database
 * @returns Converted product type configuration
 */
export const convertProductTypeToConfig = (productType: any): any => {
  // Parse pricing rules so calculation layer can locate the engine key
  let pricingRules: Record<string, unknown> | null = null;
  if (productType.pricing_rules) {
    if (typeof productType.pricing_rules === 'string') {
      try {
        pricingRules = JSON.parse(productType.pricing_rules);
      } catch (error) {
        console.warn('Failed to parse pricing_rules JSON for product type', productType.id, error);
      }
    } else if (typeof productType.pricing_rules === 'object') {
      pricingRules = productType.pricing_rules as Record<string, unknown>;
    }
  }

  const calculationKey = typeof pricingRules?.calculation_type === 'string'
    ? String(pricingRules.calculation_type)
    : null;

  // For now, create a basic config - will be enhanced when we implement dynamic templates
  return {
    id: productType.id,
    name: productType.name,
    fields: [], // TODO: Load from input_template when dynamic templates are integrated
    category: productType.category,
    pricingRules,
    calculationKey
  };
};
