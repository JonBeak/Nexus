import { useState, useRef, useMemo, useEffect } from 'react';
import { EstimateRow, EditLockStatus } from '../types';

// Match the existing GridState interface exactly
export interface GridState {
  // Main estimate state
  currentEstimate: any;
  setCurrentEstimate: (estimate: any) => void;
  
  // Data state
  customers: any[];
  setCustomers: (customers: any[]) => void;
  productTypes: any[];
  setProductTypes: (types: any[]) => void;
  dynamicTemplates: Record<number, any>;
  setDynamicTemplates: (templates: Record<number, any>) => void;
  
  // Grid rows state
  rows: EstimateRow[];
  setRows: (rows: EstimateRow[]) => void;
  
  // UI state
  loading: boolean;
  setLoading: (loading: boolean) => void;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  lastSaved: Date | null;
  setLastSaved: (date: Date | null) => void;
  
  // Validation state
  validationErrors: Record<string, Record<string, string[]>>;
  setValidationErrors: (errors: Record<string, Record<string, string[]>>) => void;
  
  // ✅ BLUR-ONLY: Field blur state tracking
  fieldBlurStates: Record<string, Record<string, boolean>>;
  setFieldBlurStates: (states: Record<string, Record<string, boolean>>) => void;
  markFieldAsBlurred: (rowId: string, fieldName: string) => void;
  hasFieldBeenBlurred: (rowId: string, fieldName: string) => boolean;
  
  // Modal state
  showClearConfirmation: boolean;
  setShowClearConfirmation: (show: boolean) => void;
  clearModalType: 'reset' | 'clearAll' | 'clearEmpty' | null;
  setClearModalType: (type: 'reset' | 'clearAll' | 'clearEmpty' | null) => void;
  
  // Versioning system state
  lockStatus: EditLockStatus | null;
  setLockStatus: (status: EditLockStatus | null) => void;
  showLockConflict: boolean;
  setShowLockConflict: (show: boolean) => void;
  effectiveReadOnly: boolean;
  setEffectiveReadOnly: (readOnly: boolean) => void;
  loadedEstimateId: number | null;
  setLoadedEstimateId: (id: number | null) => void;
  
  // Refs for auto-save (prevent stale closures)
  autoSaveTimeoutRef: React.RefObject<NodeJS.Timeout | null>;
  isUnloadingRef: React.RefObject<boolean>;
  navigationGuardRef: React.RefObject<((navigationFn: () => void) => void) | null>;
  hasUnsavedChangesRef: React.RefObject<boolean>;
  currentEstimateRef: React.RefObject<any>;
  versioningModeRef: React.RefObject<boolean>;
  estimateIdRef: React.RefObject<number | undefined>;
  rowsRef: React.RefObject<EstimateRow[]>;
  
  // Derived state
  hasValidationErrors: boolean;
}

