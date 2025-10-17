// Channel Letters Pricing Calculator
// Dedicated pricing logic for Channel Letters products
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, ComponentItem, PricingCalculationData } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { ChannelLetterMetrics } from '../validation/utils/channelLetterParser';
import { selectPowerSupplies } from './powerSupplySelector';

// Helper function to format price (integer if whole number, 2 decimals if not)
const formatPrice = (price: number): string => {
  return price % 1 === 0 ? price.toString() : price.toFixed(2);
};

const getLetterCount = (
  letterData: unknown,
  metrics?: ChannelLetterMetrics | null
): number | null => {
  if (metrics?.pairs && Array.isArray(metrics.pairs) && metrics.pairs.length > 0) {
    return metrics.pairs.length;
  }

  if (letterData && typeof letterData === 'object') {
    const data = letterData as {
      pairs?: unknown[];
      group1?: unknown[];
    };

    if (Array.isArray(data.pairs) && data.pairs.length > 0) {
      return data.pairs.length;
    }

    if (Array.isArray(data.group1) && data.group1.length > 0) {
      return data.group1.length;
    }
  }

  return null;
};

/**
 * Calculate pricing for Channel Letters products
 * Implements the ProductCalculator interface for product type ID 1
 *
 * Generates multiple components:
 * - Channel Letters base (with dimensions and pins)
 * - LEDs (if applicable)
 * - Power Supplies (if LEDs exist)
 * - UL Certification (if required)
 * - Extra Wire (if specified)
 */
