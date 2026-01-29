// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Replaced `any[]` with `OrderPartForPDF[]` for type safety
//   - Added clarifying comment for D-Tape naming variations
//   - Improved code documentation
/**
 * Specification Combiner Utility
 * Combines specifications from parent and sub-item parts
 * Used by both Order Forms and Packing Lists
 */

import { formatBooleanValue, cleanSpecValue } from './generators/pdfHelpers';
import type { OrderPartForPDF } from '../../types/orders';

/**
 * Check if any value in array indicates inclusion (Yes/true)
 * Used for boolean template fields like UL, Drain Holes, D-Tape
 */
function checkInclusionValue(values: string[]): boolean {
  return values.some(v =>
    v === 'Yes' || v === 'true' || String(v).toLowerCase().includes('yes')
  );
}

/**
 * Combines specifications from multiple parts (parent + sub-items)
 * Returns a Map of template names to their spec values
 *
 * @param parts - Array of parts to combine (parent + sub-items)
 * @returns Map of template names to arrays of spec values
 */
export function combineSpecifications(parts: OrderPartForPDF[]): Map<string, string[]> {
  const templateRowsMap = new Map<string, string[]>();

  // Process each part (parent and sub-items)
  parts.forEach((part, partIndex) => {
    if (!part.specifications) return;

    try {
      const specs = typeof part.specifications === 'string'
        ? JSON.parse(part.specifications)
        : part.specifications;

      if (!specs || Object.keys(specs).length === 0) return;

      // Find all template keys and group their spec values
      Object.keys(specs).forEach(key => {
        if (key.startsWith('_template_')) {
          const rowNum = key.replace('_template_', '');
          const templateName = specs[key];

          if (!templateName) return;

          // Gather all spec values for this template row
          const values: string[] = [];

          // Collect all field values for this row (excluding internal fields)
          Object.keys(specs).forEach(fieldKey => {
            if (fieldKey.startsWith(`row${rowNum}_`) && !fieldKey.startsWith('_')) {
              const fieldName = fieldKey.replace(`row${rowNum}_`, '');
              const value = specs[fieldKey];

              // Skip only empty/null/undefined values (but include boolean false)
              if (value !== null && value !== undefined && value !== '') {
                // First, format boolean values to Yes/No
                let formattedValue = formatBooleanValue(value);

                // Only clean LED/PS type fields (remove parenthetical details)
                const isLedTypeField = templateName === 'LEDs' && ['type', 'led_type'].includes(fieldName);
                const isPsTypeField = templateName === 'Power Supply' && ['ps_type', 'model', 'power_supply'].includes(fieldName);

                let finalValue: string;
                if (isLedTypeField || isPsTypeField) {
                  finalValue = cleanSpecValue(String(formattedValue).trim());
                } else {
                  finalValue = String(formattedValue).trim();
                }

                if (finalValue) {
                  values.push(finalValue);
                }
              }
            }
          });

          // Merge with existing template values (if template already exists from another part)
          if (templateRowsMap.has(templateName)) {
            const existing = templateRowsMap.get(templateName)!;
            templateRowsMap.set(templateName, [...existing, ...values]);
          } else {
            templateRowsMap.set(templateName, values);
          }
        }
      });
    } catch (e) {
      console.error(`Error processing part ${partIndex + 1} specifications:`, e);
    }
  });

  return templateRowsMap;
}

/**
 * Convert combined specifications back to a flat object format
 * for passing to packing items mapper
 *
 * This creates a synthetic specifications object that contains
 * all the template rows and their values from the combined parts
 *
 * @param templateRowsMap - Map from combineSpecifications()
 * @returns Flat object with template rows and values
 */
export function flattenCombinedSpecs(templateRowsMap: Map<string, string[]>): any {
  const flatSpecs: any = {};
  let rowIndex = 1;

  // Convert each template row back to flat format
  for (const [templateName, values] of templateRowsMap.entries()) {
    flatSpecs[`_template_${rowIndex}`] = templateName;

    // Add values as row fields
    values.forEach((value, valueIndex) => {
      flatSpecs[`row${rowIndex}_field${valueIndex + 1}`] = value;
    });

    // For specific templates, add structured fields for packing mapper
    switch (templateName) {
      case 'Power Supply':
        if (values.length > 0) {
          flatSpecs[`row${rowIndex}_count`] = values[0]; // First value is usually count
        }
        break;

      case 'LEDs':
        // LEDs template: first numeric value is the count
        for (const val of values) {
          if (/^\d+$/.test(val)) {
            flatSpecs[`row${rowIndex}_count`] = val;
            break;
          }
        }
        break;

      case 'Mounting':
      case 'Pins': // Legacy - renamed to Mounting
        // Mounting template fields: count, pins, spacers
        // Detect by content since Object.keys() order is not guaranteed
        for (const val of values) {
          const lowerVal = val.toLowerCase();
          if (/^\d+$/.test(val)) {
            // Numeric value is count
            flatSpecs[`row${rowIndex}_count`] = val;
          } else if (lowerVal.includes('pin') || lowerVal.includes('nylon') || lowerVal.includes('ss ')) {
            // Pin type value
            flatSpecs[`row${rowIndex}_pins`] = val;
          } else if (lowerVal.includes('spacer') || lowerVal.includes('insert') || lowerVal.includes('rivnut') || lowerVal.includes('stand')) {
            // Spacer type value
            flatSpecs[`row${rowIndex}_spacers`] = val;
          }
        }
        break;

      case 'UL':
      case 'Drain Holes':
      // Handle D-Tape variations (inconsistent naming in data)
      case 'D-Tape':
      case 'D-tape':
      case 'Dtape':
      case 'DTape':
      case 'D tape':
        // Boolean templates: check if any value indicates inclusion
        flatSpecs[`row${rowIndex}_include`] = checkInclusionValue(values);
        break;
    }

    rowIndex++;
  }

  return flatSpecs;
}
