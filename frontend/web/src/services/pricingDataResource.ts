// =====================================================
// PRICING DATA RESOURCE - Session Caching for Pricing
// =====================================================

import api from './api';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface ChannelLetterType {
  id: number;
  type_name: string;
  type_code: string;
  base_rate_per_inch: number;
  led_default: number;  // LED ID, 0 = use system default
  led_multiplier: number;
  requires_pins: boolean;
  effective_date: string;
  is_active: boolean;
}

export interface Led {
  led_id: number;
  product_code: string;
  price: number;
  watts: number;
  colour: string;
  lumens: string;
  volts: number;
  brand: string;
  model: string;
  supplier: string;
  warranty: string;
  is_default: boolean;
  is_active: boolean;
}

export interface PowerSupply {
  power_supply_id: number;
  transformer_type: string;
  price: number;
  watts: number;
  rated_watts: number;
  volts: number;
  warranty_labour_years: number;
  warranty_product_years: number;
  notes: string;
  ul_listed: boolean;
  is_default_non_ul: boolean;
  is_default_ul: boolean;
  is_active: boolean;
}

export interface UlListingPricing {
  id: number;
  ul_type: string;
  ul_code: string;
  base_fee: number;
  per_set_fee: number;
  minimum_sets: number;
  effective_date: string;
  is_active: boolean;
}

export interface WiringPricing {
  id: number;
  wiring_type: string;
  wiring_code: string;
  dc_plug_cost_per_unit: number;
  wall_plug_cost_per_unit: number;
  wire_cost_per_ft: number;
  effective_date: string;
  is_active: boolean;
}

export interface PinType {
  id: number;
  type_name: string;
  description: string;
  base_cost: number;
  display_order: number;
  is_active: boolean;
}

export interface VinylRate {
  id: number;
  vinyl_component: string;
  component_code: string;
  componentl_type: string;
  price: number;
  effective_date: string;
  is_active: boolean;
}

export interface SubstrateCutPricing {
  id: number;
  substrate_name: string;
  material_cost_per_sheet: number;
  cutting_rate_per_sheet: number;
  sheet_size_sqft: number;
  effective_date: string;
  is_active: boolean;
}

export interface SubstrateCutBasePricing {
  Index: number;
  name: string;
  Value: number;
}

export interface PushThruAssemblyPricing {
  id: number;
  base_cost_per_sheet: number;
  size_cost_per_32sqft: number;
  is_active: boolean;
}

export interface BladeSignConfig {
  frame_base_cost: number;
  frame_rate_per_sqft: number;
  assembly_base_cost: number;
  assembly_rate_per_sqft: number;
  wrap_base_cost: number;
  wrap_rate_per_sqft: number;
  cutting_fixed_cost: number;
  size_threshold_sqft: number;
  maximum_size_sqft: number;
  channel_letter_rate: number;
  led_area_factor: number;
  led_perimeter_factor: number;
}

export interface LedNeonPricing {
  id: number;
  solder_type: string;
  price: number;
  is_active: boolean;
}

export interface ShippingRate {
  id: number;
  shipping_type: string;
  shipping_code: string;
  base_rate: number;
  pallet_rate: number;
  crate_rate: number;
  b_rate: number;
  bb_rate: number;
  big_b_rate: number;
  big_bb_rate: number;
  tailgate_rate: number;
  effective_date: string;
  is_active: boolean;
}

export interface PaintingPricing {
  id: number;
  sqft_price: number;
  prep_rate_per_hour: number;
  return_3in_sqft_per_length: number;
  return_4in_sqft_per_length: number;
  return_5in_sqft_per_length: number;
  trim_cap_sqft_per_length: number;
  effective_date: string;
  is_active: boolean;
}

export interface MaterialCutPricing {
  id: number;
  return_3in_material_only: number;
  return_3in_material_cut: number;
  return_3in_prime_ret: number;
  return_4in_material_only: number;
  return_4in_material_cut: number;
  return_4in_prime_ret: number;
  return_5in_material_only: number;
  return_5in_material_cut: number;
  return_5in_prime_ret: number;
  trim_cap_material_only: number;
  trim_cap_material_cut: number;
  pc_base_cost: number;
  pc_length_cost: number;
  acm_base_cost: number;
  acm_length_cost: number;
  design_fee: number;
  effective_date: string;
  is_active: boolean;
}

