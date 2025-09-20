// Product Selector - Determines which products to create based on validated field data
// Implements the complex business logic for Channel Letters product combinations

import { GridRowCore } from '../../types/CoreTypes';
import { ValidationContext } from '../templates/ValidationTemplate';

export interface ProductSelection {
  productType: string;
  description: string;
  quantity: number;
  cost?: number;
  included?: boolean; // Whether this is included in another product's price
  metadata?: Record<string, any>;
}

export interface ProductSelectionResult {
  products: ProductSelection[];
  warnings: string[];
  context: ValidationContext;
}

export class ProductSelector {
  /**
   * Determine which products should be created for a row based on validated data
   * @param row - Grid row with validated data
   * @param context - Validation context with customer preferences and calculated values
   * @returns Product selection result
   */
  static selectProducts(row: GridRowCore, context: ValidationContext): ProductSelectionResult {
    const products: ProductSelection[] = [];
    const warnings: string[] = [];

    // Route to product-specific selector based on product type
    switch (row.productTypeId) {
      case 1: // Channel Letters
        const channelResult = this.selectChannelLettersProducts(row, context);
        products.push(...channelResult.products);
        warnings.push(...channelResult.warnings);
        break;

      // Add other product type selectors here
      // case 2: // Vinyl
      //   const vinylResult = this.selectVinylProducts(row, context);
      //   products.push(...vinylResult.products);
      //   warnings.push(...vinylResult.warnings);
      //   break;

      default:
        // Unknown product type - create generic product
        if (this.hasAnyData(row)) {
          products.push({
            productType: 'Unknown',
            description: 'Unknown product type',
            quantity: 1
          });
        }
        break;
    }

    return {
      products,
      warnings,
      context
    };
  }

  /**
   * Select products for Channel Letters based on business rules
   */
  private static selectChannelLettersProducts(
    row: GridRowCore,
    context: ValidationContext
  ): { products: ProductSelection[]; warnings: string[] } {
    const products: ProductSelection[] = [];
    const warnings: string[] = [];

    const field1 = row.data.field1?.trim(); // Type
    const field2 = row.data.field2?.trim(); // Letter data
    const field3 = row.data.field3?.trim(); // LED override
    const field4 = row.data.field4?.trim(); // UL override
    const field5 = row.data.field5?.trim(); // Pins
    const field6 = row.data.field6?.trim(); // Extra wire
    const field8 = row.data.field8?.trim(); // LED type
    const field9 = row.data.field9?.trim(); // PS override
    const field10 = row.data.field10?.trim(); // PS type

    const ledCount = context.calculatedValues.ledCount || 0;
    const psCount = context.calculatedValues.psCount || 0;
    const totalInches = context.calculatedValues.totalInches || 0;

    // 1. CHANNEL LETTERS (if field1 & field2 exist)
    if (field1 && field2) {
      products.push({
        productType: 'Channel Letters',
        description: `${field1} Channel Letters - ${totalInches}"`,
        quantity: 1,
        metadata: {
          type: field1,
          letterData: field2,
          totalInches: totalInches
        }
      });

      // 2. LEDS (based on business logic)
      if (ledCount > 0) {
        const ledType = field8 || context.customerPreferences.default_led_type || 'Standard LED';
        products.push({
          productType: 'LEDs',
          description: `${ledCount} ${ledType} LEDs`,
          quantity: ledCount,
          metadata: {
            ledType: ledType,
            autoCalculated: !field3 || field3 === 'yes'
          }
        });

        // 3. POWER SUPPLIES (if LEDs exist and required)
        if (psCount > 0) {
          const psType = field10 || this.determinePowerSupplyType(context);
          products.push({
            productType: 'Power Supplies',
            description: `${psCount} ${psType} Power Supplies`,
            quantity: psCount,
            metadata: {
              psType: psType,
              autoCalculated: !field9 || field9 === 'yes'
            }
          });
        }
      }

      // 4. UL CERTIFICATION (if required)
      const ulRequired = this.determineULRequirement(field4, ledCount, context);
      if (ulRequired.required) {
        products.push({
          productType: 'UL Certification',
          description: 'UL Listing Certification',
          quantity: 1,
          cost: ulRequired.cost !== 'default' ? ulRequired.cost : undefined,
          metadata: {
            autoCalculated: !field4,
            customCost: ulRequired.cost !== 'default'
          }
        });
      }

      // 5. PINS (included in channel letters or separate)
      if (field5) {
        const pinsQuantity = parseFloat(field5);
        if (!isNaN(pinsQuantity) && pinsQuantity > 0) {
          products.push({
            productType: 'Pins',
            description: `${pinsQuantity} Mounting Pins`,
            quantity: pinsQuantity,
            included: true, // Included in channel letters price
            metadata: {
              includedInChannelLetters: true
            }
          });
        }
      }

      // 6. EXTRA WIRE (if field1, field2, and field6 exist)
      if (field6) {
        const wireLength = parseFloat(field6);
        if (!isNaN(wireLength) && wireLength > 0) {
          products.push({
            productType: 'Extra Wire',
            description: `${wireLength}ft Extra Wire`,
            quantity: wireLength,
            metadata: {
              lengthInFeet: wireLength
            }
          });
        }
      }
    } else {
      // No channel letters - check for standalone products

      // Standalone LEDs (if field3 has numeric value)
      if (field3 && !isNaN(parseFloat(field3))) {
        const standaloneLedsCount = parseFloat(field3);
        if (standaloneLedsCount > 0) {
          const ledType = field8 || context.customerPreferences.default_led_type || 'Standard LED';
          products.push({
            productType: 'LEDs',
            description: `${standaloneLedsCount} ${ledType} LEDs (Standalone)`,
            quantity: standaloneLedsCount,
            metadata: {
              ledType: ledType,
              standalone: true
            }
          });

          // Power supplies for standalone LEDs
          const standalonePsCount = Math.ceil((standaloneLedsCount * 1.2) / 60); // Simple calculation
          if (standalonePsCount > 0 && (field9 === 'yes' || context.customerPreferences.requires_transformers)) {
            const psType = field10 || 'DC-60W';
            products.push({
              productType: 'Power Supplies',
              description: `${standalonePsCount} ${psType} Power Supplies`,
              quantity: standalonePsCount,
              metadata: {
                psType: psType,
                forStandaloneLEDs: true
              }
            });
          }
        }
      }

      // Standalone Pins (if field5 without channel letters)
      if (field5) {
        const pinsQuantity = parseFloat(field5);
        if (!isNaN(pinsQuantity) && pinsQuantity > 0) {
          products.push({
            productType: 'Pins',
            description: `${pinsQuantity} Mounting Pins (Standalone)`,
            quantity: pinsQuantity,
            metadata: {
              standalone: true
            }
          });
        }
      }

      // Standalone UL (if field4 specified)
      if (field4) {
        const ulRequired = this.determineULRequirement(field4, 0, context);
        if (ulRequired.required) {
          products.push({
            productType: 'UL Certification',
            description: 'UL Listing Certification (Standalone)',
            quantity: 1,
            cost: ulRequired.cost !== 'default' ? ulRequired.cost : undefined,
            metadata: {
              standalone: true,
              customCost: ulRequired.cost !== 'default'
            }
          });
        }
      }
    }

    return { products, warnings };
  }

