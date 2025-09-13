// Layer 2: Visual properties and formatting

import { GridRowWithRelationships, GridRowDisplay } from '../types/LayerTypes';
import { ProductTypeConfig } from '../types/CoreTypes';
import { DisplayContext } from '../types/GridTypes';

export interface DisplayOperations {
  /**
   * Calculates all display properties for rows
   * @param relationshipRows - Rows with relationship data
   * @param context - Display calculation context
   * @returns Rows with display properties added
   */
  calculateDisplay: (
    relationshipRows: GridRowWithRelationships[],
    context: DisplayContext
  ) => GridRowDisplay[];

  /**
   * Gets static field options from product configuration and database
   * @param productTypeId - Product type identifier
   * @param productConfig - Product field configurations
   * @param staticDataCache - Cache of database options (materials, colors, etc.)
   * @returns Static field options from database
   */
  getStaticFieldOptions: (
    productTypeId: number,
    productConfig: ProductTypeConfig[],
    staticDataCache?: Record<string, any[]>
  ) => Record<string, string[]>;
}

export interface StaticDataCache {
  // Common static data from database
  materials?: Array<{value: string; label: string}>;
  colors?: Array<{value: string; label: string}>;
  sizes?: Array<{value: string; label: string}>;
  finishes?: Array<{value: string; label: string}>;
  suppliers?: Array<{value: string; label: string}>;
  [key: string]: Array<{value: string; label: string}> | undefined;
}

// Implementation
export const createDisplayOperations = (): DisplayOperations => {
  return {
    calculateDisplay: (relationshipRows, context) => {
      return relationshipRows.map(row => {
        // Get static field options for this product type
        const staticFieldOptions = getStaticFieldOptions(
          row.productTypeId || 0,
          context.productTypes,
          context.staticDataCache
        );

        return {
          ...row,
          staticFieldOptions
        };
      });
    },

    getStaticFieldOptions: (productTypeId, productConfig, staticDataCache) => {
      return getStaticFieldOptions(productTypeId, productConfig, staticDataCache);
    }
  };

  // Helper function implementation
  function getStaticFieldOptions(
    productTypeId: number,
    productConfig: ProductTypeConfig[],
    staticDataCache: Record<string, any[]> = {}
  ): Record<string, string[]> {
    const options: Record<string, string[]> = {};
    
    if (!productTypeId) return options;
    
    const productType = productConfig.find(pt => pt.id === productTypeId);
    if (!productType) return options;

    // Extract options from all fields in all columns
    for (const columnFields of productType.fields) {
      for (const field of columnFields) {
        if (field.options && field.options.length > 0) {
          // Handle both string[] and {value, label}[] formats
          if (typeof field.options[0] === 'string') {
            options[field.name] = field.options as string[];
          } else {
            options[field.name] = (field.options as Array<{value: string; label: string}>)
              .map(option => option.value);
          }
        }
        
        // For fields with data_source, get options from static database cache
        else if (field.data_source) {
          const sourceData = staticDataCache[field.data_source];
          if (sourceData && Array.isArray(sourceData)) {
            if (field.value_field && field.display_field) {
              // Use specified value/display fields
              options[field.name] = sourceData.map(item => item[field.value_field!]);
            } else {
              // Default to value field
              options[field.name] = sourceData.map(item => 
                typeof item === 'string' ? item : (item.value || item.id || String(item))
              );
            }
          } else {
            // Fallback - empty array for unknown data sources
            options[field.name] = [];
          }
        }
        
        // Fields without options or data_source get empty array
        else {
          options[field.name] = [];
        }
      }
    }

    return options;
  }
};