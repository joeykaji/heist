import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,initialState,validState,validateSettings,applyPlan,snapshotAt,stepSimulation,trafficPlan,trafficAt,receiveStock,migrateState} from '../dist/model.mjs';
import {readLocations,saveLocation,stateKey,DEFAULT_LOCATION} from '../dist/locations.mjs';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('location plans and orders are independent and persist without overwriting Connections',()=>{
 const storage=memory();let registry=readLocations(storage);
 const first=stepSimulation(initialState('opening'),60);registry=saveLocation(storage,registry,DEFAULT_LOCATION,first);
 const cfg=defaultSettings();cfg.location={id:'riverside',name:'Riverside Cafe',address:'North Campus',caption:'Rochester'};cfg.hours={open:540,close:1080};cfg.menu.buffalo.price=650;cfg.menu.buffalo.stock=50;
 const second=initialState('opening',cfg);registry=saveLocation(storage,registry,cfg.location,second);
 assert.equal(readLocations(storage).locations.length,2);assert.equal(readLocations(storage).activeId,'riverside');
 assert.deepEqual(JSON.parse(storage.getItem(stateKey('connections'))),first);
 assert.equal(JSON.parse(storage.getItem(stateKey('riverside'))).settings.menu.buffalo.price,650);
 assert.equal(second.sold,0);assert.ok(first.sold>0);assert.equal(second.batches[0].location,'Riverside Cafe');assert.ok(validState(second));
});
test('closing rush is in the full planned graph and increases actual orders',()=>{
 const cfg=defaultSettings();const s=initialState('opening',cfg);
 assert.equal(trafficAt(s,840).inPerson,18);assert.equal(trafficAt(s,840).mobile,12);
 assert.deepEqual(trafficPlan(s).find(p=>p.at===840),{at:840,value:30});
 const before=snapshotAt(840,cfg),after=stepSimulation(before,50);
 assert.equal(after.orders.inPerson-before.orders.inPerson,15);assert.equal(after.orders.mobile-before.orders.mobile,10);
 assert.ok(trafficPlan(s).some(p=>p.at===895&&p.value===0));
});
test('pricing intervals, caps, fees and floors reach every batch and preserve replay',()=>{
 const cfg=defaultSettings();cfg.traffic={inPerson:0,mobile:0,speed:1};cfg.pricing={reviewMinutes:5,maxDiscount:20,maxStep:2,contribution:50,feePercent:10,orderFee:10};
 const opening=initialState('opening',cfg),later=stepSimulation(opening,480);
 assert.ok(validState(later));const b=later.batches.find(b=>b.productId==='buffalo');
 assert.ok(b.priceEvents.some(p=>p.at===435));
 assert.ok(b.priceEvents.every(p=>p.price>=Math.ceil(b.original_cents*.8)));
 assert.ok(b.priceEvents.every((p,i,a)=>!i||Math.abs(p.price-a[i-1].price)<=Math.ceil(b.original_cents*.02)));
 assert.equal(b.fee_fraction,'0.1');assert.equal(b.min_unit_contribution_cents,50);assert.equal(b.order_fee_cents,10);
 const fresh=receiveStock(opening,'buffalo',10,750,500,35).batches.at(-1);assert.equal(fresh.fee_fraction,'0.1');assert.equal(fresh.min_unit_contribution_cents,50);
 assert.deepEqual(snapshotAt(900,cfg).batches.map(b=>b.current_cents),later.batches.map(b=>b.current_cents));
 const changed=structuredClone(cfg);changed.pricing.maxDiscount=0;const applied=applyPlan(stepSimulation(opening,60),changed);assert.ok(applied.batches.every(b=>b.current_cents===b.original_cents));
});
test('invalid pricing or location settings are rejected',()=>{
 for(const [key,value] of [['reviewMinutes',0],['maxDiscount',46],['maxStep',6],['feePercent',100],['contribution',-1]]){const cfg=defaultSettings();cfg.pricing[key]=value;assert.throws(()=>validateSettings(cfg));}
 const cfg=defaultSettings();cfg.location.name='';assert.throws(()=>initialState('opening',cfg));
 assert.throws(()=>readLocations({getItem:()=>'{invalid'}));
});
test('saved version 6 sessions keep orders and prices when gaining location metadata',()=>{
 const previous=stepSimulation(initialState('opening'),120);delete previous.settings.location;delete previous.settings.pricing;previous.settings.rushes.closing.multiplier=.8;
 const next=migrateState(previous);assert.ok(validState(next));assert.equal(next.settings.location.name,'Connections Cafe');assert.equal(next.settings.rushes.closing.multiplier,1.5);assert.deepEqual(next.orders,previous.orders);assert.deepEqual(next.batches,previous.batches);
 previous.settings.rushes.closing.multiplier=1.2;assert.equal(migrateState(previous).settings.rushes.closing.multiplier,1.2);
});
