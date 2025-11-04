/**
 * Hook for loading and caching product type templates
 *
 * Loads ALL templates once on mount and caches them for the component lifecycle.
 * This ensures templates are available before grid data loads.
 */

import { useState, useEffect } from 'react';
import { fieldPromptsApi, SimpleProductTemplate } from '../../../services/fieldPromptsApi';
import { QuickBooksDataResource } from '../../../services/quickbooksDataResource';

interface UseTemplateCacheReturn {
  templateCache: Record<number, SimpleProductTemplate>;
  templatesLoaded: boolean;
  fieldPromptsMap: Record<number, Record<string, string | boolean>>;
  staticOptionsMap: Record<number, Record<string, string[]>>;
}

/**
 * Loads and caches all product type templates on mount.
 * Templates must load before grid data to ensure proper validation.
 *
 * @returns Template cache, loading state, and processed field prompts/options
 */
export const useTemplateCache = (
): UseTemplateCacheReturn => {
  // Template cache state - loads ALL templates once and caches for component lifecycle
  const [templateCache, setTemplateCache] = useState<Record<number, SimpleProductTemplate>>({});
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  // Field prompts state (derived from template cache)
  const [fieldPromptsMap, setFieldPromptsMap] = useState<Record<number, Record<string, string | boolean>>>({});
  const [staticOptionsMap, setStaticOptionsMap] = useState<Record<number, Record<string, string[]>>>({});

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
            // field6 is now handled dynamically from the database (pin_types table)
            // The database configuration already sets field6 as 'Pin Type' with dynamic options

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

        // Validation configuration is now handled internally by ValidationEngine
        setTemplatesLoaded(true);

      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    };

    loadAllTemplates();
  }, []); // Only run once on mount

  return {
    templateCache,
    templatesLoaded,
    fieldPromptsMap,
    staticOptionsMap
  };
};
