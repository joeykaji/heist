import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangeRows,sparkline} from '../dist/exchange-tv.mjs';
import {initialState,CATALOG,productView,defaultSettings,applyPlan,stepSimulation,migrateState,validState} from '../dist/model.mjs';
test('exchange TV pages include every menu food exactly once',()=>{
 const state=initialState(),first=exchangeRows(state,0),second=exchangeRows(state,1);
 assert.equal((first.match(/class="exchange-row"/g)||[]).length,12);
 assert.equal((second.match(/class="exchange-row"/g)||[]).length,12);
 for(const p of CATALOG){const escaped=p.name.replaceAll('&','&amp;');assert.equal((first+second).split('<strong>'+escaped+'</strong>').length-1,1);}
});

test('exchange category pages only include enabled matching foods',()=>{
 const state=initialState();
 const bagels=CATALOG.filter(p=>p.category==='Bagels');
 state.settings.menu[bagels[0].id].enabled=false;
 const html=exchangeRows(state,0,'Bagels');
 assert.equal((html.match(/class="exchange-row"/g)||[]).length,bagels.length-1);
 assert.ok(!html.includes(bagels[0].name));
 assert.ok(!html.includes('Buffalo Chicken'));
 assert.ok(html.includes(bagels[1].name));
 assert.equal((exchangeRows(state,0,'Empty Category').match(/class="exchange-row"/g)||[]).length,0);
});
test('TV sparkline disappears after withdrawal',()=>{
 const state=initialState();state.minute=800;
 const batch={...state.batches[0],original_cents:400,observedAt:790,terminalAt:795,priceEvents:[{at:780,price:400},{at:796,price:200}]};
 assert.equal(sparkline(batch,state),'');assert.match(sparkline(null,state),/No active batch/);
});

test('available batches with no withdrawal time retain their graphs',()=>{
 const state=initialState();
 const batch=state.batches.find(b=>productView(state,b.productId).batchId===b.id);
 assert.ok(batch);
 assert.equal(batch.terminalAt,null);
 assert.match(sparkline(batch,state),/<svg/);
 const unavailable={...batch,physical_units:0,reserved_units:0,protected_units:0,buffer_units:0};
 assert.equal(sparkline(unavailable,state),'');
});

test('daily timeline keeps earlier points fixed as new hours appear',()=>{
 const state=initialState();
 const original=state.batches.find(b=>productView(state,b.productId).batchId===b.id);
 const batch={...original,cutoff:900,observedAt:480,priceEvents:[{at:420,price:original.current_cents}]};
 state.minute=480;
 const first=sparkline(batch,state);
 state.minute=540;batch.observedAt=540;
 const later=sparkline(batch,state);
 const xs=svg=>[...svg.matchAll(/<circle cx="([^"]+)"/g)].map(m=>Number(m[1]));
 assert.deepEqual(xs(first),[6,27]);
 assert.deepEqual(xs(later),[6,27,48]);
 assert.ok(xs(later).at(-1)<174);
});


test('Cafe Desk custom foods, hidden items, floors, and discounts appear in Exchange TV',()=>{
 const cfg=defaultSettings();cfg.traffic.inPerson=0;cfg.traffic.mobile=0;cfg.menu.roast.enabled=false;
 const food={...cfg.foods[0],id:'house-wrap',symbol:'HOUSE',name:'House Wrap'};cfg.foods.push(food);cfg.menu[food.id]={stock:18,price:650,floor:500,cost:20,enabled:true};
 const opening=applyPlan(initialState('opening'),cfg),later=stepSimulation(opening,240),p=productView(later,food.id);
 const html=[0,1].map(page=>exchangeRows(later,page)).join('');
 assert.match(html,/House Wrap/);assert.match(html,/HOUSE/);assert.ok(!html.includes('Roast Beef'));assert.ok(p.price<650&&p.price>=500);assert.ok(html.includes('$'+(p.price/100).toFixed(2)));assert.match(html,/<s>Was \$6.50<\/s>/);assert.ok(validState(later));
});

test('Joey saved dynamic histories migrate without losing prices or stock',()=>{
 const old=stepSimulation(initialState('opening'),120);old.version=4;delete old.orders;delete old.settings.foods;delete old.settings.traffic;delete old.settings.deal.at;for(const m of Object.values(old.settings.menu))delete m.enabled;
 old.settings.rushes={breakfast:{at:480,orders:12,duration:30},lunch:{at:720,orders:20,duration:30},dinner:{at:1020,orders:12,duration:30}};
 const next=migrateState(old);assert.ok(validState(next));assert.equal(next.minute,old.minute);assert.deepEqual(next.batches.map(b=>[b.physical_units,b.current_cents,b.priceEvents]),old.batches.map(b=>[b.physical_units,b.current_cents,b.priceEvents]));assert.match(exchangeRows(next),/South West Wrap/);
});
