import {DEFAULT_LOCATION,validateLocation} from './locations.mjs';
const item=(id,symbol,name,category,base,image,kind)=>({id,symbol,name,category,base,image:'assets/'+image+'.webp',kind});
export const CATALOG=[
 item('southwest','SWRP','South West Wrap','Breakfast Sandwiches',399,'wrap','wrap'),
 item('veggie','VEGG','Veggie Egg','Breakfast Sandwiches',399,'egg','sandwich'),
 item('turkey','TSEG','Turkey Sausage, Egg & Cheese on Hard Roll','Breakfast Sandwiches',399,'turkey-roll','sandwich'),
 item('sausage','SBEG','Sausage, Egg & Cheese Bagel','Breakfast Sandwiches',399,'sausage-bagel','bagel'),
 item('bacon','BBEG','Bacon, Egg & Cheese Bagel','Breakfast Sandwiches',399,'bacon-bagel','bagel'),
 item('buffalo','BUFF','Buffalo Chicken','Lunch Sandwich',899,'buffalo','sandwich'),
 item('roast','RBEF','Roast Beef','Lunch Sandwich',899,'roast','sandwich'),
 ...[['poppy','POPP','Poppy Seed'],['sesame','SESM','Sesame'],['cinnamon','CINN','Cinnamon Raisin'],['bluebagel','BBGL','Blueberry'],['french','FRCH','French Toast'],['onion','ONIN','Onion'],['everything','EVRY','Everything'],['plain','PLAI','Plain']].map(([id,symbol,name])=>item(id,symbol,name+' Bagel','Bagels',219,({poppy:'bagel-poppy',sesame:'bagel-sesame',cinnamon:'bagel-cinnamon-raisin',bluebagel:'bagel-blueberry',french:'bagel-french-toast',onion:'bagel-onion',plain:'bagel-plain'})[id]||'bagel','bagel')),
 item('strawberry','STRW','Strawberry Croissant','Pastries',415,'strawberry','croissant'),
 item('chocolate','CHOC','Chocolate Croissant','Pastries',415,'chocolate','croissant'),
 item('banana','BANA','Banana Muffin','Pastries',415,'banana','muffin'),
 item('double','DBLC','Double Chocolate Muffin','Pastries',415,'double-chocolate','muffin'),
 item('blueberry','BLUE','Blueberry Muffin','Pastries',415,'blueberry','muffin'),
 item('apple','APPL','Apple Danish','Pastries',385,'apple-danish','danish'),
 item('cherry','CHRY','Cherry Danish','Pastries',385,'cherry-danish','danish'),
 item('doughnut','DOUGH','Doughnut','Bakery',365,'doughnut','doughnut'),
 item('cheese','CHSE','Cheese Danish','Bakery',385,'cheese-danish','danish')
];
export {DEFAULT_POLICY,decide} from './pricing.mjs';
import {DEFAULT_POLICY,decide,candidatePrices} from './pricing.mjs';
import {dynamicPrice} from './domain/dynamic.mjs';
export const CATEGORIES=[...new Set(CATALOG.map(p=>p.category))];
export const FEATURED=['southwest','buffalo','roast','everything','chocolate','blueberry'];
export const catalogFor=s=>(s?.settings||s)?.foods||CATALOG;
export const RUSH_NAMES={breakfast:'Breakfast Rush',lunch:'Lunch Rush',closing:'Closing Rush'};
export const OPEN=420,CLOSE=900;
export const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export const simTime=n=>(Math.floor(n/60)%12||12)+':'+String(n%60).padStart(2,'0')+' '+(n>=720?'PM':'AM');
const copy=s=>structuredClone(s),stamp=()=>new Date().toISOString();
export const rawAvailable=b=>b.physical_units-b.reserved_units-b.protected_units-b.buffer_units;
export function offerAvailable(s,b){if(s.settings?.menu[b.productId]?.enabled===false)return 0;const floor=candidatePrices(b,s.policy).floor;return (floor===null||b.current_cents>=floor)&&b.safe_and_approved&&b.checkout_supported&&b.cutoff-s.minute>b.fulfillment_buffer_minutes&&s.minute-b.observedAt<=s.policy.max_count_age_minutes?rawAvailable(b):0;}
export const hoursFor=s=>s?.settings?.hours||{open:OPEN,close:CLOSE};
function batch(product,i,quantity,minute,menu,cutoff,settings){
 const pricing=pricingFor(settings);
 if(menu)product={...product,base:menu.price};
 return {id:'batch-'+i,windowId:'batch-'+i+'-close',offerId:'CONN-'+product.symbol+'-'+i,location:settings?.location?.name||'Connections Cafe',productId:product.id,label:product.symbol+' · Batch '+(i+1),original_cents:product.base,current_cents:product.base,physical_units:quantity,reference_units:Math.max(1,quantity),reserved_units:0,protected_units:0,buffer_units:0,fee_fraction:String(pricing.feePercent/100),sale_cost_cents:menu?.cost??20,order_fee_cents:pricing.orderFee,min_unit_contribution_cents:pricing.contribution,merchant_floor_cents:menu?.floor??1,activation_cents:25,fulfillment_buffer_minutes:5,capacity_units:null,safe_and_approved:true,checkout_supported:true,surplus_eligible:true,demand_reviewed:true,economics_reviewed:true,markdowns_used:0,window_committed:false,cutoff,observedAt:minute,checkoutVersion:1,createdAt:minute,priceEvents:[{at:minute,price:product.base,version:1,operationId:'initial-'+i}],decision:null,terminalAt:null};
}
export function productView(s,id){
 const product=catalogFor(s).find(p=>p.id===id);if(!product)throw new Error('Unknown food.');
 const batches=s.batches.filter(b=>b.productId===id&&offerAvailable(s,b)>0).sort((a,b)=>a.current_cents-b.current_cents||a.createdAt-b.createdAt);
 const b= settingsFor(s).menu[id].enabled===false ? null : batches[0],base=b?.original_cents??settingsFor(s).menu[id].price,price=b?.current_cents??base;
 return {...product,base,quantity:settingsFor(s).menu[id].enabled===false?0:batches.reduce((n,b)=>n+offerAvailable(s,b),0),offerQuantity:b?offerAvailable(s,b):0,discount:100*(1-price/base),price,batchId:b?.id,offerId:b?.offerId,saving:base-price,priceAt:b?.priceEvents.at(-1).at,inventoryAt:b?.observedAt,index:100*price/base,change:b?.priceEvents.length>1?100*(price/b.priceEvents.at(-2).price-1):null};
}
export function trafficAt(s,minute=s.minute){const cfg=settingsFor(s),{open,close}=hoursFor(s),rush=Object.values(cfg.rushes).find(r=>r.at>=open&&r.at+r.duration<=close-5&&minute>=r.at&&minute<r.at+r.duration);const multiplier=rush?.multiplier??1;return {inPerson:cfg.traffic.inPerson*multiplier,mobile:cfg.traffic.mobile*multiplier};}
export function demand(s){if(s.minute>=hoursFor(s).close-5)return 0;const r=trafficAt(s);return r.inPerson+r.mobile;}
function point(s){return {at:s.minute,stock:s.batches.reduce((n,b)=>n+offerAvailable(s,b),0),demand:demand(s),sold:s.sold,savings:s.savings?.cents??0};}
function finish(s){s.revision++;s.updatedAt=stamp();const p=point(s);if(s.history.at(-1)?.at===s.minute)s.history[s.history.length-1]=p;else s.history.push(p);s.history=s.history.slice(-601);return s;}
function event(s,text,kind='status'){s.events.unshift({text,kind,at:s.minute});s.events=s.events.slice(0,40);}
export function initialState(preset='deals',settings=null){
 if(settings)validateSettings(settings);
 const {open,close}=(settings||defaultSettings()).hours;
 const opening=preset==='opening',minute=opening?open:Math.max(open,close-120);
 const cfg=copy(settings||defaultSettings());
 let s={version:6,revision:0,minute,updatedAt:stamp(),surplusSold:0,sold:0,orders:{inPerson:0,mobile:0},revenue:0,discarded:0,transferred:0,retained:0,sequence:catalogFor(cfg).length,settings:cfg,preferences:{ticker:true},policy:policyFor(cfg),promotion:null,history:[],batches:catalogFor(cfg).map((p,i)=>batch(p,i,settings?settings.menu[p.id].stock:opening?cfg.menu[p.id].stock:6+i%3,minute,cfg.menu[p.id],close,cfg)),events:[{text:opening?(cfg.location?.name||'Connections Cafe')+' opens. Fresh stock at menu prices.':'Afternoon market opens. Three surplus offers confirmed.',kind:'status',at:minute}]};
 // Explicit fixture assumptions only; they are not evidence about the cafe.
 if(!settings){s.batches.find(b=>b.productId==='buffalo').protected_units=1;s.batches.find(b=>b.productId==='roast').buffer_units=1;s.batches.find(b=>b.productId==='southwest').reserved_units=1;}
 if(!opening)for(const b of s.batches){b.createdAt=open;b.priceEvents[0].at=open;}
 s.savings={cents:0,units:0,from:minute};
 s.history=[point(s)];
 if(!opening)for(const id of ['buffalo','chocolate','blueberry']){const b=s.batches.find(b=>b.productId===id);if(b)s=executeDemoDecision(s,b.id,evaluateBatch(s,b.id),true,true,'afternoon-'+b.id);}
 return s;
}
export function validState(s){
 const {open,close}=hoursFor(s);
 if(!s||s.version!==6||!Number.isInteger(s.minute)||s.minute<open||s.minute>close||!Number.isInteger(s.revision)||s.revision<0||!Number.isFinite(Date.parse(s.updatedAt))||!Number.isInteger(s.sequence)||s.sequence<0||!s.policy||!s.preferences||typeof s.preferences.ticker!=='boolean'||!['sold','surplusSold','revenue','discarded','transferred','retained'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0)||s.surplusSold>s.sold||!s.orders||!['inPerson','mobile'].every(k=>Number.isSafeInteger(s.orders[k])&&s.orders[k]>=0)||s.orders.inPerson+s.orders.mobile>s.sold)return false;
 if(s.savings&&(!['cents','units','from'].every(k=>Number.isSafeInteger(s.savings[k])&&s.savings[k]>=0)||s.savings.units>s.sold||s.savings.from>s.minute))return false;
 if(!Array.isArray(s.batches)||s.batches.length>500||new Set(s.batches.map(b=>b.id)).size!==s.batches.length)return false;
 try{
  validateSettings(s.settings);
  if(s.promotion){const p=s.promotion;if(p.ids&&(!Array.isArray(p.ids)||p.ids.length!==2||new Set(p.ids).size!==2||!p.ids.every(id=>catalogFor(s).some(f=>f.id===id))))return false;if(p.title!==undefined&&(typeof p.title!=='string'||p.title.length>60))return false;if(p.category!==undefined&&!['all',...CATEGORIES].includes(p.category))return false;if(p.rushType!==undefined&&!Object.hasOwn(RUSH_NAMES,p.rushType))return false;}
  for(const b of s.batches){
   if(!catalogFor(s).some(p=>p.id===b.productId)||typeof b.id!=='string'||b.windowId!==b.id+'-close'||!Number.isInteger(b.observedAt)||b.observedAt>s.minute||!Number.isInteger(b.cutoff)||b.cutoff!==close||!Number.isInteger(b.checkoutVersion)||!Array.isArray(b.priceEvents)||b.priceEvents.length<1||(b.reference_units!==undefined&&(!Number.isSafeInteger(b.reference_units)||b.reference_units<1))||!b.priceEvents.every((e,i,a)=>Number.isInteger(e.price)&&e.price>0&&Number.isInteger(e.at)&&(e.price<=b.original_cents&&(i===0||e.at>=a[i-1].at)))||b.priceEvents.at(-1).price!==b.current_cents)return false;
   decide({...b,minutes_to_cutoff:b.cutoff-s.minute,count_age_minutes:s.minute-b.observedAt},[],s.policy);
  }
 }catch{return false;}
 return Array.isArray(s.events)&&s.events.length<=40&&s.events.every(e=>e&&typeof e.text==='string'&&e.text.length<300&&Number.isInteger(e.at)&&typeof e.kind==='string')&&(s.promotion===null||s.promotion&&['crash','combo','rush','rescue'].includes(s.promotion.kind)&&Number.isInteger(s.promotion.until))&&Array.isArray(s.history)&&s.history.length<=601&&s.history.every(p=>p&&['at','stock','demand'].every(k=>Number.isFinite(p[k])&&p[k]>=0));
}
// Fixed, explicit scenario fixtures for the prototype, not estimated demand.
export function demoScenarios(b,policy=DEFAULT_POLICY,profile='normal'){
 const {prices}=candidatePrices(b,policy);
 const full=[b.original_cents,...policy.discounts.map(d=>Math.ceil(b.original_cents*(1-Number(d))-1e-9))].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>b-a);
 const defs=profile==='weak'?[['Weak response','1',[2,2,2,2],null,0]]:[['Weak response / capacity cap','.3',[1,2,3,3],3,0],['Expected response','.4',[1,3,5,6],null,0],['Outside displacement','.3',[1,2,4,5],null,20]];
 return defs.map(([label,weight,units,capacity,loss])=>({label,weight,capacity_units:capacity,terminal_value_cents:-5,demand:Object.fromEntries(prices.map(p=>[p,units[full.indexOf(p)]??1])),orders:{},other_loss_cents:Object.fromEntries(prices.map(p=>[p,p===b.current_cents?0:loss]))}));
}
export function evaluateBatch(s,id,profile='normal'){
 const b=s.batches.find(b=>b.id===id);if(!b)throw new Error('Unknown batch.');
 const result=dynamicPrice({...b,minutes_to_cutoff:b.cutoff-s.minute,count_age_minutes:s.minute-b.observedAt,sale_window_minutes:b.cutoff-b.createdAt},s.policy);
 return {...result,batchId:id,windowId:b.windowId,checkoutVersion:b.checkoutVersion,physical:b.physical_units,reserved:b.reserved_units,protected:b.protected_units,buffer:b.buffer_units,evaluatedAt:s.minute,profile};
}
export function executeDemoDecision(source,id,recommendation,authorized=false,acknowledged=false,operationId=''){
 const s=copy(source),b=s.batches.find(b=>b.id===id);
 if(!b||!operationId)throw new Error('A batch and operation ID are required.');
 if(b.decision?.operationId===operationId)return s;
 if(!recommendation.evaluation_completed)return s;
 if(recommendation.windowId!==b.windowId||recommendation.checkoutVersion!==b.checkoutVersion||recommendation.evaluatedAt!==s.minute||recommendation.physical!==b.physical_units||recommendation.reserved!==b.reserved_units||recommendation.protected!==b.protected_units||recommendation.buffer!==b.buffer_units)throw new Error('Time, checkout or stock changed. Evaluate again.');
 const check=evaluateBatch(s,id,recommendation.profile);
 if(!check.evaluation_completed||check.status!==recommendation.status||check.price_cents!==recommendation.price_cents)throw new Error('Decision changed. Evaluate again.');
 if(check.status==='MARKDOWN'||check.status==='INCREASE'){
  if(!authorized)throw new Error('Staff authorization is required.');
  if(!acknowledged){event(s,'Checkout update failed. '+b.label+' keeps its confirmed price.','failure');return finish(s);}
  b.current_cents=check.price_cents;b.checkoutVersion++;if(check.status==='MARKDOWN')b.markdowns_used++;
  b.priceEvents.push({at:s.minute,price:b.current_cents,version:b.checkoutVersion,operationId});
 }
 b.window_committed=false;b.decision={...check,operationId};
 event(s,b.label+' · '+(check.status!=='HOLD'?'checkout acknowledged '+money(b.current_cents):'evaluated HOLD')+'. Dynamic pricing remains active.',check.status==='MARKDOWN'?'drop':check.status==='INCREASE'?'rise':'hold');return finish(s);
}
export function repriceDynamic(source, excluded=[]) {
 let s=source;
 for(const b of source.batches){
  if(excluded.includes(b.id)||b.closed)continue;
  const r=evaluateBatch(s,b.id);
  if(r.evaluation_completed&&r.price_cents!==b.current_cents)s=executeDemoDecision(s,b.id,r,true,true,'dynamic-'+s.revision+'-'+s.minute+'-'+b.id+'-'+b.checkoutVersion);
 }
 return s;
}
// Keep the paid price at purchase time; repricing later must not rewrite savings.
export function recordSale(s,b,price,quantity=1){
 s.savings??={cents:0,units:0,from:s.minute};
 s.savings.cents+=Math.max(0,b.original_cents-price)*quantity;s.savings.units+=quantity;
 s.sold+=quantity;s.revenue+=price*quantity;if(price<b.original_cents)s.surplusSold+=quantity;
}
export function sell(source,id,channel='inPerson',countOrder=true){
 if(!['inPerson','mobile'].includes(channel))throw new Error('Unknown purchase channel.');
 const s=copy(source),p=productView(s,id);if(!p.quantity)throw new Error('No available offer stock.');
 const b=s.batches.find(b=>b.id===p.batchId);b.physical_units--;b.observedAt=s.minute;if(countOrder)s.orders[channel]++;recordSale(s,b,p.price);
 if(rawAvailable(b)===0)b.terminalAt=s.minute;
 event(s,(channel==='mobile'?'Mobile Order':'In-Person Purchase')+' · '+p.name+' · '+money(p.price)+'.','sale');return finish(s);
}
export function restock(source,id,quantity=4){
 if(!Number.isInteger(quantity)||quantity<1||quantity>1000)throw new Error('Restock 1–1,000 fresh items.');
 const s=copy(source),p=catalogFor(s).find(p=>p.id===id);if(!p)throw new Error('Unknown food.');
 if(s.minute>=hoursFor(s).close-5)throw new Error('Fulfillment window is closed.');
 s.batches.push(batch(p,s.sequence++,quantity,s.minute,settingsFor(s).menu[id],hoursFor(s).close,settingsFor(s)));event(s,p.symbol+' · '+quantity+' fresh items, new batch at '+money(settingsFor(s).menu[id].price)+'.','restock');return finish(s);
}
export function observeStock(source){const s=copy(source);for(const b of s.batches)b.observedAt=s.minute;event(s,'Physical inventory reconciled in the simulator.','observation');return finish(s);}
export function setAllocations(source,id,reserved,protectedUnits,buffer){
 const s=copy(source),b=s.batches.find(b=>b.id===id);if(!b)throw new Error('Unknown batch.');
 if(![reserved,protectedUnits,buffer].every(n=>Number.isInteger(n)&&n>=0)||reserved+protectedUnits+buffer>b.physical_units)throw new Error('Allocations must be whole units within physical stock.');
 Object.assign(b,{reserved_units:reserved,protected_units:protectedUnits,buffer_units:buffer,observedAt:s.minute});
 event(s,b.label+' allocations updated.','allocation');return finish(s);
}
export function advance(source,minutes=1,{observe=true}={}){
 if(!Number.isInteger(minutes)||minutes<0||minutes>1440)throw new Error('Invalid time step.');
 if(minutes===0)return source;
 if(minutes>1){let s=source;for(let i=0;i<minutes&&s.minute<hoursFor(s).close;i++)s=advance(s,1,{observe});return s;}
 const s=copy(source),{close}=hoursFor(s);s.minute=Math.min(close,s.minute+minutes);
 if(observe)for(const b of s.batches)b.observedAt=s.minute;
 for(const b of s.batches)if(s.minute>=b.cutoff-b.fulfillment_buffer_minutes&&b.terminalAt===null)b.terminalAt=b.cutoff-b.fulfillment_buffer_minutes;
 if(s.promotion&&s.promotion.until<=s.minute)s.promotion=null;
 if(source.minute<close-5&&s.minute>=close-5)event(s,simTime(close-5)+' · New availability withdrawn before the fulfillment cutoff.','closed');
 if(source.minute<close&&s.minute===close)for(const b of s.batches){
  s.transferred+=b.protected_units;s.retained+=b.physical_units-b.protected_units;
  b.physical_units=0;b.reserved_units=0;b.protected_units=0;b.buffer_units=0;
 }
 return (s.minute-hoursFor(s).open)%pricingFor(s.settings).reviewMinutes===0?repriceDynamic(finish(s)):finish(s);
}
export function triggerEvent(source,kind,options={}){
 if(!['crash','combo','rush','rescue'].includes(kind))throw new Error('Unknown event.');
 let s=copy(source);if(s.minute>=hoursFor(s).close-5)throw new Error('Start a new day to run an event.');
 const cfg=settingsFor(s).deal;
 s.promotion={kind,title:options.title||(kind===cfg.kind?cfg.title:null)||({crash:'Bakery Stock Crash',combo:'Study Buddy',rush:'Lunch Rush',rescue:'Closing Rush'}[kind]),ids:options.ids||cfg.ids,category:options.category||cfg.category,rushType:options.rushType||'lunch',until:Math.min(hoursFor(s).close-5,s.minute+(options.duration||cfg.duration))};
 const messages={crash:'STOCK WATCH · Prices adjust at the next scheduled review.',combo:s.promotion.title+' · '+s.promotion.ids.map(id=>catalogFor(s).find(p=>p.id===id).name).join(' & ')+' at independently confirmed prices.',rush:'RUSH · Purchases can lift prices as stock falls.',rescue:'CLOSING RUSH · Prices follow the scheduled review. Protected stock stays protected.'};
 event(s,messages[kind],kind);s=finish(s);

 return s;
}
export function comboView(s){const products=(s.promotion?.ids||settingsFor(s).deal.ids).map(id=>productView(s,id));return {active:s.promotion?.kind==='combo'&&s.promotion.until>s.minute,available:products.every(p=>p.quantity>0),products,total:products.reduce((n,p)=>n+p.price,0),regular:products.reduce((n,p)=>n+p.base,0)};}
export function buyCombo(source){const c=comboView(source);if(!c.active||!c.available)throw new Error('This bundle is unavailable.');return buyBasket(source,Object.fromEntries(c.products.map(p=>[p.id,1])));}
export function basketQuote(source,basket){let s=source,total=0,first=true;for(const [id,n] of Object.entries(basket)){if(!Number.isInteger(n)||n<1||n>50||productView(s,id).quantity<n)throw new Error('Stock changed. Review your basket.');for(let i=0;i<n;i++){total+=productView(s,id).price;s=sell(s,id,'mobile',first);first=false;}}return {total,state:s};}
export function buyBasket(source,basket){return basketQuote(source,basket).state;}
export function applyTicker(source,enabled){const s=copy(source);s.preferences.ticker=!!enabled;return finish(s);}
function baseSchedule(s){
 const {open,close}=hoursFor(s),review=Math.max(open+1,close-120),d=settingsFor(s).deal;
 return [
  {at:d.at,action:'event',kind:d.kind,options:{...d}},
  {at:review,action:'event',kind:'crash'},
 ].filter(e=>e.at>open&&e.at<close-5).sort((a,b)=>a.at-b.at);
}
function scheduleFor(s){
 const {open,close}=hoursFor(s),events=baseSchedule(s),totals={inPerson:0,mobile:0};
 for(const [type,r] of Object.entries(settingsFor(s).rushes))if(r.at>=open&&r.at+r.duration<=close-5)events.push({at:r.at,action:'rush',type});
 // Accumulate fractional arrivals from opening so playback and seeking produce the same orders.
 for(let minute=open;minute<close-5;minute++){
  const rates=trafficAt(s,minute);
  for(const channel of ['inPerson','mobile']){
   const before=Math.floor(totals[channel]+1e-8);totals[channel]+=rates[channel]/60;
   for(let n=before;n<Math.floor(totals[channel]+1e-8);n++)events.push({at:minute+1,action:'purchase',channel,ordinal:n});
  }
 }
 return events.sort((a,b)=>a.at-b.at);
}
function purchase(s,e){
 const cfg=settingsFor(s),foods=catalogFor(s).filter(p=>cfg.menu[p.id].enabled!==false);
 const {open,close}=hoursFor(s),r=Object.entries(cfg.rushes).find(([,r])=>r.at>=open&&r.at+r.duration<=close-5&&e.at>r.at&&e.at<=r.at+r.duration)?.[0];
 const preferred=foods.filter(p=>r==='breakfast'?['Breakfast Sandwiches','Bagels'].includes(p.category):r==='lunch'?p.category==='Lunch Sandwich':true);
 const pool=preferred.length?preferred:foods,offset=e.ordinal+(e.channel==='mobile'?3:0);
 const ordered=[...pool.slice(offset%pool.length),...pool.slice(0,offset%pool.length),...foods];
 const p=ordered.find(p=>productView(s,p.id).quantity>0);
 if(!p)return s;
 const pair=comboView(s);
 if(e.channel==='mobile'&&e.ordinal%5===0&&pair.active&&pair.available)return buyCombo(s);
 return sell(s,p.id,e.channel);
}
export function stepSimulation(source,minutes=5){
 if(!Number.isInteger(minutes)||minutes<0||minutes>1440)throw new Error('Invalid time step.');
 const until=Math.min(hoursFor(source).close,source.minute+minutes);let s=source;
 for(const e of scheduleFor(source).filter(e=>e.at>source.minute&&e.at<=until)){
  s=advance(s,e.at-s.minute);
  if(e.action==='purchase')s=purchase(s,e);
  else if(e.action==='event')s=triggerEvent(s,e.kind,e.options||{});
  else if(e.action==='rush'){if(e.type==='closing')s=triggerEvent(s,'rescue',{title:RUSH_NAMES.closing,rushType:'closing',duration:settingsFor(s).rushes.closing.duration});else event(s,RUSH_NAMES[e.type]+' begins.','rush');}
  else if(e.action==='review')for(const b of s.batches.filter(b=>b.productId===e.id)){const r=evaluateBatch(s,b.id);if(r.evaluation_completed)s=executeDemoDecision(s,b.id,r,true,true,'day-'+b.windowId);}
 }
 return advance(s,until-s.minute);
}
export function snapshotAt(minute,settings=null){const {open,close}=(settings||defaultSettings()).hours;if(!Number.isInteger(minute)||minute<open||minute>close)throw new Error('Invalid time.');return stepSimulation(initialState('opening',settings),minute-open);}


