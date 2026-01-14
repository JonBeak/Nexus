// File Clean up Finished: Nov 13, 2025
/**
 * Count Parser
 * Extracts quantity counts from calculation displays
 */

/**
 * Extract count from calculation display
 * Pattern: "105 @ $1.75" → 105
 * Pattern: "Pins + Spacer: 15 @ $2/each" → 15
 * Pattern: "104 Pins + Rivnut + Spacer @ $3/ea: $312" → 104 (Substrate Cut format)
 * Pattern: "50 Stand Offs @ $3/ea: $150" → 50
 */
export function extractCount(calculationDisplay: string, componentType?: string): number | null {
  try {
    // Check if calculationDisplay contains mounting hardware keywords
    const lowerCalc = calculationDisplay.toLowerCase();
    const hasHardwareKeyword = /\bpins?\b/.test(lowerCalc) || /\bspacers?\b/.test(lowerCalc) || /\bstand\s*offs?\b/.test(lowerCalc);

    // For mounting hardware, try multiple patterns
    if (hasHardwareKeyword || (componentType && (componentType.toLowerCase().includes('pin') || componentType.toLowerCase().includes('spacer') || componentType.toLowerCase().includes('stand')))) {
      // Pattern 1: Substrate Cut format - "104 Pins + ..." or "50 Stand Offs..." at start of line
      // Matches: Pins, Pin, Stand Offs, Stand Off, StandOffs
      const substrateMatch = calculationDisplay.match(/^(\d+)\s+(?:Pins?|Stand\s*Offs?)\b/im);
      if (substrateMatch) {
        console.log(`[Specs Auto-Fill] Extracted count from Substrate Cut format: ${substrateMatch[1]}`);
        return parseInt(substrateMatch[1], 10);
      }

      // Pattern 2: Colon format - "Pins + Spacer: 15 @ $2/each"
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
