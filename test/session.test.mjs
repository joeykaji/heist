import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Session} from '../src/application/session.mjs';
const make=()=>new Session(undefined); // Each test has isolated, server-owned state.
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'marketbite-'));t.after(()=>rm(dir,{recursive:true,force:true}));return Session.open(join(dir,'session.json'));}
function request(s,type,payload={},id=crypto.randomUUID()){const v=s.get();return {id,generation:v.generation,revision:v.revision,type,payload};}
async function cmd(s,type,payload={},id){return s.command(request(s,type,payload,id));}
const first=s=>s.get().offers[0];
async function authorize(s){const offer=first(s).offerId;await cmd(s,'review',{offer,profile:'normal'});const review=first(s).review;assert.equal(review.status,'MARKDOWN');await cmd(s,'authorize',{offer,review:review.id});return first(s).pending;}

test('persistent server state, explicit controls, and monotonic revisions',async t=>{
 const s=await setup(t);let notifications=0;s.subscribe(()=>notifications++);const offer=first(s).offerId;
 await cmd(s,'approval',{offer,approved:false});assert.equal(first(s).available,0);
 await cmd(s,'approval',{offer,approved:true});assert.ok(first(s).available>0);
 await cmd(s,'recount',{offer,quantity:4});assert.equal(first(s).physical_units,4);
 await cmd(s,'allocations',{offer,reserved:1,protected:1,buffer:1});assert.equal(first(s).available,1);
 await cmd(s,'remove',{offer,quantity:1});assert.equal(first(s).available,0);
 const before=first(s);await cmd(s,'restock',{offer,quantity:4});assert.equal(s.get().offers.length,4);assert.deepEqual(s.get().offers[0],before);
 const restored=await Session.open(s.file);assert.deepEqual(restored.get(),s.get());assert.equal(notifications,6);
 await cmd(s,'close',{offer});await assert.rejects(cmd(s,'approval',{offer,approved:true}),/cannot reopen/);
});

test('request deduplication survives restart; stale commands and reused keys rejected',async t=>{
 const s=await setup(t),b=first(s),c=request(s,'purchase',{offer:b.offerId,quantity:1,checkoutVersion:b.checkoutVersion},'order-1');
 const a=await s.command(c),again=await s.command(c);assert.equal(again.duplicate,true);assert.deepEqual(a.result,again.result);assert.equal(s.get().orders.length,1);
 const restored=await Session.open(s.file);assert.equal((await restored.command(c)).duplicate,true);
 await assert.rejects(restored.command({...c,payload:{...c.payload,quantity:2}}),/reused/);
 await assert.rejects(s.command({...c,id:'other'}),/State changed/);
});