export function defaultSettings(){return {location:{...DEFAULT_LOCATION},pricing:pricingFor(),hours:{open:OPEN,close:CLOSE},foods:copy(CATALOG),menu:Object.fromEntries(CATALOG.map(p=>[p.id,{stock:24,price:p.base,floor:1,cost:20,enabled:true}])),traffic:{inPerson:12,mobile:8,speed:1},rushes:{breakfast:{at:480,multiplier:2,duration:60},lunch:{at:720,multiplier:2,duration:60},closing:{at:840,multiplier:1.5,duration:55}},deal:{kind:'combo',title:'Sandwich & Muffin Bundle',duration:30,at:690,category:'Pastries',ids:['buffalo','blueberry']}};}
export const settingsFor=s=>s.settings||defaultSettings();
export function pricingFor(settings){const defaults={reviewMinutes:30,maxDiscount:45,maxStep:5,contribution:25,feePercent:0,orderFee:0};return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,settings?.pricing?.[key]??value]));}
function policyFor(settings){const p=pricingFor(settings);return {...DEFAULT_POLICY,max_discount:String(p.maxDiscount/100),discounts:DEFAULT_POLICY.discounts.filter(d=>Number(d)<=p.maxDiscount/100),max_adjustment:p.maxStep/100};}
export function trafficPlan(s){const {open,close}=hoursFor(s);const times=new Set([open,close-5,close]);for(const r of Object.values(settingsFor(s).rushes)){if(r.at>=open&&r.at+r.duration<=close-5){times.add(r.at);times.add(r.at+r.duration);}}return [...times].sort((a,b)=>a-b).map(at=>({at,value:demand({...s,minute:at})}));}
export const BLANK_FOOD_IMAGE='assets/food-placeholder.svg';
export function validFoodImage(image){
 if(typeof image!=='string'||image.length>2048)return false;
 if(image===BLANK_FOOD_IMAGE||/^assets\/[a-z0-9-]+\.(webp|png)$/.test(image))return true;
 try{const url=new URL(image);return url.protocol==='https:'&&!url.username&&!url.password&&!/[\s<>"']/.test(image);}catch{return false;}
}
export function validateSettings(c){
 if(!c||!c.menu||!c.rushes||!c.deal)throw new Error('Cafe settings are incomplete.');
 if(c.location)validateLocation(c.location);
 const p=pricingFor(c);if(![15,30,60].includes(p.reviewMinutes)||!Number.isInteger(p.maxDiscount)||p.maxDiscount<0||p.maxDiscount>45||!Number.isInteger(p.maxStep)||p.maxStep<1||p.maxStep>5||!Number.isInteger(p.contribution)||p.contribution<0||p.contribution>10000||!Number.isFinite(p.feePercent)||p.feePercent<0||p.feePercent>50||!Number.isInteger(p.orderFee)||p.orderFee<0||p.orderFee>10000)throw new Error('Pricing needs a 15, 30, or 60 minute review, 0–45% maximum discount, 1–5% step, and nonnegative costs.');
 const h=c.hours;if(!h||!Number.isInteger(h.open)||!Number.isInteger(h.close)||h.open<0||h.close>1439||h.close-h.open<120)throw new Error('Choose same-day hours at least two hours apart.');
 if(!Array.isArray(c.foods)||c.foods.length<2||c.foods.length>80||new Set(c.foods.map(p=>p.id)).size!==c.foods.length||new Set(c.foods.map(p=>p.symbol)).size!==c.foods.length)throw new Error('Use a unique ID and ticker for each food (2–80 foods).');
 for(const p of c.foods){
  if(!/^[a-z0-9-]{1,50}$/.test(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>90||!/^[A-Z0-9]{3,6}$/.test(p.symbol)||!CATEGORIES.includes(p.category)||!['wrap','sandwich','bagel','croissant','muffin','danish','doughnut'].includes(p.kind)||!validFoodImage(p.image))throw new Error('Use a food name, a unique 3–6 letter ticker, and a category. Photos can be blank, a menu image, or an HTTPS image URL.');
  const m=c.menu[p.id];if(!m||!Number.isInteger(m.stock)||m.stock<0||m.stock>1000||!Number.isInteger(m.price)||m.price<1||m.price>10000||!Number.isInteger(m.floor)||m.floor<1||m.floor>m.price||!Number.isInteger(m.cost)||m.cost<0||m.cost>10000||typeof m.enabled!=='boolean')throw new Error(p.name+': enter stock 0–1,000, a positive price, and a minimum no higher than the price.');
 }
 const t=c.traffic;if(!t||!['inPerson','mobile'].every(k=>Number.isInteger(t[k])&&t[k]>=0&&t[k]<=200)||![.5,1,2].includes(t.speed))throw new Error('Enter 0–200 hourly purchases for each channel.');
 for(const type of Object.keys(RUSH_NAMES)){const r=c.rushes[type];if(!r||!Number.isInteger(r.at)||r.at<0||r.at>1439||!Number.isFinite(r.multiplier)||r.multiplier<.1||r.multiplier>5||!Number.isInteger(r.duration)||r.duration<5||r.duration>120||r.at+r.duration>1439)throw new Error('Rushes need a 0.1–5× rate and a 5–120 minute duration within the same day.');}
 const d=c.deal;if(!['combo','crash','rescue'].includes(d.kind)||typeof d.title!=='string'||d.title.length<1||d.title.length>60||!Number.isInteger(d.at)||d.at<0||d.at>1439||!Number.isInteger(d.duration)||d.duration<5||d.duration>120||!['all',...CATEGORIES].includes(d.category)||!Array.isArray(d.ids)||d.ids.length!==2||new Set(d.ids).size!==2||!d.ids.every(id=>c.foods.some(p=>p.id===id)))throw new Error('Choose a deal name, two different foods and a duration of 5–120 minutes.');
 return true;
}
export function updateSettings(source,settings){validateSettings(settings);if(settings.hours.open!==hoursFor(source).open||settings.hours.close!==hoursFor(source).close)throw new Error('Apply new hours by starting a new day.');const s=copy(source);s.settings=copy(settings);event(s,'Cafe plan saved. Current batches keep their confirmed prices.','plan');return finish(s);}
export function startPlannedDay(source,settings=settingsFor(source)){validateSettings(settings);return initialState('opening',settings);}
export function receiveStock(source,id,quantity,price,floor,cost){
 const cfg=copy(settingsFor(source));cfg.menu[id]={...cfg.menu[id],price,floor,cost};
 return restock(updateSettings(source,cfg),id,quantity);
}
export function recountBatch(source,id,quantity){
 const s=copy(source),b=s.batches.find(b=>b.id===id);if(!b)throw new Error('Choose a batch.');
 if(!Number.isInteger(quantity)||quantity<0||quantity>1000||quantity<b.reserved_units+b.protected_units+b.buffer_units)throw new Error('Count must cover reserved, protected and buffer units.');
 const difference=quantity-b.physical_units;b.physical_units=quantity;b.observedAt=s.minute;
 if(rawAvailable(b)>0&&s.minute<b.cutoff-b.fulfillment_buffer_minutes)b.terminalAt=null;
 event(s,b.label+' recount: '+quantity+' physical units ('+(difference>=0?'+':'')+difference+'). Price history kept.','observation');return finish(s);
}
export const SCHEDULE=scheduleFor({settings:defaultSettings()});
export function jumpToRush(source,type){
 const cfg=settingsFor(source),r=cfg.rushes[type];if(!Object.hasOwn(RUSH_NAMES,type)||!r)throw new Error('Choose a rush.');
 const {open,close}=hoursFor(source);if(r.at<open||r.at+r.duration>close-5)throw new Error('Set this rush within cafe hours, ending by '+simTime(close-5)+'.');
 const s=r.at<source.minute?snapshotAt(r.at,cfg):stepSimulation(source,r.at-source.minute);
 return triggerEvent(s,type==='closing'?'rescue':'rush',{title:RUSH_NAMES[type],rushType:type,duration:r.duration});
}

// Applying a menu plan rebuilds the same point in the day, so all views share its inventory and prices.
export function applyPlan(source,settings){validateSettings(settings);const next=snapshotAt(Math.max(settings.hours.open,Math.min(source.minute,settings.hours.close)),settings);next.revision=source.revision+1;return next;}

export function endDeal(source){const s=copy(source);s.promotion=null;event(s,'Offer announcement ended. Confirmed batch prices remain.','status');return finish(s);}

// Preserve saved plans and price histories; upgrade old default traffic without silently losing owner edits.
export function migrateState(legacy){
 if(validState(legacy)){const s=copy(legacy);if(!s.settings.location){s.settings.location={...DEFAULT_LOCATION};s.settings.pricing=pricingFor();const r=s.settings.rushes.closing;if(r.at===840&&r.duration===55&&r.multiplier===.8)r.multiplier=1.5;}for(const b of s.batches)b.reference_units??=Math.max(1,s.settings.menu[b.productId]?.stock??b.physical_units);return s;}
 if(!legacy||![3,4,5].includes(legacy.version))return null;
 if(legacy.version===5){
  const s=copy(legacy);s.version=6;
  if(s.settings?.traffic?.inPerson===20&&s.settings.traffic.mobile===20)Object.assign(s.settings.traffic,{inPerson:12,mobile:8});
  if(/^last[- ]call/i.test(s.settings?.deal?.title||''))s.settings.deal.title='Closing Rush';
  if(s.promotion?.kind==='rescue')s.promotion.title='Closing Rush';
  return validState(s)?migrateState(s):null;
 }
 try{
  const s=copy(legacy),defaults=defaultSettings(),cfg=s.settings;
  if(!cfg||!Array.isArray(s.batches)||!Number.isInteger(s.minute))return null;
  cfg.hours=legacy.version===3?{open:480,close:1080}:cfg.hours;
  cfg.foods=copy(CATALOG);cfg.traffic=defaults.traffic;
  for(const p of CATALOG){cfg.menu[p.id].enabled=true;if(cfg.menu[p.id].stock===8)cfg.menu[p.id].stock=24;}
  for(const type of ['breakfast','lunch']){const r=cfg.rushes[type],oldDefault=type==='breakfast'?12:20;cfg.rushes[type]={at:r.at,duration:r.orders===oldDefault?60:r.duration,multiplier:r.orders===oldDefault?2:Math.max(.1,Math.min(5,r.orders*60/r.duration/40))};}
  cfg.rushes.closing=defaults.rushes.closing;delete cfg.rushes.dinner;
  cfg.deal.at=defaults.deal.at;s.version=6;s.orders={inPerson:s.sold,mobile:0};
  if(s.promotion?.rushType==='dinner')s.promotion.rushType='closing';
  for(const b of s.batches){b.label=cfg.foods.find(p=>p.id===b.productId)?.symbol+' · Batch '+(Number(b.id.replace('batch-',''))+1);b.reference_units??=Math.max(1,cfg.menu[b.productId]?.stock??b.physical_units);}
  if(!validState(s))return null;
  if(legacy.version===3){cfg.hours={open:OPEN,close:CLOSE};return initialState('deals',cfg);}
  return s;
 }catch{return null;}
}
