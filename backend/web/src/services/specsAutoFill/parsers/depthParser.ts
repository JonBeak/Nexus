// File Clean up Finished: Nov 13, 2025
/**
 * Depth Parser
 * Extracts depth values from QB item names
 */

/**
 * Extract depth from QB item name
 * Pattern: "3\" Front Lit" → "3\""
 */
export function extractDepth(qbItemName: string): string | null {
  try {
    const match = qbItemName.match(/^(\d+["'])/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('[Specs Auto-Fill] Error extracting depth:', error);
    return null;
  }
}
