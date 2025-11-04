// =====================================================
// QUICKBOOKS DATA RESOURCE - Session Caching for QB Data
// =====================================================

import api from './api';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface QuickBooksItem {
  id: number;
  name: string;
  description: string | null;
  qbItemId: string;
  qbItemType: string | null;
}

export interface AllQuickBooksData {
  items: QuickBooksItem[];
  fetchTime: string;
}

// =====================================================
// QUICKBOOKS DATA RESOURCE CLASS
// =====================================================

export class QuickBooksDataResource {
  private static cachedData: AllQuickBooksData | null = null;
  private static cacheTimestamp: number | null = null;
  private static inFlightRequest: Promise<AllQuickBooksData> | null = null;
  private static readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Get all QuickBooks data - cached for session
   */
  static async getAllQuickBooksData(): Promise<AllQuickBooksData> {
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
        const response = await api.get('/quickbooks/items');

        if (response.data.success) {
          this.cachedData = {
            items: response.data.items,
            fetchTime: new Date().toISOString()
          };
          this.cacheTimestamp = Date.now();
          return this.cachedData!;
        } else {
          throw new Error('API returned unsuccessful response');
        }
      } catch (error) {
        console.error('Error fetching QuickBooks items:', error);
        throw new Error('Failed to fetch QuickBooks items');
      } finally {
        this.inFlightRequest = null;
      }
    })();

    return this.inFlightRequest;
  }

  /**
   * Get all QuickBooks items (for dropdown population)
   */
  static async getItems(): Promise<QuickBooksItem[]> {
    const qbData = await this.getAllQuickBooksData();
    return qbData.items;
  }

  /**
   * Get QuickBooks item by name
   */
  static async getItemByName(name: string): Promise<QuickBooksItem | null> {
    const qbData = await this.getAllQuickBooksData();
    return qbData.items.find(item => item.name === name) || null;
  }

  /**
   * Get QuickBooks item by QB Item ID
   */
  static async getItemByQBId(qbItemId: string): Promise<QuickBooksItem | null> {
    const qbData = await this.getAllQuickBooksData();
    return qbData.items.find(item => item.qbItemId === qbItemId) || null;
  }

  /**
   * Clear cached data (force refresh)
   */
  static clearCache(): void {
    this.cachedData = null;
    this.cacheTimestamp = null;
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
    fetchTime?: string,
    itemCount?: number
  } {
    if (!this.cachedData || !this.cacheTimestamp) {
      return { isCached: false };
    }

    const ageMinutes = Math.floor((Date.now() - this.cacheTimestamp) / (1000 * 60));

    return {
      isCached: true,
      ageMinutes,
      fetchTime: this.cachedData.fetchTime,
      itemCount: this.cachedData.items.length
    };
  }
}

// Export default instance for convenience
export default QuickBooksDataResource;
