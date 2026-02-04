/**
 * Stock Availability Hook
 * Checks if stock is available for a material requirement
 * Created: 2026-02-04
 */

import { useState, useEffect, useCallback } from 'react';
import { materialRequirementsApi } from '../../../services/api/materialRequirementsApi';
import { MaterialRequirement, StockAvailabilityResponse } from '../../../types/materialRequirements';

interface UseStockAvailabilityOptions {
  /** Skip checking if true */
  skip?: boolean;
}

interface UseStockAvailabilityReturn {
  hasStock: boolean;
  stockType: 'vinyl' | 'general' | null;
  checking: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook to check stock availability for a material requirement
 * Only checks if product type is selected but vendor is NOT selected
 */
export const useStockAvailability = (
  requirement: MaterialRequirement | null,
  options: UseStockAvailabilityOptions = {}
): UseStockAvailabilityReturn => {
  const [hasStock, setHasStock] = useState<boolean>(false);
  const [stockType, setStockType] = useState<'vinyl' | 'general' | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const checkStock = useCallback(async () => {
    // Don't check if:
    // - No requirement
    // - Skip option is set
    // - No product type (archetype_id) selected
    // - Vendor (supplier_id) is already selected
    // - Already has a hold
    if (
      !requirement ||
      options.skip ||
      !requirement.archetype_id ||
      requirement.supplier_id !== null ||
      requirement.held_vinyl_id !== null ||
      requirement.held_supplier_product_id !== null
    ) {
      setHasStock(false);
      setStockType(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    setError(null);

    try {
      const result = await materialRequirementsApi.checkStockAvailability({
        archetype_id: requirement.archetype_id,
        vinyl_product_id: requirement.vinyl_product_id,
        supplier_product_id: requirement.supplier_product_id,
      });

      setHasStock(result.hasStock);
      setStockType(result.stockType);
    } catch (err) {
      console.error('Error checking stock availability:', err);
      setError('Failed to check stock');
      setHasStock(false);
      setStockType(null);
    } finally {
      setChecking(false);
    }
  }, [
    requirement?.requirement_id,
    requirement?.archetype_id,
    requirement?.vinyl_product_id,
    requirement?.supplier_product_id,
    requirement?.supplier_id,
    requirement?.held_vinyl_id,
    requirement?.held_supplier_product_id,
    options.skip,
  ]);

  useEffect(() => {
    checkStock();
  }, [checkStock]);

  return {
    hasStock,
    stockType,
    checking,
    error,
    refresh: checkStock,
  };
};

export default useStockAvailability;
