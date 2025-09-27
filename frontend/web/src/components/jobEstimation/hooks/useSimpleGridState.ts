import { useReducer, useRef, useEffect, useCallback, Dispatch, useMemo } from 'react';
import { EditLockStatus } from '../types';
import { GridRow } from '../core/types/LayerTypes';

export type ClearModalType = 'reset' | 'clearAll' | 'clearEmpty' | null;

export const GRID_ACTIONS = {
  SET_CURRENT_ESTIMATE: 'SET_CURRENT_ESTIMATE',
  SET_CUSTOMERS: 'SET_CUSTOMERS',
  SET_PRODUCT_TYPES: 'SET_PRODUCT_TYPES',
  SET_DYNAMIC_TEMPLATES: 'SET_DYNAMIC_TEMPLATES',
  SET_ROWS: 'SET_ROWS',
  SET_LOADING: 'SET_LOADING',
  SET_SAVING: 'SET_SAVING',
  SET_HAS_UNSAVED_CHANGES: 'SET_HAS_UNSAVED_CHANGES',
  SET_LAST_SAVED: 'SET_LAST_SAVED',
  SET_VALIDATION_ERRORS: 'SET_VALIDATION_ERRORS',
  SET_FIELD_BLUR_STATES: 'SET_FIELD_BLUR_STATES',
  MARK_FIELD_BLURRED: 'MARK_FIELD_BLURRED',
  SET_SHOW_CLEAR_CONFIRMATION: 'SET_SHOW_CLEAR_CONFIRMATION',
  SET_CLEAR_MODAL_TYPE: 'SET_CLEAR_MODAL_TYPE',
  SET_LOCK_STATUS: 'SET_LOCK_STATUS',
  SET_SHOW_LOCK_CONFLICT: 'SET_SHOW_LOCK_CONFLICT',
  SET_EFFECTIVE_READ_ONLY: 'SET_EFFECTIVE_READ_ONLY',
  SET_LOADED_ESTIMATE_ID: 'SET_LOADED_ESTIMATE_ID'
} as const;

type GridActionType = (typeof GRID_ACTIONS)[keyof typeof GRID_ACTIONS];

type PayloadAction<TType extends GridActionType, TPayload> = {
  type: TType;
  payload: TPayload;
};

type GridReducerState = {
  currentEstimate: any;
  customers: any[];
  productTypes: any[];
  dynamicTemplates: Record<number, any>;
  rows: GridRow[];
  loading: boolean;
  saving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  validationErrors: Record<string, Record<string, string[]>>;
  fieldBlurStates: Record<string, Record<string, boolean>>;
  showClearConfirmation: boolean;
  clearModalType: ClearModalType;
  lockStatus: EditLockStatus | null;
  showLockConflict: boolean;
  effectiveReadOnly: boolean;
  loadedEstimateId: number | null;
};

export type GridAction =
  | PayloadAction<typeof GRID_ACTIONS.SET_CURRENT_ESTIMATE, any>
  | PayloadAction<typeof GRID_ACTIONS.SET_CUSTOMERS, any[]>
  | PayloadAction<typeof GRID_ACTIONS.SET_PRODUCT_TYPES, any[]>
  | PayloadAction<typeof GRID_ACTIONS.SET_DYNAMIC_TEMPLATES, Record<number, any>>
  | PayloadAction<typeof GRID_ACTIONS.SET_ROWS, GridRow[]>
  | PayloadAction<typeof GRID_ACTIONS.SET_LOADING, boolean>
  | PayloadAction<typeof GRID_ACTIONS.SET_SAVING, boolean>
  | PayloadAction<typeof GRID_ACTIONS.SET_HAS_UNSAVED_CHANGES, boolean>
  | PayloadAction<typeof GRID_ACTIONS.SET_LAST_SAVED, Date | null>
  | PayloadAction<typeof GRID_ACTIONS.SET_VALIDATION_ERRORS, Record<string, Record<string, string[]>>>
  | PayloadAction<typeof GRID_ACTIONS.SET_FIELD_BLUR_STATES, Record<string, Record<string, boolean>>>
  | PayloadAction<typeof GRID_ACTIONS.MARK_FIELD_BLURRED, { rowId: string; fieldName: string }>
  | PayloadAction<typeof GRID_ACTIONS.SET_SHOW_CLEAR_CONFIRMATION, boolean>
  | PayloadAction<typeof GRID_ACTIONS.SET_CLEAR_MODAL_TYPE, ClearModalType>
  | PayloadAction<typeof GRID_ACTIONS.SET_LOCK_STATUS, EditLockStatus | null>
  | PayloadAction<typeof GRID_ACTIONS.SET_SHOW_LOCK_CONFLICT, boolean>
  | PayloadAction<typeof GRID_ACTIONS.SET_EFFECTIVE_READ_ONLY, boolean>
  | PayloadAction<typeof GRID_ACTIONS.SET_LOADED_ESTIMATE_ID, number | null>;