export interface AllPricingData {
  channelLetterTypes: ChannelLetterType[];
  leds: Led[];
  powerSupplies: PowerSupply[];
  ulListingPricing: UlListingPricing[];
  wiringPricing: WiringPricing[];
  pinTypes: PinType[];
  vinylPricing: VinylRate[];
  substrateCutPricing: SubstrateCutPricing[];
  substrateCutBasePricing: SubstrateCutBasePricing[];
  bladeSignConfig: BladeSignConfig;
  ledNeonPricing: LedNeonPricing[];
  shippingRatesPricing: ShippingRate[];
  paintingPricing: PaintingPricing | null;
  materialCutPricing: MaterialCutPricing | null;
  fetchTime: string;
}

// =====================================================
// PRICING DATA RESOURCE CLASS
// =====================================================

export class PricingDataResource {
  private static cachedData: AllPricingData | null = null;
  private static cacheTimestamp: number | null = null;
  private static inFlightRequest: Promise<AllPricingData> | null = null;
  private static readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  // Cached derived maps (built once from cached data)
  private static vinylRatesMapCache: Record<string, number> | null = null;
  private static substrateCutPricingMapCache: Record<string, SubstrateCutPricing> | null = null;
  private static substrateCutBasePricingMapCache: Record<string, number> | null = null;
  private static shippingRatesMapCache: Record<string, number> | null = null;

  /**
   * Get all pricing data - cached for session
   */
  static async getAllPricingData(): Promise<AllPricingData> {
    // Check if we have valid cached data
    if (this.isCacheValid()) {
      return this.cachedData!;
    }

    // Check if there's already a request in flight
    if (this.inFlightRequest) {
      return this.inFlightRequest;
    }

    // Create new request
    this.inFlightRequest = (async () => {
      try {
        const response = await api.get('/pricing/all-pricing-data');
        // API interceptor unwraps { success: true, data: pricing } -> pricing directly
        this.cachedData = response.data;
        this.cacheTimestamp = Date.now();
        return this.cachedData!;
      } catch (error) {
        console.error('Error fetching pricing data:', error);
        throw new Error('Failed to fetch pricing data');
      } finally {
        this.inFlightRequest = null;
      }
    })();

    return this.inFlightRequest;
  }

