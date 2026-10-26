import test from 'node:test';
import assert from 'node:assert/strict';
import {decide,DEFAULT_POLICY,candidatePrices} from '../dist/pricing.mjs';
import {CATALOG,OPEN,CLOSE,hoursFor,migrateState,initialState,validState,productView,rawAvailable,offerAvailable,sell,restock,evaluateBatch,executeDemoDecision,observeStock,setAllocations,advance,snapshotAt,stepSimulation,triggerEvent,basketQuote,defaultSettings,settingsFor,updateSettings,startPlannedDay,receiveStock,recountBatch,jumpToRush,comboView,buyCombo,endDeal,validateSettings,applyPlan,catalogFor,trafficAt} from '../dist/model.mjs';
const fixture=()=>({label:'Test',original_cents:600,current_cents:600,physical_units:10,reserved_units:0,protected_units:0,buffer_units:0,fee_fraction:'0',sale_cost_cents:0,order_fee_cents:0,min_unit_contribution_cents:0,merchant_floor_cents:1,activation_cents:0,minutes_to_cutoff:60,fulfillment_buffer_minutes:5,count_age_minutes:0,safe_and_approved:true,checkout_supported:true,surplus_eligible:true,demand_reviewed:true,economics_reviewed:true,markdowns_used:0,window_committed:false});
const scenario=(demand={600:1,510:2,420:3,330:4})=>({label:'Reviewed',weight:'1',demand,terminal_value_cents:0,other_loss_cents:{600:0,510:0,420:0,330:0}});
test('24 unique food items use supplied menu prices; no drinks',()=>{assert.equal(CATALOG.length,24);assert.equal(new Set(CATALOG.map(p=>p.symbol)).size,24);for(const p of CATALOG)assert.equal(p.base,p.category==='Breakfast Sandwiches'?399:p.category==='Lunch Sandwich'?899:p.category==='Bagels'?219:p.id==='doughnut'?365:['apple','cherry','cheese'].includes(p.id)?385:415);});
test('cent-ceiling ladder and binding fee floor',()=>{assert.deepEqual(candidatePrices({...fixture(),original_cents:399,current_cents:399}).prices,[399,340,280,220]);assert.equal(candidatePrices({...fixture(),fee_fraction:'.1',sale_cost_cents:200,order_fee_cents:50,min_unit_contribution_cents:25}).floor,330);assert.equal(candidatePrices({...fixture(),fee_fraction:'.3',sale_cost_cents:200,order_fee_cents:50,min_unit_contribution_cents:25}).floor,393);});
test('scenario contribution, gain, cap and diagnostics',()=>{const r=decide(fixture(),[scenario()]);assert.equal(r.status,'MARKDOWN');assert.equal(r.price_cents,330);assert.equal(r.expected_gain_cents,720);assert.equal(r.expected_baseline_leftovers,9);assert.equal(r.rows[3].scenario_sales[0],4);assert.equal(r.rows[3].scenario_values_cents[0],1320);});
test('cap inside scenarios before expectation; apply both caps',()=>{const b={...fixture(),capacity_units:5};const r=decide(b,[{...scenario(),weight:'.5',capacity_units:2},{...scenario(),weight:'.5',demand:{600:1,510:8,420:9,330:10}}]);assert.equal(r.rows.find(x=>x.price_cents===330).expected_sales,3.5);});
test('order fees per order, activation once, signed terminal value and outside loss',()=>{const b={...fixture(),sale_cost_cents:10,order_fee_cents:20,activation_cents:50};const s={...scenario(),orders:{600:1,510:1,420:2,330:2},terminal_value_cents:-5,other_loss_cents:{600:0,510:5,420:10,330:15}};const r=decide(b,[s]);const row=r.rows.find(x=>x.price_cents===330);assert.equal(row.scenario_values_cents[0],1145);assert.equal(row.scenario_gains_cents[0],620);});
test('missing fees, terminal values, orders, demand and losses require review',()=>{for(const key of ['fee_fraction','sale_cost_cents','order_fee_cents','activation_cents'])assert.equal(decide({...fixture(),[key]:null},[scenario()]).status,'REVIEW');for(const key of ['terminal_value_cents','demand','other_loss_cents']){const s=scenario();delete s[key];assert.equal(decide(fixture(),[s]).status,'REVIEW');}assert.equal(decide({...fixture(),order_fee_cents:1},[scenario()]).status,'REVIEW');});
test('malformed allocations, fractions, weights, counts and baseline loss are errors',()=>{for(const b of [{reserved_units:11},{physical_units:-1},{fee_fraction:1},{original_cents:0},{current_cents:601},{safe_and_approved:'true'}])assert.throws(()=>decide({...fixture(),...b},[scenario()]));for(const s of [{weight:0},{weight:'.9'},{demand:{600:1.5,510:2,420:3,330:4}},{other_loss_cents:{600:1,510:0,420:0,330:0}},{orders:{600:2,510:1,420:1,330:1}}])assert.throws(()=>decide(fixture(),[{...scenario(),...s}]));assert.throws(()=>decide(fixture(),[scenario()],{max_markdowns:2}));});
test('pause/administrative hold precedence and no invented forecasts',()=>{for(const b of [{safe_and_approved:false},{checkout_supported:false},{minutes_to_cutoff:5},{count_age_minutes:31},{physical_units:0},{merchant_floor_cents:601}]){const r=decide({...fixture(),...b},[scenario()]);assert.equal(r.status,'PAUSE');assert.equal(r.price_cents,null);assert.equal(r.expected_gain_cents,null);assert.equal(r.evaluation_completed,false);}for(const b of [{surplus_eligible:false},{minutes_to_cutoff:121},{window_committed:true},{markdowns_used:1}])assert.equal(decide({...fixture(),...b},[scenario()]).evaluation_completed,false);const b=fixture();delete b.safe_and_approved;assert.equal(decide(b,[scenario()]).status,'PAUSE');});
test('strict positive uplift and gain; inclusive monetary/downside boundaries',()=>{assert.equal(decide(fixture(),[scenario()],{min_incremental_sales:3}).status,'HOLD');assert.equal(decide(fixture(),[scenario()],{min_gain_cents:720}).price_cents,330);assert.equal(decide(fixture(),[scenario()],{min_gain_cents:721}).status,'HOLD');assert.equal(decide(fixture(),[scenario({600:10,510:10,420:10,330:10})],{min_gain_cents:0}).status,'HOLD');});
test('zero downside rejects any negative listed gain even at tiny weight',()=>{const r=decide(fixture(),[{...scenario(),weight:'.999999'},{...scenario({600:1,510:1,420:1,330:1}),weight:'.000001'}]);assert.equal(r.status,'HOLD');});
test('normalize weight tolerance; higher price wins exact gain tie',()=>{const s=scenario();s.other_loss_cents={600:0,510:0,420:240,330:300};const r=decide(fixture(),[{...s,weight:'1.0000000005'}]);assert.equal(r.price_cents,510);assert.equal(r.normalized_weights[0],1);});
test('holds leave future dynamic evaluations enabled',()=>{let s=initialState('opening');const id='batch-0',r=evaluateBatch(s,id);assert.equal(r.status,'HOLD');s=executeDemoDecision(s,id,r,false,false,'hold-test');assert.equal(s.batches[0].window_committed,false);assert.equal(evaluateBatch(advance(s,5),id).evaluation_completed,true);});
test('recommendation is read-only; failure and no authorization never publish',()=>{const s=initialState(),id='batch-0',r=evaluateBatch(s,id),price=productView(s,'southwest').price;assert.equal(r.status,'MARKDOWN');assert.equal(productView(s,'southwest').price,price);assert.throws(()=>executeDemoDecision(s,id,r,false,true,'no-auth'));const failed=executeDemoDecision(s,id,r,true,false,'fail');assert.equal(productView(failed,'southwest').price,price);assert.equal(failed.batches[0].window_committed,false);});
test('acknowledged execution is idempotent and future repricing remains enabled',()=>{let s=initialState(),id='batch-0',r=evaluateBatch(s,id);s=executeDemoDecision(s,id,r,true,true,'ok');const count=s.batches[0].priceEvents.length;const again=executeDemoDecision(s,id,r,true,true,'ok');assert.equal(again.batches[0].priceEvents.length,count);assert.equal(evaluateBatch(s,id).evaluation_completed,true);s=advance(s,30);assert.ok(s.batches[0].priceEvents.length>count);assert.equal(s.batches[0].window_committed,false);});
test('execution rechecks time, checkout version and allocations',()=>{const s=initialState(),id='batch-0',r=evaluateBatch(s,id);assert.throws(()=>executeDemoDecision(sell(s,'southwest'),id,r,true,true,'stale'));assert.throws(()=>executeDemoDecision(advance(s,1),id,r,true,true,'late'));assert.throws(()=>executeDemoDecision(setAllocations(s,id,2,0,0),id,r,true,true,'reserved'));});
test('sales cannot consume reservations, protection, buffers or stale stock',()=>{let s=setAllocations(initialState(),'batch-0',1,2,2);assert.equal(productView(s,'southwest').quantity,1);s=sell(s,'southwest');assert.throws(()=>sell(s,'southwest'));assert.equal(s.batches[0].physical_units,5);assert.equal(rawAvailable(s.batches[0]),0);const stale=advance(initialState(),31,{observe:false});assert.equal(productView(stale,'buffalo').quantity,0);assert.ok(productView(observeStock(stale),'buffalo').quantity>0);});
test('new stock gets new ID at regular price; existing batch keeps identity and price',()=>{const s=initialState(),old=s.batches[5],next=restock(s,'buffalo');assert.equal(next.batches[5].id,old.id);assert.equal(next.batches[5].current_cents,old.current_cents);assert.notEqual(next.batches.at(-1).id,old.id);assert.equal(next.batches.at(-1).current_cents,899);assert.equal(next.batches.at(-1).window_committed,false);});
test('basket quote allocates exact batch prices and is atomic on insufficient stock',()=>{const s=restock(initialState(),'buffalo',4),q=productView(s,'buffalo').quantity,n=productView(s,'buffalo').offerQuantity;const r=basketQuote(s,{buffalo:n+1});assert.equal(r.total,n*productView(s,'buffalo').price+899);assert.equal(r.state.revenue-s.revenue,r.total);assert.equal(productView(s,'buffalo').quantity,q);assert.throws(()=>basketQuote(s,{southwest:1,buffalo:50}));assert.equal(s.sold,0);});
test('offers close at buffer, graph retains positive events and stock reconciles at close',()=>{const s=advance(initialState(),115);assert.equal(s.minute,CLOSE-5);assert.ok(CATALOG.every(p=>productView(s,p.id).quantity===0));assert.throws(()=>sell(s,'buffalo'));assert.throws(()=>restock(s,'buffalo'));assert.ok(s.batches.every(b=>b.priceEvents.every(e=>e.price>0)));const end=advance(s,5);assert.equal(end.batches.reduce((n,b)=>n+b.physical_units,0),0);assert.equal(end.transferred,1);});
test('whole day deterministic, conserved inventory, valid states and bounded dynamic prices',()=>{let s=initialState('opening');const stock=s.batches.reduce((n,b)=>n+b.physical_units,0);for(let t=OPEN;t<CLOSE;t+=5){s=stepSimulation(s,5);assert.ok(validState(s));assert.ok(s.batches.every(b=>b.current_cents<=b.original_cents&&rawAvailable(b)>=0));}const direct=snapshotAt(CLOSE);assert.equal(s.sold,direct.sold);assert.equal(s.revenue,direct.revenue);assert.equal(s.sold+s.transferred+s.retained+s.discarded,stock);assert.ok(s.surplusSold>0);});
test('corrupted persisted state is rejected',()=>{assert.ok(validState(initialState()));for(const s of [null,{}, {...initialState(),minute:'960'},{...initialState(),batches:[{id:'x'}]},{...initialState(),policy:{max_markdowns:4}}])assert.equal(validState(s),false);});


