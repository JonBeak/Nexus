import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';

interface CustomerPreferences {
  led_type?: string;
  power_supply_type?: string;
  material_preferences?: Record<string, any>;
  default_specifications?: Record<string, any>;
}

interface UseCustomerPreferencesReturn {
  preferences: CustomerPreferences;
  isLoading: boolean;
  error: string | null;
  loadPreferences: (customerId: number, productTypeId?: number) => Promise<void>;
  clearPreferences: () => void;
}

export const useCustomerPreferences = (): UseCustomerPreferencesReturn => {
  const [preferences, setPreferences] = useState<CustomerPreferences>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreferences = useCallback(async (customerId: number, productTypeId?: number) => {
    if (!customerId) {
      setPreferences({});
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // For now, we'll use the existing customer LED and power supply endpoints
      // In the future, we can create a unified preferences endpoint
      const [ledTypesResponse, powerSupplyTypesResponse] = await Promise.all([
        fetch(`${api.defaults.baseURL}/customers/led-types`, {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json'
          }
        }).then(res => res.json()),
        fetch(`${api.defaults.baseURL}/customers/power-supply-types`, {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json'
          }
        }).then(res => res.json())
      ]);

      // Get customer-specific preferences
      const customerResponse = await fetch(`${api.defaults.baseURL}/customers/${customerId}`, {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const customerData = await customerResponse.json();

      // Map customer data to preferences
      // This is a simplified mapping - in reality we'd have more sophisticated preference matching
      const customerPreferences: CustomerPreferences = {
        led_type: customerData.customer?.preferred_led_type || (Array.isArray(ledTypesResponse) && ledTypesResponse[0]) || 'White LEDs',
        power_supply_type: customerData.customer?.preferred_power_supply || (Array.isArray(powerSupplyTypesResponse) && powerSupplyTypesResponse[0]) || '12V',
        material_preferences: {
          face_material: customerData.customer?.preferred_face_material || 'White Polycarbonate',
          return_color: customerData.customer?.preferred_return_color || 'Black Anodized'
        }
      };

      setPreferences(customerPreferences);
    } catch (err) {
      console.error('Error loading customer preferences:', err);
      setError('Failed to load customer preferences');
      
      // Set reasonable defaults on error
      setPreferences({
        led_type: 'White LEDs',
        power_supply_type: '12V',
        material_preferences: {
          face_material: 'White Polycarbonate',
          return_color: 'Black Anodized'
        }
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearPreferences = useCallback(() => {
    setPreferences({});
    setError(null);
  }, []);

  return {
    preferences,
    isLoading,
    error,
    loadPreferences,
    clearPreferences
  };
};