  /**
   * Get channel letter type by type name or type code
   */
  static async getChannelLetterType(typeNameOrCode: string): Promise<ChannelLetterType | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.channelLetterTypes.find(
      type => type.type_name === typeNameOrCode || type.type_code === typeNameOrCode
    ) || null;
  }

  /**
   * Get LED by product code
   */
  static async getLed(productCode: string): Promise<Led | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.leds.find(led => led.product_code === productCode) || null;
  }

  /**
   * Get default LED
   */
  static async getDefaultLed(): Promise<Led | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.leds.find(led => led.is_default && led.is_active) || null;
  }

  /**
   * Get LED by ID (for channel type defaults)
   */
  static async getLedById(ledId: number): Promise<Led | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.leds.find(led => led.led_id === ledId && led.is_active) || null;
  }

  /**
   * Get power supply by transformer type
   */
  static async getPowerSupply(transformerType: string): Promise<PowerSupply | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.powerSupplies.find(ps => ps.transformer_type === transformerType) || null;
  }

  /**
   * Get power supply by transformer type name
   */
  static async getPowerSupplyByType(transformerType: string): Promise<PowerSupply | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.powerSupplies.find(ps =>
      ps.transformer_type === transformerType && ps.is_active
    ) || null;
  }

  /**
   * Get power supply by ID
   */
  static async getPowerSupplyById(id: number): Promise<PowerSupply | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.powerSupplies.find(ps =>
      ps.power_supply_id === id && ps.is_active
    ) || null;
  }

  /**
   * Get default UL power supply
   */
  static async getDefaultULPowerSupply(): Promise<PowerSupply | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.powerSupplies.find(ps =>
      ps.is_default_ul && ps.is_active
    ) || null;
  }

  /**
   * Get default non-UL power supply
   */
  static async getDefaultNonULPowerSupply(): Promise<PowerSupply | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.powerSupplies.find(ps =>
      ps.is_default_non_ul && ps.is_active
    ) || null;
  }

  /**
   * Get UL listing pricing by type
   */
  static async getUlListingPricing(ulType: string = 'Standard UL Listing'): Promise<UlListingPricing | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.ulListingPricing.find(ul => ul.ul_type === ulType) || null;
  }

  /**
   * Get wiring pricing
   */
  static async getWiringPricing(): Promise<WiringPricing | null> {
    const pricingData = await this.getAllPricingData();
    // Get the first active wiring pricing (typically only one)
    return pricingData.wiringPricing.find(w => w.is_active) || null;
  }

  /**
   * Get pin type by name
   */
  static async getPinType(typeName: string): Promise<PinType | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.pinTypes.find(pt => pt.type_name === typeName) || null;
  }

  /**
   * Get vinyl rate by component code
   */
  static async getVinylRate(componentCode: string): Promise<VinylRate | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.vinylPricing.find(vr => vr.component_code === componentCode) || null;
  }

  /**
   * Get all vinyl rates as a map for easy lookup (CACHED)
   */
  static async getVinylRatesMap(): Promise<Record<string, number>> {
    // Return cached map if available
    if (this.vinylRatesMapCache) {
      return this.vinylRatesMapCache;
    }

    const pricingData = await this.getAllPricingData();
    const rateMap: Record<string, number> = {};

    if (!pricingData.vinylPricing) {
      console.error('vinylPricing not found in pricing data:', Object.keys(pricingData));
      throw new Error('Vinyl pricing data not available');
    }

    for (const rate of pricingData.vinylPricing) {
      const priceValue = parseFloat(rate.price);
      if (isNaN(priceValue)) {
        console.error(`Invalid price for ${rate.component_code}:`, rate.price);
      }
      rateMap[rate.component_code] = priceValue;
    }

    // Cache the map for future calls
    this.vinylRatesMapCache = rateMap;
    return rateMap;
  }

  /**
   * Get substrate cut pricing by substrate name
   */
  static async getSubstrateCutPricing(substrateName: string): Promise<SubstrateCutPricing | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.substrateCutPricing.find(s => s.substrate_name === substrateName) || null;
  }

  /**
   * Get all substrate cut pricing as a map for easy lookup (CACHED)
   */
  static async getSubstrateCutPricingMap(): Promise<Record<string, SubstrateCutPricing>> {
    // Return cached map if available
    if (this.substrateCutPricingMapCache) {
      return this.substrateCutPricingMapCache;
    }

    const pricingData = await this.getAllPricingData();
    const pricingMap: Record<string, SubstrateCutPricing> = {};

    for (const substrate of pricingData.substrateCutPricing) {
      pricingMap[substrate.substrate_name] = substrate;
    }

    // Cache the map for future calls
    this.substrateCutPricingMapCache = pricingMap;
    return pricingMap;
  }

  /**
   * Get substrate cut base pricing as a map (by name) (CACHED)
   */
  static async getSubstrateCutBasePricingMap(): Promise<Record<string, number>> {
    // Return cached map if available
    if (this.substrateCutBasePricingMapCache) {
      return this.substrateCutBasePricingMapCache;
    }

    const pricingData = await this.getAllPricingData();
    const baseMap: Record<string, number> = {};

    for (const base of pricingData.substrateCutBasePricing) {
      baseMap[base.name] = parseFloat(base.Value as any);
    }

    // Cache the map for future calls
    this.substrateCutBasePricingMapCache = baseMap;
    return baseMap;
  }

  /**
   * Get Push Thru assembly pricing (single active row)
   */
  static async getPushThruAssemblyPricing(): Promise<PushThruAssemblyPricing> {
    try {
      const response = await api.get('/pricing/push-thru-assembly');
      // API interceptor unwraps { success: true, data: T } -> T directly
      return response.data;
    } catch (error) {
      console.error('Error fetching Push Thru assembly pricing:', error);
      // Return defaults if API fails
      return {
        id: 1,
        base_cost_per_sheet: 50.00,
        size_cost_per_32sqft: 80.00,
        is_active: true
      };
    }
  }

  /**
   * Get Blade Sign configuration
   */
  static async getBladeSignConfig(): Promise<BladeSignConfig | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.bladeSignConfig || null;
  }

  /**
   * Get painting pricing configuration
   */
  static async getPaintingPricing(): Promise<PaintingPricing | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.paintingPricing || null;
  }

  /**
   * Get material cut pricing rates
   */
  static async getMaterialCutRates(): Promise<MaterialCutPricing | null> {
    const pricingData = await this.getAllPricingData();
    return pricingData.materialCutPricing || null;
  }

  /**
   * Get all shipping rates as a map for easy lookup (CACHED)
   */
  static async getShippingRatesMap(): Promise<Record<string, number>> {
    // Return cached map if available
    if (this.shippingRatesMapCache) {
      return this.shippingRatesMapCache;
    }

    const pricingData = await this.getAllPricingData();
    const rateMap: Record<string, number> = {};

    if (!pricingData.shippingRatesPricing || pricingData.shippingRatesPricing.length === 0) {
      console.error('shippingRatesPricing not found in pricing data:', Object.keys(pricingData));
      throw new Error('Shipping rates pricing data not available');
    }

    // Get the first active shipping rate (typically only one)
    const activeRate = pricingData.shippingRatesPricing.find(rate => rate.is_active);

    if (!activeRate) {
      throw new Error('No active shipping rates found');
    }

    // Map the rates to convenient keys
    rateMap['SHIP_B'] = parseFloat(activeRate.b_rate as any);
    rateMap['SHIP_BB'] = parseFloat(activeRate.bb_rate as any);
    rateMap['SHIP_BIG_B'] = parseFloat(activeRate.big_b_rate as any);
    rateMap['SHIP_BIG_BB'] = parseFloat(activeRate.big_bb_rate as any);
    rateMap['SHIP_TAILGATE'] = parseFloat(activeRate.tailgate_rate as any);
    rateMap['SHIP_BASE'] = parseFloat(activeRate.base_rate as any);
    rateMap['SHIP_PALLET'] = parseFloat(activeRate.pallet_rate as any);
    rateMap['SHIP_CRATE'] = parseFloat(activeRate.crate_rate as any);

    // Cache the map for future calls
    this.shippingRatesMapCache = rateMap;
    return rateMap;
  }

  /**
   * Clear cached data (force refresh)
   */
  static clearCache(): void {
    this.cachedData = null;
    this.cacheTimestamp = null;
    // Also clear derived maps
    this.vinylRatesMapCache = null;
    this.substrateCutPricingMapCache = null;
    this.substrateCutBasePricingMapCache = null;
    this.shippingRatesMapCache = null;
  }

  /**
   * Check if cached data is still valid
   */
  private static isCacheValid(): boolean {
    if (!this.cachedData || !this.cacheTimestamp) {
      return false;
    }

    const now = Date.now();
    const cacheAge = now - this.cacheTimestamp;
    return cacheAge < this.CACHE_DURATION_MS;
  }

  /**
   * Get cache status for debugging
   */
  static getCacheStatus(): {
    isCached: boolean,
    ageMinutes?: number,
    fetchTime?: string
  } {
    if (!this.cachedData || !this.cacheTimestamp) {
      return { isCached: false };
    }

    const ageMinutes = Math.floor((Date.now() - this.cacheTimestamp) / (1000 * 60));

    return {
      isCached: true,
      ageMinutes,
      fetchTime: this.cachedData.fetchTime
    };
  }
}

// Export default instance for convenience
export default PricingDataResource;