import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Order, OrderPart } from '../../../../types/orders';
import {
  ordersApi,
  provincesApi,
  customerApi,
  ledsApi,
  powerSuppliesApi
} from '../../../../services/api';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import {
  populateLEDOptions,
  populatePowerSupplyOptions,
  populateMaterialOptions,
  areTemplatesPopulated,
  getCachedLEDs,
  getCachedPowerSupplies,
  getCachedMaterials
} from '../../../../config/orderProductTemplates';
import type { LEDType, PowerSupplyType } from '../../../../config/specificationConstants';

interface TaxRule {
  tax_rule_id: number;
  tax_name: string;
  tax_percent: number;
  is_active: number;
}

interface OrderData {
  order: Order | null;
  parts: OrderPart[];
  taxRules: TaxRule[];
  customerDiscount: number;
}

interface UIState {
  loading: boolean;
  initialLoad: boolean;
  error: string | null;
  activeTab: 'specs' | 'progress';
  saving: boolean;
  generatingForms: boolean;
  printingForm: boolean;
  showFormsDropdown: boolean;
  showPrintModal: boolean;
}

interface CalculatedValues {
  turnaroundDays: number | null;
  daysUntilDue: number | null;
  specsDataLoaded: boolean;
  leds: LEDType[];
  powerSupplies: PowerSupplyType[];
  materials: string[];
}

export function useOrderDetails(orderNumber: string | undefined) {
  // Group 1: Order Data
  const [orderData, setOrderData] = useState<OrderData>({
    order: null,
    parts: [],
    taxRules: [],
    customerDiscount: 0
  });

  // Group 2: UI State
  const [uiState, setUiState] = useState<UIState>({
    loading: true,
    initialLoad: true,
    error: null,
    activeTab: 'specs',
    saving: false,
    generatingForms: false,
    printingForm: false,
    showFormsDropdown: false,
    showPrintModal: false
  });

  // Group 3: Calculated Values & Specs Data
  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues>({
    turnaroundDays: null,
    daysUntilDue: null,
    specsDataLoaded: false,
    leds: [],
    powerSupplies: [],
    materials: []
  });

  const fetchTaxRules = async () => {
    try {
      const rules = await provincesApi.getTaxRules();
      setOrderData(prev => ({ ...prev, taxRules: rules }));
    } catch (err) {
      console.error('Error fetching tax rules:', err);
    }
  };

  const fetchSpecificationData = async () => {
    try {
      // Check if templates are already populated (cached)
      if (areTemplatesPopulated()) {
        // Use cached data
        setCalculatedValues(prev => ({
          ...prev,
          leds: getCachedLEDs(),
          powerSupplies: getCachedPowerSupplies(),
          materials: getCachedMaterials(),
          specsDataLoaded: true
        }));
        return;
      }
      // Fetch LEDs, Power Supplies, and Materials in parallel
      const [ledsData, powerSuppliesData, pricingData] = await Promise.all([
        ledsApi.getActiveLEDs(),
        powerSuppliesApi.getActivePowerSupplies(),
        PricingDataResource.getAllPricingData()
      ]);

      // Extract substrate names from pricing data
      const materialsData = pricingData.substrateCutPricing.map(s => s.substrate_name);

      setCalculatedValues(prev => ({
        ...prev,
        leds: ledsData,
        powerSupplies: powerSuppliesData,
        materials: materialsData,
        specsDataLoaded: true
      }));

      // Populate template options with fetched data (also caches it)
      // Extract arrays from API response objects
      populateLEDOptions(ledsData.leds || ledsData);
      populatePowerSupplyOptions(powerSuppliesData.powerSupplies || powerSuppliesData);
      populateMaterialOptions(materialsData);
    } catch (err) {
      console.error('Error fetching specification data:', err);
      // Non-critical error - specs will just have empty dropdowns
    }
  };

  const fetchOrder = async (orderNum: number, isInitial: boolean = false) => {
    try {
      if (isInitial) {
        setUiState(prev => ({ ...prev, loading: true }));
      }
      setUiState(prev => ({ ...prev, error: null }));
      const { order: orderDetails, parts: partsData } = await ordersApi.getOrderWithParts(orderNum);
      setOrderData(prev => ({ ...prev, order: orderDetails, parts: partsData }));

      // Fetch customer discount
      if (orderDetails.customer_id) {
        try {
          const customerData = await customerApi.getCustomer(orderDetails.customer_id);
          setOrderData(prev => ({ ...prev, customerDiscount: customerData.discount || 0 }));
        } catch (err) {
          console.error('Error fetching customer discount:', err);
          setOrderData(prev => ({ ...prev, customerDiscount: 0 }));
        }
      }
    } catch (err) {
      setUiState(prev => ({ ...prev, error: err instanceof Error ? err.message : 'Failed to fetch order' }));
      console.error('Error fetching order:', err);
    } finally {
      if (isInitial) {
        setUiState(prev => ({ ...prev, loading: false, initialLoad: false }));
      }
    }
  };

  const calculateTurnaround = async () => {
    if (!orderData.order || !orderData.order.due_date) return;

    try {
      const result = await ordersApi.calculateBusinessDays(
        orderData.order.order_date.split('T')[0], // Ensure YYYY-MM-DD format
        orderData.order.due_date.split('T')[0]
      );
      setCalculatedValues(prev => ({ ...prev, turnaroundDays: result.businessDays }));
    } catch (err) {
      console.error('Error calculating turnaround days:', err);
      setCalculatedValues(prev => ({ ...prev, turnaroundDays: null }));
    }
  };

  const calculateDaysUntil = async () => {
    if (!orderData.order || !orderData.order.due_date) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await ordersApi.calculateBusinessDays(
        today,
        orderData.order.due_date.split('T')[0]
      );
      setCalculatedValues(prev => ({ ...prev, daysUntilDue: result.businessDays }));
    } catch (err) {
      console.error('Error calculating days until due:', err);
      setCalculatedValues(prev => ({ ...prev, daysUntilDue: null }));
    }
  };

  // Initial load effect
  useEffect(() => {
    if (orderNumber) {
      fetchOrder(parseInt(orderNumber), true);
    }
    // Fetch tax rules for dropdown
    fetchTaxRules();
    // Fetch and cache LED and Power Supply data for specification templates
    fetchSpecificationData();
  }, [orderNumber]);

  // Calculation trigger effects
  useEffect(() => {
    // Calculate turnaround days when order loads
    if (orderData.order && orderData.order.due_date) {
      calculateTurnaround();
      calculateDaysUntil();
    }
  }, [orderData.order?.order_date, orderData.order?.due_date]);

  const refetch = () => {
    if (orderNumber) {
      return fetchOrder(parseInt(orderNumber), false);
    }
  };

  return {
    orderData,
    setOrderData,
    uiState,
    setUiState,
    calculatedValues,
    setCalculatedValues,
    loading: uiState.loading,
    error: uiState.error,
    refetch
  };
}