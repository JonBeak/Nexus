// LED Pricing Calculator
// Dedicated pricing logic for LED products
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, ComponentItem, PricingCalculationData } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { selectPowerSupplies } from './powerSupplySelector';

// Helper function to format price (integer if whole number, 2 decimals if not)
const formatPrice = (price: number): string => {
  return price % 1 === 0 ? price.toString() : price.toFixed(2);
};

/**
 * Calculate pricing for LED products
 * Implements the ProductCalculator interface for product type ID 26
 *
 * Generates multiple components:
 * - LEDs (if field1 specified)
 * - Power Supplies (if LEDs exist)
 * - UL Certification (if required)
 * - Extra Wire (if specified)
 */
export const calculateLed = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
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

    const ledCount = (input.parsedValues.field1 as number) || 0;
    const ledType = input.parsedValues.field2;
    const ledPriceOverride = (input.parsedValues.field3 as number) || null;
    const psCountOverrideRaw = input.parsedValues.field4; // Can be number | 'yes' | 'no' | null
    const psTypeOverride = input.parsedValues.field5;
    const psPriceOverride = (input.parsedValues.field6 as number) || null;
    const ulOverride = input.parsedValues.field7;
    const wireLenPerWire = (input.parsedValues.field8 as number) || 0;
    const wireCount = (input.parsedValues.field9 as number) || 0;
    const wireFlatLength = (input.parsedValues.field10 as number) || 0;

    // Normalize PS count override: "no" -> 0, "yes" -> null (use calculated), numeric -> numeric
    let psCountOverride: number | null = null;
    if (psCountOverrideRaw === 'no') {
      psCountOverride = 0;
    } else if (typeof psCountOverrideRaw === 'number') {
      psCountOverride = psCountOverrideRaw;
    }
    // If "yes" or undefined, leave as null to use default calculation

    console.log('LED Pricing Input:', {
      ledCount,
      ledType,
      ledPriceOverride,
      psCountOverride,
      psTypeOverride,
      psPriceOverride,
      ulOverride,
      wireLenPerWire,
      wireCount,
      wireFlatLength
    });

    // Validate quantity
    if (quantity === null || quantity <= 0 || isNaN(quantity)) {
      return {
        status: 'pending',
        display: 'Invalid quantity',
        data: null
      };
    }

    const components: ComponentItem[] = [];
    let totalPrice = 0;
    let totalWattage = 0;

    // Determine UL requirement from field7 (UL override)
    let hasUL = false;
    let ulCustomPrice: number | null = null;
    let ulSetCount: number | null = null;
    let ulExplicitlySet = false;

    if (ulOverride) {
      ulExplicitlySet = true;
      if (ulOverride === 'yes') {
        hasUL = true;
      } else if (ulOverride === 'no') {
        hasUL = false;
      } else if (typeof ulOverride === 'object') {
        // Custom UL handling
        if (ulOverride.type === 'currency') {
          // Custom price override
          hasUL = true;
          ulCustomPrice = ulOverride.amount;
        } else if (ulOverride.type === 'float') {
          // Float represents number of UL sets
          hasUL = true;
          ulSetCount = ulOverride.amount;
        }
      }
    } else {
      // No override - check customer preference only if LEDs exist
      hasUL = input.customerPreferences?.pref_ul_required === true;
    }

    // 1. LEDs Component (if LED count specified)
    if (ledCount > 0) {
      // Get LED pricing
      let ledPricing = null;
      let effectiveLedType = ledType;

      // Priority: field2 (LED Type) > customer preference > system default
      if (ledType) {
        // Parse the product_code from format: "product_code [colour]"
        const productCodeMatch = (ledType as string).match(/^([^[]+)(?:\s*\[.*\])?$/);
        const productCode = productCodeMatch ? productCodeMatch[1].trim() : ledType;

        effectiveLedType = productCode;
        ledPricing = await PricingDataResource.getLed(productCode as string);

        if (!ledPricing) {
          console.warn(`LED type '${productCode}' not found in database (from '${ledType}')`);
        }
      }

      // Fallback to customer preference LED type
      if (!ledPricing && input.customerPreferences?.default_led_type) {
        effectiveLedType = input.customerPreferences.default_led_type;
        ledPricing = await PricingDataResource.getLed(effectiveLedType);
        if (!ledPricing) {
          console.warn(`Customer default LED '${effectiveLedType}' not found`);
        }
      }

      // Fallback to system default LED
      if (!ledPricing) {
        const defaultLed = await PricingDataResource.getDefaultLed();
        if (defaultLed) {
          ledPricing = defaultLed;
          effectiveLedType = defaultLed.product_code;
          console.log('Using system default LED:', effectiveLedType);
        }
      }

      if (!ledPricing) {
        return {
          status: 'error',
          display: 'No LED pricing data found',
          error: 'Unable to find LED pricing data in system'
        };
      }

      // Calculate LED wattage for power supply calculation
      if (!ledPricing.watts) {
        return {
          status: 'error',
          display: `LED ${effectiveLedType} missing wattage data`,
          error: `LED wattage not defined for ${effectiveLedType}`
        };
      }

      totalWattage = ledCount * ledPricing.watts;

      // Calculate LED price (use override if provided)
      const ledUnitPrice = ledPriceOverride !== null ? ledPriceOverride : ledPricing.price;
      const ledsPrice = ledCount * ledUnitPrice;

      components.push({
        name: 'LEDs',
        price: ledsPrice,
        type: 'leds',
        calculationDisplay: `${ledCount} @ $${formatPrice(Number(ledUnitPrice))}, ${effectiveLedType}`
      });
      totalPrice += ledsPrice;

      console.log('LED Component Added:', {
        description: `${ledCount} ${effectiveLedType} LEDs`,
        price: ledsPrice,
        wattagePerLed: ledPricing.watts,
        totalWattage
      });
    }

    // 2. Power Supplies - Use powerSupplySelector for smart selection
    const calculatedPsCount = input.calculatedValues.psCount || 0;

    // Determine what to pass to powerSupplySelector
    let psOverrideForSelector: number | null = null;
    let shouldCalculatePS = false;

    if (psCountOverrideRaw === 'yes') {
      // User explicitly wants PSs - enable UL optimization
      shouldCalculatePS = true;
      psOverrideForSelector = null;
    } else if (psCountOverride !== null) {
      // User entered a specific number (including 0)
      shouldCalculatePS = true;
      psOverrideForSelector = psCountOverride;
    } else if (psTypeOverride && psTypeOverride !== '') {
      // User specified PS type - use ValidationContextBuilder's count
      shouldCalculatePS = true;
      psOverrideForSelector = calculatedPsCount;
    } else {
      // No user override - use ValidationContextBuilder's decision
      shouldCalculatePS = calculatedPsCount > 0;
      psOverrideForSelector = calculatedPsCount;
    }

    if (shouldCalculatePS) {
      // Use section-level UL for PS optimization (consistent PS types within section)
      const sectionHasUL = input.calculatedValues?.sectionHasUL ?? false;

      const psResult = await selectPowerSupplies({
        totalWattage,
        hasUL: sectionHasUL,  // Use section-level UL for PS selection
        psTypeOverride: psTypeOverride as string | null,
        psCountOverride: psOverrideForSelector,
        customerPreferences: input.customerPreferences,
        psPriceOverride: psPriceOverride
      });

      if (psResult.error) {
        return {
          status: 'error',
          display: 'Power supply selection failed',
          error: psResult.error
        };
      }

      // Add all power supply components
      components.push(...psResult.components);
      totalPrice += psResult.components.reduce((sum, c) => sum + c.price, 0);

      console.log('Power Supply Components Added:', {
        count: psResult.totalCount,
        components: psResult.components
      });
    }

    // 3. UL Certification (if applicable)
    // UL only shows if:
    // - Explicitly set via override (yes/custom), OR
    // - Not explicitly set AND LEDs exist AND customer preference is true
    const shouldShowUL = ulExplicitlySet ? hasUL : (hasUL && ledCount > 0);

    if (shouldShowUL) {
      let ulPrice = 0;
      let ulCalculationDisplay = '';

      if (ulCustomPrice !== null) {
        // Use custom UL price from field7 override ($amount)
        ulPrice = ulCustomPrice;
        ulCalculationDisplay = `$${formatPrice(ulCustomPrice)} Custom`;
      } else {
        // Get standard UL price from database
        const ulPricing = await PricingDataResource.getUlListingPricing();
        if (!ulPricing) {
          return {
            status: 'error',
            display: 'UL pricing data not found',
            error: 'No UL listing pricing configured in database'
          };
        }

        if (ulSetCount !== null) {
          // Float value: Calculate based on number of sets
          const baseFee = Number(ulPricing.base_fee);
          const perSetFee = Number(ulPricing.per_set_fee);

          if (isNaN(baseFee) || isNaN(perSetFee)) {
            return {
              status: 'error',
              display: 'Invalid UL pricing data',
              error: `UL pricing contains invalid values: base_fee=${ulPricing.base_fee}, per_set_fee=${ulPricing.per_set_fee}`
            };
          }

          const setsAmount = perSetFee * ulSetCount;

          // Cumulative UL logic: Only add base fee if this is the first row with UL
          if (input.ulExistsInPreviousRows) {
            // UL already exists in job - only add per-set fees
            ulPrice = setsAmount;
            ulCalculationDisplay = `${ulSetCount} Set${ulSetCount !== 1 ? 's' : ''} ($${formatPrice(setsAmount)})`;
          } else {
            // First UL in job - add base fee + per-set fees
            ulPrice = baseFee + setsAmount;
            ulCalculationDisplay = `Base ($${formatPrice(baseFee)}) + ${ulSetCount} Set${ulSetCount !== 1 ? 's' : ''} ($${formatPrice(setsAmount)})`;
          }
        } else {
          // Default: Calculate for 1 set
          const baseFee = Number(ulPricing.base_fee);
          const perSetFee = Number(ulPricing.per_set_fee);

          if (isNaN(baseFee) || isNaN(perSetFee)) {
            return {
              status: 'error',
              display: 'Invalid UL pricing data',
              error: `UL pricing contains invalid values: base_fee=${ulPricing.base_fee}, per_set_fee=${ulPricing.per_set_fee}`
            };
          }

          // Cumulative UL logic: Only add base fee if this is the first row with UL
          if (input.ulExistsInPreviousRows) {
            // UL already exists in job - only add per-set fee for 1 set
            ulPrice = perSetFee;
            ulCalculationDisplay = `1 Set ($${formatPrice(perSetFee)})`;
          } else {
            // First UL in job - add base fee + per-set fee for 1 set
            ulPrice = baseFee + perSetFee;
            ulCalculationDisplay = `Base ($${formatPrice(baseFee)}) + 1 Set ($${formatPrice(perSetFee)})`;
          }
        }
      }

      if (ulPrice !== 0) {
        components.push({
          name: 'UL',
          price: ulPrice,
          type: 'ul',
          calculationDisplay: ulCalculationDisplay
        });
        totalPrice += ulPrice;
      }
    }

    // 4. Extra Wire Component
    // Calculate total wire length: (wireLenPerWire × wireCount) + wireFlatLength
    const totalWireLength = (wireLenPerWire * wireCount) + wireFlatLength;

    if (totalWireLength > 0) {
      const wiringPricing = await PricingDataResource.getWiringPricing();
      if (!wiringPricing) {
        return {
          status: 'error',
          display: 'Wiring pricing data not found',
          error: 'No wiring pricing configured in database'
        };
      }

      const wireUnitRate = Number(wiringPricing.wire_cost_per_ft);
      const wirePrice = totalWireLength * wireUnitRate;

      // Build calculation display
      let wireCalculationDisplay = '';
      const hasPairedWire = wireLenPerWire > 0 && wireCount > 0;
      const hasFlatWire = wireFlatLength > 0;

      if (hasPairedWire && hasFlatWire) {
        wireCalculationDisplay = `[${wireCount} × ${formatPrice(wireLenPerWire)}ft + ${formatPrice(wireFlatLength)}ft] @ $${formatPrice(wireUnitRate)}/ft`;
      } else if (hasPairedWire) {
        wireCalculationDisplay = `${wireCount} × ${formatPrice(wireLenPerWire)}ft @ $${formatPrice(wireUnitRate)}/ft`;
      } else {
        wireCalculationDisplay = `${formatPrice(wireFlatLength)}ft @ $${formatPrice(wireUnitRate)}/ft`;
      }

      components.push({
        name: 'Extra Wire',
        price: wirePrice,
        type: 'wire',
        calculationDisplay: wireCalculationDisplay
      });
      totalPrice += wirePrice;

      console.log('Extra Wire Component Added:', {
        wireLenPerWire,
        wireCount,
        wireFlatLength,
        totalWireLength,
        wirePrice
      });
    }

    if (components.length === 0) {
      return {
        status: 'pending',
        display: 'No components configured',
        data: null
      };
    }

    // Calculate unit price per set (before quantity multiplication)
    const unitPrice = totalPrice;

    // Build the pricing calculation data following the interface
    const pricingData: PricingCalculationData = {
      productTypeId: input.productTypeId,
      rowId: input.rowId,
      itemName: 'LED',
      description: ledCount > 0 ? `${ledCount} LEDs` : 'Components Only',
      unitPrice: unitPrice,
      quantity: quantity,
      components: components,
      hasCompleteSet: ledCount > 0
    };

    console.log('LED Final Output:', {
      componentCount: components.length,
      components: components.map(c => ({
        type: c.type,
        name: c.name,
        price: c.price,
        calculationDisplay: c.calculationDisplay
      })),
      totalPrice: unitPrice,
      pricingData
    });

    return {
      status: 'completed',
      display: '', // Not used - components have their own calculationDisplay
      data: pricingData
    };

  } catch (error) {
    return {
      status: 'error',
      display: 'LED calculation failed',
      error: error instanceof Error ? error.message : 'Unknown calculation error'
    };
  }
};