  /**
   * Determine UL requirement based on field input and context
   */
  private static determineULRequirement(
    field4: string | undefined,
    ledCount: number,
    context: ValidationContext
  ): { required: boolean; cost: number | 'default' } {
    if (!field4) {
      // No explicit input - use default behavior
      if (ledCount > 0 && context.customerPreferences.default_ul_requirement) {
        return { required: true, cost: 'default' };
      }
      return { required: false, cost: 0 };
    }

    const lower = field4.toLowerCase();

    if (lower === 'yes') {
      return { required: true, cost: 'default' };
    }

    if (lower === 'no') {
      return { required: false, cost: 0 };
    }

    // Check for currency format: $amount
    if (field4.startsWith('$')) {
      const amount = parseFloat(field4.substring(1));
      if (!isNaN(amount) && amount >= 0) {
        return { required: true, cost: amount };
      }
    }

    // Check for numeric value
    const numericValue = parseFloat(field4);
    if (!isNaN(numericValue) && numericValue >= 0) {
      return { required: true, cost: numericValue };
    }

    // Invalid input - default to no UL
    return { required: false, cost: 0 };
  }

  /**
   * Determine power supply type based on context
   */
  private static determinePowerSupplyType(context: ValidationContext): string {
    const totalWattage = context.calculatedValues.totalWattage || 0;
    const isUL = context.gridContext.hasAnyUL;

    // Auto-select based on wattage and UL requirement
    if (totalWattage <= 60) {
      return isUL ? 'UL-DC-60W' : 'DC-60W';
    } else if (totalWattage <= 100) {
      return isUL ? 'UL-DC-100W' : 'DC-100W';
    } else {
      return 'Speedbox'; // High wattage solution
    }
  }

  /**
   * Check if row has any data
   */
  private static hasAnyData(row: GridRowCore): boolean {
    return Object.values(row.data).some(value => value && typeof value === 'string' && value.trim() !== '');
  }

  /**
   * Get product selection summary for UI display
   * @param row - Grid row
   * @param context - Validation context
   * @returns Summary of selected products
   */
  static getProductSummary(row: GridRowCore, context: ValidationContext): string {
    const result = this.selectProducts(row, context);

    if (result.products.length === 0) {
      return 'No products selected';
    }

    const mainProducts = result.products.filter(p => !p.included);
    const includedProducts = result.products.filter(p => p.included);

    let summary = mainProducts.map(p => p.description).join(', ');

    if (includedProducts.length > 0) {
      summary += ' (includes: ' + includedProducts.map(p => p.description).join(', ') + ')';
    }

    return summary;
  }

  /**
   * Check if products are valid for pricing
   * @param products - Selected products
   * @returns Whether products can be priced
   */
  static canPrice(products: ProductSelection[]): boolean {
    // Basic rule: need at least one main product (not included)
    return products.some(p => !p.included);
  }

  /**
   * Get total estimated cost (if available)
   * @param products - Selected products
   * @returns Total cost or null if not calculable
   */
  static getTotalCost(products: ProductSelection[]): number | null {
    let total = 0;
    let hasAnyCost = false;

    for (const product of products) {
      if (product.cost !== undefined && !product.included) {
        total += product.cost * product.quantity;
        hasAnyCost = true;
      }
    }

    return hasAnyCost ? total : null;
  }
}