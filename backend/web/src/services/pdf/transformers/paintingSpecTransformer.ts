/**
 * Painting Spec Transformer
 *
 * Transforms Return, Trim, Face, and other specs when a Painting spec targets them.
 * - Appends paint color to affected specs (e.g., "3" White" → "3" White Painted 2622C")
 * - Marks transformed specs for purple label background in PDF rendering
 * - Detects collision errors when multiple paintings target the same component
 *
 * Created: 2026-01-19
 */

import { PartColumnStandardized, StandardizedSpec } from '../../orderSpecificationStandardizationService';
import { PaintingComponent, PaintingTiming } from '../../taskGeneration/paintingTaskMatrix';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Extracted painting specification with parsed data
 */
export interface ExtractedPaintingSpec {
  rowNum: string;
  colour: string;                    // e.g., "2622C"
  component: PaintingComponent;      // "Return & Trim", "Face", etc.
  timing: PaintingTiming;            // "After Fabrication", etc. (tracked for future)
}

/**
 * Error encountered during transformation (e.g., collision)
 */
export interface TransformationError {
  type: 'collision' | 'invalid_data';
  message: string;
  details: {
    targetTemplate?: string;
    paintingSpecs?: ExtractedPaintingSpec[];
  };
}

/**
 * Result of applying painting transformations to specs
 */
export interface TransformationResult {
  transformedColumns: PartColumnStandardized[];
  errors: TransformationError[];
}

// ============================================
// COMPONENT TARGET MAPPING
// ============================================

/**
 * Maps painting components to the spec templates they affect
 * When a painting targets "Return & Trim", it affects both Return and Trim specs
 */
export const COMPONENT_TARGETS: Record<PaintingComponent, string[]> = {
  'Face': ['Face'],
  'Return': ['Return', '3DP Return'],
  'Trim': ['Trim'],
  'Return & Trim': ['Return', '3DP Return', 'Trim'],
  'Face & Return': ['Face', 'Return', '3DP Return'],
  'Frame': ['Frame'],
  'All Sides': ['Face', 'Return', '3DP Return', 'Trim', 'Back', 'Frame'],
};

// ============================================
// COMPONENT GROUP VALIDATION
// ============================================

/**
 * Component groups - specs within a group are alternatives (either satisfies the requirement)
 * e.g., 'Return' group can be satisfied by either 'Return' or '3DP Return' spec
 */
const COMPONENT_GROUPS: Record<string, string[]> = {
  'Return': ['Return', '3DP Return'],
  'Face': ['Face'],
  'Trim': ['Trim'],
  'Back': ['Back'],
  'Frame': ['Frame'],
};

/**
 * Required component groups for each painting component
 * All listed groups must have at least one spec present for the painting to be valid
 */
const COMPONENT_REQUIREMENTS: Record<PaintingComponent, string[]> = {
  'Face': ['Face'],
  'Return': ['Return'],
  'Trim': ['Trim'],
  'Return & Trim': ['Return', 'Trim'],       // Both groups required
  'Face & Return': ['Face', 'Return'],       // Both groups required
  'Frame': ['Frame'],
  'All Sides': ['Face', 'Return', 'Trim', 'Back', 'Frame'],  // All groups required
};

// ============================================
// PRODUCT TYPE CONFIGURATION
// ============================================

/**
 * Product-type-specific configuration for transformation
 * Extensible: add entries to PRODUCT_TYPE_CONFIGS to override defaults
 */
export interface ProductTypeConfig {
  // Which specs CAN be transformed (if painting targets them)
  transformableSpecs: string[];
  // Format string for appended text (default: " Painted {colour}")
  paintedSuffix: string;
}

/**
 * Default configuration (applies to all product types unless overridden)
 */
const DEFAULT_CONFIG: ProductTypeConfig = {
  transformableSpecs: ['Return', '3DP Return', 'Trim', 'Face', 'Back', 'Frame'],
  paintedSuffix: ' Painted {colour}',
};

