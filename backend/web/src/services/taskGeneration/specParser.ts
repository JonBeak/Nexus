/**
 * Spec Parser
 * Parses specifications JSON from order parts into structured data for task generation
 */

import { ParsedSpec, PartInfo, PartGroup } from './types';
import { OrderPart } from '../../types/orders';

/**
 * Parse specifications JSON to extract template-based specs
 * Looks for _template_N keys and corresponding rowN_* values
 */
export function parseSpecifications(specifications: Record<string, any>): ParsedSpec[] {
  const specs: ParsedSpec[] = [];

  if (!specifications || typeof specifications !== 'object') {
    return specs;
  }

  // Find all _template_N keys
  const templateKeys = Object.keys(specifications)
    .filter(key => key.match(/^_template_\d+$/) || key === '_template')
    .sort();

  for (const templateKey of templateKeys) {
    const templateName = specifications[templateKey];
    if (!templateName || typeof templateName !== 'string') continue;

    // Extract row number from template key (e.g., _template_1 -> 1)
    const match = templateKey.match(/^_template_?(\d*)$/);
    const rowNum = match?.[1] || '1';

    // Collect all values for this row
    const values: Record<string, string> = {};
    const rowPrefix = `row${rowNum}_`;

    for (const [key, value] of Object.entries(specifications)) {
      if (key.startsWith(rowPrefix) && value !== undefined && value !== null && value !== '') {
        // Remove row prefix to get clean field name (e.g., row1_colour -> colour)
        const fieldName = key.substring(rowPrefix.length);
        values[fieldName] = String(value);
      }
    }

    specs.push({
      templateName,
      values
    });
  }

  return specs;
}

/**
 * Group order parts by parent/sub-part relationship
 * Uses is_parent flag and sequential ordering (part_number) to group parts.
 * Each parent part (is_parent=true) starts a new group, and all following
 * sub-parts (is_parent=false) are added to that group until the next parent.
 *
 * This approach is more reliable than parsing display_number strings, which
 * come from estimate preview data and may not align with production grouping.
 */
export function groupPartsByParent(parts: OrderPart[]): PartGroup[] {
  const groups: PartGroup[] = [];
  let currentGroup: PartGroup | null = null;

  // Sort by part_number to ensure sequential creation order
  const sortedParts = [...parts].sort((a, b) => a.part_number - b.part_number);

  // Track display number for parent parts (for UI display purposes)
  let parentDisplayIndex = 0;

  for (const part of sortedParts) {
    if (part.is_parent) {
      // Start new group for parent part
      parentDisplayIndex++;

      currentGroup = {
        parentPartId: part.part_id,
        // Use actual display_number for UI, fallback to sequential parent index
        displayNumber: part.display_number || String(parentDisplayIndex),
        specsDisplayName: part.specs_display_name || null,
        allSpecs: parseSpecifications(part.specifications),
        parts: [{
          partId: part.part_id,
          displayNumber: part.display_number || String(part.part_number),
          isParent: true,
          specsDisplayName: part.specs_display_name || null,
          specifications: part.specifications
        }]
      };
      groups.push(currentGroup);
    } else if (currentGroup) {
      // Add sub-part to current parent's group
      currentGroup.parts.push({
        partId: part.part_id,
        displayNumber: part.display_number || String(part.part_number),
        isParent: false,
        specsDisplayName: part.specs_display_name || null,
        specifications: part.specifications
      });

      // Merge specs from sub-part
      const subPartSpecs = parseSpecifications(part.specifications);
      currentGroup.allSpecs.push(...subPartSpecs);
    }
    // Note: Sub-parts without a preceding parent are skipped (orphaned)
    // This shouldn't happen in properly formed orders
  }

  return groups;
}

/**
 * Find a specific spec by template name in a part group
 */
export function findSpec(group: PartGroup, templateName: string): ParsedSpec | undefined {
  return group.allSpecs.find(spec =>
    spec.templateName.toLowerCase() === templateName.toLowerCase()
  );
}

/**
 * Check if a part group has a specific spec type
 */
export function hasSpec(group: PartGroup, templateName: string): boolean {
  return findSpec(group, templateName) !== undefined;
}

/**
 * Get spec value by template name and field
 */
export function getSpecValue(group: PartGroup, templateName: string, field: string): string | null {
  const spec = findSpec(group, templateName);
  if (!spec) return null;
  return spec.values[field] || null;
}

/**
 * Extract Box Type material information for task notes
 * Returns "material, colour" or "Material spec" if Box Type not found
 * Checks both Box Type and Material specs for backward compatibility
 */
export function extractBoxTypeMaterial(group: PartGroup): string {
  // Try Box Type first (new name)
  const boxType = findSpec(group, 'Box Type');
  if (boxType) {
    const material = boxType.values.material || '';
    const colour = boxType.values.colour || '';
    if (material && colour) {
      return `${material}, ${colour}`;
    }
    if (material) return material;
  }

  // Fallback to Material spec (for parts that use Material instead of Box Type)
  const materialSpec = findSpec(group, 'Material');
  if (materialSpec) {
    const substrate = materialSpec.values.substrate || '';
    const colour = materialSpec.values.colour || '';
    if (substrate && colour) {
      return `${substrate}, ${colour}`;
    }
    if (substrate) return substrate;
  }

  return 'Material spec';
}

/**
 * Get cutting method from Cutting spec
 * Returns 'Router', 'Laser', or null if not found
 */
export function getCuttingMethod(group: PartGroup): 'Router' | 'Laser' | null {
  const cutting = findSpec(group, 'Cutting');
  if (!cutting) return null;

  const method = cutting.values.method;
  if (method === 'Router' || method === 'Laser') {
    return method;
  }

  return null;
}

/**
 * Find ALL specs by template name in a part group
 * Returns array of all matching specs (useful when multiple parts have the same spec type)
 */
export function findAllSpecs(group: PartGroup, templateName: string): ParsedSpec[] {
  return group.allSpecs.filter(spec =>
    spec.templateName.toLowerCase() === templateName.toLowerCase()
  );
}
