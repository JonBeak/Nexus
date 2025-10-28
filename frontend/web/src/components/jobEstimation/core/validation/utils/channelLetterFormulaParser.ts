/**
 * Channel Letter Formula Parser
 * Parses calculation formulas like: "48x48*12 + 30*12 + 15 + (30x30)*15"
 *
 * Syntax:
 * - WxH*Q → Q pieces of WxH dimensions (calculates linear inches and LEDs)
 * - N*Q → Q pieces of N linear inches (LEDs calculated from linear inches)
 * - N → 1 piece of N linear inches
 * - (WxH)*Q → Q pieces of WxH dimensions (parentheses for clarity)
 * - Combine with + to add entries
 *
 * Examples:
 * - "48x48*12" → 12 boxes of 48×48"
 * - "30*12" → 12 letters at 30 linear inches each
 * - "15" → 1 letter at 15 linear inches
 * - "48x48*12 + 30*12 + 15" → Combined entries
 */

import { calculateLinearInches, calculateLEDs } from './channelLetterCalculations';

/**
 * Parsed entry representing a single size/quantity combination
 */
export interface ParsedFormulaEntry {
  type: 'dimensions' | 'linear_inches';
  dimensions?: { width: number; height: number };
  linearInches: number;      // Either calculated from dimensions or provided directly
  leds: number;              // Calculated based on dimensions or linear inches
  quantity: number;          // How many of this size
}

/**
 * Complete formula parse result with totals
 */
export interface FormulaParseResult {
  entries: ParsedFormulaEntry[];
  totalLinearInches: number; // Sum of (linearInches × quantity)
  totalPieceCount: number;   // Sum of all quantities
  totalLEDs: number;         // Sum of (leds × quantity)
}

/**
 * Token types for lexical analysis
 */
type TokenType = 'NUMBER' | 'PLUS' | 'MULTIPLY' | 'DIMENSION_X' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
  type: TokenType;
  value?: number;
  position: number;
}

/**
 * Tokenizer - converts input string to token stream
 */
class FormulaTokenizer {
  private input: string;
  private position: number = 0;
  private tokens: Token[] = [];

  constructor(input: string) {
    // Normalize: remove all whitespace outside of numbers
    this.input = input.replace(/\s+/g, '');
  }

  tokenize(): Token[] {
    this.tokens = [];
    this.position = 0;

    while (this.position < this.input.length) {
      const char = this.input[this.position];

      if (char >= '0' && char <= '9') {
        this.readNumber();
      } else if (char === '+') {
        this.tokens.push({ type: 'PLUS', position: this.position });
        this.position++;
      } else if (char === '*') {
        this.tokens.push({ type: 'MULTIPLY', position: this.position });
        this.position++;
      } else if (char === 'x' || char === 'X') {
        this.tokens.push({ type: 'DIMENSION_X', position: this.position });
        this.position++;
      } else if (char === '(') {
        this.tokens.push({ type: 'LPAREN', position: this.position });
        this.position++;
      } else if (char === ')') {
        this.tokens.push({ type: 'RPAREN', position: this.position });
        this.position++;
      } else {
        throw new Error(`Invalid character '${char}' at position ${this.position}`);
      }
    }

    this.tokens.push({ type: 'EOF', position: this.position });
    return this.tokens;
  }

  private readNumber(): void {
    const start = this.position;
    let numStr = '';

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      if (char >= '0' && char <= '9') {
        numStr += char;
        this.position++;
      } else {
        break;
      }
    }

    const value = parseInt(numStr, 10);
    if (isNaN(value)) {
      throw new Error(`Invalid number at position ${start}`);
    }

    this.tokens.push({ type: 'NUMBER', value, position: start });
  }
}

/**
 * Parser - converts token stream to parsed entries
 */
class FormulaParser {
  private tokens: Token[];
  private position: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parse the entire formula
   * Grammar: Formula := Term ('+' Term)*
   */
  parse(): ParsedFormulaEntry[] {
    const entries: ParsedFormulaEntry[] = [];

    // Parse first term
    entries.push(this.parseTerm());

    // Parse additional terms separated by +
    while (this.currentToken().type === 'PLUS') {
      this.consume('PLUS');
      entries.push(this.parseTerm());
    }

    // Ensure we've consumed all tokens
    if (this.currentToken().type !== 'EOF') {
      throw new Error(`Unexpected token at position ${this.currentToken().position}`);
    }

    return entries;
  }

  /**
   * Parse a term (factor with optional multiplier)
   * Grammar: Term := Factor ('*' Quantity)?
   */
  private parseTerm(): ParsedFormulaEntry {
    const factor = this.parseFactor();
    let quantity = 1;

    // Check for quantity multiplier (e.g., *12)
    if (this.currentToken().type === 'MULTIPLY') {
      this.consume('MULTIPLY');
      const quantityToken = this.consume('NUMBER');
      quantity = quantityToken.value!;

      if (quantity <= 0 || !Number.isInteger(quantity)) {
        throw new Error(`Quantity must be a positive integer, got ${quantity}`);
      }
    }

    return {
      ...factor,
      quantity
    };
  }

