// =====================================================
// RATE LOOKUP SERVICE - Cached Pricing Data Access
// =====================================================
// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Removed getCurrentRates() - dead code (only called by other dead methods)
//   - Removed getSpecificRate() - dead code (never used)
//   - Removed getMultiplierRanges() - unused feature (quantity-based pricing)
//   - Removed getDiscountRanges() - unused feature (volume-based discounts)
//   - Removed getAvailableRateTypes() - unused endpoint
//   - Removed isCached() - dead code (never called)
//   - Removed fetchRatesFromDatabase() - only called by dead methods
//   - Removed getCategoryTableName() - only called by dead methods
//   - Removed getRateKey() - only called by dead methods
//   - Removed RateQueryResult import - type only used by dead code
// Result: 449 lines → 265 lines (184 lines removed, 41% reduction)
//
// Active Methods:
//   - getAllPricingData() - Used by frontend PricingDataResource
//   - getPushThruAssemblyPricing() - Used by frontend PricingDataResource
//   - clearCache() - Admin endpoint for debugging
//   - getCacheStats() - Admin endpoint for monitoring

import { query } from '../config/database';

// =====================================================
// PRICING TABLES CONFIGURATION
// =====================================================

interface PricingTableConfig {
  table: string;
  columns: string[];
  orderBy: string;
  hasActiveFilter?: boolean; // default true
  postProcess?: (data: any[]) => any;
}

const PRICING_TABLES: Record<string, PricingTableConfig> = {
  channelLetterTypes: {
    table: 'channel_letter_types',
    columns: ['id', 'type_name', 'type_code', 'base_rate_per_inch', 'led_default', 'led_multiplier', 'requires_pins', 'effective_date', 'is_active'],
    orderBy: 'type_name'
  },
  leds: {
    table: 'leds',
    columns: ['led_id', 'product_code', 'price', 'watts', 'colour', 'lumens', 'volts', 'brand', 'model', 'supplier', 'warranty', 'is_default', 'is_active'],
    orderBy: 'product_code'
  },
  powerSupplies: {
    table: 'power_supplies',
    columns: ['power_supply_id', 'transformer_type', 'price', 'watts', 'rated_watts', 'volts', 'warranty_labour_years', 'warranty_product_years', 'notes', 'ul_listed', 'is_default_non_ul', 'is_default_ul', 'is_active'],
    orderBy: 'transformer_type'
  },
  ulListingPricing: {
    table: 'ul_listing_pricing',
    columns: ['id', 'ul_type', 'ul_code', 'base_fee', 'per_set_fee', 'minimum_sets', 'effective_date', 'is_active'],
    orderBy: 'ul_type'
  },
  wiringPricing: {
    table: 'wiring_pricing',
    columns: ['id', 'wiring_type', 'wiring_code', 'dc_plug_cost_per_unit', 'wall_plug_cost_per_unit', 'wire_cost_per_ft', 'effective_date', 'is_active'],
    orderBy: 'wiring_type'
  },
  pinTypes: {
    table: 'pin_types',
    columns: ['id', 'type_name', 'description', 'base_cost', 'display_order', 'is_active'],
    orderBy: 'display_order, type_name'
  },
  vinylPricing: {
    table: 'vinyl_pricing',
    columns: ['id', 'vinyl_component', 'component_code', 'componentl_type', 'price', 'effective_date', 'is_active'],
    orderBy: 'vinyl_component'
  },
  substrateCutPricing: {
    table: 'substrate_cut_pricing',
    columns: ['id', 'substrate_name', 'material_cost_per_sheet', 'cutting_rate_per_sheet', 'sheet_size_sqft', 'effective_date', 'is_active'],
    orderBy: 'id'
  },
  substrateCutBasePricing: {
    table: 'substrate_cut_base_pricing',
    columns: ['`Index`', 'name', 'Value'],
    orderBy: '`Index`',
    hasActiveFilter: false // No WHERE clause for this table
  },
  bladeSignConfig: {
    table: 'blade_sign_pricing',
    columns: ['config_name', 'config_value'],
    orderBy: 'id',
    hasActiveFilter: true,
    postProcess: (data: any[]) => {
      // Convert array to object map
      const configMap: Record<string, number> = {};
      for (const row of data) {
        configMap[row.config_name] = parseFloat(row.config_value);
      }
      return configMap;
    }
  },
  ledNeonPricing: {
    table: 'led_neon_pricing',
    columns: ['id', 'solder_type', 'price', 'is_active'],
    orderBy: 'solder_type'
  },
  shippingRatesPricing: {
    table: 'shipping_rates_pricing',
    columns: ['id', 'shipping_type', 'shipping_code', 'base_rate', 'pallet_rate', 'crate_rate', 'b_rate', 'bb_rate', 'big_b_rate', 'big_bb_rate', 'tailgate_rate', 'effective_date', 'is_active'],
    orderBy: 'shipping_type'
  },
  paintingPricing: {
    table: 'painting_pricing',
    columns: ['id', 'sqft_price', 'prep_rate_per_hour', 'return_3in_sqft_per_length', 'return_4in_sqft_per_length', 'return_5in_sqft_per_length', 'trim_cap_sqft_per_length', 'effective_date', 'is_active'],
    orderBy: 'id',
    hasActiveFilter: true,
    postProcess: (data: any[]) => data[0] || null // Return single config row
  },
  materialCutPricing: {
    table: 'material_cut_pricing',
    columns: ['id', 'return_3in_material_only', 'return_3in_material_cut', 'return_3in_prime_ret', 'return_4in_material_only', 'return_4in_material_cut', 'return_4in_prime_ret', 'return_5in_material_only', 'return_5in_material_cut', 'return_5in_prime_ret', 'trim_cap_material_only', 'trim_cap_material_cut', 'pc_base_cost', 'pc_length_cost', 'acm_base_cost', 'acm_length_cost', 'design_fee', 'effective_date', 'is_active'],
    orderBy: 'id',
    hasActiveFilter: true,
    postProcess: (data: any[]) => data[0] || null // Return single config row
  }
};