export const calculateChannelLetters = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
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

    // Channel Letters pricing calculation in progress

    const type = input.parsedValues.field1;
    const letterData = input.parsedValues.field2;
    const ledOverride = input.parsedValues.field3;
    const ulOverride = input.parsedValues.field4;
    const pinsCount = (input.parsedValues.field5 as number) || 0;
    const pinsType = input.parsedValues.field6;
    const extraWireFeet = (input.parsedValues.field7 as number) || 0;
    const ledType = input.parsedValues.field8;
    const psCountOverride = input.parsedValues.field9; // Transformer count override
    const psTypeOverride = input.parsedValues.field10; // Transformer type override

    console.log('Field8/10 Debug:', {
      field8_ledType: ledType,
      field8_type: typeof ledType,
      field8_truthyCheck: !!ledType,
      field10_psType: psTypeOverride,
      field10_type: typeof psTypeOverride,
      field10_truthyCheck: !!psTypeOverride,
      allParsedValues: input.parsedValues
    });

    // Extract calculated values from validation layer
    // IMPORTANT: The validation layer has ALREADY applied field3 override logic!
    // We should just use what it calculated, not re-process field3
    let ledCount = input.calculatedValues.ledCount || 0;
    const totalInches = input.calculatedValues.totalInches || 0;

    console.log('Pricing Calculator - LED Count:', {
      ledCountFromValidation: input.calculatedValues.ledCount,
      ledCountUsed: ledCount,
      field3Override: ledOverride,
      savedLedCount: input.calculatedValues.savedLedCount,
      defaultLedCount: input.calculatedValues.defaultLedCount
    });
    const channelLetterMetrics = input.calculatedValues
      .channelLetterMetrics as ChannelLetterMetrics | null | undefined;
    const letterCount = getLetterCount(letterData, channelLetterMetrics);
    const letterCountLabel = letterCount && letterCount > 0 ? `[${letterCount} pcs]` : null;

    // We'll apply the LED multiplier after we get the channel letter type data
    // This will be done inside the hasCompleteSet block where we have letterPricing

    // Determine UL requirement from field4 (UL override)
    let hasUL = false;
    let ulCustomPrice: number | null = null;
    let ulSetCount: number | null = null;
    let ulExplicitlySet = false; // Track if UL was explicitly overridden

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
      // No override - will check customer preference only if LEDs exist
      // (checked later when UL component is added, after LED count is finalized)
      hasUL = input.customerPreferences?.pref_ul_required === true;
    }

    console.log('Channel Letters Pricing Input:', {
      parsedField3: ledOverride,
      parsedField4: ulOverride,
      fromValidation: {
        ledCount: input.calculatedValues.ledCount,
        totalInches: input.calculatedValues.totalInches,
        psCount: input.calculatedValues.psCount
      },
      initialLedCount: ledCount,
      hasUL,
      ulCustomPrice
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

    // Variables for power supply calculation
    let totalWattage = 0;
    let psCount = 0;

    // Check if we have channel letter data
    const hasChannelLetters = type && letterData;

    // UNIFORM COMPONENT CALCULATION - no branching logic

    // Get pin type data first if needed (for channel letter display)
    let pinTypeData = null;
    if (pinsCount > 0 && pinsType) {
      pinTypeData = await PricingDataResource.getPinType(pinsType);
      if (!pinTypeData) {
        return {
          status: 'error',
          display: `Pin type "${pinsType}" not found`,
          error: `Pin type "${pinsType}" not found in pricing database`,
          data: null
        };
      }
    }

    // 1. Channel Letters (if data exists)
    if (hasChannelLetters) {
      const letterPricing = await PricingDataResource.getChannelLetterType(type as string);
      if (letterPricing) {
        // Apply LED multiplier for float inputs ONLY if no explicit numeric override in field3
        // Check if the input was a float by checking the parsed value type
        const isFloatInput = typeof letterData === 'number';
        const hasNumericOverride = typeof ledOverride === 'number';

        if (isFloatInput && letterPricing.led_multiplier && !hasNumericOverride) {
          // For float inputs, apply the LED multiplier
          // The validation layer calculated ledCount = totalInches for floats
          // We need to apply the multiplier: ledCount = totalInches * multiplier
          const originalLedCount = ledCount;
          ledCount = Math.round(totalInches * letterPricing.led_multiplier);

          console.log('Applied LED Multiplier (channel letters section):', {
            isFloatInput,
            letterData,
            totalInches,
            multiplier: letterPricing.led_multiplier,
            originalLedCount,
            adjustedLedCount: ledCount
          });
        } else if (isFloatInput && hasNumericOverride) {
          console.log('Skipping LED Multiplier (channel letters section) - field3 has numeric override:', ledOverride);
        }

        // Will calculate wattage and PS count after we have LED data
        // (moved to after LED lookup to use actual wattage)

        const letterPrice = totalInches * letterPricing.base_rate_per_inch;

        // Build display string for channel letters component
        let channelLetterDisplay = `${type}, ${totalInches}" @ $${formatPrice(Number(letterPricing.base_rate_per_inch))}/inch`;
        if (letterCountLabel) {
          channelLetterDisplay += ` - ${letterCountLabel}`;
        }
        if (pinsCount > 0 && pinTypeData) {
          channelLetterDisplay += `\n${pinsType}: ${pinsCount} @ $${formatPrice(pinTypeData.base_cost)}/each`;
        }

        components.push({
          name: 'Channel Letters',
          price: letterPrice,
          type: 'channel_letters',
          calculationDisplay: channelLetterDisplay
        });
        totalPrice += letterPrice;
      } else {
        console.error('Channel letter pricing not found for type:', type);
      }
    }

    // 2. Pins (calculated separately, will merge later if needed)
    if (pinsCount > 0 && pinTypeData) {
      const pinsPrice = pinsCount * pinTypeData.base_cost;

      components.push({
        name: `Pins`,
        price: pinsPrice,
        type: 'pins',
        calculationDisplay: `${pinsCount} ${pinsType} @ $${formatPrice(pinTypeData.base_cost)}`
      });
      totalPrice += pinsPrice;
    }

    // 3. LEDs (if needed) - GET FROM DATABASE
    console.log('LED Component Check:', {
      ledCount,
      condition: ledCount > 0,
      ledType,
      hasChannelLetters
    });

    if (ledCount > 0) {
      // LED multiplier logic for channel letters with float input (SKIP if field3 has numeric override)
      if (hasChannelLetters) {
        const letterPricing = await PricingDataResource.getChannelLetterType(type as string);
        if (letterPricing) {
          const isFloatInput = typeof letterData === 'number';
          const hasNumericOverride = typeof ledOverride === 'number';

          if (isFloatInput && letterPricing.led_multiplier && !hasNumericOverride) {
            const originalLedCount = ledCount;
            ledCount = Math.round(totalInches * letterPricing.led_multiplier);

            console.log('Applied LED Multiplier (LED section):', {
              isFloatInput,
              letterData,
              totalInches,
              multiplier: letterPricing.led_multiplier,
              originalLedCount,
              adjustedLedCount: ledCount
            });
          } else if (isFloatInput && hasNumericOverride) {
            console.log('Skipping LED Multiplier (LED section) - field3 has numeric override:', ledOverride);
          }
          // Try to get LED pricing in order of priority:
          // 1. User-specified LED type (field8)
          // 2. Letter type's default LED (if not "Default" and channel letters exist)
          // 3. System default LED (where is_default = 1)
          let ledPricing = null;
          let effectiveLedType = ledType;

          if (ledType) {
            // Try user-specified LED type
            ledPricing = await PricingDataResource.getLed(ledType as string);
            if (!ledPricing) {
              console.warn(`LED type '${ledType}' not found, trying defaults`);
            }
          }

          // Try letter type's default LED (but skip if it's "Default")
          if (!ledPricing && letterPricing && letterPricing.led_default && letterPricing.led_default !== 'Default') {
            effectiveLedType = letterPricing.led_default;
            ledPricing = await PricingDataResource.getLed(effectiveLedType);
            if (!ledPricing) {
              console.warn(`Letter default LED '${effectiveLedType}' not found, trying system default`);
            }
          }
        }
      }

      // Get LED pricing (for both channel letters and standalone)
      let ledPricing = null;
      let effectiveLedType = ledType;

      if (ledType) {
        // Parse the product_code from format: "product_code [colour]"
        // e.g., "Hanley 2080 7k [7000K]" -> "Hanley 2080 7k"
        const productCodeMatch = ledType.match(/^([^[]+)(?:\s*\[.*\])?$/);
        const productCode = productCodeMatch ? productCodeMatch[1].trim() : ledType;

        effectiveLedType = productCode;
        ledPricing = await PricingDataResource.getLed(productCode as string);

        if (!ledPricing) {
          console.warn(`LED type '${productCode}' not found in database (from '${ledType}')`);
        }
      }

      if (!ledPricing) {
        // Fall back to system default LED
        const defaultLed = await PricingDataResource.getDefaultLed();
        if (defaultLed) {
          ledPricing = defaultLed;
          effectiveLedType = defaultLed.product_code;
          console.log('Using system default LED:', effectiveLedType);
        }
      }

      console.log('LED Pricing Lookup:', {
        userSpecified: ledType,
        effectiveLedType,
        ledPricing,
        found: !!ledPricing
      });

      if (ledPricing) {
        // Calculate actual wattage using LED data
        if (!ledPricing.watts) {
          return {
            status: 'error',
            display: `LED ${effectiveLedType} missing wattage data`,
            error: `LED wattage not defined for ${effectiveLedType}`
          };
        }

        totalWattage = ledCount * ledPricing.watts;

        console.log('LED Wattage Calculation:', {
          ledType: effectiveLedType,
          wattagePerLed: ledPricing.watts,
          ledCount,
          totalWattage
        });

        const ledsPrice = ledCount * ledPricing.price;
        components.push({
          name: `LEDs`,
          price: ledsPrice,
          type: 'leds',
          calculationDisplay: `${ledCount} @ $${formatPrice(Number(ledPricing.price))}, ${effectiveLedType}`
        });
        totalPrice += ledsPrice;
        console.log('LED Component Added:', {
          description: `${ledCount} ${effectiveLedType} LEDs`,
          price: ledsPrice,
          wattagePerLed: ledPricing.watts,
          totalWattage
        });
      } else {
        return {
          status: 'error',
          display: 'No LED pricing data found',
          error: 'Unable to find LED pricing data in system'
        };
      }
    }

    // 4. Power Supplies (if LEDs exist OR explicit override)
    // Allow Power Supplies to be added independently via Field 9/10 without requiring LEDs
    const hasExplicitPsOverride = (psCountOverride !== null && psCountOverride !== undefined) ||
                                   (psTypeOverride && psTypeOverride !== '');

    if (totalWattage > 0 || hasExplicitPsOverride) {
      const psResult = await selectPowerSupplies({
        totalWattage,
        hasUL,
        psTypeOverride: psTypeOverride as string | null,
        psCountOverride: psCountOverride as number | null,
        customerPreferences: input.customerPreferences
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
      psCount = psResult.totalCount;
    }

    // 5. UL Certification (if applicable)
    // UL only shows if:
    // - Explicitly set via override (yes/custom), OR
    // - Not explicitly set AND LEDs exist AND customer preference is true
    const shouldShowUL = ulExplicitlySet ? hasUL : (hasUL && ledCount > 0);

    if (shouldShowUL) {
      let ulPrice = 0;
      let ulCalculationDisplay = '';

      if (ulCustomPrice !== null) {
        // Use custom UL price from field4 override ($amount)
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

          console.log('UL Set-based Pricing:', {
            baseFee,
            perSetFee,
            setCount: ulSetCount,
            ulExistsInPreviousRows: input.ulExistsInPreviousRows,
            totalUlPrice: ulPrice
          });
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

          console.log('UL Default Pricing (1 set):', {
            baseFee,
            perSetFee,
            ulExistsInPreviousRows: input.ulExistsInPreviousRows,
            totalUlPrice: ulPrice
          });
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

    // 6. Extra Wire - GET FROM DATABASE
    if (extraWireFeet > 0) {
      const wiringPricing = await PricingDataResource.getWiringPricing();
      if (wiringPricing) {
        const wireUnitRate = Number(wiringPricing.wire_cost_per_ft);
        const effectiveLetterCount = letterCount && letterCount > 0 ? letterCount : 1;
        const wirePrice = extraWireFeet * wireUnitRate * effectiveLetterCount;
        const wireFeetDisplay = `${formatPrice(extraWireFeet)}ft`;
        const wireRateDisplay = `$${formatPrice(wireUnitRate)}/ft`;
        const wireCalculationDisplay =
          letterCount && letterCount > 0
            ? `[${letterCount} pcs] x [${wireFeetDisplay}] x [${wireRateDisplay}]`
            : `${wireFeetDisplay} @ ${wireRateDisplay}`;
        components.push({
          name: `Extra Wire`,
          price: wirePrice,
          type: 'wire',
          calculationDisplay: wireCalculationDisplay
        });
        totalPrice += wirePrice;
      }
    }

    // POST-PROCESSING: Merge pins into channel letters if both exist
    const channelLetterComponent = components.find(c => c.type === 'channel_letters');
    const pinsComponent = components.find(c => c.type === 'pins');

    if (channelLetterComponent && pinsComponent) {
      // Merge pins price into channel letters (but keep description clean)
      channelLetterComponent.price += pinsComponent.price;
      // Remove standalone pins component
      const pinsIndex = components.findIndex(c => c.type === 'pins');
      if (pinsIndex !== -1) {
        components.splice(pinsIndex, 1);
      }
    }

    if (components.length === 0) {
      return {
        status: 'pending',
        display: 'No components configured',
        data: null
      };
    }

    // Recalculate total price after merging
    totalPrice = components.reduce((sum, c) => sum + c.price, 0);

    // Calculate unit price per set (before quantity multiplication)
    const unitPrice = totalPrice; // The total calculated price IS the unit price for one set

    // Build the pricing calculation data following the interface
    const pricingData: PricingCalculationData = {
      productTypeId: input.productTypeId,
      rowId: input.rowId,
      itemName: "Channel Letters",
      description: hasChannelLetters ? `${type} (${totalInches}")` : "Components Only",
      unitPrice: unitPrice,
      quantity: quantity,
      components: components,
      hasCompleteSet: hasChannelLetters
    };

    console.log('Channel Letters Final Output:', {
      mode: hasChannelLetters ? 'WITH_LETTERS' : 'COMPONENTS_ONLY',
      componentCount: components.length,
      components: components.map(c => ({
        type: c.type,
        description: c.description,
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
      display: 'Channel Letters calculation failed',
      error: error instanceof Error ? error.message : 'Unknown calculation error'
    };
  }
};
