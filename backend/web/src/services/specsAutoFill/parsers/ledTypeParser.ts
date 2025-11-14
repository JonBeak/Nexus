// File Clean up Finished: Nov 13, 2025
/**
 * LED Type Parser
 * Extracts LED type information from calculation displays
 */

/**
 * Extract LED type from calculation display
 * Pattern: "105 @ $1.75, Interone 9K" → "Interone 9K"
 */
export function extractLedType(calculationDisplay: string): string | null {
  try {
    const match = calculationDisplay.match(/,\s*(.+)$/);
    return match ? match[1].trim() : null;
  } catch (error) {
    console.error('[Specs Auto-Fill] Error extracting LED type:', error);
    return null;
  }
}
