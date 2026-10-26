import test from 'node:test';
import assert from 'node:assert/strict';
import {dynamicPrice} from '../src/domain/dynamic.mjs';
import {initialState,defaultSettings,advance,sell,validState,evaluateBatch,executeDemoDecision,validateSettings,migrateState} from '../dist/model.mjs';
import {chartSamples} from '../web/price-history.mjs';
import {marketChart} from '../web/market-chart.mjs';
const batch=()=>({label:'Test',original_cents:1000,current_cents:800,physical_units:10,reference_units:10,reserved_units:0,protected_units:0,buffer_units:0,fee_fraction:'0',sale_cost_cents:100,order_fee_cents:0,merchant_floor_cents:1,min_unit_contribution_cents:25,minutes_to_cutoff:30,fulfillment_buffer_minutes:5,count_age_minutes:0,safe_and_approved:true,checkout_supported:true,surplus_eligible:true,economics_reviewed:true});
test('all documented review intervals work and prices hold between reviews',()=>{
 assert.equal(defaultSettings().pricing.reviewMinutes,30);
 for(const reviewMinutes of [5,30,60]){
  const cfg=defaultSettings();cfg.pricing.reviewMinutes=reviewMinutes;cfg.traffic.inPerson=0;cfg.traffic.mobile=0;
  assert.equal(validateSettings(cfg),true);
  let s=initialState('opening',cfg);const price=s.batches[0].current_cents;
  s=advance(s,reviewMinutes-1);assert.equal(s.batches[0].current_cents,price);
  s=advance(s,1);assert.ok(s.batches[0].current_cents<price);assert.ok(validState(s));
 }
 const cfg=defaultSettings();cfg.pricing.reviewMinutes=15;assert.throws(()=>validateSettings(cfg),/5, 30, or 60/);
});
test('saved 15-minute plans migrate without losing inventory or confirmed prices',()=>{
 const legacy=advance(initialState('opening'),70);legacy.settings.pricing.reviewMinutes=15;
 const before=structuredClone(legacy),migrated=migrateState(legacy);
 assert.ok(validState(migrated));assert.equal(migrated.settings.pricing.reviewMinutes,5);
 const expected=structuredClone(before);expected.settings.pricing.reviewMinutes=5;
 assert.deepEqual(migrated,expected);assert.deepEqual(legacy,before);
});
test('published document examples match confirmed prices and targets',()=>{
 const common={...batch(),original_cents:1000,current_cents:1000,reference_units:20,physical_units:10,minutes_to_cutoff:60,sale_window_minutes:120,merchant_floor_cents:600};
 const halfway=dynamicPrice(common);assert.equal(halfway.target_cents,888);assert.equal(halfway.price_cents,950);
 const recovery=dynamicPrice({...common,physical_units:4,minutes_to_cutoff:30,current_cents:880});assert.equal(recovery.target_cents,933);assert.equal(recovery.price_cents,930);
 const nearClosing=dynamicPrice({...common,physical_units:1,minutes_to_cutoff:6,current_cents:930});assert.equal(nearClosing.target_cents,979);assert.equal(nearClosing.price_cents,979);
 const costs=dynamicPrice({...common,sale_cost_cents:600,order_fee_cents:20,min_unit_contribution_cents:50,fee_fraction:'0.03',merchant_floor_cents:700});assert.equal(costs.floor_cents,700);
 const override=dynamicPrice({...common,current_cents:900,merchant_floor_cents:960});assert.equal(override.price_cents,960);
});
test('stock/time target falls with time and recovers after sales, bounded per adjustment',()=>{
 const b=batch(),r=dynamicPrice(b);assert.equal(r.status,'MARKDOWN');assert.equal(r.price_cents,750);
 const recovery=dynamicPrice({...b,physical_units:2});assert.equal(recovery.status,'INCREASE');assert.equal(recovery.price_cents,850);
 assert.ok(dynamicPrice({...b,minutes_to_cutoff:60}).target_cents>r.target_cents);
 assert.equal(dynamicPrice({...b,merchant_floor_cents:900}).price_cents,900);
 assert.ok(dynamicPrice({...b,current_cents:995,physical_units:1,minutes_to_cutoff:120}).price_cents<=1000);
});
test('paused, stale, missing economics and cutoff cannot publish a dynamic price',()=>{
 for(const change of [{safe_and_approved:false},{checkout_supported:false},{closed:true},{count_age_minutes:31},{minutes_to_cutoff:5},{physical_units:0}])assert.equal(dynamicPrice({...batch(),...change}).status,'PAUSE');
 assert.equal(dynamicPrice({...batch(),fee_fraction:null}).status,'REVIEW');
 assert.equal(dynamicPrice({...batch(),economics_reviewed:false}).status,'REVIEW');
 assert.throws(()=>dynamicPrice({...batch(),reference_units:0}));
});
test('automatic prices stay fixed between half-hour reviews, sales affect the next review',()=>{
 const cfg=defaultSettings();cfg.menu.southwest.stock=8;let s=initialState('opening',cfg);s=advance(s,240);const b=s.batches[0],price=b.current_cents;
 s=advance(s,1);s=sell(s,'southwest');assert.equal(s.batches[0].current_cents,price);
 s=advance(s,28);assert.equal(s.batches[0].current_cents,price);
 s=advance(s,1);assert.equal(s.minute%30,0);assert.ok(s.batches[0].current_cents>price);assert.ok(validState(s));
});
test('manual increases require acknowledgment and leave future evaluations enabled',()=>{
 let s=advance(initialState('opening'),240);s=sell(s,'southwest');const r=evaluateBatch(s,'batch-0');assert.equal(r.status,'INCREASE');
 assert.throws(()=>executeDemoDecision(s,'batch-0',r,false,true,'unauthorized'));
 const failed=executeDemoDecision(s,'batch-0',r,true,false,'failed');assert.equal(failed.batches[0].current_cents,s.batches[0].current_cents);
 const done=executeDemoDecision(s,'batch-0',r,true,true,'done');assert.ok(done.batches[0].current_cents>s.batches[0].current_cents);assert.equal(done.batches[0].window_committed,false);
});
test('chart sampling retains endpoints and ledger with hourly markers and an exact ledger',()=>{
 const points=Array.from({length:300},(_,at)=>({at,price:1000-at})),before=structuredClone(points),sample=chartSamples(points);
 assert.ok(sample.length<=32);assert.equal(sample[0],points[0]);assert.equal(sample.at(-1),points.at(-1));assert.deepEqual(points,before);
 const s=initialState('opening'),b=s.batches[0];b.priceEvents=points;b.cutoff=900;b.observedAt=300;
 const html=marketChart({minute:300,policy:s.policy,offers:[{...b,available:10,offerId:'test',name:'Test'}]});assert.equal((html.match(/<circle/g)||[]).length,6);assert.match(html,/30-minute samples/);assert.equal((html.match(/<tr><td>/g)||[]).length,300);
});
