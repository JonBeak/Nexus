// File Clean up Finished: 2026-01-12
/**
 * Specification Options Cache
 * Session caching for specification dropdown options
 *
 * Created: 2025-12-16
 * Part of: Settings to Database Migration
 *
 * Follows same pattern as PricingDataResource
 */

import { settingsApi } from './api';

// =====================================================
// SPECIFICATION OPTIONS CACHE CLASS
// =====================================================

export class SpecificationOptionsCache {
  private static cachedOptions: Record<string, string[]> | null = null;
  private static cacheTimestamp: number | null = null;
  private static inFlightRequest: Promise<Record<string, string[]>> | null = null;
  private static readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Get all specification options - cached for session
   * Returns a map of category key -> option values array
   */
  static async getAllOptions(): Promise<Record<string, string[]>> {
    // Check if we have valid cached data
    if (this.isCacheValid()) {
      return this.cachedOptions!;
    }

    // Check if there's already a request in flight
    if (this.inFlightRequest) {
      return this.inFlightRequest;
    }

    // Create new request
    this.inFlightRequest = (async () => {
      try {
        console.log('[SpecOptionsCache] Fetching all specification options from API...');

        // Fetch all categories
        const categories = await settingsApi.getSpecificationCategories();

        // Fetch all category options in parallel
        const optionsPromises = categories.map(async (cat) => {
          const options = await settingsApi.getOptionsByCategory(cat.category);
          return {
            category: cat.category,
            values: options
              .sort((a, b) => a.display_order - b.display_order)
              .map(opt => opt.option_value)
          };
        });

        const results = await Promise.all(optionsPromises);

        // Convert to Record<category, values[]>
        const optionsMap: Record<string, string[]> = {};
        for (const result of results) {
          optionsMap[result.category] = result.values;
        }

        this.cachedOptions = optionsMap;
        this.cacheTimestamp = Date.now();
        console.log(`[SpecOptionsCache] Cached ${Object.keys(optionsMap).length} categories`);
        return this.cachedOptions!;
      } catch (error) {
        console.error('[SpecOptionsCache] Error fetching specification options:', error);
        throw new Error('Failed to fetch specification options');
      } finally {
        this.inFlightRequest = null;
      }
    })();

    return this.inFlightRequest;
  }

  /**
   * Get options for a specific category
   * Returns empty array if category not found
   */
  static async getOptionsForCategory(category: string): Promise<string[]> {
    const allOptions = await this.getAllOptions();
    return allOptions[category] || [];
  }

  /**
   * Clear cached data (force refresh)
   * Call this after modifying options in Settings UI
   */
  static invalidateCache(): void {
    this.cachedOptions = null;
    this.cacheTimestamp = null;
    console.log('[SpecOptionsCache] Cache invalidated');
  }

  /**
   * Check if cached data is still valid
   */
  static isCacheValid(): boolean {
    if (!this.cachedOptions || !this.cacheTimestamp) {
      return false;
    }

    const now = Date.now();
    const cacheAge = now - this.cacheTimestamp;
    return cacheAge < this.CACHE_DURATION_MS;
  }

  /**
   * Check if cache has been populated (for template population check)
   */
  static isCachePopulated(): boolean {
    return this.cachedOptions !== null;
  }

  /**
   * Get cached options synchronously (returns null if not cached)
   * Use this for template population when you know cache exists
   */
  static getCachedOptionsSync(): Record<string, string[]> | null {
    return this.cachedOptions;
  }

  /**
   * Get cache status for debugging
   */
  static getCacheStatus(): {
    isCached: boolean;
    categoryCount?: number;
    ageMinutes?: number;
  } {
    if (!this.cachedOptions || !this.cacheTimestamp) {
      return { isCached: false };
    }

    const ageMinutes = Math.floor((Date.now() - this.cacheTimestamp) / (1000 * 60));

    return {
      isCached: true,
      categoryCount: Object.keys(this.cachedOptions).length,
      ageMinutes
    };
  }
}
