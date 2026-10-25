/** Exact rational arithmetic. Decimal strings never pass through binary floats. */
const gcd = (a, b) => { while (b)
    [a, b] = [b, a % b]; return a < 0n ? -a : a; };
export default class Rational {
    constructor(value, denominator) {
        if (value instanceof Rational) {
            this.a = value.a;
            this.b = value.b;
            return;
        }
        if (denominator !== undefined) {
            this.a = BigInt(value);
            this.b = BigInt(denominator);
        }
        else {
            if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint')
                throw new Error('Expected decimal');
            if (typeof value === 'number' && !Number.isFinite(value))
                throw new Error('Expected finite decimal');
            const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value).replace(/^([+-]?)\./, '$10.'));
            if (!match)
                throw new Error('Invalid decimal');
            const exponent = Number(match[4] || 0) - (match[3] || '').length;
            if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000)
                throw new Error('Decimal exponent too large');
            this.a = BigInt((match[1] === '-' ? '-' : '') + match[2] + (match[3] || '')) * 10n ** BigInt(Math.max(exponent, 0));
            this.b = 10n ** BigInt(Math.max(-exponent, 0));
        }
        if (!this.b)
            throw new Error('Division by zero');
        if (this.b < 0n) {
            this.a = -this.a;
            this.b = -this.b;
        }
        const g = gcd(this.a, this.b);
        this.a /= g;
        this.b /= g;
    }
    plus(x) { x = new Rational(x); return new Rational(this.a * x.b + x.a * this.b, this.b * x.b); }
    minus(x) { return this.plus(new Rational(x).negated()); }
    times(x) { x = new Rational(x); return new Rational(this.a * x.a, this.b * x.b); }
    div(x) { x = new Rational(x); return new Rational(this.a * x.b, this.b * x.a); }
    negated() { return new Rational(-this.a, this.b); }
    abs() { return this.a < 0n ? this.negated() : this; }
    cmp(x) { x = new Rational(x); const d = this.a * x.b - x.a * this.b; return d < 0n ? -1 : d > 0n ? 1 : 0; }
    gt(x) { return this.cmp(x) > 0; }
    gte(x) { return this.cmp(x) >= 0; }
    lt(x) { return this.cmp(x) < 0; }
    lte(x) { return this.cmp(x) <= 0; }
    eq(x) { return this.cmp(x) === 0; }
    isZero() { return this.a === 0n; }
    isFinite() { return true; }
    ceil() { return new Rational(this.a / this.b + (this.a > 0n && this.a % this.b ? 1n : 0n)); }
    toNumber() {
        // Scale before converting so very long exact fractions do not become Infinity/Infinity.
        if (!this.a)
            return 0;
        const sign = this.a < 0n ? -1 : 1, a = this.a < 0n ? -this.a : this.a;
        const shift = 18 + this.b.toString().length - a.toString().length;
        const digits = shift >= 0 ? a * 10n ** BigInt(shift) / this.b : a / (this.b * 10n ** BigInt(-shift));
        return sign * Number(`${digits}e${-shift}`);
    }
    /** Exact JSON-safe audit representation, including nonterminating normalized weights. */
    toJSON() { return { numerator: String(this.a), denominator: String(this.b) }; }
    static max(...xs) { return xs.map(x => new Rational(x)).reduce((a, b) => a.gte(b) ? a : b); }
    static min(...xs) { return xs.map(x => new Rational(x)).reduce((a, b) => a.lte(b) ? a : b); }
}