// =====================================================
// RATE LOOKUP SERVICE CLASS
// =====================================================

export class RateLookupService {
  // In-memory cache for rate data (in production, use Redis with TTL)
  private static rateCache = new Map<string, { data: any, expires: Date }>();
  private static readonly CACHE_TTL_MINUTES = 30; // 30-minute cache

  // =====================================================
  // PUBLIC METHODS
  // =====================================================

  /**
   * Get all pricing data for session caching
   */
  async getAllPricingData(): Promise<any> {
    return this.withCache('all_pricing_data', async () => {
      const configKeys = Object.keys(PRICING_TABLES);
      const results = await Promise.all(
        configKeys.map(key => this.fetchPricingTable(key))
      );

      const allPricingData: any = {
        fetchTime: new Date().toISOString()
      };

      configKeys.forEach((key, i) => {
        allPricingData[key] = results[i];
      });

      return allPricingData;
    });
  }


  /**
   * Get Push Thru assembly pricing (single active row)
   */
  async getPushThruAssemblyPricing(): Promise<any> {
    const result = await query(`
      SELECT
        id,
        base_cost_per_sheet,
        size_cost_per_32sqft,
        is_active
      FROM push_thru_assembly_pricing
      WHERE is_active = 1
      LIMIT 1
    `) as any[];

    if (result.length === 0) {
      throw new Error('No active Push Thru assembly pricing found');
    }

    return result[0];
  }

  /**
   * Clear cache for specific category or all cache
   */
  clearCache(category?: string): void {
    if (category) {
      const cacheKey = `rates_${category}`;
      RateLookupService.rateCache.delete(cacheKey);
    } else {
      RateLookupService.rateCache.clear();
    }
  }


  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): any {
    const stats = {
      totalEntries: RateLookupService.rateCache.size,
      categories: [] as string[],
      oldestEntry: null as Date | null,
      newestEntry: null as Date | null
    };

    for (const [key, value] of RateLookupService.rateCache.entries()) {
      if (key.startsWith('rates_')) {
        stats.categories.push(key.replace('rates_', ''));
      }

      if (!stats.oldestEntry || value.expires < stats.oldestEntry) {
        stats.oldestEntry = value.expires;
      }

      if (!stats.newestEntry || value.expires > stats.newestEntry) {
        stats.newestEntry = value.expires;
      }
    }

    return stats;
  }

  // =====================================================
  // PRIVATE METHODS
  // =====================================================

  /**
   * Generic cache wrapper - eliminates duplicate caching logic
   */
  private async withCache<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = RateLookupService.rateCache.get(cacheKey);

    // Check if cached data is still valid
    if (cached && cached.expires > new Date()) {
      return cached.data;
    }

    // Fetch fresh data
    const data = await fetcher();

    // Cache the results
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + RateLookupService.CACHE_TTL_MINUTES);
    RateLookupService.rateCache.set(cacheKey, { data, expires });

    return data;
  }

  /**
   * Generic pricing table fetch - replaces 11 individual fetch methods
   */
  private async fetchPricingTable(configKey: string): Promise<any> {
    const config = PRICING_TABLES[configKey];

    if (!config) {
      throw new Error(`Unknown pricing table config: ${configKey}`);
    }

    // Build WHERE clause
    const whereClause = config.hasActiveFilter !== false
      ? 'WHERE is_active = true'
      : '';

    try {
      const result = await query(`
        SELECT ${config.columns.join(', ')}
        FROM ${config.table}
        ${whereClause}
        ORDER BY ${config.orderBy}
      `) as any[];

      // Apply post-processing if defined (e.g., convert array to object)
      return config.postProcess ? config.postProcess(result) : result;

    } catch (error) {
      console.error(`Error fetching pricing table ${configKey}:`, error);
      throw error;
    }
  }

}
