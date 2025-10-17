// React hook for fetching and caching customer manufacturing preferences
// Integrates with validation system to provide context-aware validation

import { useState, useEffect } from 'react';
import { customerApi } from '../../../../../services/api';
import { PricingDataResource, PowerSupply } from '../../../../../services/pricingDataResource';

export interface RawCustomerManufacturingPreferences {
  pref_customer_id: number;
  pref_leds_enabled: boolean;
  pref_led_id: number | null;
  pref_led_product_code: string | null;
  pref_led_brand: string | null;
  pref_led_colour: string | null;
  pref_led_watts: number | null;
  pref_wire_length: number | null;
  pref_power_supply_required: boolean;
  pref_power_supply_id: number | null;
  pref_power_supply_type: string | null;
  pref_power_supply_watts: number | null;
  pref_power_supply_volts: number | null;
  pref_power_supply_is_ul_listed: boolean;
  pref_ul_required: boolean;
  pref_drain_holes_required: boolean | null;
  pref_pattern_required: boolean | null;
  pref_pattern_type: string | null;
  pref_wiring_diagram_required: boolean | null;
  pref_wiring_diagram_type: string | null;
  pref_plug_and_play_required: boolean | null;
  pref_shipping_required: boolean | null;
  pref_shipping_multiplier: number | null;
  pref_shipping_flat: number | null;
  pref_manufacturing_comments: string | null;
  pref_special_instructions: string | null;
}

export interface CustomerManufacturingPreferences extends RawCustomerManufacturingPreferences {
  use_leds: boolean;
  default_led_type: string;
  requires_transformers: boolean;
}

interface UseCustomerPreferencesResult {
  preferences: CustomerManufacturingPreferences | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

let systemDefaultPreferences: CustomerManufacturingPreferences | null = null;
let systemDefaultsPromise: Promise<CustomerManufacturingPreferences> | null = null;

function createBlankPreferences(): CustomerManufacturingPreferences {
  return {
    pref_customer_id: 0,
    pref_leds_enabled: false,
    pref_led_id: null,
    pref_led_product_code: null,
    pref_led_brand: null,
    pref_led_colour: null,
    pref_led_watts: null,
    pref_wire_length: null,
    pref_power_supply_required: false,
    pref_power_supply_id: null,
    pref_power_supply_type: null,
    pref_power_supply_watts: null,
    pref_power_supply_volts: null,
    pref_power_supply_is_ul_listed: false,
    pref_ul_required: false,
    pref_drain_holes_required: null,
    pref_pattern_required: null,
    pref_pattern_type: null,
    pref_wiring_diagram_required: null,
    pref_wiring_diagram_type: null,
    pref_plug_and_play_required: null,
    pref_shipping_required: null,
    pref_shipping_multiplier: null,
    pref_shipping_flat: null,
    pref_manufacturing_comments: null,
    pref_special_instructions: null,
    use_leds: false,
    default_led_type: 'Standard LED',
    requires_transformers: false
  };
}

async function loadSystemDefaultPreferences(): Promise<CustomerManufacturingPreferences> {
  if (systemDefaultPreferences) {
    return {
      ...systemDefaultPreferences
    };
  }

  if (systemDefaultsPromise) {
    return systemDefaultsPromise;
  }

  systemDefaultsPromise = (async () => {
    let defaultNonUl: PowerSupply | null = null;
    let defaultUl: PowerSupply | null = null;

    try {
      const [nonUl, ul] = await Promise.all([
        PricingDataResource.getDefaultNonULPowerSupply(),
        PricingDataResource.getDefaultULPowerSupply()
      ]);

      defaultNonUl = nonUl;
      defaultUl = ul;
    } catch (error) {
      console.warn('Failed to load default power supplies, using blank defaults', error);
    }

    const selectedDefault = defaultNonUl ?? defaultUl;

    systemDefaultPreferences = {
      ...createBlankPreferences(),
      pref_power_supply_id: selectedDefault?.power_supply_id ?? null,
      pref_power_supply_type: selectedDefault?.transformer_type ?? null,
      pref_power_supply_watts: selectedDefault?.watts ?? null,
      pref_power_supply_volts: selectedDefault?.volts ?? null,
      pref_power_supply_is_ul_listed: Boolean(selectedDefault?.ul_listed),
      pref_ul_required: Boolean(selectedDefault?.ul_listed)
    };

    systemDefaultsPromise = null;

    return {
      ...systemDefaultPreferences
    };
  })();

  return systemDefaultsPromise;
}

export async function ensureSystemDefaultPreferences(): Promise<CustomerManufacturingPreferences> {
  return loadSystemDefaultPreferences();
}

export function getSystemDefaultPreferencesSnapshot(): CustomerManufacturingPreferences | null {
  return systemDefaultPreferences ? { ...systemDefaultPreferences } : null;
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

      const response = await customerApi.getManufacturingPreferences(id);

      if (response.success) {
        setPreferences(normalizePreferences(response.data));
      } else {
        const fallback = await getDefaultPreferences(id);
        setPreferences(fallback);
      }
    } catch (err) {
      console.warn('Error fetching customer preferences, using defaults:', err);
      const fallback = await getDefaultPreferences(id);
      setPreferences(fallback);
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
async function getDefaultPreferences(customerId: number): Promise<CustomerManufacturingPreferences> {
  const systemDefaults = await loadSystemDefaultPreferences();

  return {
    ...systemDefaults,
    pref_customer_id: customerId
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
    const cached = PreferencesCache.get(id);
    if (cached) {
      setPreferences(cached);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await customerApi.getManufacturingPreferences(id);

      let prefs: CustomerManufacturingPreferences;

      if (response.success) {
        prefs = normalizePreferences(response.data);
      } else {
        prefs = await getDefaultPreferences(id);
      }

      PreferencesCache.set(id, prefs);
      setPreferences(prefs);
      console.log('Fetched manufacturing preferences for customer', id, prefs);
    } catch (err) {
      console.warn('Error fetching customer preferences, using defaults:', err);
      const fallback = await getDefaultPreferences(id);
      PreferencesCache.set(id, fallback);
      setPreferences(fallback);
      setError('Failed to load customer preferences, using defaults');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchPreferences(customerId);
      console.log('Fetching manufacturing preferences for customer', customerId);
    } else {
      setPreferences(null);
      setError(null);
    }
  }, [customerId]);

  const refetch = () => {
    if (customerId) {
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

export { PreferencesCache };

function normalizePreferences(raw: RawCustomerManufacturingPreferences): CustomerManufacturingPreferences {
  return {
    ...raw,
    use_leds: raw.pref_leds_enabled,
    default_led_type: raw.pref_led_product_code || raw.pref_led_brand || 'Standard LED',
    requires_transformers: raw.pref_power_supply_required
  };
}
