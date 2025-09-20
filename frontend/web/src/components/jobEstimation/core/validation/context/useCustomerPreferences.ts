// React hook for fetching and caching customer manufacturing preferences
// Integrates with validation system to provide context-aware validation

import { useState, useEffect } from 'react';
import api from '../../../../../services/api';

export interface CustomerManufacturingPreferences {
  customer_id: number;
  use_leds: boolean;
  default_led_type: string;
  requires_transformers: boolean;
  default_transformer: string;
  default_ul_requirement: boolean;
  // Add other preferences as needed
}

interface UseCustomerPreferencesResult {
  preferences: CustomerManufacturingPreferences | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch customer manufacturing preferences
 * @param customerId - Customer ID to fetch preferences for
 * @returns Customer preferences with loading state
 */
export const useCustomerPreferences = (customerId?: number): UseCustomerPreferencesResult => {
  const [preferences, setPreferences] = useState<CustomerManufacturingPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = async (id: number) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/customers/${id}/manufacturing-preferences`);

      if (response.data.success) {
        setPreferences(response.data.data);
      } else {
        // Customer might not have preferences set - use defaults
        setPreferences(getDefaultPreferences(id));
      }
    } catch (err) {
      console.warn('Error fetching customer preferences, using defaults:', err);
      // Use defaults if fetch fails
      setPreferences(getDefaultPreferences(id));
      setError('Failed to load customer preferences, using defaults');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchPreferences(customerId);
    } else {
      // No customer selected - clear preferences
      setPreferences(null);
      setError(null);
    }
  }, [customerId]);

  const refetch = () => {
    if (customerId) {
      fetchPreferences(customerId);
    }
  };

  return {
    preferences,
    loading,
    error,
    refetch
  };
};

/**
 * Get default manufacturing preferences for a customer
 */
function getDefaultPreferences(customerId: number): CustomerManufacturingPreferences {
  return {
    customer_id: customerId,
    use_leds: false,
    default_led_type: 'Standard LED',
    requires_transformers: false,
    default_transformer: 'DC-60W',
    default_ul_requirement: false
  };
}

/**
 * Session-based preferences cache for performance
 */
class PreferencesCache {
  private static cache = new Map<number, CustomerManufacturingPreferences>();
  private static cacheTimestamps = new Map<number, number>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static get(customerId: number): CustomerManufacturingPreferences | null {
    const cached = this.cache.get(customerId);
    const timestamp = this.cacheTimestamps.get(customerId);

    if (cached && timestamp && Date.now() - timestamp < this.CACHE_DURATION) {
      return cached;
    }

    // Cache expired or doesn't exist
    if (cached) {
      this.cache.delete(customerId);
      this.cacheTimestamps.delete(customerId);
    }

    return null;
  }

  static set(customerId: number, preferences: CustomerManufacturingPreferences): void {
    this.cache.set(customerId, preferences);
    this.cacheTimestamps.set(customerId, Date.now());
  }

  static clear(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  static clearCustomer(customerId: number): void {
    this.cache.delete(customerId);
    this.cacheTimestamps.delete(customerId);
  }
}

/**
 * Hook with session caching for better performance
 */
export const useCustomerPreferencesWithCache = (customerId?: number): UseCustomerPreferencesResult => {
  const [preferences, setPreferences] = useState<CustomerManufacturingPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = async (id: number) => {
    // Check cache first
    const cached = PreferencesCache.get(id);
    if (cached) {
      setPreferences(cached);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/customers/${id}/manufacturing-preferences`);

      let prefs: CustomerManufacturingPreferences;

      if (response.data.success) {
        prefs = response.data.data;
      } else {
        prefs = getDefaultPreferences(id);
      }

      // Cache the result
      PreferencesCache.set(id, prefs);
      setPreferences(prefs);

    } catch (err) {
      console.warn('Error fetching customer preferences, using defaults:', err);
      const defaultPrefs = getDefaultPreferences(id);
      PreferencesCache.set(id, defaultPrefs);
      setPreferences(defaultPrefs);
      setError('Failed to load customer preferences, using defaults');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchPreferences(customerId);
    } else {
      setPreferences(null);
      setError(null);
    }
  }, [customerId]);

  const refetch = () => {
    if (customerId) {
      // Clear cache and refetch
      PreferencesCache.clearCustomer(customerId);
      fetchPreferences(customerId);
    }
  };

  return {
    preferences,
    loading,
    error,
    refetch
  };
};

// Export cache utility for manual cache management
export { PreferencesCache };