const createInitialState = (estimate: any, isReadOnly: boolean): GridReducerState => ({
  currentEstimate: estimate,
  customers: [],
  productTypes: [],
  dynamicTemplates: {},
  rows: [],
  loading: false,
  saving: false,
  hasUnsavedChanges: false,
  lastSaved: null,
  validationErrors: {},
  fieldBlurStates: {},
  showClearConfirmation: false,
  clearModalType: null,
  lockStatus: null,
  showLockConflict: false,
  effectiveReadOnly: isReadOnly,
  loadedEstimateId: null
});

const gridStateReducer = (state: GridReducerState, action: GridAction): GridReducerState => {
  switch (action.type) {
    case GRID_ACTIONS.SET_CURRENT_ESTIMATE:
      return state.currentEstimate === action.payload
        ? state
        : { ...state, currentEstimate: action.payload };

    case GRID_ACTIONS.SET_CUSTOMERS:
      return state.customers === action.payload ? state : { ...state, customers: action.payload };

    case GRID_ACTIONS.SET_PRODUCT_TYPES:
      return state.productTypes === action.payload ? state : { ...state, productTypes: action.payload };

    case GRID_ACTIONS.SET_DYNAMIC_TEMPLATES:
      return state.dynamicTemplates === action.payload
        ? state
        : { ...state, dynamicTemplates: action.payload };

    case GRID_ACTIONS.SET_ROWS:
      return state.rows === action.payload ? state : { ...state, rows: action.payload };

    case GRID_ACTIONS.SET_LOADING:
      return state.loading === action.payload ? state : { ...state, loading: action.payload };

    case GRID_ACTIONS.SET_SAVING:
      return state.saving === action.payload ? state : { ...state, saving: action.payload };

    case GRID_ACTIONS.SET_HAS_UNSAVED_CHANGES:
      return state.hasUnsavedChanges === action.payload
        ? state
        : { ...state, hasUnsavedChanges: action.payload };

    case GRID_ACTIONS.SET_LAST_SAVED:
      return state.lastSaved === action.payload ? state : { ...state, lastSaved: action.payload };

    case GRID_ACTIONS.SET_VALIDATION_ERRORS:
      return state.validationErrors === action.payload
        ? state
        : { ...state, validationErrors: action.payload };

    case GRID_ACTIONS.SET_FIELD_BLUR_STATES:
      return state.fieldBlurStates === action.payload
        ? state
        : { ...state, fieldBlurStates: action.payload };

    case GRID_ACTIONS.MARK_FIELD_BLURRED: {
      const { rowId, fieldName } = action.payload;
      const existingRow = state.fieldBlurStates[rowId];
      if (existingRow?.[fieldName]) {
        return state;
      }

      return {
        ...state,
        fieldBlurStates: {
          ...state.fieldBlurStates,
          [rowId]: {
            ...existingRow,
            [fieldName]: true
          }
        }
      };
    }

    case GRID_ACTIONS.SET_SHOW_CLEAR_CONFIRMATION:
      return state.showClearConfirmation === action.payload
        ? state
        : { ...state, showClearConfirmation: action.payload, clearModalType: action.payload ? state.clearModalType : null };

    case GRID_ACTIONS.SET_CLEAR_MODAL_TYPE:
      return state.clearModalType === action.payload
        ? state
        : { ...state, clearModalType: action.payload };

    case GRID_ACTIONS.SET_LOCK_STATUS:
      return state.lockStatus === action.payload ? state : { ...state, lockStatus: action.payload };

    case GRID_ACTIONS.SET_SHOW_LOCK_CONFLICT:
      return state.showLockConflict === action.payload
        ? state
        : { ...state, showLockConflict: action.payload };

    case GRID_ACTIONS.SET_EFFECTIVE_READ_ONLY:
      return state.effectiveReadOnly === action.payload
        ? state
        : { ...state, effectiveReadOnly: action.payload };

    case GRID_ACTIONS.SET_LOADED_ESTIMATE_ID:
      return state.loadedEstimateId === action.payload
        ? state
        : { ...state, loadedEstimateId: action.payload };

    default:
      return state;
  }
};

