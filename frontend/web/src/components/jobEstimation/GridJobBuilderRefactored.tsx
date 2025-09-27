/**
 * GridJobBuilder implementation using Base Layer architecture
 * Clean, performant, and maintainable grid system
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { GridJobBuilderProps } from './types';

// Base Layer architecture
import { GridEngine, GridEngineConfig } from './core/GridEngine';
import { estimateRowsToGridRowCores, gridRowCoresToEstimateRows } from './core/adapters/EstimateRowAdapter';

// UI components
import { DragDropGridRenderer } from './components/DragDropGridRenderer';
import { GridHeader } from './components/GridHeader';
import { GridFooter } from './components/GridFooter';

// Hooks
import { useEditLock } from '../../hooks/useEditLock';
import { useProductTypes } from './hooks/useProductTypes';
import { EditLockIndicator } from '../common/EditLockIndicator';
import { useCustomerPreferencesWithCache } from './core/validation/context/useCustomerPreferences';

// Import the save API
import { jobVersioningApi } from '../../services/jobVersioningApi';
import { fieldPromptsApi, SimpleProductTemplate } from '../../services/fieldPromptsApi';

// Helper function to convert ProductType to ProductTypeConfig
const convertProductTypeToConfig = (productType: any): any => {
  // Parse pricing rules so calculation layer can locate the engine key
  let pricingRules: Record<string, unknown> | null = null;
  if (productType.pricing_rules) {
    if (typeof productType.pricing_rules === 'string') {
      try {
        pricingRules = JSON.parse(productType.pricing_rules);
      } catch (error) {
        console.warn('Failed to parse pricing_rules JSON for product type', productType.id, error);
      }
    } else if (typeof productType.pricing_rules === 'object') {
      pricingRules = productType.pricing_rules as Record<string, unknown>;
    }
  }

  const calculationKey = typeof pricingRules?.calculation_type === 'string'
    ? String(pricingRules.calculation_type)
    : null;

  // For now, create a basic config - will be enhanced when we implement dynamic templates
  return {
    id: productType.id,
    name: productType.name,
    fields: [], // TODO: Load from input_template when dynamic templates are integrated
    category: productType.category,
    pricingRules,
    calculationKey
  };
};


export const GridJobBuilderRefactored: React.FC<GridJobBuilderProps> = ({
  user,
  estimate,
  isCreatingNew,
  onEstimateChange,
  onBackToEstimates,
  showNotification,
  customerId,
  customerName,
  cashCustomer,
  taxRate,
  versioningMode = false,
  estimateId,
  isReadOnly = false,
  onValidationChange,
  onRequestNavigation
}) => {
  // Load product types from database
  const { productTypes, loading: productTypesLoading, error: productTypesError } = useProductTypes();

  const estimateCustomerId = estimate?.customer_id ?? (estimate as any)?.customerId ?? null;
  const effectiveCustomerId = customerId ?? estimateCustomerId ?? null;
  const { preferences: customerPreferences } = useCustomerPreferencesWithCache(
    effectiveCustomerId === null ? undefined : effectiveCustomerId
  );

  useEffect(() => {
    if (estimate && effectiveCustomerId === null) {
      console.warn('Customer preferences: no customer id resolved for estimate', {
        explicitlySelectedCustomerId: customerId,
        estimateCustomerId,
        estimate
      });
    }
  }, [estimate, effectiveCustomerId, estimateCustomerId, customerId]);

  useEffect(() => {
    if (customerPreferences) {
      console.log('Loaded customer manufacturing preferences:', customerPreferences);
    }
  }, [customerPreferences]);

  // Minimal modal state to replace buttonGridState
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [clearModalType, setClearModalType] = useState<'reset' | 'clearAll' | 'clearEmpty' | null>(null);

  // Template cache state - loads ALL templates once and caches for component lifecycle
  const [templateCache, setTemplateCache] = React.useState<Record<number, SimpleProductTemplate>>({});
  const [templatesLoaded, setTemplatesLoaded] = React.useState(false);
  const [validationVersion, setValidationVersion] = useState(0);

  // Field prompts state (derived from template cache)
  const [fieldPromptsMap, setFieldPromptsMap] = React.useState<Record<number, Record<string, string | boolean>>>({});
  const [staticOptionsMap, setStaticOptionsMap] = React.useState<Record<number, Record<string, string[]>>>({});
  // Initialize GridEngine with configuration
  const gridEngine = useMemo(() => {
    const config: GridEngineConfig = {
      productTypes: [], // Will be populated when useProductTypes loads
      staticDataCache: {
        // Basic static data for Base Layer testing
        // Future: Load from API via dynamic template service
        materials: ['ACM', 'Aluminum', 'PVC', 'Vinyl'],
        colors: ['White', 'Black', 'Red', 'Blue', 'Green'],
        finishes: ['Matte', 'Gloss', 'Satin', 'Textured'],
        sizes: ['Small', 'Medium', 'Large', 'Custom']
      }, // TODO: Load from API
      autoSave: {
        enabled: !isReadOnly && versioningMode,
        debounceMs: 500,
        onSave: async (coreRows) => {
          if (!estimateId) return;

          try {

            // Convert to simplified structure - no IDs needed, but keep row types
            const simplifiedRows = coreRows.map((row, index) => {
              return {
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
              };
            });


            // Save directly as JSON array
            await jobVersioningApi.saveGridData(estimateId, simplifiedRows);
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        }
      },
      validation: {
        enabled: !isReadOnly, // Enable validation only when editing
        productValidations: new Map()
      },
      callbacks: {
        onRowsChange: (gridRows) => {
          // Pass GridRowWithCalculations directly - no conversion needed
          // Filter out empty rows for parent callback
          const activeRows = gridRows.filter(row =>
            row.productTypeId ||
            Object.values(row.data || {}).some(value => value && String(value).trim() !== '')
          );

        },
        onStateChange: (state) => {
          // GridEngine state changes
        },
        onValidationChange: (hasErrors, errorCount, resultsManager) => {
          setValidationVersion(prev => prev + 1);
          // Validation results from ValidationEngine
          onValidationChange?.(hasErrors, errorCount, resultsManager);
        }
      },
      permissions: {
        canEdit: !isReadOnly,
        canDelete: !isReadOnly,
        userRole: user?.role || 'viewer'
      },
      customerPreferences: customerPreferences || undefined,

      // NEW: Customer context for pricing calculations
      customerId: effectiveCustomerId || undefined,
      customerName: customerName || undefined,
      cashCustomer: cashCustomer || false,
      taxRate: taxRate || 2.0,
      estimateId: estimateId || undefined
    };

    return new GridEngine(config);
  }, [isReadOnly, versioningMode, user?.role]);

  useEffect(() => {
    if (customerPreferences) {
      gridEngine.updateConfig({ customerPreferences });
    }
  }, [customerPreferences, gridEngine]);

  // Update GridEngine configuration when product types load
  useEffect(() => {
    if (productTypes.length > 0) {
      const convertedProductTypes = productTypes.map(convertProductTypeToConfig);
      gridEngine.updateConfig({ productTypes: convertedProductTypes });
    }
  }, [productTypes, gridEngine]);

  // Expose GridEngine for testing in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && gridEngine) {
      (window as any).gridEngineTestAccess = gridEngine;
    }
    
    return () => {
      if (process.env.NODE_ENV === 'development') {
        delete (window as any).gridEngineTestAccess;
      }
    };
  }, [gridEngine]);

  // Edit lock system
  const editLock = useEditLock({
    resourceType: 'estimate',
    resourceId: estimateId?.toString() || '',
    userId: user?.user_id || 0,
    username: user?.username || '',
    userRole: user?.role || '',
    autoAcquire: versioningMode && estimateId && !isReadOnly,
    onLockLost: () => {
      gridEngine.setEditMode('readonly');
    },
    onLockAcquired: () => {
      // Switch back to normal editing mode when lock is (re)acquired
      if (versioningMode && estimateId && !isReadOnly) {
        gridEngine.setEditMode('normal');
      }
    }
  });

  // Update edit mode based on lock status
  useEffect(() => {
    if (versioningMode && estimateId) {
      const shouldBeReadOnly = isReadOnly || !editLock.hasLock;
      gridEngine.setEditMode(shouldBeReadOnly ? 'readonly' : 'normal');
    }
  }, [editLock.hasLock, isReadOnly, versioningMode, estimateId, gridEngine]);

  // Load ALL templates once when component mounts - cached for entire editing session
  useEffect(() => {
    const loadAllTemplates = async () => {
      try {
        const allTemplates = await fieldPromptsApi.getAllTemplates();

        setTemplateCache(allTemplates);

        // Extract field prompts and static options for existing compatibility
        const newFieldPrompts: Record<number, Record<string, string | boolean>> = {};
        const newStaticOptions: Record<number, Record<string, string[]>> = {};

        Object.entries(allTemplates).forEach(([productTypeId, template]) => {
          const id = parseInt(productTypeId);

          const normalizedPrompts: Record<string, string | boolean> = {
            ...(template.field_prompts || {})
          };

          const normalizedStaticOptions: Record<string, string[]> = {
            ...(template.static_options || {})
          };

          if (id === 1) {
            normalizedPrompts.field6 = 'Pins Type';
            normalizedPrompts.field6_enabled = true;

            if (!normalizedStaticOptions.field6 || normalizedStaticOptions.field6.length === 0) {
              normalizedStaticOptions.field6 = [
                'Pins',
                'Pins + Spacer',
                'Pins + Rivnut',
                'Pins + Rivnut + Spacer'
              ];
            }

            normalizedPrompts.field7 = 'Extra Wire (ft)';
            normalizedPrompts.field7_enabled = true;
            if (!normalizedStaticOptions.field7) {
              normalizedStaticOptions.field7 = [];
            }
          }

          newFieldPrompts[id] = normalizedPrompts;
          newStaticOptions[id] = normalizedStaticOptions;
        });

        setFieldPromptsMap(newFieldPrompts);
        setStaticOptionsMap(newStaticOptions);

        // Update GridEngine validation config with field validation rules
        const validationConfigs = new Map<number, Record<string, any>>();

        Object.entries(allTemplates).forEach(([productTypeId, template]) => {
          const id = parseInt(productTypeId);

          if (template.validation_rules && Object.keys(template.validation_rules).length > 0) {
            const rules: Record<string, any> = { ...template.validation_rules };

            if (id === 1 && !rules.field6) {
              rules.field6 = {
                function: 'non_empty',
                error_level: 'warning',
                field_category: 'supplementary'
              };
            }

            if (id === 1 && !rules.field7) {
              rules.field7 = {
                function: 'float',
                error_level: 'mixed',
                field_category: 'supplementary',
                params: {
                  min: 0,
                  allow_negative: false,
                  decimal_places: 2
                }
              };
            }

            validationConfigs.set(id, rules);
            return;
          }

          if (id === 1) {
            validationConfigs.set(id, {
              field1: {
                function: 'non_empty',
                error_level: 'warning',
                field_category: 'complete_set'
              },
              field2: {
                function: 'float_or_groups',
                error_level: 'error',
                field_category: 'complete_set',
                params: {
                  group_separator: '. . . . . ',
                  number_separator: ',',
                  allow_negative: false,
                  min_value: 0
                }
              },
              field3: {
                function: 'led_override',
                error_level: 'mixed',
                field_category: 'sufficient',
                params: {
                  accepts: ['float', 'yes', 'no']
                }
              },
              field5: {
                function: 'float',
                error_level: 'error',
                field_category: 'sufficient',
                params: {
                  min: 0,
                  allow_negative: false,
                  decimal_places: 2
                }
              },
              field6: {
                function: 'non_empty',
                error_level: 'warning',
                field_category: 'supplementary'
              },
              field7: {
                function: 'float',
                error_level: 'mixed',
                field_category: 'supplementary',
                params: {
                  min: 0,
                  allow_negative: false,
                  decimal_places: 2
                }
              },
              field9: {
                function: 'ps_override',
                error_level: 'mixed',
                field_category: 'sufficient',
                params: {
                  accepts: ['float', 'yes', 'no']
                }
              }
            });
          }
        });
        console.log(`Templates loaded for ${validationConfigs.size} products`);
        gridEngine.updateValidationConfig(validationConfigs);

        setTemplatesLoaded(true);

      } catch (error) {
        console.error('Failed to load templates:', error);
        if (showNotification) {
          showNotification('Failed to load product type templates. Some features may not work correctly.', 'error');
        }
      }
    };

    loadAllTemplates();
  }, []); // Only run once when component mounts

  // Load initial data - wait for templates to be loaded first
  useEffect(() => {
    const loadData = async () => {
      if (!templatesLoaded) {
        return; // Wait for templates to be loaded
      }

      if (!estimateId) {
        // No estimate ID - initialize with empty row
        const emptyRow = gridEngine.getCoreOperations().createEmptyRow('main', []);
        gridEngine.updateCoreData([emptyRow]);
        return;
      }

      try {
        // Load from grid-data API
        const response = await jobVersioningApi.loadGridData(estimateId);
        const savedRows = response.data || [];

        if (savedRows.length > 0) {
          // Backend already provides data in correct GridRowCore format
          const coreRows = savedRows.map((row: any, index: number) => ({
            id: row.id || `row-${index + 1}`, // Use backend ID if available
            rowType: row.rowType || 'main', // Restore saved row type
            productTypeId: row.productTypeId,
            productTypeName: row.productTypeName,
            data: row.data || {}, // Use the data object as-is from backend
            parentProductId: row.parentProductId || undefined,
            // Include other backend metadata fields
            dbId: row.dbId,
            itemIndex: row.itemIndex,
            assemblyId: row.assemblyId,
            fieldConfig: row.fieldConfig || [],
            isMainRow: row.isMainRow,
            indent: row.indent || 0
          }));

          // Templates are already loaded and cached - no need for individual loading

          // Set the grid data immediately (don't mark as dirty during initial load)
          gridEngine.updateCoreData(coreRows, { markAsDirty: false });

          // Then trigger product type processing for each row to handle sub-item conversion (don't mark as dirty during initial load)
          coreRows.forEach((row, index) => {
            if (row.productTypeId && row.productTypeName) {
              gridEngine.updateRowProductType(row.id, row.productTypeId, row.productTypeName, { markAsDirty: false });
            }
          });
        } else {
          // No data found - initialize with empty row (don't mark as dirty during initial load)
          const emptyRow = gridEngine.getCoreOperations().createEmptyRow('main', []);
          gridEngine.updateCoreData([emptyRow], { markAsDirty: false });
        }
      } catch (error) {
        console.error('Failed to load estimate data:', error);
        // Don't create fallback data - show error to user instead
        // This prevents auto-save from potentially overwriting real data
        if (showNotification) {
          showNotification('Failed to load estimate data. Please refresh the page.', 'error');
        }
        // Leave grid empty rather than risk overwriting data
      }
    };

    loadData();
  }, [estimateId, gridEngine, templatesLoaded]); // Include templatesLoaded to trigger reload when templates are ready

  // Get current state
  const gridState = gridEngine.getState();
  const displayRows = gridEngine.getRows();

  // Event handlers using GridEngine methods
  const handleFieldCommit = useCallback((
    rowIndex: number,
    fieldName: string,
    value: string
  ) => {

    const row = displayRows[rowIndex];
    if (!row) {
      return;
    }

    gridEngine.updateSingleRow(row.id, { [fieldName]: value });
  }, [displayRows, gridEngine]);

  const handleProductTypeSelect = useCallback(async (
    rowIndex: number,
    productTypeId: number
  ) => {
    const row = displayRows[rowIndex];
    if (!row) return;

    // Get product type name from loaded productTypes
    const productType = productTypes.find(pt => pt.id === productTypeId);
    const productTypeName = productType?.name || `Product Type ${productTypeId}`;

    // Fetch field prompts for this product type if not already cached
    if (!fieldPromptsMap[productTypeId]) {
      try {
        const template = await fieldPromptsApi.getFieldPrompts(productTypeId);
        setFieldPromptsMap(prev => ({
          ...prev,
          [productTypeId]: template.field_prompts
        }));
        setStaticOptionsMap(prev => ({
          ...prev,
          [productTypeId]: template.static_options
        }));
      } catch (error) {
        console.error('Failed to fetch field prompts:', error);
        showNotification?.('Failed to load field prompts', 'error');
      }
    }

    // Clear all field data when changing product type
    const clearedFieldData = {
      field1: '', field2: '', field3: '', field4: '', field5: '', field6: '',
      field7: '', field8: '', field9: '', field10: ''
    };

    gridEngine.updateSingleRow(row.id, clearedFieldData);
    gridEngine.updateRowProductType(row.id, productTypeId, productTypeName);
  }, [displayRows, gridEngine, productTypes, fieldPromptsMap, showNotification]);

  const handleInsertRow = useCallback((afterIndex: number) => {
    gridEngine.insertRow(afterIndex, 'main');
  }, [gridEngine]);

  const handleDeleteRow = useCallback((rowIndex: number) => {
    const row = displayRows[rowIndex];
    if (!row) return;

    gridEngine.deleteRow(row.id);
  }, [displayRows, gridEngine]);

  const handleDuplicateRow = useCallback((rowIndex: number) => {
    const row = displayRows[rowIndex];
    if (!row) return;

    gridEngine.duplicateRow(row.id);
  }, [displayRows, gridEngine]);

  const handleClearRow = useCallback((rowIndex: number) => {
    const row = displayRows[rowIndex];
    if (!row) return;

    const editableSet = new Set(row.editableFields || []);
    const baseFields = ['quantity', 'field1', 'field2', 'field3', 'field4', 'field5', 'field6', 'field7', 'field8', 'field9', 'field10'];
    const existingFields = Object.keys(row.data || {});
    const fieldsToProcess = new Set([...baseFields, ...existingFields, ...editableSet]);

    const updates: Record<string, string> = {};

    fieldsToProcess.forEach((fieldName) => {
      const normalized = fieldName.toLowerCase();
      const isEditable = editableSet.size === 0 || editableSet.has(fieldName) || normalized === 'quantity';
      const isGridField = normalized === 'quantity' || normalized.startsWith('field');

      if (!isEditable && !isGridField) {
        return;
      }

      const currentValue = row.data?.[fieldName] ?? '';

      if (normalized === 'quantity') {
        if (currentValue !== '1') {
          updates[fieldName] = '1';
        }
        return;
      }

      const nextValue = '';
      if ((isGridField || editableSet.has(fieldName)) && currentValue !== nextValue) {
        updates[fieldName] = nextValue;
      }
    });

    if (Object.keys(updates).length === 0) {
      return;
    }

    gridEngine.updateSingleRow(row.id, updates);
  }, [displayRows, gridEngine]);

  // Drag and drop handling
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sourceRow = displayRows.find(r => r.id === active.id);
    if (!sourceRow) return;

    // Detect drag direction by comparing row indices
    const sourceIndex = displayRows.findIndex(r => r.id === active.id);
    const targetIndex = displayRows.findIndex(r => r.id === over.id);

    // Apply directional logic:
    // Moving up (higher index to lower) → drop above target
    // Moving down (lower index to higher) → drop below target
    const dropPosition = sourceIndex > targetIndex ? 'above' : 'below';

    gridEngine.moveRows(sourceRow.draggedRowIds, over.id, dropPosition);
  }, [displayRows, gridEngine]);

  // Simple button action callbacks to replace gridActions
  const handleReset = useCallback(async () => {
    setShowClearConfirmation(false);
    setClearModalType(null);

    if (versioningMode && estimateId) {
      try {
        await jobVersioningApi.resetEstimateItems(estimateId);
        await gridEngine.reloadFromBackend(estimateId, jobVersioningApi, fieldPromptsMap);
        showNotification?.('Grid reset to default template', 'success');
      } catch (error) {
        console.error('Reset failed:', error);
        showNotification?.('Failed to reset grid. Please try again.', 'error');
      }
    }
  }, [versioningMode, estimateId, gridEngine, fieldPromptsMap, showNotification]);

  const handleClearAll = useCallback(async () => {
    setShowClearConfirmation(false);
    setClearModalType(null);

    if (versioningMode && estimateId) {
      try {
        await jobVersioningApi.clearAllEstimateItems(estimateId);
        await gridEngine.reloadFromBackend(estimateId, jobVersioningApi, fieldPromptsMap);
        showNotification?.('All items cleared', 'success');
      } catch (error) {
        console.error('Clear all failed:', error);
        showNotification?.('Failed to clear all items. Please try again.', 'error');
      }
    }
  }, [versioningMode, estimateId, gridEngine, fieldPromptsMap, showNotification]);

  const handleClearEmpty = useCallback(async () => {
    setShowClearConfirmation(false);
    setClearModalType(null);

    if (versioningMode && estimateId) {
      try {
        await jobVersioningApi.clearEmptyItems(estimateId);
        await gridEngine.reloadFromBackend(estimateId, jobVersioningApi, fieldPromptsMap);
        showNotification?.('Empty rows cleared', 'success');
      } catch (error) {
        console.error('Clear empty failed:', error);
        showNotification?.('Failed to clear empty rows. Please try again.', 'error');
      }
    }
  }, [versioningMode, estimateId, gridEngine, fieldPromptsMap, showNotification]);

  const handleAddSection = useCallback(async () => {
    if (versioningMode && estimateId) {
      try {
        await jobVersioningApi.addTemplateSection(estimateId);
        await gridEngine.reloadFromBackend(estimateId, jobVersioningApi, fieldPromptsMap);
        showNotification?.('Template section added', 'success');
      } catch (error) {
        console.error('Add section failed:', error);
        showNotification?.('Failed to add template section. Please try again.', 'error');
      }
    }
  }, [versioningMode, estimateId, gridEngine, fieldPromptsMap, showNotification]);

  // Manual save
  const handleManualSave = useCallback(async () => {
    if (!estimateId) return;

    const coreData = gridEngine.getCoreData();

    try {
      // Convert to simplified structure - no IDs needed, but keep row types
      const simplifiedRows = coreData.map(row => ({
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

      // Save directly as JSON array
      await jobVersioningApi.saveGridData(estimateId, simplifiedRows);
      gridEngine.markAsSaved();
      showNotification?.('Grid saved successfully', 'success');
    } catch (error) {
      console.error('Save error:', error);
      showNotification?.('Failed to save grid', 'error');
    }
  }, [estimateId, gridEngine, showNotification]);

  // Navigation guard - simplified
  useEffect(() => {
    if (onRequestNavigation) {
      const navigationGuard = (navigationFn?: () => void) => {
        // Only proceed if we have a valid function
        if (typeof navigationFn === 'function') {
          if (gridState.hasUnsavedChanges) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
            if (confirmed) {
              navigationFn();
            }
          } else {
            navigationFn();
          }
        }
      };

      onRequestNavigation(navigationGuard);

      return () => {
        onRequestNavigation(null);
      };
    }
  }, [onRequestNavigation, gridState.hasUnsavedChanges]);

  // Auto-save trigger - missing piece from original working version
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Trigger auto-save when hasUnsavedChanges becomes true
    if (gridState.hasUnsavedChanges && versioningMode && estimateId && !isReadOnly) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set debounced auto-save (500ms delay)
      autoSaveTimeoutRef.current = setTimeout(async () => {
        try {
          const coreData = gridEngine.getCoreData();
          await gridEngine.getConfig().autoSave?.onSave(coreData);
          gridEngine.markAsSaved();
        } catch (error) {
          console.error('Auto-save failed:', error);
          showNotification?.('Auto-save failed - your changes may not be saved!', 'error');
        }
      }, 500);
    }

    // Cleanup timeout on unmount
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [gridState.hasUnsavedChanges, versioningMode, estimateId, isReadOnly, gridEngine, showNotification]);

  // Beforeunload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (gridState.hasUnsavedChanges && !isReadOnly) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [gridState.hasUnsavedChanges, isReadOnly]);

  // Loading states
  if (productTypesLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p className="mt-2 text-gray-600">Loading product types...</p>
      </div>
    );
  }

  if (productTypesError) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="text-red-500 mb-4">
          <p className="font-semibold">Error loading product types</p>
          <p className="text-sm">{productTypesError}</p>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!displayRows.length) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p className="mt-2 text-gray-600">Loading grid...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow w-full" data-testid="grid-job-builder">
      {/* Edit Lock Indicator */}
      {versioningMode && estimateId && !isReadOnly && editLock.lockStatus && (
        <div className="p-4 border-b border-gray-200">
          <EditLockIndicator
            lockStatus={editLock.lockStatus}
            hasLock={editLock.hasLock}
            isLoading={editLock.isLoading}
            canOverride={editLock.canOverride}
            onOverride={editLock.overrideLock}
            onViewReadOnly={() => gridEngine.setEditMode('readonly')}
          />
        </div>
      )}

      {/* Header Section - GridHeader with action buttons */}
      <GridHeader
        gridEngine={gridEngine}
        user={user}
        estimate={estimate}
        versioningMode={versioningMode}
        isCreatingNew={isCreatingNew}
        onBackToEstimates={onBackToEstimates || (() => {})}
        editLock={editLock}
        onReset={() => { setClearModalType('reset'); setShowClearConfirmation(true); }}
        onClearAll={() => { setClearModalType('clearAll'); setShowClearConfirmation(true); }}
        onClearEmpty={() => { setClearModalType('clearEmpty'); setShowClearConfirmation(true); }}
        onAddSection={handleAddSection}
        onManualSave={handleManualSave}
      />

      {/* Main Grid Body - New Drag-Drop Renderer */}
      <DragDropGridRenderer
        rows={displayRows}
        productTypes={gridEngine.getConfig().productTypes || []}
        staticDataCache={gridEngine.getConfig().staticDataCache}
        onFieldCommit={handleFieldCommit}
        onProductTypeSelect={handleProductTypeSelect}
        onInsertRow={handleInsertRow}
        onDeleteRow={handleDeleteRow}
        onDuplicateRow={handleDuplicateRow}
        onClearRow={handleClearRow}
        onDragEnd={handleDragEnd}
        isReadOnly={gridState.editMode === 'readonly'}
        fieldPromptsMap={fieldPromptsMap}
        staticOptionsMap={staticOptionsMap}
        validationEngine={gridEngine.getValidationResults ? gridEngine : undefined}
        validationVersion={validationVersion}
      />

      {/* Footer Section - Simple for now */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>Total rows: {displayRows.length}</span>
          {gridState.lastSaved && (
            <span>Last saved: {gridState.lastSaved.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* Simple confirmation modal for clear actions */}
      {showClearConfirmation && clearModalType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {clearModalType === 'reset' && 'Reset Grid to Default Template?'}
              {clearModalType === 'clearAll' && 'Clear All Items?'}
              {clearModalType === 'clearEmpty' && 'Clear Empty Rows?'}
            </h3>
            <p className="text-gray-600 mb-6">
              {clearModalType === 'reset' && 'This will reset all items to the default template configuration. Your current data will be lost.'}
              {clearModalType === 'clearAll' && 'This will permanently delete all items in the grid. This action cannot be undone.'}
              {clearModalType === 'clearEmpty' && 'This will remove all empty rows with no input data.'}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => { setShowClearConfirmation(false); setClearModalType(null); }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={clearModalType === 'reset' ? handleReset : clearModalType === 'clearAll' ? handleClearAll : handleClearEmpty}
                className={`px-4 py-2 text-white rounded ${
                  clearModalType === 'reset' ? 'bg-orange-600 hover:bg-orange-700' :
                  clearModalType === 'clearAll' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {clearModalType === 'reset' && 'Reset'}
                {clearModalType === 'clearAll' && 'Clear All'}
                {clearModalType === 'clearEmpty' && 'Clear Empty'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
