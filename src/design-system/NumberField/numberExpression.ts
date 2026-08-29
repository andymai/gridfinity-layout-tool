/**
 * Evaluates a small arithmetic expression ("42/2", "(1+2)*3", "-4.2") without
 * eval. A number may carry a unit suffix ("42mm", "90°", "42 mm"), which is
 * ignored, and a comma decimal separator ("1,5") reads as a decimal point.
 * Scientific notation ("1e307") parses as a number, not a suffix, so an
 * overflowing exponent still surfaces as Infinity for callers to reject.
 *
 * Returns NaN when the input is not one complete, valid expression. The
 * result may be non-finite (division by zero, exponent overflow) — callers
 * must gate on Number.isFinite, exactly as they did for parseFloat.
 */
export function evaluateNumberExpression(raw: string): number {
  const src = raw;
  let pos = 0;

  const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';

  const skipWs = (): void => {
    while (src[pos] === ' ' || src[pos] === '\t') pos += 1;
  };

  const parseNumber = (): number => {
    const start = pos;
    while (isDigit(src[pos])) pos += 1;
    const intDigits = pos - start;
    let sep = '';
    if (src[pos] === '.' || (src[pos] === ',' && intDigits > 0)) {
      const fracStart = pos + 1;
      if (isDigit(src[fracStart]) || (src[pos] === '.' && intDigits > 0)) {
        sep = src[pos];
        pos += 1;
        while (isDigit(src[pos])) pos += 1;
      }
    }
    if (pos === start || (intDigits === 0 && pos === start + 1)) return NaN;
    let text = src.slice(start, pos);
    if (sep === ',') text = text.replace(',', '.');
    if (src[pos] === 'e' || src[pos] === 'E') {
      const expStart = pos + 1;
      let cursor = expStart;
      if (src[cursor] === '+' || src[cursor] === '-') cursor += 1;
      const digitsFrom = cursor;
      while (isDigit(src[cursor])) cursor += 1;
      if (cursor > digitsFrom) {
        text += src.slice(pos, cursor);
        pos = cursor;
      }
    }
    // Trailing unit ("mm", "°", "%", optionally space-separated) is dropped.
    const beforeSuffix = pos;
    skipWs();
    const suffixStart = pos;
    while (/[A-Za-z°%"'µ]/.test(src[pos] ?? '')) pos += 1;
    if (pos === suffixStart) pos = beforeSuffix;
    return Number(text);
  };

  const parseFactor = (): number => {
    skipWs();
    if (src[pos] === '-') {
      pos += 1;
      return -parseFactor();
    }
    if (src[pos] === '+') {
      pos += 1;
      return parseFactor();
    }
    if (src[pos] === '(') {
      pos += 1;
      const inner = parseExpr();
      skipWs();
      if (src[pos] !== ')') return NaN;
      pos += 1;
      return inner;
    }
    return parseNumber();
  };

  const parseTerm = (): number => {
    let left = parseFactor();
    for (;;) {
      skipWs();
      const op = src[pos];
      if (op === '*' || op === '/') {
        pos += 1;
        const right = parseFactor();
        left = op === '*' ? left * right : left / right;
      } else {
        return left;
      }
    }
  };

  const parseExpr = (): number => {
    let left = parseTerm();
    for (;;) {
      skipWs();
      const op = src[pos];
      if (op === '+' || op === '-') {
        pos += 1;
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
      } else {
        return left;
      }
    }
  };

  const result = parseExpr();
  skipWs();
  return pos === src.length ? result : NaN;
}