test('simultaneous attempts at last unit accept exactly one order',async t=>{
 const s=await setup(t),b=first(s);await cmd(s,'recount',{offer:b.offerId,quantity:b.reserved_units+1});
 const p={offer:b.offerId,quantity:1,checkoutVersion:first(s).checkoutVersion};const results=await Promise.allSettled([s.command(request(s,'purchase',p)),s.command(request(s,'purchase',p))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(first(s).available,0);assert.equal(s.get().orders.length,1);
});

test('acceptance reserves once; fulfillment removes physical stock and reservation once',async t=>{
 const s=await setup(t),b=first(s);const order=(await cmd(s,'purchase',{offer:b.offerId,quantity:2,checkoutVersion:b.checkoutVersion})).result;
 assert.equal(first(s).physical_units,b.physical_units);assert.equal(first(s).reserved_units,b.reserved_units+2);
 await assert.rejects(cmd(s,'allocations',{offer:b.offerId,reserved:1,protected:0,buffer:0}),/cover accepted/);
 await cmd(s,'fulfill',{order:order.id});assert.equal(first(s).physical_units,b.physical_units-2);assert.equal(first(s).reserved_units,b.reserved_units);assert.equal(s.get().orders[0].priceCents,b.current_cents);
 await assert.rejects(cmd(s,'fulfill',{order:order.id}),/awaiting fulfillment/);
});

test('authorization never publishes until acknowledgment; timeout reconciles once',async t=>{
 const s=await setup(t),b=first(s),pending=await authorize(s);assert.equal(first(s).current_cents,b.current_cents);assert.equal(first(s).available,0);assert.equal(first(s).window_committed,false);
 await cmd(s,'checkout',{offer:b.offerId,operation:pending.id,action:'unknown'});assert.equal(first(s).status,'Checkout uncertain');
 await assert.rejects(cmd(s,'checkout',{offer:b.offerId,operation:pending.id,action:'ack'}),/Reconcile/);
 const reloaded=await Session.open(s.file);assert.equal(first(reloaded).pending.state,'unknown');
 await cmd(reloaded,'checkout',{offer:b.offerId,operation:pending.id,action:'reconcile'});assert.ok(first(reloaded).current_cents<b.current_cents);assert.equal(first(reloaded).window_committed,false);assert.equal(first(reloaded).priceEvents.length,2);
 await cmd(reloaded,'review',{offer:b.offerId,profile:'normal'});assert.equal(first(reloaded).review.evaluation_completed,true);
});

test('reject keeps confirmed price; stale recommendation and delayed acknowledgments withdraw',async t=>{
 const s=await setup(t),b=first(s);let pending=await authorize(s);
 await cmd(s,'checkout',{offer:b.offerId,operation:pending.id,action:'reject'});assert.equal(first(s).current_cents,b.current_cents);assert.equal(first(s).window_committed,false);
 pending=await authorize(s);await cmd(s,'advance',{minutes:1});await cmd(s,'checkout',{offer:b.offerId,operation:pending.id,action:'ack'});
 assert.equal(first(s).status,'Paused');assert.equal(first(s).current_cents,b.current_cents);assert.equal(first(s).window_committed,false);
});

test('missing evidence blocks publication; repeated dynamic reviews stay enabled',async t=>{
 const s=await setup(t),offer=first(s).offerId;
 await cmd(s,'review',{offer,profile:'missing'});assert.equal(first(s).review.status,'REVIEW');await assert.rejects(cmd(s,'authorize',{offer,review:first(s).review.id}),/executable/);assert.equal(first(s).window_committed,false);
 await cmd(s,'review',{offer,profile:'weak'});assert.equal(first(s).review.status,'MARKDOWN');await cmd(s,'authorize',{offer,review:first(s).review.id});assert.equal(first(s).window_committed,false);assert.equal(first(s).priceEvents.length,1);assert.ok(first(s).pending);
});

test('stale counts, fulfillment buffer, and reset generation prevent old operations',async t=>{
 const s=await setup(t),b=first(s);await cmd(s,'advance',{minutes:30});assert.ok(first(s).available>0);await cmd(s,'advance',{minutes:1});assert.equal(first(s).status,'Count stale');await assert.rejects(cmd(s,'purchase',{offer:b.offerId,quantity:1,checkoutVersion:first(s).checkoutVersion}),/unavailable/);
 await cmd(s,'recount',{offer:b.offerId,quantity:b.physical_units});assert.ok(first(s).available>0);
 const old=request(s,'advance',{minutes:1});await cmd(s,'reset');await assert.rejects(s.command(old),/reset/);
 await cmd(s,'advance',{minutes:115});assert.equal(first(s).status,'Closed');assert.equal(first(s).terminalAt,895);assert.ok(first(s).priceEvents.every(e=>e.price>0));
});

test('failed persistence cannot mutate visible state or deliver events',async t=>{
 const s=await setup(t),before=s.get();s.persist=async()=>{throw new Error('disk unavailable');};let called=false;s.subscribe(()=>called=true);
 await assert.rejects(cmd(s,'pauseAll'),/disk unavailable/);assert.deepEqual(s.get(),before);assert.equal(called,false);
});

test('corrupt persistence is never silently reset',async t=>{
 const s=await setup(t);await writeFile(s.file,'{"schema":999}');await assert.rejects(Session.open(s.file));
});

test('pre-merge server sessions retain accepted orders and inventory on reopen',async t=>{
 const s=await setup(t),b=first(s);
 const order=(await cmd(s,'purchase',{offer:b.offerId,quantity:1,checkoutVersion:b.checkoutVersion})).result;
 const saved=JSON.parse(await readFile(s.file,'utf8')),old=saved.model;
 old.version=4;delete old.orders;delete old.settings.foods;delete old.settings.traffic;delete old.settings.deal.at;
 for(const m of Object.values(old.settings.menu))delete m.enabled;
 old.settings.rushes={breakfast:{at:480,orders:12,duration:30},lunch:{at:720,orders:20,duration:45},dinner:{at:1020,orders:12,duration:30}};
 await writeFile(s.file,JSON.stringify(saved));
 const restored=await Session.open(s.file),view=restored.get();
 assert.equal(view.generation,saved.generation);assert.equal(view.revision,saved.revision);assert.deepEqual(view.orders,saved.orders);
 assert.deepEqual(view.offers.map(b=>[b.physical_units,b.reserved_units,b.current_cents,b.priceEvents]),old.batches.map(b=>[b.physical_units,b.reserved_units,b.current_cents,b.priceEvents]));
 await cmd(restored,'fulfill',{order:order.id});assert.equal(restored.get().orders[0].priceCents,order.priceCents);assert.equal(restored.get().orders[0].status,'fulfilled');
});

test('old checkout callback after reset cannot affect fresh batch with same identifier',async t=>{
 const s=await setup(t),b=first(s),pending=await authorize(s);const delayed=request(s,'checkout',{offer:b.offerId,operation:pending.id,action:'ack'});
 await cmd(s,'reset');const fresh=first(s);await assert.rejects(s.command(delayed),/reset/);assert.deepEqual(first(s),fresh);
});

test('half-hour reviews recover prices after purchases, preserving accepted order quotes',async t=>{
 const s=await setup(t),offer=first(s).offerId;
 for(let i=0;i<6;i++){const pending=await authorize(s);await cmd(s,'checkout',{offer,operation:pending.id,action:'ack'});}
 const before=first(s),quantity=Math.ceil(before.reference_units/4),order=(await cmd(s,'purchase',{offer,quantity,checkoutVersion:before.checkoutVersion})).result;
 assert.equal(first(s).current_cents,before.current_cents);
 await cmd(s,'advance',{minutes:29});assert.equal(first(s).current_cents,before.current_cents);
 await cmd(s,'advance',{minutes:1});assert.ok(first(s).current_cents>before.current_cents);
 await assert.rejects(cmd(s,'purchase',{offer,quantity:1,checkoutVersion:before.checkoutVersion}),/Price changed/);
 assert.equal(s.get().orders[0].priceCents,order.priceCents);await cmd(s,'fulfill',{order:order.id});assert.equal(s.get().orders[0].priceCents,before.current_cents);
});
