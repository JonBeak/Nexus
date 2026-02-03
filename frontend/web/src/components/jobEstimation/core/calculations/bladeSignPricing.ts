// Blade Sign Pricing Calculator
// Dedicated pricing logic for Blade Sign products (Product Type 6)
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, ComponentItem, PricingCalculationData } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { selectPowerSupplies } from './powerSupplySelector';
import { formatPrice } from './utils/priceFormatter';

/**
 * Calculate pricing for Blade Sign products
 * Implements the ProductCalculator interface for product type ID 6
 *
 * Field mapping:
 * - field1: Shape (Circle/Rectangle dropdown)
 * - field2: X x Y (dimensions in "X x Y" format)
 * - field3: LEDs # (LED count override - accepts float/yes/no)
 * - field4: UL (UL certification override - accepts float/yes/no/$amount)
 * - field5: PS # (Power supply count override - accepts float/yes/no)
 * - field7: ~ Frame ~ (frame cost override)
 * - field8: ~ Assem ~ (assembly cost override)
 * - field9: ~ Wrap ~ (wrap/aluminum cost override)
 * - field10: ~ Cut 2" ~ (cutting cost override)
 *
 * Pricing Components:
 * - Blade Material Cost: 2 * ROUNDUP(MAX(sqInches/20 * channelRate, SQRT(sqInches) * channelRate), 1)
 *   NOTE: Uses actual shape area calculated in validation layer
 *   - Rectangle: width × height
 *   - Circle: average of (π × width × height / 4) and (width × height) → cheaper!
 * - Frame, Assembly, Wrap: Tiered pricing (base cost < 4 sqft, additional cost per sqft > 4 sqft)
 * - Cutting: Fixed cost
 *
 * Component Logic:
 * - WITH field2: Single "Blade Sign" component (Blade+Frame+Assembly+Wrap+Cutting combined)
 * - WITHOUT field2: Separate components (Frame, Assembly, Aluminum, Cutting)
 * - LEDs, Power Supplies, UL always separate (following Channel Letters pattern)
 *
 * Display Format:
 * - Line 1: Width" x Height" [sqft] Blade $XX
 * - Line 2: Frame XX, Assem XX, Wrap XX, Cut XX (no $ signs, comma separated)
 */