test('opening plan applies custom stock, price and floor only when a new day starts',()=>{
 const original=initialState(),cfg=defaultSettings();cfg.menu.southwest={stock:14,price:450,floor:250,cost:80,enabled:true};
 const saved=updateSettings(original,cfg);assert.equal(productView(saved,'southwest').price,399);assert.equal(original.settings.menu.southwest.price,399);
 const next=startPlannedDay(saved);assert.equal(next.minute,OPEN);assert.equal(productView(next,'southwest').quantity,14);assert.equal(productView(next,'southwest').price,450);assert.equal(next.batches[0].merchant_floor_cents,250);assert.ok(validState(next));
});

test('receiving custom-priced food preserves existing markdown identity and history',()=>{
 const original=initialState(),old=structuredClone(original.batches[5]);const next=receiveStock(original,'buffalo',11,950,600,100);
 assert.deepEqual(next.batches[5],old);assert.equal(next.batches.at(-1).physical_units,11);assert.equal(next.batches.at(-1).original_cents,950);assert.equal(next.batches.at(-1).window_committed,false);assert.equal(productView(next,'buffalo').price,old.current_cents);assert.ok(validState(next));
 const after=basketQuote(next,{buffalo:productView(next,'buffalo').offerQuantity}).state;assert.equal(productView(after,'buffalo').price,950);assert.equal(productView(after,'buffalo').base,950);
});

