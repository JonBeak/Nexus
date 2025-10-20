import { parseChannelLetterFormula, looksLikeFormula, FormulaParseResult } from './channelLetterFormulaParser';

export interface ChannelLetterPair {
  linearInches: number;
  leds: number;
}

export interface ChannelLetterMetrics {
  pairs: ChannelLetterPair[];
  totalWidth: number;
  totalPerimeter: number;
  ledCount: number;
  pieceCount?: number; // Total piece count (for formulas)
}

export type ChannelLetterInput =
  | { type: 'pairs'; pairs: ChannelLetterPair[] }
  | { type: 'float'; value: number }
  | { type: 'formula'; result: FormulaParseResult };

const GROUP_SEPARATOR_REGEX = /\.\s+\.\s+\.\s+\.\s+\.\s+/;
const CANONICAL_GROUP_SEPARATOR = '. . . . . ';
const PLACEHOLDER_CHANNEL_LETTER_METRICS: ChannelLetterMetrics = {
  pairs: [],
  totalWidth: 0,
  totalPerimeter: 0,
  ledCount: 0,
  pieceCount: 0
};

/**
 * Parse channel letter input field into grouped format, formula, or float value.
 * Priority:
 * 1. Grouped format (e.g., "10, . . . . . 6,") - most specific pattern
 * 2. Formula format (e.g., "48x48*12 + 30*12") - NEW!
 * 3. Float format (e.g., "32") - fallback
 */
export function parseChannelLetterInput(rawValue: string | undefined | null): ChannelLetterInput | null {
  if (!rawValue) {
    return null;
  }

  const value = rawValue.trim();
  if (value === '') {
    return null;
  }

  // PRIORITY 1: Try grouped format first (most specific pattern)
  // Format: "10, . . . . . 6," (linear inches, separator, LED counts)
  if (GROUP_SEPARATOR_REGEX.test(value)) {
    const normalizedValue = value.replace(GROUP_SEPARATOR_REGEX, CANONICAL_GROUP_SEPARATOR);
    const [widthGroupRaw, heightGroupRaw, ...extra] = normalizedValue.split(CANONICAL_GROUP_SEPARATOR);
    if (!widthGroupRaw || !heightGroupRaw || extra.length > 0) {
      return null;
    }

    const parseGroup = (group: string): number[] =>
      group
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => parseFloat(part))
        .filter(num => isFinite(num));

    const linearInches = parseGroup(widthGroupRaw);
    const ledCounts = parseGroup(heightGroupRaw);

    if (!linearInches.length || linearInches.length !== ledCounts.length) {
      return null;
    }

    const pairs = linearInches.map((widthValue, index) => ({
      linearInches: widthValue,
      leds: ledCounts[index]
    }));
    return { type: 'pairs', pairs };
  }

  // PRIORITY 2: Try formula format (NEW!)
  // Format: "48x48*12 + 30*12 + 15" (dimension calculations)
  if (looksLikeFormula(value)) {
    try {
      const result = parseChannelLetterFormula(value);
      return { type: 'formula', result };
    } catch (error) {
      // Formula parsing failed - will fall through to float check
      console.warn('Formula parsing failed:', error.message);
    }
  }

  // PRIORITY 3: Float fallback
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const floatValue = parseFloat(value);
    if (isFinite(floatValue)) {
      return { type: 'float', value: floatValue };
    }
  }

  return null;
}

/**
 * Calculate LED-related metrics from channel letter input.
 */
export function calculateChannelLetterMetrics(rawValue: string | undefined | null): ChannelLetterMetrics | null {
  const parsed = parseChannelLetterInput(rawValue);
  if (!parsed) {
    return PLACEHOLDER_CHANNEL_LETTER_METRICS;
  }

  if (parsed.type === 'pairs') {
    const totalLinearInches = parsed.pairs.reduce((sum, pair) => sum + pair.linearInches, 0);
    const totalLedCount = parsed.pairs.reduce((sum, pair) => sum + pair.leds, 0);

    return {
      pairs: parsed.pairs,
      totalWidth: totalLinearInches,
      totalPerimeter: totalLinearInches,
      ledCount: totalLedCount,
      pieceCount: parsed.pairs.length
    };
  }

  if (parsed.type === 'formula') {
    // Formula provides complete metrics including piece count
    const { totalLinearInches, totalLEDs, totalPieceCount, entries } = parsed.result;

    // Convert formula entries to pairs format for compatibility
    // Each entry with quantity > 1 needs to be expanded into multiple pairs
    // For example: 30*12 should create 12 pairs of (30", X LEDs)
    const pairs: ChannelLetterPair[] = [];
    for (const entry of entries) {
      for (let i = 0; i < entry.quantity; i++) {
        pairs.push({
          linearInches: entry.linearInches,  // Individual letter size
          leds: entry.leds                    // Individual LED count
        });
      }
    }

    return {
      pairs,
      totalWidth: totalLinearInches,
      totalPerimeter: totalLinearInches,
      ledCount: totalLEDs,
      pieceCount: totalPieceCount
    };
  }

  if (parsed.type === 'float') {
    const value = Math.max(0, parsed.value);
    return {
      pairs: [],
      totalWidth: value,
      totalPerimeter: value,
      ledCount: value,
      pieceCount: 1
    };
  }

  return PLACEHOLDER_CHANNEL_LETTER_METRICS;
}

export { PLACEHOLDER_CHANNEL_LETTER_METRICS };