export const calculateBladeSign = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
  // Skip calculation if validation errors exist
  if (input.hasValidationErrors) {
    return {
      status: 'pending',
      display: 'Fix validation errors first',
      data: null
    };
  }

  try {
    // Extract quantity
    const quantityRaw = input.parsedValues.quantity as string;
    const quantity = quantityRaw ? parseFloat(quantityRaw) : null;

    if (!quantity || quantity <= 0) {
      return {
        status: 'pending',
        display: 'Quantity required',
        data: null
      };
    }

    // Fetch Blade Sign pricing configuration
    const bladeSignConfig = await PricingDataResource.getBladeSignConfig();
    if (!bladeSignConfig) {
      return {
        status: 'error',
        display: 'Blade Sign pricing configuration not found',
        error: 'Unable to load blade_sign_pricing config'
      };
    }

    // Extract calculated values from validation layer
    const sqft = (input.calculatedValues.sqft as number) || 0;
    const sqInches = (input.calculatedValues.sqInches as number) || 0;
    const width = (input.calculatedValues.width as number) || 0;
    const height = (input.calculatedValues.height as number) || 0;
    let ledCount = (input.calculatedValues.ledCount as number) || 0;

    // Extract field overrides
    const frameOverride = input.parsedValues.field7 as number | undefined;
    const assemblyOverride = input.parsedValues.field8 as number | undefined;
    const wrapOverride = input.parsedValues.field9 as number | undefined;
    const cuttingOverride = input.parsedValues.field10 as number | undefined;

    const ulOverride = input.parsedValues.field4;
    const psCountOverride = input.parsedValues.field5;

    // Check if we have dimensions (determines component structure)
    const hasDimensions = sqft > 0 && width > 0 && height > 0;

    const components: ComponentItem[] = [];
    let totalPrice = 0;

    // Variables for power supply calculation
    let totalWattage = 0;
    let psCount = 0;

    // ========== CALCULATE BLADE SIGN COMPONENTS ==========

    if (hasDimensions) {
      // SCENARIO 1: Dimensions provided → Calculate tiered costs → Single "Blade Sign" component

      // Calculate Blade Material Cost (channel box price)
      // Formula: 2 * ROUNDUP(MAX(sqInches/20 * channelRate, SQRT(sqInches) * channelRate), 1)
      // IMPORTANT: Uses actual shape area (reuses sqInches from validation layer)
      // For circles: this will be the averaged ellipse area, making circles cheaper!
      const channelRate = bladeSignConfig.channel_letter_rate;
      const method1 = (sqInches / 20) * channelRate;
      const method2 = Math.sqrt(sqInches) * channelRate;
      const bladeMaterialCost = 2 * Math.ceil(Math.max(method1, method2));

      // Calculate Frame cost (tiered) - round up to nearest dollar
      let frameCost = 0;
      if (frameOverride !== undefined) {
        frameCost = frameOverride;
      } else {
        if (sqft < bladeSignConfig.size_threshold_sqft) {
          frameCost = Math.ceil(bladeSignConfig.frame_base_cost);
        } else if (sqft < bladeSignConfig.maximum_size_sqft) {
          const additionalSqft = sqft - bladeSignConfig.size_threshold_sqft;
          frameCost = Math.ceil(bladeSignConfig.frame_base_cost + (additionalSqft * bladeSignConfig.frame_rate_per_sqft));
        } else {
          return {
            status: 'error',
            display: `Size ${sqft.toFixed(2)} sqft exceeds maximum ${bladeSignConfig.maximum_size_sqft} sqft`,
            error: 'Blade sign size exceeds maximum allowable size'
          };
        }
      }

      // Calculate Assembly cost (tiered) - round up to nearest dollar
      let assemblyCost = 0;
      if (assemblyOverride !== undefined) {
        assemblyCost = assemblyOverride;
      } else {
        if (sqft < bladeSignConfig.size_threshold_sqft) {
          assemblyCost = Math.ceil(bladeSignConfig.assembly_base_cost);
        } else {
          const additionalSqft = sqft - bladeSignConfig.size_threshold_sqft;
          assemblyCost = Math.ceil(bladeSignConfig.assembly_base_cost + (additionalSqft * bladeSignConfig.assembly_rate_per_sqft));
        }
      }

      // Calculate Wrap cost (tiered) - round up to nearest dollar
      let wrapCost = 0;
      if (wrapOverride !== undefined) {
        wrapCost = wrapOverride;
      } else {
        if (sqft < bladeSignConfig.size_threshold_sqft) {
          wrapCost = Math.ceil(bladeSignConfig.wrap_base_cost);
        } else {
          const additionalSqft = sqft - bladeSignConfig.size_threshold_sqft;
          wrapCost = Math.ceil(bladeSignConfig.wrap_base_cost + (additionalSqft * bladeSignConfig.wrap_rate_per_sqft));
        }
      }

      // Calculate Cutting cost (fixed)
      let cuttingCost = 0;
      if (cuttingOverride !== undefined) {
        cuttingCost = cuttingOverride;
      } else {
        cuttingCost = bladeSignConfig.cutting_fixed_cost;
      }

      // Build display string showing breakdown
      const bladeSignTotal = bladeMaterialCost + frameCost + assemblyCost + wrapCost + cuttingCost;
      const displayLines: string[] = [];
      displayLines.push(`${width}" x ${height}" [${formatPrice(sqft)} sqft] Blade $${formatPrice(bladeMaterialCost)}`);
      displayLines.push(`Frame ${formatPrice(frameCost)}, Assem ${formatPrice(assemblyCost)}, Wrap ${formatPrice(wrapCost)}, Cut ${formatPrice(cuttingCost)}`);

      components.push({
        name: 'Blade sign',
        price: bladeSignTotal,
        type: 'blade_sign',
        calculationDisplay: displayLines.join('\n')
      });

      totalPrice += bladeSignTotal;

    } else {
      // SCENARIO 2: No dimensions → Standalone components (Frame, Assembly, Aluminum, Cutting)

      if (frameOverride !== undefined && frameOverride !== 0) {
        components.push({
          name: 'Frame',
          price: frameOverride,
          type: 'frame',
          calculationDisplay: `Manual cost: $${formatPrice(frameOverride)}`
        });
        totalPrice += frameOverride;
      }

      if (assemblyOverride !== undefined && assemblyOverride !== 0) {
        components.push({
          name: 'Assembly',
          price: assemblyOverride,
          type: 'assembly',
          calculationDisplay: `Manual cost: $${formatPrice(assemblyOverride)}`
        });
        totalPrice += assemblyOverride;
      }

      if (wrapOverride !== undefined && wrapOverride !== 0) {
        components.push({
          name: 'Aluminum',
          price: wrapOverride,
          type: 'aluminum',
          calculationDisplay: `Manual cost: $${formatPrice(wrapOverride)}`
        });
        totalPrice += wrapOverride;
      }

      if (cuttingOverride !== undefined && cuttingOverride !== 0) {
        components.push({
          name: 'Cutting',
          price: cuttingOverride,
          type: 'cutting',
          calculationDisplay: `Manual cost: $${formatPrice(cuttingOverride)}`
        });
        totalPrice += cuttingOverride;
      }
    }

    // ========== LEDs Component (if needed) ==========
    if (ledCount > 0) {
      // Get LED pricing (similar to Channel Letters)
      const defaultLed = await PricingDataResource.getDefaultLed();
      if (!defaultLed) {
        return {
          status: 'error',
          display: 'No LED pricing data found',
          error: 'Unable to find default LED pricing'
        };
      }

      if (!defaultLed.watts) {
        return {
          status: 'error',
          display: `LED ${defaultLed.product_code} missing wattage data`,
          error: `LED wattage not defined for ${defaultLed.product_code}`
        };
      }

      totalWattage = ledCount * defaultLed.watts;
      const ledsPrice = ledCount * defaultLed.price;

      components.push({
        name: 'LEDs',
        price: ledsPrice,
        type: 'leds',
        calculationDisplay: `${ledCount} @ $${formatPrice(Number(defaultLed.price))}, ${defaultLed.product_code}`
      });
      totalPrice += ledsPrice;
    }

    // ========== Power Supplies - Use powerSupplySelector for smart selection ==========

    // Normalize psCountOverride from field5
    let normalizedPsCountOverride: number | null = null;
    if (psCountOverride === 'no') {
      normalizedPsCountOverride = 0;
    } else if (typeof psCountOverride === 'number') {
      normalizedPsCountOverride = psCountOverride;
    }

    // sectionHasUL only affects PS TYPE selection (UL vs non-UL), not whether PS should be calculated
    const sectionHasUL = input.calculatedValues?.sectionHasUL ?? false;

    // Determine if PS should be calculated:
    // 1. User explicitly set PS # field (number or 'yes')
    // 2. This row has LEDs AND customer prefers power supplies
    let psOverrideForSelector: number | null = null;
    let shouldCalculatePS = false;

    if (psCountOverride === 'yes') {
      // User explicitly wants PSs
      shouldCalculatePS = true;
      psOverrideForSelector = null;
    } else if (normalizedPsCountOverride !== null) {
      // User entered a specific number (including 0)
      shouldCalculatePS = true;
      psOverrideForSelector = normalizedPsCountOverride;
    } else if (ledCount > 0 && input.customerPreferences?.pref_power_supply_required === true) {
      // This row has LEDs and customer preference requires power supplies
      shouldCalculatePS = true;
      psOverrideForSelector = null; // Let optimizer choose count based on wattage
    }

    if (shouldCalculatePS) {

      // Use totalWattage if available, otherwise use a minimal value for standalone PS
      const wattageForCalculation = totalWattage > 0 ? totalWattage : 1;

      const psResult = await selectPowerSupplies({
        totalWattage: wattageForCalculation,
        hasUL: sectionHasUL,  // Use section-level UL for PS selection
        psTypeOverride: null, // Blade Sign doesn't have PS type override field
        psCountOverride: psOverrideForSelector,
        customerPreferences: input.customerPreferences
      });

      if (psResult.error) {
        return {
          status: 'error',
          display: 'Power supply selection failed',
          error: psResult.error
        };
      }

      components.push(...psResult.components);
      totalPrice += psResult.components.reduce((sum, c) => sum + c.price, 0);
      psCount = psResult.totalCount;
    }

    // ========== UL Certification (if applicable) ==========
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
        if (ulOverride.type === 'currency') {
          hasUL = true;
          ulCustomPrice = ulOverride.amount;
        } else if (ulOverride.type === 'float') {
          hasUL = true;
          ulSetCount = ulOverride.amount;
        }
      }
    } else {
      hasUL = input.customerPreferences?.pref_ul_required === true;
    }

    // Show UL if explicitly set, OR if customer requires it and we have LEDs
    const shouldShowUL = ulExplicitlySet ? hasUL : (hasUL && ledCount > 0);

    if (shouldShowUL) {
      let ulPrice = 0;
      let ulCalculationDisplay = '';

      if (ulCustomPrice !== null) {
        ulPrice = ulCustomPrice;
        ulCalculationDisplay = `$${formatPrice(ulCustomPrice)} Custom`;
      } else {
        const ulPricing = await PricingDataResource.getUlListingPricing();
        if (!ulPricing) {
          return {
            status: 'error',
            display: 'UL pricing data not found',
            error: 'No UL listing pricing configured in database'
          };
        }

        if (ulSetCount !== null) {
          const baseFee = Number(ulPricing.base_fee);
          const perSetFee = Number(ulPricing.per_set_fee);

          if (isNaN(baseFee) || isNaN(perSetFee)) {
            return {
              status: 'error',
              display: 'Invalid UL pricing data',
              error: `UL pricing contains invalid values`
            };
          }

          const setsAmount = perSetFee * ulSetCount;

          if (input.ulExistsInPreviousRows) {
            ulPrice = setsAmount;
            ulCalculationDisplay = `${ulSetCount} Set${ulSetCount !== 1 ? 's' : ''} ($${formatPrice(setsAmount)})`;
          } else {
            ulPrice = baseFee + setsAmount;
            ulCalculationDisplay = `Base ($${formatPrice(baseFee)}) + ${ulSetCount} Set${ulSetCount !== 1 ? 's' : ''} ($${formatPrice(setsAmount)})`;
          }
        } else {
          // Default: Use parent quantity as set count (UL covers all sets in the row)
          // This prevents UL from being multiplied by parent qty again in extended price
          const baseFee = Number(ulPricing.base_fee);
          const perSetFee = Number(ulPricing.per_set_fee);

          if (isNaN(baseFee) || isNaN(perSetFee)) {
            return {
              status: 'error',
              display: 'Invalid UL pricing data',
              error: `UL pricing contains invalid values`
            };
          }

          // Use parent quantity as effective set count when no explicit override
          const effectiveSetCount = quantity;
          const setsAmount = perSetFee * effectiveSetCount;

          if (input.ulExistsInPreviousRows) {
            ulPrice = setsAmount;
            ulCalculationDisplay = `${effectiveSetCount} Set${effectiveSetCount !== 1 ? 's' : ''} ($${formatPrice(setsAmount)})`;
          } else {
            ulPrice = baseFee + setsAmount;
            ulCalculationDisplay = `Base ($${formatPrice(baseFee)}) + ${effectiveSetCount} Set${effectiveSetCount !== 1 ? 's' : ''} ($${formatPrice(setsAmount)})`;
          }
        }
      }

      if (ulPrice !== 0) {
        components.push({
          name: 'UL',
          price: ulPrice,
          type: 'ul',
          calculationDisplay: ulCalculationDisplay,
          quantity: 1  // Fixed quantity - UL price already includes all sets, don't multiply by parent qty
        });
        totalPrice += ulPrice;
      }
    }

    // Must have at least one component
    if (components.length === 0) {
      return {
        status: 'pending',
        display: 'No data to calculate',
        data: null
      };
    }

    // Build calculation data
    const calculationData: PricingCalculationData = {
      productTypeId: 6,
      rowId: input.rowId,
      itemName: hasDimensions ? `Blade Sign (${width}" x ${height}")` : components.map(c => c.name).join(' + '),
      unitPrice: totalPrice,
      quantity,
      components,
      hasCompleteSet: hasDimensions
    };

    return {
      status: 'completed',
      display: '',
      data: calculationData
    };

  } catch (error) {
    console.error('Blade Sign pricing calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      error: error instanceof Error ? error.message : 'Unknown calculation error'
    };
  }
};