test('recounts retain price history and cannot consume allocated stock',()=>{
 const original=initialState(),next=recountBatch(original,'batch-5',12);assert.equal(next.batches[5].id,original.batches[5].id);assert.deepEqual(next.batches[5].priceEvents,original.batches[5].priceEvents);assert.equal(next.batches[5].window_committed,false);assert.equal(productView(next,'buffalo').quantity,11);assert.throws(()=>recountBatch(original,'batch-5',0));assert.ok(validState(next));
});

test('custom rush jumps to its start and attempts configured arrivals across duration',()=>{
 const cfg=defaultSettings();cfg.rushes.breakfast={at:500,multiplier:3,duration:10};
 const start=jumpToRush(initialState('opening',cfg),'breakfast');assert.equal(start.minute,500);assert.equal(start.promotion.rushType,'breakfast');
 const end=stepSimulation(start,10);assert.equal(end.sold-start.sold,10);assert.equal(end.minute,510);assert.ok(validState(end));
 const backwards=jumpToRush(initialState('deals',cfg),'breakfast');assert.equal(backwards.minute,500);assert.equal(backwards.sold,snapshotAt(500,cfg).sold);assert.throws(()=>jumpToRush(start,'unknown'));
});

test('configured pairing buys the selected foods at confirmed prices and announcement ends cleanly',()=>{
 const cfg=defaultSettings();cfg.deal={kind:'combo',title:'Morning Pair',duration:20,at:690,category:'Bagels',ids:['sesame','banana']};
 const s=triggerEvent(initialState('opening',cfg),'combo'),c=comboView(s);assert.deepEqual(c.products.map(p=>p.id),['sesame','banana']);assert.equal(c.total,634);
 const bought=buyCombo(s);assert.equal(bought.sold,2);assert.equal(bought.revenue,634);assert.equal(productView(bought,'sesame').quantity,9);const ended=endDeal(bought);assert.equal(comboView(ended).active,false);assert.equal(ended.revenue,634);
});