export interface GridState extends GridReducerState {
  setCurrentEstimate: (estimate: any) => void;
  setCustomers: (customers: any[]) => void;
  setProductTypes: (types: any[]) => void;
  setDynamicTemplates: (templates: Record<number, any>) => void;
  setRows: (rows: GridRow[]) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  setLastSaved: (date: Date | null) => void;
  setValidationErrors: (errors: Record<string, Record<string, string[]>>) => void;
  setFieldBlurStates: (states: Record<string, Record<string, boolean>>) => void;
  markFieldAsBlurred: (rowId: string, fieldName: string) => void;
  hasFieldBeenBlurred: (rowId: string, fieldName: string) => boolean;
  setShowClearConfirmation: (show: boolean) => void;
  setClearModalType: (type: ClearModalType) => void;
  setLockStatus: (status: EditLockStatus | null) => void;
  setShowLockConflict: (show: boolean) => void;
  setEffectiveReadOnly: (readOnly: boolean) => void;
  setLoadedEstimateId: (id: number | null) => void;
  autoSaveTimeoutRef: React.RefObject<NodeJS.Timeout | null>;
  isUnloadingRef: React.RefObject<boolean>;
  navigationGuardRef: React.RefObject<((navigationFn: () => void) => void) | null>;
  hasUnsavedChangesRef: React.RefObject<boolean>;
  currentEstimateRef: React.RefObject<any>;
  versioningModeRef: React.RefObject<boolean>;
  estimateIdRef: React.RefObject<number | undefined>;
  rowsRef: React.RefObject<GridRow[]>;
  hasValidationErrors: boolean;
  dispatch: Dispatch<GridAction>;
  state: GridReducerState;
}

