import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, candidatePrices, DEFAULT_POLICY } from '../src/domain/decide.mjs';
import Rational from '../src/domain/decimal.mjs';
import {decide as browserDecide} from '../dist/pricing.mjs';
import { batch, scenario } from './fixtures/scenario-pricing.mjs';
test('source engine is deterministic, read-only, and JSON safe', () => {
    const b = batch(), ss = [scenario()], saved = structuredClone({ b, ss });
    Object.freeze(b);
    const a = decide(b, ss);
    assert.equal(a.price_cents, 330);
    assert.equal(a.expected_gain_cents, 720);
    assert.deepEqual(a, decide(b, ss));
    assert.deepEqual({ b, ss }, saved);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
    assert.deepEqual(a.exact.expected_gain_cents, { numerator: '720', denominator: '1' });
    assert.equal(a.rows.find(r => r.price_cents === 600).gates.lower_price, false);
});
test('exact arithmetic distinguishes gains beyond forty decimal places', () => {
    const s = scenario();
    s.other_loss_cents = { 600: '0', 510: '0', 420: '240', 330: '300.00000000000000000000000000000000000000000000000001' };
    const r = decide(batch(), [s]);
    // 510 and 420 gain 420; 330 gains just less than 420. A rounded tie must not select it.
    assert.equal(r.price_cents, 510);
    const low = r.rows.find(x => x.price_cents === 330);
    assert.notEqual(low.exact.expected_gain_cents.denominator, '1');
    // Reverse the tiny advantage: exact gain must beat higher-price tie-breaking.
    s.other_loss_cents[330] = '299.99999999999999999999999999999999999999999999999999';
    assert.equal(decide(batch(), [s]).price_cents, 330);
});
test('rational parsing, ceiling and nonterminating normalization are exact', () => {
    assert.equal(new Rational('.15').times(399).ceil().toNumber(), 60);
    assert.equal(new Rational('-1.2').ceil().toNumber(), -1);
    assert.equal(new Rational('1e-50').plus('1').minus('1').eq('1e-50'), true);
    const r = decide(batch(), [{ ...scenario(), weight: '.3' }, { ...scenario(), weight: '.7000000005' }]);
    assert.deepEqual(r.exact.normalized_weights[0], { numerator: '200000000', denominator: '666666667' });
    assert.throws(() => decide(batch(), [{ ...scenario(), weight: '1.0000000011' }]));
    assert.doesNotThrow(() => decide(batch(), [{ ...scenario(), weight: '1.000000001' }]));
});
test('validation rejects malformed values rather than coercing them or imputing zero', () => {
    for (const key of ['fee_fraction', 'count_age_minutes', 'fulfillment_buffer_minutes'])
        for (const value of [true, false, '', {}, [], NaN, Infinity])
            assert.throws(() => decide({ ...batch(), [key]: value }, [scenario()]));
    for (const key of ['safe_and_approved', 'checkout_supported', 'window_committed'])
        assert.throws(() => decide({ ...batch(), [key]: null }, [scenario()]));
    for (const bad of [null, [], 1, 'batch'])
        assert.throws(() => decide(bad, [scenario()]));
    for (const bad of [null, {}, 'scenarios'])
        assert.throws(() => decide(batch(), bad));
    for (const bad of [null, 1, []])
        assert.throws(() => decide(batch(), [bad]));
    for (const key of ['demand', 'orders', 'other_loss_cents'])
        assert.throws(() => decide(batch(), [{ ...scenario(), [key]: [] }]));
    assert.equal(decide({ ...batch(), fee_fraction: null }, [scenario()]).status, 'REVIEW');
    assert.equal(decide({ ...batch(), safe_and_approved: undefined }, [scenario()]).status, 'PAUSE');
    assert.throws(() => candidatePrices({ ...batch(), fee_fraction: 1 }));
});
test('fractional timing, configured review window and strict boundaries', () => {
    assert.equal(decide({ ...batch(), minutes_to_cutoff: 5 }, [scenario()]).status, 'PAUSE');
    assert.equal(decide({ ...batch(), minutes_to_cutoff: 5.001, count_age_minutes: '30' }, [scenario()]).evaluation_completed, true);
    assert.equal(decide({ ...batch(), count_age_minutes: '30.0001' }, [scenario()]).status, 'PAUSE');
    const r = decide({ ...batch(), minutes_to_cutoff: 60.5 }, [scenario()], { window_minutes: '60.25' });
    assert.equal(r.evaluation_completed, false);
    assert.match(r.reason, /configured/);
    assert.equal(decide(batch(), [scenario()], { max_markdowns: 0 }).evaluation_completed, false);
});
test('downside equality passes and zero expected gain never passes', () => {
    const ss = [{ ...scenario(), weight: '.5' }, { ...scenario(), weight: '.5', demand: { 600: 1, 510: 1, 420: 1, 330: 1 } }];
    const r = decide(batch(), ss, { discounts: ['0', '.45'], downside_budget_cents: 270 });
    assert.equal(r.status, 'MARKDOWN');
    assert.equal(r.worst_gain_cents, -270);
    assert.equal(decide(batch(), ss, { discounts: ['0', '.45'], downside_budget_cents: '269.999' }).status, 'HOLD');
    const s = scenario();
    s.other_loss_cents = { 600: 0, 510: 420, 420: 660, 330: 720 };
    assert.equal(decide(batch(), [s], { min_gain_cents: 0 }).status, 'HOLD');
});
test('rounding deduplicates candidates, rejects prices below floor, and never raises current price', () => {
    const b = { ...batch(), original_cents: 1, current_cents: 1 };
    assert.deepEqual(candidatePrices(b).prices, [1]);
    assert.equal(decide({ ...batch(), current_cents: 300 }, [scenario()]).status, 'PAUSE');
    for (let price = 330; price <= 600; price += 10) {
        const b = { ...batch(), current_cents: price };
        const prices = candidatePrices(b).prices;
        const s = { ...scenario(), demand: Object.fromEntries(prices.map(p => [p, p === price ? 1 : 4])), other_loss_cents: Object.fromEntries(prices.map(p => [p, 0])) };
        const r = decide(b, [s]);
        assert.ok(r.price_cents <= price);
        if (r.status === 'MARKDOWN') {
            assert.ok(r.rows.find(x => x.price_cents === r.price_cents).admissible);
            assert.ok(r.price_cents >= r.floor_cents);
        }
    }
});
test('invalid scenarios are deferred for administrative holds, but validated at comparison', () => {
    const bad = [{ weight: '-1' }];
    assert.equal(decide({ ...batch(), window_committed: true }, bad).evaluation_completed, false);
    assert.equal(decide({ ...batch(), safe_and_approved: false }, bad).status, 'PAUSE');
    assert.throws(() => decide(batch(), bad));
    assert.ok(Object.isFrozen(DEFAULT_POLICY));
    assert.ok(Object.isFrozen(DEFAULT_POLICY.discounts));
});

test('generated browser entry agrees with canonical source', () => {
    for (const b of [batch(), {...batch(), window_committed:true}, {...batch(), fee_fraction:null}, {...batch(), minutes_to_cutoff:5}]) {
        assert.deepEqual(browserDecide(b,[scenario()]),decide(b,[scenario()]));
    }
});