test('custom plan replay remains deterministic and conserves food',()=>{
 const cfg=defaultSettings();cfg.menu.buffalo.stock=20;cfg.menu.buffalo.price=1000;cfg.rushes.lunch={at:700,multiplier:2.5,duration:50};
 let s=initialState('opening',cfg);const stock=s.batches.reduce((n,b)=>n+b.physical_units,0);for(let i=OPEN;i<CLOSE;i+=5)s=stepSimulation(s,5);
 const direct=snapshotAt(CLOSE,cfg);assert.equal(s.sold,direct.sold);assert.equal(s.revenue,direct.revenue);assert.equal(s.sold+s.retained+s.transferred+s.discarded,stock);assert.ok(validState(s));
});

test('invalid editable settings and corrupted promotion references are rejected',()=>{
 for(const mutate of [c=>c.menu.southwest.stock=-1,c=>c.menu.southwest.floor=500,c=>c.rushes.closing.at=1430,c=>c.rushes.breakfast.multiplier=6,c=>c.traffic.mobile=201,c=>c.deal.ids=['banana','banana']]){const c=defaultSettings();mutate(c);assert.throws(()=>validateSettings(c));}
 for(const promotion of [{kind:'combo',until:1000,ids:['missing','banana']},{kind:'combo',until:1000,ids:'bad'},{kind:'rush',until:1000,rushType:'other'}])assert.equal(validState({...initialState(),promotion}),false);
});

