// =====================================================
// RATE LOOKUP SERVICE - Cached Pricing Data Access
// =====================================================

import { RateQueryResult } from '../types/pricing';
import { query } from '../config/database';

export class RateLookupService {
  // In-memory cache for rate data (in production, use Redis with TTL)
  private static rateCache = new Map<string, { data: any, expires: Date }>();
  private static readonly CACHE_TTL_MINUTES = 30; // 30-minute cache
  
  /**
   * Get current rates for a specific category with caching
   */
  async getCurrentRates(category: string): Promise<Record<string, any>> {
    const cacheKey = `rates_${category}`;
    const cached = RateLookupService.rateCache.get(cacheKey);
    
    // Check if cached data is still valid
    if (cached && cached.expires > new Date()) {
      return cached.data;
    }
    
    // Fetch fresh data from database
    const rates = await this.fetchRatesFromDatabase(category);
    
    // Cache the results
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + RateLookupService.CACHE_TTL_MINUTES);
    
    RateLookupService.rateCache.set(cacheKey, {
      data: rates,
      expires
    });
    
    return rates;
  }
  
  /**
   * Get specific rate by code and category
   */
  async getSpecificRate(category: string, rateCode: string): Promise<RateQueryResult> {
    const allRates = await this.getCurrentRates(category);
    const rateData = allRates[rateCode];
    
    return {
      found: !!rateData,
      rates: rateData || {},
      effectiveDate: rateData?.effective_date || new Date(),
      rateTable: this.getCategoryTableName(category)
    };
  }
  
  /**
   * Get multiplier ranges for quantity calculations
   */
  async getMultiplierRanges(): Promise<any[]> {
    const cacheKey = 'multiplier_ranges';
    const cached = RateLookupService.rateCache.get(cacheKey);
    
    if (cached && cached.expires > new Date()) {
      return cached.data;
    }
    
    const multipliers = await query(`
      SELECT 
        multiplier_name,
        multiplier_code,
        quantity_ranges,
        applies_to_categories,
        priority_order
      FROM multiplier_ranges 
      WHERE is_active = true 
      AND effective_date <= CURDATE() 
      AND (expires_date IS NULL OR expires_date > CURDATE())
      ORDER BY priority_order, multiplier_name
    `) as any[];
    
    // Parse JSON fields
    const processedMultipliers = multipliers.map(m => ({
      ...m,
      quantity_ranges: JSON.parse(m.quantity_ranges || '[]'),
      applies_to_categories: JSON.parse(m.applies_to_categories || '[]')
    }));
    
    // Cache results
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + RateLookupService.CACHE_TTL_MINUTES);
    
    RateLookupService.rateCache.set(cacheKey, {
      data: processedMultipliers,
      expires
    });
    
    return processedMultipliers;
  }
  
  /**
   * Get discount ranges for volume discounts
   */
  async getDiscountRanges(): Promise<any[]> {
    const cacheKey = 'discount_ranges';
    const cached = RateLookupService.rateCache.get(cacheKey);
    
    if (cached && cached.expires > new Date()) {
      return cached.data;
    }
    
    const discounts = await query(`
      SELECT 
        discount_name,
        discount_code,
        discount_ranges,
        applies_to_categories,
        customer_restrictions,
        priority_order
      FROM discount_ranges 
      WHERE is_active = true 
      AND effective_date <= CURDATE() 
      AND (expires_date IS NULL OR expires_date > CURDATE())
      ORDER BY priority_order, discount_name
    `) as any[];
    
    // Parse JSON fields
    const processedDiscounts = discounts.map(d => ({
      ...d,
      discount_ranges: JSON.parse(d.discount_ranges || '[]'),
      applies_to_categories: JSON.parse(d.applies_to_categories || '[]'),
      customer_restrictions: JSON.parse(d.customer_restrictions || '{}')
    }));
    
    // Cache results
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + RateLookupService.CACHE_TTL_MINUTES);
    
    RateLookupService.rateCache.set(cacheKey, {
      data: processedDiscounts,
      expires
    });
    
    return processedDiscounts;
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
  
  // =====================================================
  // PRIVATE METHODS
  // =====================================================
  
  /**
   * Fetch rates from database for specific category
   */
  private async fetchRatesFromDatabase(category: string): Promise<Record<string, any>> {
    const tableName = this.getCategoryTableName(category);
    
    if (!tableName) {
      return {};
    }
    
    try {
      const rates = await query(`
        SELECT * FROM ${tableName}
        WHERE is_active = true 
        AND effective_date <= CURDATE() 
        AND (expires_date IS NULL OR expires_date > CURDATE())
        ORDER BY effective_date DESC
      `) as any[];
      
      // Convert array to keyed object for easy lookup
      const rateMap: Record<string, any> = {};
      
      rates.forEach(rate => {
        const key = this.getRateKey(rate, category);
        if (key) {
          rateMap[key] = rate;
        }
      });
      
      return rateMap;
      
    } catch (error) {
      console.error(`Error fetching rates for category ${category}:`, error);
      return {};
    }
  }
  
  /**
   * Get database table name for category
   */
  private getCategoryTableName(category: string): string | null {
    const tableMap: Record<string, string> = {
      'vinyl': 'vinyl_types_pricing',
      'channel_letters': 'channel_letter_types', // Existing table
      'substrate': 'substrate_cut_pricing',
      'backer': 'backer_pricing',
      'push_thru': 'push_thru_pricing',
      'blade_sign': 'blade_sign_pricing',
      'led_neon': 'led_neon_pricing',
      'painting': 'painting_pricing',
      'custom': 'custom_pricing',
      'wiring': 'wiring_pricing',
      'material_cut': 'material_cut_pricing',
      'shipping': 'shipping_rates_pricing', // Existing table
      'ul_supplementary': 'ul_listing_pricing', // Existing table
      'led_types': 'led_types_pricing', // Existing table
      'transformer_types': 'transformer_types_pricing' // Existing table
    };
    
    return tableMap[category] || null;
  }
  
  /**
   * Get the key field for rate lookup based on category
   */
  private getRateKey(rate: any, category: string): string | null {
    const keyFieldMap: Record<string, string> = {
      'vinyl': 'vinyl_type',
      'channel_letters': 'type_name',
      'substrate': 'substrate_type',
      'backer': 'backer_type',
      'push_thru': 'push_thru_type',
      'blade_sign': 'blade_type',
      'led_neon': 'neon_type',
      'painting': 'painting_type',
      'custom': 'custom_type',
      'wiring': 'wiring_type',
      'material_cut': 'material_type',
      'shipping': 'shipping_type',
      'ul_supplementary': 'ul_type',
      'led_types': 'led_type',
      'transformer_types': 'transformer_type'
    };
    
    const keyField = keyFieldMap[category];
    return keyField ? rate[keyField] : null;
  }
  
  /**
   * Get all available rate types for a category (for dropdowns)
   */
  async getAvailableRateTypes(category: string): Promise<string[]> {
    const rates = await this.getCurrentRates(category);
    return Object.keys(rates);
  }
  
  /**
   * Check if rates are cached
   */
  isCached(category: string): boolean {
    const cacheKey = `rates_${category}`;
    const cached = RateLookupService.rateCache.get(cacheKey);
    return cached ? cached.expires > new Date() : false;
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
}