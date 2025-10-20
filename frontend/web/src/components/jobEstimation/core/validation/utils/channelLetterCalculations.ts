/**
 * Channel Letter Calculation Functions
 * Pure math functions for calculating linear inches and LED counts
 * Used by formula parser for rectangular letter dimensions
 */

/**
 * Calculate linear inches for a rectangular channel letter
 *
 * Formula has 2 main conditions:
 * 1. For long, thin shapes (aspect ratio > 4:1 AND dimension ≥ 15"):
 *    linear_inches = MAX(perimeter ÷ 3.75, area ÷ 20)
 *
 * 2. Default case (solid, normal aspect ratio):
 *    linear_inches = MAX(width, height, area ÷ 20)
 *
 * Post-processing rounds up small sizes:
 * 1-2" → 5", 3" → 6", 4" → 7", 5" → 8", 6-7" → 9", 8-9" → 10"
 */
export function calculateLinearInches(width: number, height: number): number {
  const w = Math.abs(width);
  const h = Math.abs(height);
  const area = w * h;
  const perimeter = 2 * (w + h);

  // Condition 1: Long/thin shape?
  // (w > 14 OR h > 14) AND (w/h > 4 OR h/w > 4)
  const isLongThin = (w > 14 || h > 14) && (w / h > 4 || h / w > 4);

  let linearInches: number;

  if (isLongThin) {
    // Long thin shape: use perimeter-based or area-based
    linearInches = Math.max(perimeter / 3.75, area / 20);
  } else {
    // Default: solid rectangle
    linearInches = Math.max(w, h, area / 20);
  }

  // Post-processing: round up small sizes
  if (linearInches <= 2) return 5;
  if (linearInches <= 3) return 6;
  if (linearInches <= 4) return 7;
  if (linearInches <= 5) return 8;
  if (linearInches <= 7) return 9;
  if (linearInches <= 9) return 10;

  return Math.round(linearInches);
}

/**
 * Calculate LED count for a rectangular channel letter
 *
 * Two formulas based on size:
 *
 * For Small Letters (linear_inches < 11):
 *   LEDs = ROUND(0.6121 × linear_inches + 0.9333)
 *
 * For Larger Letters (linear_inches ≥ 11):
 *   LEDs = CEIL(MAX(
 *     area × 8.5 ÷ 144,           // 8.5 LEDs per square foot
 *     (perimeter ÷ 2) ÷ 3.5       // 1 LED per 3.5" of half-perimeter
 *   ))
 */
export function calculateLEDs(width: number, height: number, linearInches: number): number {
  const w = Math.abs(width);
  const h = Math.abs(height);

  if (linearInches < 11) {
    // Small letters: simple formula
    return Math.round(0.6121 * linearInches + 0.9333);
  } else {
    // Larger letters: use area-based OR perimeter-based (whichever is higher)
    const area = w * h;
    const perimeter = 2 * (w + h);

    const areaBasedLEDs = (area * 8.5) / 144;  // 8.5 LEDs per square foot
    const perimeterBasedLEDs = (perimeter / 2) / 3.5;  // 1 LED per 3.5" of half-perimeter

    return Math.ceil(Math.max(areaBasedLEDs, perimeterBasedLEDs));
  }
}
