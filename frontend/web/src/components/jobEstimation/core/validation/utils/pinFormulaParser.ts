/**
 * Pin Formula Parser
 * Parses simple arithmetic formulas for pin calculations
 *
 * Supported operations:
 * - Addition: 50 + 25 → 75
 * - Subtraction: 100 - 20 → 80
 * - Multiplication: 25x9 or 25*9 → 225
 * - Division: 100/4 → 25
 * - Combined: 50 + 25x9 → 275 (multiplication/division before addition/subtraction)
 *
 * Examples:
 * - "50" → 50
 * - "50 + 25" → 75
 * - "25x9" → 225
 * - "50 + 25x9" → 275
 * - "100 - 20 + 5x3" → 95
 */

export interface FormulaParseResult {
  value: number;
  originalFormula: string;
}

/**
 * Token types for lexical analysis
 */
type TokenType = 'NUMBER' | 'PLUS' | 'MINUS' | 'MULTIPLY' | 'DIVIDE' | 'EOF';

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
    // Normalize: remove all whitespace
    this.input = input.replace(/\s+/g, '');
  }

  tokenize(): Token[] {
    this.tokens = [];
    this.position = 0;

    while (this.position < this.input.length) {
      const char = this.input[this.position];

      if (char >= '0' && char <= '9' || char === '.') {
        this.readNumber();
      } else if (char === '+') {
        this.tokens.push({ type: 'PLUS', position: this.position });
        this.position++;
      } else if (char === '-') {
        this.tokens.push({ type: 'MINUS', position: this.position });
        this.position++;
      } else if (char === '*') {
        this.tokens.push({ type: 'MULTIPLY', position: this.position });
        this.position++;
      } else if (char === 'x' || char === 'X') {
        this.tokens.push({ type: 'MULTIPLY', position: this.position });
        this.position++;
      } else if (char === '/') {
        this.tokens.push({ type: 'DIVIDE', position: this.position });
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
    let hasDecimal = false;

    while (this.position < this.input.length) {
      const char = this.input[this.position];

      if (char >= '0' && char <= '9') {
        numStr += char;
        this.position++;
      } else if (char === '.' && !hasDecimal) {
        hasDecimal = true;
        numStr += char;
        this.position++;
      } else {
        break;
      }
    }

    const value = parseFloat(numStr);
    if (isNaN(value)) {
      throw new Error(`Invalid number at position ${start}`);
    }

    this.tokens.push({ type: 'NUMBER', value, position: start });
  }
}

/**
 * Parser - converts token stream to calculated result
 * Implements operator precedence:
 * 1. Multiplication and Division (left to right)
 * 2. Addition and Subtraction (left to right)
 */
class FormulaParser {
  private tokens: Token[];
  private position: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parse the entire formula and return the result
   * Grammar: Expression := Term (('+' | '-') Term)*
   */
  parse(): number {
    let result = this.parseTerm();

    while (this.currentToken().type === 'PLUS' || this.currentToken().type === 'MINUS') {
      const operator = this.currentToken().type;
      this.advance();
      const term = this.parseTerm();

      if (operator === 'PLUS') {
        result += term;
      } else {
        result -= term;
      }
    }

    // Ensure we've consumed all tokens
    if (this.currentToken().type !== 'EOF') {
      throw new Error(`Unexpected token at position ${this.currentToken().position}`);
    }

    return result;
  }

  /**
   * Parse a term (handles multiplication and division)
   * Grammar: Term := Factor (('*' | '/' | 'x') Factor)*
   */
  private parseTerm(): number {
    let result = this.parseFactor();

    while (
      this.currentToken().type === 'MULTIPLY' ||
      this.currentToken().type === 'DIVIDE'
    ) {
      const operator = this.currentToken().type;
      this.advance();
      const factor = this.parseFactor();

      if (operator === 'MULTIPLY') {
        result *= factor;
      } else {
        if (factor === 0) {
          throw new Error('Division by zero');
        }
        result /= factor;
      }
    }

    return result;
  }

  /**
   * Parse a factor (a number)
   * Grammar: Factor := NUMBER
   */
  private parseFactor(): number {
    const token = this.currentToken();

    if (token.type === 'NUMBER') {
      this.advance();
      return token.value!;
    }

    throw new Error(`Expected number at position ${token.position}`);
  }

  /**
   * Get current token without consuming
   */
  private currentToken(): Token {
    return this.tokens[this.position];
  }

  /**
   * Move to next token
   */
  private advance(): void {
    this.position++;
  }
}

/**
 * Parse a pin formula and return the calculated result
 *
 * @param formula - Input formula string (e.g., "50 + 25x9")
 * @returns Parsed result with calculated value
 * @throws Error if formula is invalid
 */
export function parsePinFormula(formula: string): FormulaParseResult {
  if (!formula || formula.trim() === '') {
    throw new Error('Formula cannot be empty');
  }

  const originalFormula = formula.trim();

  // Check if it's just a simple number (optimization)
  const simpleNumber = parseFloat(originalFormula);
  if (!isNaN(simpleNumber) && originalFormula === simpleNumber.toString()) {
    return {
      value: simpleNumber,
      originalFormula
    };
  }

  try {
    // Tokenize
    const tokenizer = new FormulaTokenizer(originalFormula);
    const tokens = tokenizer.tokenize();

    // Parse and evaluate
    const parser = new FormulaParser(tokens);
    const value = parser.parse();

    return {
      value,
      originalFormula
    };
  } catch (error) {
    throw new Error(`Invalid formula: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a string looks like a formula (contains operators)
 * This is a quick heuristic check before attempting to parse
 */
export function looksLikeFormula(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  const normalized = input.trim();

  // Check for arithmetic operators
  return /[+\-*x/]/.test(normalized);
}
