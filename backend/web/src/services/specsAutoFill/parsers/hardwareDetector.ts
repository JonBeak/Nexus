// File Clean up Finished: Nov 13, 2025
/**
 * Hardware Detector
 * Detects presence of pins, spacers, and rivnuts in calculation displays
 */

/**
 * Detect if calculation display mentions pins, spacers, and rivnuts
 */
export function detectPinsAndSpacers(calculationDisplay: string): {
  hasPins: boolean;
  hasSpacers: boolean;
  hasRivnut: boolean;
  hasStandOffs: boolean;
} {
  const lowerText = calculationDisplay.toLowerCase();
  return {
    hasPins: /\bpins?\b/.test(lowerText),
    hasSpacers: /\bspacers?\b/.test(lowerText),
    hasRivnut: /\b(rivnut|riv-nut|rivnuts)\b/.test(lowerText),
    hasStandOffs: /\bstand\s*offs?\b/.test(lowerText)
  };
}