/**
 * Product-type specific overrides (empty for now - all use default)
 * Example for future: { 'Halo Lit': { transformableSpecs: ['Return', 'Face'], paintedSuffix: '...' } }
 */
const PRODUCT_TYPE_CONFIGS: Record<string, Partial<ProductTypeConfig>> = {};

/**
 * Get configuration for a product type (merges with defaults)
 */
export function getConfigForProductType(productType: string): ProductTypeConfig {
  const override = PRODUCT_TYPE_CONFIGS[productType] || {};
  return { ...DEFAULT_CONFIG, ...override };
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

/**
 * Valid painting components (for validation)
 */
const VALID_COMPONENTS: PaintingComponent[] = [
  'Face', 'Return', 'Trim', 'Return & Trim', 'Face & Return', 'Frame', 'All Sides'
];

/**
 * Valid painting timings (for validation)
 */
const VALID_TIMINGS: PaintingTiming[] = [
  'Before Cutting', 'After Cutting', 'After Bending', 'After Fabrication'
];

/**
 * Extract painting specifications from all specs in a column
 */
export function extractPaintingSpecs(allSpecs: StandardizedSpec[]): ExtractedPaintingSpec[] {
  const paintingSpecs: ExtractedPaintingSpec[] = [];

  for (const spec of allSpecs) {
    if (spec.template !== 'Painting') continue;

    const colour = spec.specs.colour || spec.specs.color || '';
    const component = spec.specs.component as PaintingComponent;
    const timing = spec.specs.timing as PaintingTiming;

    // Skip invalid painting specs
    if (!colour || !component) continue;
    if (!VALID_COMPONENTS.includes(component)) continue;

    paintingSpecs.push({
      rowNum: spec.rowNum,
      colour,
      component,
      timing: VALID_TIMINGS.includes(timing) ? timing : 'After Fabrication', // Default timing
    });
  }

  return paintingSpecs;
}

// ============================================
// COMPONENT GROUP VALIDATION FUNCTIONS
// ============================================

/**
 * Check if a component group has at least one spec present in the column
 */
function isGroupSatisfied(group: string, allSpecs: StandardizedSpec[], transformableSpecs: string[]): boolean {
  const templatesInGroup = COMPONENT_GROUPS[group] || [];
  return allSpecs.some(spec =>
    templatesInGroup.includes(spec.template) && transformableSpecs.includes(spec.template)
  );
}

/**
 * Validate that all required component groups exist for a painting spec
 * Returns error if any required group is missing
 */
function validatePaintingRequirements(
  painting: ExtractedPaintingSpec,
  allSpecs: StandardizedSpec[],
  transformableSpecs: string[]
): TransformationError | null {
  const requiredGroups = COMPONENT_REQUIREMENTS[painting.component] || [];
  const missingGroups: string[] = [];

  for (const group of requiredGroups) {
    if (!isGroupSatisfied(group, allSpecs, transformableSpecs)) {
      missingGroups.push(group);
    }
  }

  if (missingGroups.length > 0) {
    const missingList = missingGroups.join(', ');
    return {
      type: 'invalid_data',
      message: `Painting "${painting.component}" (${painting.colour}) requires ${missingList} spec(s) but they are missing. Please add the required specs or change the painting component.`,
      details: {
        targetTemplate: painting.component,
        paintingSpecs: [painting],
      },
    };
  }

  return null;
}

// ============================================
// CLOSEST TARGET SELECTION
// ============================================

/**
 * Find the closest target spec to a painting spec
 * Prefers specs above (lower rowNum), falls back to closest below
 *
 * @param paintingRowNum - The rowNum of the painting spec
 * @param targetSpecs - All specs that could be painted (matching template)
 * @returns The closest spec, or null if none found
 */
function findClosestTarget(paintingRowNum: string, targetSpecs: StandardizedSpec[]): StandardizedSpec | null {
  if (targetSpecs.length === 0) return null;
  if (targetSpecs.length === 1) return targetSpecs[0];

  const paintingRow = parseInt(paintingRowNum, 10);

  // Find specs above the painting (lower rowNum = above in table)
  const specsAbove = targetSpecs
    .filter(s => parseInt(s.rowNum, 10) < paintingRow)
    .sort((a, b) => parseInt(b.rowNum, 10) - parseInt(a.rowNum, 10)); // Highest first (closest above)

  if (specsAbove.length > 0) {
    return specsAbove[0];
  }

  // Fallback to closest below
  const specsBelow = targetSpecs
    .filter(s => parseInt(s.rowNum, 10) > paintingRow)
    .sort((a, b) => parseInt(a.rowNum, 10) - parseInt(b.rowNum, 10)); // Lowest first (closest below)

  return specsBelow.length > 0 ? specsBelow[0] : null;
}

/**
 * Create a unique key for a spec (rowNum alone can collide across different parts)
 */
function makeSpecKey(rowNum: string, template: string): string {
  return `${rowNum}:${template}`;
}

/**
 * Build a map of specific specs that should be painted
 * Uses closest-target selection when multiple specs of same template exist
 *
 * @returns Map of "rowNum:template" → { colour, paintingComponent }
 */
function buildTargetedPaintingMap(
  paintingSpecs: ExtractedPaintingSpec[],
  allSpecs: StandardizedSpec[],
  transformableSpecs: string[]
): Map<string, { colour: string; component: PaintingComponent }> {
  const targetMap = new Map<string, { colour: string; component: PaintingComponent }>();

  for (const painting of paintingSpecs) {
    const targetTemplates = COMPONENT_TARGETS[painting.component] || [];

    for (const template of targetTemplates) {
      if (!transformableSpecs.includes(template)) continue;

      // Find all specs matching this template
      const matchingSpecs = allSpecs.filter(s => s.template === template);
      if (matchingSpecs.length === 0) continue;

      // Find the closest one to this painting spec
      const closestSpec = findClosestTarget(painting.rowNum, matchingSpecs);
      if (closestSpec) {
        // Use unique key combining rowNum and template to avoid collisions across parts
        const specKey = makeSpecKey(closestSpec.rowNum, closestSpec.template);
        targetMap.set(specKey, {
          colour: painting.colour,
          component: painting.component,
        });
        console.log(`[PAINTING TRANSFORM] Targeting ${template} at row ${closestSpec.rowNum} (key: ${specKey}) from painting at row ${painting.rowNum}`);
      }
    }
  }

  return targetMap;
}

// ============================================
// COLLISION DETECTION
// ============================================

/**
 * Detect collisions where multiple paintings target the same spec template
 */
export function detectCollisions(paintingSpecs: ExtractedPaintingSpec[]): TransformationError[] {
  const errors: TransformationError[] = [];

  // Build map: { targetTemplate: [paintingSpecs that target it] }
  const templateTargetMap: Map<string, ExtractedPaintingSpec[]> = new Map();

  for (const painting of paintingSpecs) {
    const targetTemplates = COMPONENT_TARGETS[painting.component] || [];

    for (const template of targetTemplates) {
      const existing = templateTargetMap.get(template) || [];
      existing.push(painting);
      templateTargetMap.set(template, existing);
    }
  }

  // Check for collisions (multiple paintings targeting same template)
  templateTargetMap.forEach((paintings, template) => {
    if (paintings.length > 1) {
      const componentList = paintings.map(p => `"${p.component}" (${p.colour})`).join(' and ');
      errors.push({
        type: 'collision',
        message: `Painting collision: ${template} is targeted by multiple paintings: ${componentList}. Please remove conflicting painting specifications.`,
        details: {
          targetTemplate: template,
          paintingSpecs: paintings,
        },
      });
    }
  });

  return errors;
}

// ============================================
// TRANSFORMATION LOGIC
// ============================================

/**
 * Apply painting transformations to a single column
 */
function transformColumn(
  column: PartColumnStandardized,
  productType: string
): { transformedColumn: PartColumnStandardized; errors: TransformationError[] } {
  const errors: TransformationError[] = [];
  const config = getConfigForProductType(productType);

  // Extract painting specs from this column
  const paintingSpecs = extractPaintingSpecs(column.allSpecs);

  // No paintings = no transformation needed
  if (paintingSpecs.length === 0) {
    return { transformedColumn: column, errors: [] };
  }

  console.log(`[PAINTING TRANSFORM] Found ${paintingSpecs.length} painting specs in column`);

  // Step 1: Validate all painting specs have required targets
  const validPaintingSpecs: ExtractedPaintingSpec[] = [];
  for (const painting of paintingSpecs) {
    const validationError = validatePaintingRequirements(painting, column.allSpecs, config.transformableSpecs);
    if (validationError) {
      errors.push(validationError);
      console.log(`[PAINTING TRANSFORM] Validation failed for ${painting.component}: ${validationError.message}`);
    } else {
      validPaintingSpecs.push(painting);
    }
  }

  // If all paintings failed validation, return with errors
  if (validPaintingSpecs.length === 0) {
    return { transformedColumn: column, errors };
  }

  // Step 2: Detect collisions among valid painting specs
  const collisionErrors = detectCollisions(validPaintingSpecs);
  if (collisionErrors.length > 0) {
    errors.push(...collisionErrors);
    return { transformedColumn: column, errors };
  }

  // Step 3: Build targeted painting map (specRowNum → paint info)
  // Uses closest-target selection when multiple specs of same template exist
  const targetedPaintingMap = buildTargetedPaintingMap(validPaintingSpecs, column.allSpecs, config.transformableSpecs);

  // Track which painting components were fully applied
  const appliedPaintingComponents = new Set<PaintingComponent>();

  // Step 4: Transform specs based on targeted map
  const transformedSpecs: StandardizedSpec[] = column.allSpecs.map(spec => {
    // Use unique key combining rowNum and template to match the map
    const specKey = makeSpecKey(spec.rowNum, spec.template);
    const paintInfo = targetedPaintingMap.get(specKey);

    if (paintInfo) {
      console.log(`[PAINTING TRANSFORM] Transforming ${spec.template} at row ${spec.rowNum} with colour ${paintInfo.colour}`);
      appliedPaintingComponents.add(paintInfo.component);

      return {
        ...spec,
        paintingApplied: true,
        paintingColour: paintInfo.colour,
      };
    }

    return spec;
  });

  // Step 5: Filter out Painting specs that were fully applied
  // A painting is "fully applied" if all its required component groups were satisfied
  const filteredSpecs = transformedSpecs.filter(spec => {
    if (spec.template !== 'Painting') return true;

    const component = spec.specs.component as PaintingComponent;

    // Check if this painting was in the valid list and was applied
    const wasValid = validPaintingSpecs.some(p => p.component === component);
    const wasApplied = appliedPaintingComponents.has(component);

    if (wasValid && wasApplied) {
      console.log(`[PAINTING TRANSFORM] Removing Painting spec (${component}) - fully applied to all targets`);
      return false;
    }

    return true;
  });

  // Return transformed column with any validation errors
  return {
    transformedColumn: {
      ...column,
      allSpecs: filteredSpecs,
    },
    errors,
  };
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

/**
 * Apply painting transformations to all columns
 *
 * This is the main entry point for the transformation system.
 * Call after standardizeOrderParts() and before rendering.
 *
 * @param columns - Standardized part columns from standardizeOrderParts()
 * @returns Transformed columns and any errors encountered
 */
export function applyPaintingTransformations(
  columns: PartColumnStandardized[]
): TransformationResult {
  const transformedColumns: PartColumnStandardized[] = [];
  const allErrors: TransformationError[] = [];

  for (const column of columns) {
    // Get product type for configuration lookup
    const productType = column.parent.specs_display_name || column.parent.product_type || 'Unknown';

    const { transformedColumn, errors } = transformColumn(column, productType);
    transformedColumns.push(transformedColumn);
    allErrors.push(...errors);
  }

  if (allErrors.length > 0) {
    console.log(`[PAINTING TRANSFORM] Transformation errors: ${allErrors.map(e => e.message).join('; ')}`);
  }

  return {
    transformedColumns,
    errors: allErrors,
  };
}