test('default hours and custom cutoff control the full day and offers',()=>{
 assert.deepEqual(hoursFor(initialState()),{open:420,close:900});
 const cfg=defaultSettings();cfg.hours={open:360,close:1080};
 const opening=initialState('opening',cfg);assert.equal(opening.minute,360);assert.ok(opening.batches.every(b=>b.cutoff===1080));
 const early=advance(opening,479);assert.equal(evaluateBatch(early,'batch-0').evaluation_completed,true);
 const review=advance(opening,600);assert.equal(evaluateBatch(review,'batch-0').evaluation_completed,true);
 const fresh=restock(review,'buffalo');assert.equal(fresh.batches.at(-1).cutoff,1080);
 const closed=snapshotAt(1080,cfg);assert.ok(validState(closed));assert.equal(closed.minute,1080);assert.ok(closed.batches.every(b=>b.physical_units===0));
 assert.throws(()=>snapshotAt(359,cfg));assert.throws(()=>snapshotAt(1081,cfg));assert.throws(()=>updateSettings(initialState(),cfg));
});
test('after-hours rushes stay saved without running until hours permit them',()=>{
 const cfg=defaultSettings();cfg.rushes.closing.at=1020;const s=initialState('opening',cfg);assert.throws(()=>jumpToRush(s,'closing'),/within cafe hours/);
 const end=snapshotAt(CLOSE);assert.ok(end.events.every(e=>e.at<=CLOSE));
 cfg.hours.close=1080;const closing=jumpToRush(initialState('opening',cfg),'closing');assert.equal(closing.minute,1020);assert.equal(closing.promotion.rushType,'closing');
});
test('short and long custom days conserve inventory and replay deterministically',()=>{
 for(const hours of [{open:420,close:540},{open:0,close:1439}]){
 const cfg=defaultSettings();cfg.hours=hours;let s=initialState('opening',cfg);const stock=s.batches.reduce((n,b)=>n+b.physical_units,0);
 while(s.minute<hours.close)s=stepSimulation(s,5);
 const direct=snapshotAt(hours.close,cfg);assert.ok(validState(s));assert.equal(s.revenue,direct.revenue);assert.equal(s.sold,direct.sold);assert.equal(s.sold+s.retained+s.transferred+s.discarded,stock);
 }
 for(const hours of [{open:900,close:420},{open:420,close:430},{open:0,close:1440}]){const cfg=defaultSettings();cfg.hours=hours;assert.throws(()=>validateSettings(cfg));}
});
test('legacy saved cafe plan migrates to 7 AM–3 PM without losing custom prices',()=>{
 const cfg=defaultSettings();cfg.hours={open:480,close:1080};cfg.menu.buffalo.price=999;
 const old=initialState('deals',cfg);old.version=3;delete old.settings.hours;delete old.settings.foods;delete old.settings.traffic;delete old.settings.deal.at;for(const m of Object.values(old.settings.menu))delete m.enabled;old.settings.rushes={breakfast:{at:540,orders:12,duration:30},lunch:{at:720,orders:31,duration:30},dinner:{at:1020,orders:12,duration:30}};
 const s=migrateState(old);assert.ok(validState(s));assert.equal(s.settings.menu.buffalo.price,999);assert.equal(s.settings.rushes.lunch.multiplier,1.55);assert.equal(s.settings.rushes.closing.at,840);assert.deepEqual(hoursFor(s),{open:420,close:900});assert.equal(s.minute,780);
 assert.equal(migrateState({...old,batches:[] ,minute:'bad'}),null);assert.equal(migrateState(null),null);
});

