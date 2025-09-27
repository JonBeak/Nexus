// Channel Letters Pricing Calculator
// Dedicated pricing logic for Channel Letters products
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult } from '../types/LayerTypes';

// TODO: Replace with database pricing view when tables are implemented
const PLACEHOLDER_PRICING = {
  channelLetters: {
    '3" Front Lit': { linearInchPrice: 4, ledMult: 0.7, ledDefault: 'Default' },
    '4" Front Lit': { linearInchPrice: 4, ledMult: 0.7, ledDefault: 'Default' },
    '5" Front Lit': { linearInchPrice: 4, ledMult: 0.7, ledDefault: 'Default' }
  },
  leds: {
    'Integra 3': { unitPrice: 1.75, watts: 1, colour: 'Cool White', volts: 12 },
    'Hanley 2080 7k': { unitPrice: 2, watts: 0.8, colour: '7000K', volts: 12 }
  },
  powerSupplies: {
    'Plain, No Box': { unitPrice: 35, watts: 50, volts: 12 },
    'Speedbox 60W': { unitPrice: 120, watts: 50, volts: 12 },
    'Speedbox 150W': { unitPrice: 180, watts: 120, volts: 12 }
  },
  ul: { baseFee: 150, perSetFee: 50 },
  wire: { pricePerFoot: 0.7 }
};

interface ValidatedPricingInput {
  rowId: string;
  productTypeId: number;

  // Validated and parsed field values from validation layer
  parsedValues: Record<string, unknown>;

  // Calculated business data from validation layer
  calculatedValues: Record<string, unknown>;

  // Validation status from validation layer
  hasValidationErrors: boolean;
}

