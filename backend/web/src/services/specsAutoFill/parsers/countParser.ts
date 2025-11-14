// File Clean up Finished: Nov 13, 2025
/**
 * Count Parser
 * Extracts quantity counts from calculation displays
 */

/**
 * Extract count from calculation display
 * Pattern: "105 @ $1.75" → 105
 * Pattern: "Pins + Spacer: 15 @ $2/each" → 15
 */
export function extractCount(calculationDisplay: string, componentType?: string): number | null {
  try {
    // Check if calculationDisplay contains pins/spacers keywords
    const lowerCalc = calculationDisplay.toLowerCase();
    const hasPinsKeyword = /\bpins?\b/.test(lowerCalc) || /\bspacers?\b/.test(lowerCalc);

    // For pins/spacers, look for the pattern with colon (e.g., "Pins + Spacer: 15 @ $2/each")
    if (hasPinsKeyword || (componentType && (componentType.toLowerCase().includes('pin') || componentType.toLowerCase().includes('spacer')))) {
      const colonMatch = calculationDisplay.match(/:\s*(\d+)\s*@/);
      if (colonMatch) {
        return parseInt(colonMatch[1], 10);
      }
    }

    // For LEDs and other components, look at the start
    const match = calculationDisplay.match(/^(\d+)\s*@/);
    return match ? parseInt(match[1], 10) : null;
  } catch (error) {
    console.error('[Specs Auto-Fill] Error extracting count:', error);
    return null;
  }
}
