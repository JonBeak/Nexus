// File Clean up Finished: Nov 13, 2025
/**
 * Parser Functions Index
 * Central export point for all parser utilities
 */

import { AutoFillInput, ParsedData } from '../types';
import { extractDepth } from './depthParser';
import { extractCount } from './countParser';
import { extractLedType } from './ledTypeParser';
import { detectPinsAndSpacers } from './hardwareDetector';

export { extractDepth } from './depthParser';
export { extractCount } from './countParser';
export { extractLedType } from './ledTypeParser';
export { detectPinsAndSpacers } from './hardwareDetector';
export { extractSubstrateMaterial } from './substrateParser';

/**
 * Parse all available data from input sources
 */
export function parseSourceData(input: AutoFillInput): ParsedData {
  const parsed: ParsedData = {};

  // Extract depth from QB item name
  if (input.qbItemName) {
    parsed.depth = extractDepth(input.qbItemName) || undefined;
  }

  // Extract count and type from calculation display
  if (input.calculationDisplay) {
    parsed.count = extractCount(input.calculationDisplay, input.specsDisplayName) || undefined;

    // For LEDs, extract type
    if (input.specsDisplayName === 'LEDs') {
      parsed.type = extractLedType(input.calculationDisplay) || undefined;
    }

    // Detect pins, spacers, and rivnut
    const detection = detectPinsAndSpacers(input.calculationDisplay);
    parsed.hasPins = detection.hasPins;
    parsed.hasSpacers = detection.hasSpacers;
    parsed.hasRivnut = detection.hasRivnut;
  }

  console.log('[Specs Auto-Fill] Parsed data:', JSON.stringify(parsed, null, 2));
  return parsed;
}
