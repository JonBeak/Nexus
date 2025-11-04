import { useState, useCallback, useEffect } from 'react';
import { CustomerManufacturingPreferences } from '../core/validation/context/useCustomerPreferences';
import { PricingCalculationContext } from '../core/types/GridTypes';
import { createCalculationOperations, EstimatePreviewData } from '../core/layers/CalculationLayer';
import { validateCustomerPreferences } from '../utils/customerPreferencesValidator';
import { CustomerPreferencesData, CustomerPreferencesValidationResult } from '../types/customerPreferences';
import { jobVersioningApi } from '../../../services/api';
import { GridEngine } from '../core/GridEngine';

interface UseValidationOrchestrationParams {
  isInBuilderMode: boolean;
  selectedEstimateId: number | null;
  isDraft: boolean;
  customerPreferencesData: CustomerPreferencesData | null;
  setCustomerPreferencesData: (data: CustomerPreferencesData | null) => void;
  setPreferencesValidationResult: (result: CustomerPreferencesValidationResult | null) => void;
  gridEngineRef: GridEngine | null;
}

export const useValidationOrchestration = ({
  isInBuilderMode,
  selectedEstimateId,
  isDraft,
  customerPreferencesData,
  setCustomerPreferencesData,
  setPreferencesValidationResult,
  gridEngineRef
}: UseValidationOrchestrationParams) => {
  // Validation state
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const [validationErrorCount, setValidationErrorCount] = useState(0);

  // Validation results and price calculation state
  const [pricingContext, setPricingContext] = useState<PricingCalculationContext | null>(null);
  const [estimatePreviewData, setEstimatePreviewData] = useState<EstimatePreviewData | null>(null);

  // Grid data version tracking (for auto-save orchestration)
  const [gridDataVersion, setGridDataVersion] = useState(0);

  // Customer preferences - received from GridJobBuilder (single source of truth)
  const [customerPreferences, setCustomerPreferences] = useState<CustomerManufacturingPreferences | null>(null);

  // Handle preferences loaded from GridJobBuilder (single source of truth)
  const handlePreferencesLoaded = useCallback((preferences: CustomerManufacturingPreferences | null) => {
    setCustomerPreferences(preferences);

    // Always update customerPreferencesData with new preferences using functional setState
    // This ensures preferences get set even if customerPreferencesData was temporarily null
    setCustomerPreferencesData(prev => prev ? {
      ...prev,
      preferences: preferences
    } : null);
  }, [setCustomerPreferencesData]);

  // Handle grid data changes from GridJobBuilder (for auto-save orchestration)
  const handleGridDataChange = useCallback((version: number) => {
    setGridDataVersion(version);
  }, []);

  // Handle validation results and trigger price calculation
  const handleValidationChange = useCallback((hasErrors: boolean, errorCount: number, context?: PricingCalculationContext) => {
    setHasValidationErrors(hasErrors);
    setValidationErrorCount(errorCount);
    setPricingContext(context || null);
  }, []);

  // Price calculation effect - triggers when validation completes
  useEffect(() => {
    const calculatePricing = async () => {
      if (pricingContext) {
        try {
          const calculationOps = createCalculationOperations();
          const calculated = await calculationOps.calculatePricing(pricingContext);
          setEstimatePreviewData(calculated);
        } catch (error) {
          console.error('Error calculating pricing:', error);
          setEstimatePreviewData(null);
        }
      } else {
        setEstimatePreviewData(null);
      }
    };

    calculatePricing();
  }, [pricingContext]);

  // Auto-save effect - triggers when BOTH grid data changes AND calculation completes
  // This eliminates race condition: save only happens after calculation finishes
  useEffect(() => {
    // Skip if not in builder mode with a draft estimate
    if (!isInBuilderMode || !selectedEstimateId || !isDraft) return;

    // Skip if no data to save
    if (!estimatePreviewData) return;

    // Skip if no grid changes yet (initial load)
    if (gridDataVersion === 0) return;

    // Debounce: Wait a bit after calculation completes before saving
    const saveTimer = setTimeout(async () => {
      // Re-check conditions when timer executes (might have changed)
      if (!isInBuilderMode || !selectedEstimateId || !isDraft) {
        return; // Silently skip if conditions no longer met
      }

      try {
        // Get simplified rows from GridEngine
        if (!gridEngineRef) {
          // GridEngine not ready yet - skip this auto-save cycle
          return;
        }

        const coreRows = gridEngineRef.getRows();

        // Convert to simplified structure
        const simplifiedRows = coreRows.map((row: any) => ({
          rowType: row.rowType || 'main',
          productTypeId: row.productTypeId || null,
          productTypeName: row.productTypeName || null,
          qty: row.data?.quantity || '',
          field1: row.data?.field1 || '',
          field2: row.data?.field2 || '',
          field3: row.data?.field3 || '',
          field4: row.data?.field4 || '',
          field5: row.data?.field5 || '',
          field6: row.data?.field6 || '',
          field7: row.data?.field7 || '',
          field8: row.data?.field8 || '',
          field9: row.data?.field9 || '',
          field10: row.data?.field10 || ''
        }));

        // Save with calculated total (no race condition!)
        await jobVersioningApi.saveGridData(
          selectedEstimateId,
          simplifiedRows,
          estimatePreviewData.total
        );
      } catch (error) {
        console.error('[JobEstimation] Auto-save failed:', error);
      }
    }, 300); // Small debounce after calculation completes

    return () => clearTimeout(saveTimer);
  }, [estimatePreviewData, gridDataVersion, isInBuilderMode, selectedEstimateId, isDraft, gridEngineRef]);

  // Run preferences validation when estimate preview data updates
  useEffect(() => {
    if (estimatePreviewData && customerPreferences) {
      const validationResult = validateCustomerPreferences(
        estimatePreviewData,
        customerPreferences,
        customerPreferencesData?.discount
      );
      setPreferencesValidationResult(validationResult);
    } else {
      setPreferencesValidationResult(null);
    }
  }, [estimatePreviewData, customerPreferences, customerPreferencesData?.discount, setPreferencesValidationResult]);

  return {
    // State
    hasValidationErrors,
    validationErrorCount,
    pricingContext,
    estimatePreviewData,
    gridDataVersion,
    customerPreferences,
    // Handlers
    handlePreferencesLoaded,
    handleGridDataChange,
    handleValidationChange
  };
};