export const useSimpleGridState = (
  estimate: any,
  isReadOnly: boolean,
  versioningMode: boolean,
  estimateId?: number
): GridState => {
  const [state, dispatch] = useReducer(
    gridStateReducer,
    undefined,
    () => createInitialState(estimate, isReadOnly)
  );

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnloadingRef = useRef(false);
  const navigationGuardRef = useRef<((navigationFn: () => void) => void) | null>(null);
  const hasUnsavedChangesRef = useRef(state.hasUnsavedChanges);
  const currentEstimateRef = useRef(state.currentEstimate);
  const versioningModeRef = useRef(versioningMode);
  const estimateIdRef = useRef(estimateId);
  const rowsRef = useRef<GridRow[]>(state.rows);

  useEffect(() => {
    hasUnsavedChangesRef.current = state.hasUnsavedChanges;
  }, [state.hasUnsavedChanges]);

  useEffect(() => {
    currentEstimateRef.current = state.currentEstimate;
  }, [state.currentEstimate]);

  useEffect(() => {
    versioningModeRef.current = versioningMode;
  }, [versioningMode]);

  useEffect(() => {
    estimateIdRef.current = estimateId;
  }, [estimateId]);

  useEffect(() => {
    rowsRef.current = state.rows;
  }, [state.rows]);

  useEffect(() => {
    if (estimate) {
      dispatch({ type: GRID_ACTIONS.SET_CURRENT_ESTIMATE, payload: estimate });
    }
  }, [estimate]);

  const setCurrentEstimate = useCallback((value: any) => {
    dispatch({ type: GRID_ACTIONS.SET_CURRENT_ESTIMATE, payload: value });
  }, [dispatch]);

  const setCustomers = useCallback((customers: any[]) => {
    dispatch({ type: GRID_ACTIONS.SET_CUSTOMERS, payload: customers });
  }, [dispatch]);

  const setProductTypes = useCallback((types: any[]) => {
    dispatch({ type: GRID_ACTIONS.SET_PRODUCT_TYPES, payload: types });
  }, [dispatch]);

  const setDynamicTemplates = useCallback((templates: Record<number, any>) => {
    dispatch({ type: GRID_ACTIONS.SET_DYNAMIC_TEMPLATES, payload: templates });
  }, [dispatch]);

  const setRows = useCallback((rows: GridRow[]) => {
    dispatch({ type: GRID_ACTIONS.SET_ROWS, payload: rows });
  }, [dispatch]);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: GRID_ACTIONS.SET_LOADING, payload: loading });
  }, [dispatch]);

  const setSaving = useCallback((saving: boolean) => {
    dispatch({ type: GRID_ACTIONS.SET_SAVING, payload: saving });
  }, [dispatch]);

  const setHasUnsavedChanges = useCallback((hasChanges: boolean) => {
    dispatch({ type: GRID_ACTIONS.SET_HAS_UNSAVED_CHANGES, payload: hasChanges });
  }, [dispatch]);

  const setLastSaved = useCallback((date: Date | null) => {
    dispatch({ type: GRID_ACTIONS.SET_LAST_SAVED, payload: date });
  }, [dispatch]);

  const setValidationErrors = useCallback((errors: Record<string, Record<string, string[]>>) => {
    dispatch({ type: GRID_ACTIONS.SET_VALIDATION_ERRORS, payload: errors });
  }, [dispatch]);

  const setFieldBlurStates = useCallback((states: Record<string, Record<string, boolean>>) => {
    dispatch({ type: GRID_ACTIONS.SET_FIELD_BLUR_STATES, payload: states });
  }, [dispatch]);

  const markFieldAsBlurred = useCallback((rowId: string, fieldName: string) => {
    dispatch({ type: GRID_ACTIONS.MARK_FIELD_BLURRED, payload: { rowId, fieldName } });
  }, [dispatch]);

  const hasFieldBeenBlurred = useCallback(
    (rowId: string, fieldName: string) => state.fieldBlurStates[rowId]?.[fieldName] || false,
    [state.fieldBlurStates]
  );

  const setShowClearConfirmation = useCallback((show: boolean) => {
    dispatch({ type: GRID_ACTIONS.SET_SHOW_CLEAR_CONFIRMATION, payload: show });
  }, [dispatch]);

  const setClearModalType = useCallback((type: ClearModalType) => {
    dispatch({ type: GRID_ACTIONS.SET_CLEAR_MODAL_TYPE, payload: type });
  }, [dispatch]);

  const setLockStatus = useCallback((status: EditLockStatus | null) => {
    dispatch({ type: GRID_ACTIONS.SET_LOCK_STATUS, payload: status });
  }, [dispatch]);

  const setShowLockConflict = useCallback((show: boolean) => {
    dispatch({ type: GRID_ACTIONS.SET_SHOW_LOCK_CONFLICT, payload: show });
  }, [dispatch]);

  const setEffectiveReadOnly = useCallback((readOnly: boolean) => {
    dispatch({ type: GRID_ACTIONS.SET_EFFECTIVE_READ_ONLY, payload: readOnly });
  }, [dispatch]);

  const setLoadedEstimateId = useCallback((id: number | null) => {
    dispatch({ type: GRID_ACTIONS.SET_LOADED_ESTIMATE_ID, payload: id });
  }, [dispatch]);

  const hasValidationErrors = useMemo(
    () => Object.keys(state.validationErrors).length > 0,
    [state.validationErrors]
  );

  return {
    ...state,
    setCurrentEstimate,
    setCustomers,
    setProductTypes,
    setDynamicTemplates,
    setRows,
    setLoading,
    setSaving,
    setHasUnsavedChanges,
    setLastSaved,
    setValidationErrors,
    setFieldBlurStates,
    markFieldAsBlurred,
    hasFieldBeenBlurred,
    setShowClearConfirmation,
    setClearModalType,
    setLockStatus,
    setShowLockConflict,
    setEffectiveReadOnly,
    setLoadedEstimateId,
    autoSaveTimeoutRef,
    isUnloadingRef,
    navigationGuardRef,
    hasUnsavedChangesRef,
    currentEstimateRef,
    versioningModeRef,
    estimateIdRef,
    rowsRef,
    hasValidationErrors,
    dispatch,
    state
  };
};