export const useSimpleGridState = (
  estimate: any,
  isReadOnly: boolean,
  versioningMode: boolean,
  estimateId?: number
): GridState => {
  // Simple state - no complex logic here
  const [currentEstimate, setCurrentEstimate] = useState(estimate);
  const [customers, setCustomers] = useState<any[]>([]);
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [dynamicTemplates, setDynamicTemplates] = useState<Record<number, any>>({});
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string[]>>>({});
  const [fieldBlurStates, setFieldBlurStates] = useState<Record<string, Record<string, boolean>>>({});
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [clearModalType, setClearModalType] = useState<'reset' | 'clearAll' | 'clearEmpty' | null>(null);
  const [lockStatus, setLockStatus] = useState<EditLockStatus | null>(null);
  const [showLockConflict, setShowLockConflict] = useState(false);
  const [effectiveReadOnly, setEffectiveReadOnly] = useState(isReadOnly);
  const [loadedEstimateId, setLoadedEstimateId] = useState<number | null>(null);

  // Refs for autosave (prevent stale closures) - from original working version
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnloadingRef = useRef(false);
  const navigationGuardRef = useRef<((navigationFn: () => void) => void) | null>(null);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const currentEstimateRef = useRef(currentEstimate);
  const versioningModeRef = useRef(versioningMode);
  const estimateIdRef = useRef(estimateId);
  const rowsRef = useRef<EstimateRow[]>(rows);

  // Update refs whenever state changes (from original working version)
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
    currentEstimateRef.current = currentEstimate;
    versioningModeRef.current = versioningMode;
    estimateIdRef.current = estimateId;
    rowsRef.current = rows;
  });

  // Sync local currentEstimate state when estimate prop changes
  useEffect(() => {
    if (estimate) {
      setCurrentEstimate(estimate);
    }
  }, [estimate?.id]);


  // Check if there are any validation errors
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  // ✅ BLUR-ONLY: Field blur state management functions
  const markFieldAsBlurred = (rowId: string, fieldName: string) => {
    setFieldBlurStates(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [fieldName]: true
      }
    }));
  };

  const hasFieldBeenBlurred = (rowId: string, fieldName: string): boolean => {
    return fieldBlurStates[rowId]?.[fieldName] || false;
  };

  // ✅ CRITICAL FIX: REMOVE PRICING UPDATE TO CURRENT ESTIMATE
  // The pricing data should be derived state, not stored in currentEstimate
  // IMPORTANT: This useEffect was causing infinite loops by constantly updating currentEstimate
  // which triggered gridState recreation -> baseGridActions recreation -> manager recreation
  // PRICING DATA IS NOW PURELY DERIVED STATE - NO STATE UPDATES!

  // ✅ CRITICAL FIX: NO MORE MIXING PRICING WITH CURRENTESTIMATE
  // Pricing data should be completely separate to prevent circular dependencies
  // The issue was: pricing depends on rows -> currentEstimate includes pricing -> gridState changes -> recreates everything

  // ✅ CRITICAL FIX: Memoize the return object to prevent recreation on every render
  // This was the ROOT CAUSE of infinite loops - gridState object changed every render
  return useMemo(() => {
    return {
    // Main estimate state - STABLE VERSION WITHOUT PRICING MIXING
    currentEstimate: currentEstimate,
    setCurrentEstimate,
    
    // Data state
    customers,
    setCustomers,
    productTypes,
    setProductTypes,
    dynamicTemplates,
    setDynamicTemplates,
    
    // Grid rows state
    rows,
    setRows,
    
    // UI state
    loading,
    setLoading,
    saving,
    setSaving,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    lastSaved,
    setLastSaved,
    
    // Validation state
    validationErrors,
    setValidationErrors,
    
    // ✅ BLUR-ONLY: Field blur state
    fieldBlurStates,
    setFieldBlurStates,
    markFieldAsBlurred,
    hasFieldBeenBlurred,
    
    // Modal state
    showClearConfirmation,
    setShowClearConfirmation,
    clearModalType,
    setClearModalType,
    
    // Versioning system state
    lockStatus,
    setLockStatus,
    showLockConflict,
    setShowLockConflict,
    effectiveReadOnly,
    setEffectiveReadOnly,
    loadedEstimateId,
    setLoadedEstimateId,
    
    // Refs
    autoSaveTimeoutRef,
    isUnloadingRef,
    navigationGuardRef,
    hasUnsavedChangesRef,
    currentEstimateRef,
    versioningModeRef,
    estimateIdRef,
    rowsRef,
    
    // Derived state
    hasValidationErrors
  };
  }, [
    // ✅ CRITICAL FIX: Use stable references to prevent infinite loops
    // Exclude pricing data to break circular dependency
    currentEstimate?.id, // Only the core estimate ID matters for stability
    currentEstimate?.version_number, // Version number for state changes
    currentEstimate?.is_draft, // Draft status for business logic
    customers,
    productTypes,
    dynamicTemplates,
    rows,
    // ✅ REMOVED: loading, saving - These change frequently but don't affect core state structure
    hasUnsavedChanges,
    lastSaved,
    // ✅ REMOVED: validationErrors, hasValidationErrors - These cause infinite rerender loops
    showClearConfirmation,
    clearModalType,
    lockStatus,
    showLockConflict,
    effectiveReadOnly,
    loadedEstimateId
    // ✅ EXCLUDED: loading, saving - UI states that shouldn't trigger full gridState recreation
    // ✅ EXCLUDED: pricingData - this is now purely derived and not part of state dependencies
    // Excluded: All setter functions and refs (these are stable)
  ]);
};