  /**
   * Parse a factor (number, dimensions, or parenthesized dimensions)
   * Grammar: Factor := NUMBER | Dimensions | '(' Dimensions ')'
   */
  private parseFactor(): Omit<ParsedFormulaEntry, 'quantity'> {
    const token = this.currentToken();

    // Handle parenthesized dimensions: (WxH)
    if (token.type === 'LPAREN') {
      this.consume('LPAREN');
      const dimensions = this.parseDimensions();
      this.consume('RPAREN');
      return dimensions;
    }

    // Handle number (could be dimensions or linear inches)
    if (token.type === 'NUMBER') {
      const firstNumber = this.consume('NUMBER').value!;

      // Check if it's dimensions (WxH)
      if (this.currentToken().type === 'DIMENSION_X') {
        this.consume('DIMENSION_X');
        const secondNumber = this.consume('NUMBER').value!;

        // Calculate linear inches and LEDs for dimensions
        const width = firstNumber;
        const height = secondNumber;
        const linearInches = calculateLinearInches(width, height);
        const leds = calculateLEDs(width, height, linearInches);

        return {
          type: 'dimensions',
          dimensions: { width, height },
          linearInches,
          leds,
          quantity: 1 // Will be overridden by parseTerm if multiplier exists
        };
      }

      // It's a single linear inch value
      // For linear inches input, we need to calculate LEDs
      // We'll assume square dimensions for LED calculation (conservative estimate)
      const linearInches = firstNumber;
      const leds = this.calculateLEDsForLinearInches(linearInches);

      return {
        type: 'linear_inches',
        linearInches,
        leds,
        quantity: 1 // Will be overridden by parseTerm if multiplier exists
      };
    }

    throw new Error(`Expected number or '(' at position ${token.position}`);
  }

  /**
   * Parse dimensions (WxH) - assumes LPAREN already consumed
   */
  private parseDimensions(): Omit<ParsedFormulaEntry, 'quantity'> {
    const width = this.consume('NUMBER').value!;
    this.consume('DIMENSION_X');
    const height = this.consume('NUMBER').value!;

    const linearInches = calculateLinearInches(width, height);
    const leds = calculateLEDs(width, height, linearInches);

    return {
      type: 'dimensions',
      dimensions: { width, height },
      linearInches,
      leds,
      quantity: 1 // Will be overridden by parseTerm if multiplier exists
    };
  }

  /**
   * Calculate LEDs for a given linear inches value
   * When we only have linear inches (not dimensions), we use the small letter formula
   * or estimate dimensions based on 2:1 aspect ratio
   */
  private calculateLEDsForLinearInches(linearInches: number): number {
    if (linearInches < 11) {
      // Small letters: use the simple formula
      return Math.round(0.6121 * linearInches + 0.9333);
    } else {
      // For larger sizes without dimensions, assume 2:1 aspect ratio
      // (e.g., 20" → 20x10, 24" → 24x12, 30" → 30x15)
      const estimatedWidth = linearInches;
      const estimatedHeight = linearInches * 0.50;

      return calculateLEDs(estimatedWidth, estimatedHeight, linearInches);
    }
  }

  /**
   * Get current token without consuming
   */
  private currentToken(): Token {
    return this.tokens[this.position];
  }

  /**
   * Consume a token of expected type
   */
  private consume(expectedType: TokenType): Token {
    const token = this.currentToken();
    if (token.type !== expectedType) {
      throw new Error(
        `Expected ${expectedType} but got ${token.type} at position ${token.position}`
      );
    }
    this.position++;
    return token;
  }
}

/**
 * Parse a channel letter formula and return structured data with totals
 *
 * @param formula - Input formula string (e.g., "48x48*12 + 30*12 + 15")
 * @returns Parsed entries with calculated totals
 * @throws Error if formula is invalid
 */
export function parseChannelLetterFormula(formula: string): FormulaParseResult {
  if (!formula || formula.trim() === '') {
    throw new Error('Formula cannot be empty');
  }

  // Tokenize
  const tokenizer = new FormulaTokenizer(formula);
  const tokens = tokenizer.tokenize();

  // Parse
  const parser = new FormulaParser(tokens);
  const entries = parser.parse();

  // Calculate totals
  let totalLinearInches = 0;
  let totalPieceCount = 0;
  let totalLEDs = 0;

  for (const entry of entries) {
    totalLinearInches += entry.linearInches * entry.quantity;
    totalPieceCount += entry.quantity;
    totalLEDs += entry.leds * entry.quantity;
  }

  return {
    entries,
    totalLinearInches,
    totalPieceCount,
    totalLEDs
  };
}

/**
 * Check if a string looks like a formula (contains formula operators)
 * This is a quick heuristic check before attempting to parse
 */
export function looksLikeFormula(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  const normalized = input.trim();

  // Check for formula operators: x (dimensions), + (addition), * (multiplication), parentheses
  // But exclude the grouped format separator ". . . . . "
  if (normalized.includes('. . . . . ')) {
    return false; // This is the grouped format, not a formula
  }

  // Must contain at least one formula operator
  return /[x\+\*\(\)]/.test(normalized);
}
