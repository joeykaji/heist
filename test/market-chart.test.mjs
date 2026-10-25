import test from 'node:test';
import assert from 'node:assert/strict';
import {marketSeries,marketChart} from '../web/market-chart.mjs';
const offer=(id,price,extra={})=>({offerId:id,name:id,symbol:id,label:id,original_cents:price,available:1,priceEvents:[{at:420,price}],cutoff:900,fulfillment_buffer_minutes:5,observedAt:780,...extra});
const state=offers=>({minute:800,policy:{max_count_age_minutes:30},offers});
test('market chart retains distinct fresh batches, confirmed steps and a shared dollar scale',()=>{
 const s=state([offer('first',400,{priceEvents:[{at:420,price:400},{at:790,price:280}]}),offer('fresh',900,{priceEvents:[{at:795,price:900}]})]);
 const series=marketSeries(s);assert.deepEqual(series.map(s=>s.points.map(p=>p.value)),[[400,280],[900]]);
 const html=marketChart(s);assert.match(html,/first/);assert.match(html,/fresh/);assert.match(html,/\$2.80/);assert.match(html,/\$9.00/);assert.match(html,/View exact price changes/);
 assert.deepEqual(marketSeries(s,'change')[0].points.map(p=>Math.round(p.value)),[0,-30]);
});
test('history ends at earliest valid boundary, never includes pending or later prices',()=>{
 const s=state([offer('closed',400,{terminalAt:790,priceEvents:[{at:420,price:400},{at:795,price:200}]}),offer('stale',400,{observedAt:750}),offer('cutoff',400,{cutoff:795}),offer('pending',400,{pending:{review:{price_cents:200}}})]);
 const series=marketSeries(s);assert.deepEqual(series.map(s=>s.end),[790,780,790,800]);assert.equal(series[0].points.length,1);assert.equal(series[3].points[0].value,400);
});
test('empty and coincident-time histories render without invalid geometry or injected markup',()=>{
 assert.match(marketChart(state([])),/No available items with confirmed price history/);
 const s=state([offer('<unsafe>',400,{priceEvents:[{at:800,price:400},{at:800,price:300}]})]);
 const html=marketChart(s);assert.ok(!/NaN|Infinity|<unsafe>/.test(html));assert.match(html,/&lt;unsafe&gt;/);
});
