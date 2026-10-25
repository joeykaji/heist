import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangeRows,sparkline} from '../dist/exchange-tv.mjs';
import {initialState,CATALOG,productView} from '../dist/model.mjs';
test('exchange TV pages include every menu food exactly once',()=>{
 const state=initialState(),first=exchangeRows(state,0),second=exchangeRows(state,1);
 assert.equal((first.match(/class="exchange-row"/g)||[]).length,12);
 assert.equal((second.match(/class="exchange-row"/g)||[]).length,12);
 for(const p of CATALOG){const escaped=p.name.replaceAll('&','&amp;');assert.equal((first+second).split('<strong>'+escaped+'</strong>').length-1,1);}
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
