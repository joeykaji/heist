import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,sell,productView,stepSimulation,snapshotAt,hoursFor,startPlannedDay,restock,recountBatch,advance,defaultSettings,validState,triggerEvent,buyCombo} from '../dist/model.mjs';
import {sustainabilityReport} from '../dist/sustainability.mjs';

test('savings use paid batch prices and survive later repricing',()=>{
 const opening=initialState();const p=productView(opening,'buffalo');
 const bought=sell(opening,'buffalo');assert.equal(bought.savings.cents,p.base-p.price);
 assert.equal(bought.savings.units,1);assert.equal(bought.revenue,p.price);
 const later=advance(bought,30);assert.equal(later.savings.cents,bought.savings.cents);
 assert.equal(sustainabilityReport(later).savingsComplete,true);
});
test('bundle and regular sales record savings per food, not per order',()=>{
 const source=triggerEvent(initialState(),'combo');const prices=['buffalo','blueberry'].map(id=>productView(source,id));
 const bought=buyCombo(source);assert.equal(bought.savings.cents,prices.reduce((sum,p)=>sum+p.saving,0));
 assert.equal(bought.savings.units,2);assert.equal(bought.orders.mobile,1);
 const regular=sell(initialState('opening'),'veggie');assert.equal(regular.savings.cents,0);assert.equal(regular.savings.units,1);
});
test('live stock, receipts, recounts and closing destinations reconcile without assuming waste avoided',()=>{
 let s=initialState('opening');const before=sustainabilityReport(s).accounted;
 s=sell(s,'southwest');s=restock(s,'southwest',4);s=recountBatch(s,s.batches.at(-1).id,6);
 const r=sustainabilityReport(s);assert.equal(r.accounted,before+6);assert.equal(r.remaining,before+5);
 assert.equal(r.sellThrough,100/r.accounted);
 const end=advance(s,hoursFor(s).close-s.minute),final=sustainabilityReport(end);
 assert.equal(final.accounted,r.accounted);assert.equal(final.remaining,0);assert.equal(final.closed,true);
 assert.ok(end.retained>0);assert.equal(end.discarded,0);
});
test('seeking, playback and restart share consistent savings and results',()=>{
 const cfg=defaultSettings();let s=initialState('opening',cfg);
 for(let i=0;i<96;i++)s=stepSimulation(s,5);
 const direct=snapshotAt(cfg.hours.close,cfg);
 assert.deepEqual(s.savings,direct.savings);assert.deepEqual(sustainabilityReport(s),sustainabilityReport(direct));
 assert.ok(s.savings.cents>0);assert.ok(validState(s));
 const reset=startPlannedDay(s);assert.equal(reset.savings.cents,0);assert.equal(reset.sold,0);
});
test('old saved sales are not assigned invented savings; invalid counters are rejected',()=>{
 let s=sell(initialState(),'buffalo');delete s.savings;assert.ok(validState(s));
 const old=sustainabilityReport(s);assert.equal(old.savings,0);assert.equal(old.savingsComplete,false);
 const price=productView(s,'blueberry');s=sell(s,'blueberry');assert.equal(s.savings.cents,price.saving);
 assert.equal(sustainabilityReport(s).savingsComplete,false);
 assert.equal(validState({...s,savings:{cents:-1,units:0,from:s.minute}}),false);
});
test('empty menus and configured pricing caps produce honest outcomes and current offers',()=>{
 const cfg=defaultSettings();for(const m of Object.values(cfg.menu))m.stock=0;
 const empty=sustainabilityReport(initialState('opening',cfg));assert.equal(empty.sellThrough,0);assert.equal(empty.accounted,0);assert.deepEqual(empty.offers,[]);
 cfg.menu.buffalo.stock=24;cfg.pricing.maxDiscount=0;
 const noDrops=sustainabilityReport(snapshotAt(800,cfg));assert.deepEqual(noDrops.offers,[]);assert.equal(noDrops.pricing.maxDiscount,0);
 const live=initialState();for(const p of sustainabilityReport(live).offers){assert.ok(p.quantity>0);assert.ok(p.price<p.base);assert.deepEqual(p,productView(live,p.id));}
});
