/**
 * Substrate Parser
 * Extracts substrate material name from Substrate Cut calculation displays
 */

/**
 * Extract substrate material from calculation display
 * Pattern: "Acrylic 12mm [24x96]@$370: $281.25" -> "Acrylic 12mm"
 * Pattern: "ACM 3mm [48x96]@$250: $125.00" -> "ACM 3mm"
 * Pattern: "PVC 6mm [36x48]@$180: $90.00" -> "PVC 6mm"
 *
 * The pattern looks for everything before the first '[' character
 * which typically contains the dimensions.
 */
export function extractSubstrateMaterial(calculationDisplay: string): string | null {
  try {
    if (!calculationDisplay) return null;

    // Pattern: <Material> [dimensions]@price
    // Match everything before the first [
    const match = calculationDisplay.match(/^([^[\n]+)\s*\[/);
    if (match) {
      const material = match[1].trim();
      console.log(`[Specs Auto-Fill] Extracted substrate material: "${material}"`);
      return material;
    }
    return null;
  } catch (error) {
    console.error('[Specs Auto-Fill] Error extracting substrate material:', error);
    return null;
  }
}
