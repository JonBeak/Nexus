export interface ChannelLetterPair {
  linearInches: number;
  leds: number;
}

export interface ChannelLetterMetrics {
  pairs: ChannelLetterPair[];
  totalWidth: number;
  totalPerimeter: number;
  ledCount: number;
}

export type ChannelLetterInput =
  | { type: 'pairs'; pairs: ChannelLetterPair[] }
  | { type: 'float'; value: number };

const GROUP_SEPARATOR_REGEX = /\.\s+\.\s+\.\s+\.\s+\.\s+/;
const CANONICAL_GROUP_SEPARATOR = '. . . . . ';
const PLACEHOLDER_CHANNEL_LETTER_METRICS: ChannelLetterMetrics = {
  pairs: [],
  totalWidth: 0,
  totalPerimeter: 0,
  ledCount: 0
};

/**
 * Parse channel letter input field into either paired dimensions (new grouped format) or a float value.
 */
export function parseChannelLetterInput(rawValue: string | undefined | null): ChannelLetterInput | null {
  if (!rawValue) {
    return null;
  }

  const value = rawValue.trim();
  if (value === '') {
    return null;
  }

  // Reject legacy "WxH" formatting explicitly
  if (/[xX]/.test(value)) {
    return null;
  }

  // New format: list of widths, separator, list of heights (each value ending with comma)
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

  // Float fallback
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
      ledCount: totalLedCount
    };
  }

  if (parsed.type === 'float') {
    const value = Math.max(0, parsed.value);
    return {
      pairs: [],
      totalWidth: value,
      totalPerimeter: value,
      ledCount: value
    };
  }

  return PLACEHOLDER_CHANNEL_LETTER_METRICS;
}

export { PLACEHOLDER_CHANNEL_LETTER_METRICS };