export const calculateChannelLetters = (input: ValidatedPricingInput): RowCalculationResult => {
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
    const type = input.parsedValues.field1;
    const letterData = input.parsedValues.field2;
    const ledOverride = input.parsedValues.field3;
    const ulOverride = input.parsedValues.field4;
    const pinsCount = input.parsedValues.field5 || 0;
    const pinsType = input.parsedValues.field6;
    const extraWireFeet = input.parsedValues.field7 || 0;
    const ledType = input.parsedValues.field8;

    // Extract calculated values
    const ledCount = input.calculatedValues.ledCount || 0;
    const psCount = input.calculatedValues.psCount || 0;
    const totalInches = input.calculatedValues.totalInches || 0;
    const totalWattage = input.calculatedValues.totalWattage || 0;
    const hasAnyUL = input.calculatedValues.hasAnyUL || false;

    const components = [];
    let totalPrice = 0;

    // LOGIC: Complete Set vs Component-Only
    const hasCompleteSet = type && letterData;

    if (hasCompleteSet) {
      // COMPLETE SET: Channel Letters + integrated components

      // 1. Channel Letters base pricing
      const letterPricing = PLACEHOLDER_PRICING.channelLetters[type as keyof typeof PLACEHOLDER_PRICING.channelLetters];
      if (letterPricing) {
        const letterPrice = totalInches * letterPricing.linearInchPrice;

        // Include pins in channel letters price (not separate)
        let letterDescription = `${type} Channel Letters (${totalInches}")`;
        if (pinsCount > 0) {
          letterDescription += ` with ${pinsCount} ${pinsType || 'Pins'}`;
        }

        components.push({
          description: letterDescription,
          price: letterPrice,
          type: 'channel_letters'
        });
        totalPrice += letterPrice;

        // 2. LEDs (separate from letters if needed)
        if (ledCount > 0) {
          const effectiveLedType = ledType || letterPricing.ledDefault || 'Integra 3';
          const ledPricing = PLACEHOLDER_PRICING.leds[effectiveLedType as keyof typeof PLACEHOLDER_PRICING.leds];
          if (ledPricing) {
            const ledsPrice = ledCount * ledPricing.unitPrice;
            components.push({
              description: `${ledCount} ${effectiveLedType} LEDs`,
              price: ledsPrice,
              type: 'leds'
            });
            totalPrice += ledsPrice;
          }

          // 3. Power Supplies (if LEDs exist)
          if (psCount > 0) {
            const psType = 'Speedbox 60W'; // Default
            const psPricing = PLACEHOLDER_PRICING.powerSupplies[psType as keyof typeof PLACEHOLDER_PRICING.powerSupplies];
            if (psPricing) {
              const psPrice = psCount * psPricing.unitPrice;
              components.push({
                description: `${psCount} ${psType} Power Supplies`,
                price: psPrice,
                type: 'power_supplies'
              });
              totalPrice += psPrice;
            }
          }

          // 4. UL Certification (if applicable)
          if (hasAnyUL) {
            const ulPrice = PLACEHOLDER_PRICING.ul.baseFee;
            components.push({
              description: 'UL Certification',
              price: ulPrice,
              type: 'ul'
            });
            totalPrice += ulPrice;
          }
        }

        // 5. Extra Wire (always separate)
        if (extraWireFeet > 0) {
          const wirePrice = extraWireFeet * PLACEHOLDER_PRICING.wire.pricePerFoot;
          components.push({
            description: `${extraWireFeet}ft Extra Wire`,
            price: wirePrice,
            type: 'wire'
          });
          totalPrice += wirePrice;
        }
      }

    } else {
      // COMPONENT-ONLY: Individual items without complete set

      // Standalone LEDs
      if (typeof ledOverride === 'number' && ledOverride > 0) {
        const effectiveLedType = ledType || 'Integra 3';
        const ledPricing = PLACEHOLDER_PRICING.leds[effectiveLedType as keyof typeof PLACEHOLDER_PRICING.leds];
        if (ledPricing) {
          const ledsPrice = ledOverride * ledPricing.unitPrice;
          components.push({
            description: `${ledOverride} ${effectiveLedType} LEDs`,
            price: ledsPrice,
            type: 'leds'
          });
          totalPrice += ledsPrice;
        }
      }

      // Standalone Pins
      if (pinsCount > 0) {
        // TODO: Add pins standalone pricing when available
        components.push({
          description: `${pinsCount} ${pinsType || 'Pins'}`,
          price: 0, // TODO: Get standalone pins pricing
          type: 'pins'
        });
      }

      // Standalone UL
      if (ulOverride) {
        const ulPrice = PLACEHOLDER_PRICING.ul.baseFee;
        components.push({
          description: 'UL Certification',
          price: ulPrice,
          type: 'ul'
        });
        totalPrice += ulPrice;
      }

      // Standalone Wire
      if (extraWireFeet > 0) {
        const wirePrice = extraWireFeet * PLACEHOLDER_PRICING.wire.pricePerFoot;
        components.push({
          description: `${extraWireFeet}ft Wire`,
          price: wirePrice,
          type: 'wire'
        });
        totalPrice += wirePrice;
      }
    }

    if (components.length === 0) {
      return {
        status: 'pending',
        display: 'No components configured',
        data: null
      };
    }

    // Calculate unit price - for channel letters, this is typically per set
    const quantity = 1; // Channel letters are typically sold as complete sets
    const unitPrice = totalPrice; // The total calculated price IS the unit price for the set

    return {
      status: 'completed',
      display: `Channel Letters - $${unitPrice.toFixed(2)}`,
      data: {
        productTypeId: input.productTypeId,
        rowId: input.rowId,
        itemName: "Channel Letters",
        description: hasCompleteSet ? `${type} (${totalInches}")` : "Components Only",
        unitPrice: unitPrice,
        quantity: quantity,
        components: components,
        hasCompleteSet: hasCompleteSet
      }
    };

  } catch (error) {
    return {
      status: 'error',
      display: 'Channel Letters calculation failed',
      error: error instanceof Error ? error.message : 'Unknown calculation error'
    };
  }
};