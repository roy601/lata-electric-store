/**
 * Safe arithmetic for the assistant's `calculate` tool — so the model never
 * does maths "in its head". Supports + - * / % ^, parentheses, unary minus
 * and decimals. No eval, no identifiers.
 */
const calculate = (expr) => {
  const src = String(expr ?? '').replace(/,/g, '').replace(/৳/g, '');
  if (src.length > 300) throw new Error('Expression too long.');
  const tokens = src.match(/\d+(?:\.\d+)?|[-+*/%^()]|\S/g) || [];
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  // expr := term (('+'|'-') term)*
  const parseExpr = () => {
    let v = parseTerm();
    while (peek() === '+' || peek() === '-') v = next() === '+' ? v + parseTerm() : v - parseTerm();
    return v;
  };
  // term := unary (('*'|'/'|'%') unary)*
  const parseTerm = () => {
    let v = parseUnary();
    while (['*', '/', '%'].includes(peek())) {
      const op = next(), r = parseUnary();
      if ((op === '/' || op === '%') && r === 0) throw new Error('Division by zero.');
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  };
  // unary := ('-'|'+') unary | power      (so -2^2 = -(2^2) = -4)
  const parseUnary = () => {
    if (peek() === '-') { next(); return -parseUnary(); }
    if (peek() === '+') { next(); return parseUnary(); }
    return parsePower();
  };
  // power := atom ('^' unary)?             (right-associative)
  const parsePower = () => {
    const base = parseAtom();
    return peek() === '^' ? (next(), Math.pow(base, parseUnary())) : base;
  };
  const parseAtom = () => {
    const t = next();
    if (t === '(') {
      const v = parseExpr();
      if (next() !== ')') throw new Error('Missing ")".');
      return v;
    }
    if (t !== undefined && /^\d/.test(t)) return parseFloat(t);
    throw new Error(`Unexpected "${t ?? 'end of expression'}".`);
  };

  const result = parseExpr();
  if (pos < tokens.length) throw new Error(`Unexpected "${tokens[pos]}".`);
  if (!Number.isFinite(result)) throw new Error('Result is not a finite number.');
  return Math.round(result * 1e6) / 1e6;
};

module.exports = { calculate };
