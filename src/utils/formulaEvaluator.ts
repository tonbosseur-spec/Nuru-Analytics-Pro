/**
 * Safe expression parser & evaluator for custom mathematical formulas.
 * Supports standard algebraic hierarchy, parenthesis, variables, math constants (pi, e),
 * and basic scientific functions (sqrt, ln, log, abs, exp, sin, cos, tan).
 * Handles both dot and French comma decimal formats (e.g. 2,5 -> 2.5).
 */

export function evaluateMathExpr(expr: string): number {
  // Remove whitespace
  const s = expr.replace(/\s+/g, '');
  if (!s) return NaN;

  let pos = 0;

  function peek(): string {
    return pos < s.length ? s[pos] : '';
  }

  function consume(char: string): boolean {
    if (peek() === char) {
      pos++;
      return true;
    }
    return false;
  }

  function parseExpression(): number {
    let val = parseTerm();
    while (true) {
      if (consume('+')) {
        val += parseTerm();
      } else if (consume('-')) {
        val -= parseTerm();
      } else {
        break;
      }
    }
    return val;
  }

  function parseTerm(): number {
    let val = parseFactor();
    while (true) {
      if (consume('*')) {
        val *= parseFactor();
      } else if (consume('/')) {
        const div = parseFactor();
        val = div !== 0 ? (val / div) : NaN;
      } else {
        break;
      }
    }
    return val;
  }

  function parseFactor(): number {
    if (consume('-')) {
      return -parseFactor();
    }
    if (consume('+')) {
      return parseFactor();
    }

    if (consume('(')) {
      const val = parseExpression();
      consume(')');
      return val;
    }

    // Parse numbers, letters (functions or constants)
    const start = pos;
    const next = peek();

    if (/[a-zA-Z]/.test(next)) {
      while (pos < s.length && /[a-zA-Z0-9]/.test(s[pos])) {
        pos++;
      }
      const symbol = s.substring(start, pos).toLowerCase();

      // Constants
      if (symbol === 'pi') return Math.PI;
      if (symbol === 'e') return Math.E;

      // Function calls
      if (consume('(')) {
        const arg = parseExpression();
        consume(')');
        switch (symbol) {
          case 'sqrt': return Math.sqrt(arg);
          case 'log':
          case 'ln': return Math.log(arg);
          case 'log10': return Math.log10(arg);
          case 'abs': return Math.abs(arg);
          case 'exp': return Math.exp(arg);
          case 'sin': return Math.sin(arg);
          case 'cos': return Math.cos(arg);
          case 'tan': return Math.tan(arg);
          default: return NaN;
        }
      }
      return NaN;
    }

    // Standard number parsing
    while (pos < s.length && /[0-9.]/.test(s[pos])) {
      pos++;
    }
    const numStr = s.substring(start, pos);
    return numStr ? parseFloat(numStr) : NaN;
  }

  return parseExpression();
}

function getNumericValue(val: any): number {
  if (val === undefined || val === null || val === '') return NaN;
  if (typeof val === 'number') return val;
  // Handle French comma notation
  const cleanStr = String(val).replace(',', '.').trim();
  const parsed = parseFloat(cleanStr);
  return parsed;
}

/**
 * Evaluates a math formula string for a specific row by replacing column names with value.
 */
export function evaluateFormulaForRow(
  formulaStr: string,
  row: Record<string, any>,
  availableCols: string[]
): number | null {
  try {
    // 1. Handle comma decimals, e.g. "2,5" -> "2.5" between digits
    let processed = formulaStr.replace(/(\d+),(\d+)/g, "$1.$2");

    // 2. Handle bracketed column names [Column Name] - prioritizes perfect matches and avoids spaces collision
    for (const col of availableCols) {
      const bracketed = `[${col}]`;
      if (processed.includes(bracketed)) {
        const val = getNumericValue(row[col]);
        if (isNaN(val)) return null;
        // Negative values wrapped securely in parenthesis
        const valStr = val < 0 ? `(${val})` : `${val}`;
        processed = processed.replaceAll(bracketed, valStr);
      }
    }

    // 3. Handle raw bare column names (e.g. Var3)
    // Sort columns by length descending to prevent sub-string name collision (e.g. replacing Var33 as Var3)
    const sortedCols = [...availableCols].sort((a, b) => b.length - a.length);
    for (const col of sortedCols) {
      // Escape for RegExp safety
      const escaped = col.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Match boundaries, excluding if bracketed
      const regex = new RegExp(`\\b${escaped}\\b`, 'g');
      if (regex.test(processed)) {
        // Make sure it wasn't already parsed as part of brackets
        const val = getNumericValue(row[col]);
        if (isNaN(val)) return null;
        const valStr = val < 0 ? `(${val})` : `${val}`;
        processed = processed.replace(regex, valStr);
      }
    }

    const finalVal = evaluateMathExpr(processed);
    return isNaN(finalVal) || !isFinite(finalVal) ? null : finalVal;
  } catch (err) {
    console.error("Error evaluating formula with config:", formulaStr, row, err);
    return null;
  }
}