test('illustrative cafe hours deliver 12 in-person and 8 mobile purchases, with double rush traffic',()=>{
 const cfg=defaultSettings();for(const m of Object.values(cfg.menu))m.stock=100;
 const normal=snapshotAt(480,cfg);assert.deepEqual(normal.orders,{inPerson:12,mobile:8});
 const breakfast=snapshotAt(540,cfg);assert.equal(breakfast.orders.inPerson-normal.orders.inPerson,24);assert.equal(breakfast.orders.mobile-normal.orders.mobile,16);
 const beforeLunch=snapshotAt(720,cfg),lunch=snapshotAt(780,cfg);assert.equal(lunch.orders.inPerson-beforeLunch.orders.inPerson,24);assert.equal(lunch.orders.mobile-beforeLunch.orders.mobile,16);
 const closing=snapshotAt(840,cfg),last=snapshotAt(894,cfg);assert.equal(last.orders.inPerson-closing.orders.inPerson,16);assert.equal(last.orders.mobile-closing.orders.mobile,10);
 assert.equal(trafficAt(normal,840).inPerson,18);assert.equal(trafficAt(normal,840).mobile,12);
});
test('custom traffic controls actual orders and never sells more than available',()=>{
 const cfg=defaultSettings();cfg.traffic={inPerson:30,mobile:45,speed:2};
 assert.deepEqual(snapshotAt(480,cfg).orders,{inPerson:30,mobile:45});
 for(const m of Object.values(cfg.menu))m.stock=1;const end=snapshotAt(900,cfg);
 assert.equal(end.sold,24);assert.ok(end.orders.inPerson+end.orders.mobile<=24);assert.ok(validState(end));
});
test('applying an inventory plan updates custom foods, ticker, price and availability at the shared clock',()=>{
 const cfg=defaultSettings();cfg.traffic.inPerson=0;cfg.traffic.mobile=0;
 cfg.foods[0].name='House Breakfast Wrap';cfg.foods[0].symbol='WRAP';cfg.menu.southwest.price=499;cfg.menu.southwest.stock=80;cfg.menu.roast.enabled=false;
 const extra={...cfg.foods[0],id:'house-wrap',symbol:'HOUSE',name:'House Wrap'};cfg.foods.push(extra);cfg.menu[extra.id]={...cfg.menu.southwest,stock:16};
 const next=applyPlan(initialState('opening'),cfg);assert.equal(next.minute,420);assert.equal(productView(next,'southwest').price,499);assert.equal(productView(next,'southwest').quantity,80);assert.equal(productView(next,'southwest').symbol,'WRAP');assert.equal(productView(next,'roast').quantity,0);assert.equal(productView(next,'house-wrap').quantity,16);assert.equal(catalogFor(next).length,25);assert.ok(validState(next));
 assert.throws(()=>sell(next,'roast'));const restart=startPlannedDay(stepSimulation(next,5));assert.equal(restart.minute,420);assert.equal(restart.sold,0);assert.deepEqual(restart.orders,{inPerson:0,mobile:0});
});
test('a mobile pairing counts two items but only one mobile order',()=>{
 const s=triggerEvent(initialState('opening',defaultSettings()),'combo'),bought=buyCombo(s);assert.equal(bought.sold,2);assert.deepEqual(bought.orders,{inPerson:0,mobile:1});assert.ok(validState(bought));
});
test('version 4 migration preserves the current run while adopting readable labels and new traffic',()=>{
 const cfg=defaultSettings(),old=initialState('deals',cfg);old.version=4;delete old.orders;delete old.settings.foods;delete old.settings.traffic;delete old.settings.deal.at;for(const m of Object.values(old.settings.menu)){delete m.enabled;m.stock=8;}
 old.settings.menu.southwest.price=450;old.settings.rushes={breakfast:{at:480,orders:12,duration:30},lunch:{at:720,orders:20,duration:30},dinner:{at:1020,orders:12,duration:30}};
 const next=migrateState(old);assert.ok(validState(next));assert.equal(next.minute,old.minute);assert.equal(next.settings.menu.southwest.price,450);assert.equal(next.settings.menu.southwest.stock,10);assert.deepEqual(next.settings.traffic,{inPerson:12,mobile:8,speed:1});assert.equal(next.settings.rushes.closing.at,840);assert.match(next.batches[0].label,/SWRP · Batch 1/);assert.equal(next.batches[5].current_cents,old.batches[5].current_cents);
});

test('version 5 adjusts old default traffic but preserves custom rates, stock and price history',()=>{
 const old=initialState('deals');old.version=5;old.settings.traffic={inPerson:20,mobile:20,speed:2};
 const next=migrateState(old);assert.ok(validState(next));assert.deepEqual(next.settings.traffic,{inPerson:12,mobile:8,speed:2});assert.deepEqual(next.batches,old.batches);assert.equal(next.minute,old.minute);
 old.settings.traffic={inPerson:17,mobile:11,speed:1};assert.deepEqual(migrateState(old).settings.traffic,old.settings.traffic);
});

test('Closing Rush shares confirmed prices and waits for scheduled reviews',()=>{
 const cfg=defaultSettings();cfg.traffic={inPerson:0,mobile:0,speed:1};
 const before=snapshotAt(839,cfg),closing=stepSimulation(before,1);assert.equal(closing.promotion.title,'Closing Rush');assert.equal(closing.promotion.kind,'rescue');assert.equal(closing.promotion.until,895);
 const fresh=restock(closing,'blueberry',6),replayed=jumpToRush(fresh,'closing');assert.ok(validState(replayed));assert.equal(replayed.batches.at(-1).markdowns_used,0);
 const again=jumpToRush(replayed,'closing');assert.equal(again.batches.at(-1).current_cents,replayed.batches.at(-1).current_cents);assert.equal(again.batches.at(-1).markdowns_used,0);const later=stepSimulation(again,30);assert.ok(later.batches.at(-1).current_cents<again.batches.at(-1).current_cents);
 assert.ok(stepSimulation(again,16).events.every(e=>!e.text.includes('LAST-CALL')));
});
