const item=(id,symbol,name,category,base,image,kind)=>({id,symbol,name,category,base,image:'assets/'+image+'.webp',kind});
export const CATALOG=[
 item('southwest','SWRP','South West wrap','Breakfast Sandwiches',399,'wrap','wrap'),
 item('veggie','VEGG','Veggie egg','Breakfast Sandwiches',399,'egg','sandwich'),
 item('turkey','TSEG','Turkey sausage, egg & cheese on hard roll','Breakfast Sandwiches',399,'turkey-roll','sandwich'),
 item('sausage','SBEG','Sausage, egg & cheese bagel','Breakfast Sandwiches',399,'sausage-bagel','bagel'),
 item('bacon','BBEG','Bacon, egg & cheese bagel','Breakfast Sandwiches',399,'bacon-bagel','bagel'),
 item('buffalo','BUFF','Buffalo Chicken','Lunch Sandwich',899,'buffalo','sandwich'),
 item('roast','RBEF','Roast Beef','Lunch Sandwich',899,'roast','sandwich'),
 ...[['poppy','POPP','Poppy Seed'],['sesame','SESM','Sesame'],['cinnamon','CINN','Cinnamon Raisin'],['bluebagel','BBGL','Blueberry'],['french','FRCH','French Toast'],['onion','ONIN','Onion'],['everything','EVRY','Everything'],['plain','PLAI','Plain']].map(([id,symbol,name])=>item(id,symbol,name+' bagel','Bagels',219,'bagel','bagel')),
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
export const CATEGORIES=[...new Set(CATALOG.map(p=>p.category))];
export const FEATURED=['southwest','buffalo','roast','everything','chocolate','blueberry'];
export const OPEN=480,CLOSE=1080;
export const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export const simTime=n=>(Math.floor(n/60)%12||12)+':'+String(n%60).padStart(2,'0')+' '+(n>=720?'PM':'AM');
const copy=s=>structuredClone(s),stamp=()=>new Date().toISOString();
export const rawAvailable=b=>b.physical_units-b.reserved_units-b.protected_units-b.buffer_units;
export function offerAvailable(s,b){const floor=candidatePrices(b,s.policy).floor;return (floor===null||b.current_cents>=floor)&&b.safe_and_approved&&b.checkout_supported&&b.cutoff-s.minute>b.fulfillment_buffer_minutes&&s.minute-b.observedAt<=s.policy.max_count_age_minutes?rawAvailable(b):0;}
function batch(product,i,quantity,minute){
 return {id:'batch-'+i,windowId:'batch-'+i+'-close',offerId:'CONN-'+product.symbol+'-'+i,location:'Connections Cafe',productId:product.id,label:product.symbol+' / B'+i,original_cents:product.base,current_cents:product.base,physical_units:quantity,reserved_units:0,protected_units:0,buffer_units:0,fee_fraction:'0',sale_cost_cents:20,order_fee_cents:0,min_unit_contribution_cents:25,merchant_floor_cents:1,activation_cents:25,fulfillment_buffer_minutes:5,capacity_units:null,safe_and_approved:true,checkout_supported:true,surplus_eligible:true,demand_reviewed:true,economics_reviewed:true,markdowns_used:0,window_committed:false,cutoff:CLOSE,observedAt:minute,checkoutVersion:1,createdAt:minute,priceEvents:[{at:minute,price:product.base,version:1,operationId:'initial-'+i}],decision:null,terminalAt:null};
}
export function productView(s,id){
 const product=CATALOG.find(p=>p.id===id);if(!product)throw new Error('Unknown food.');
 const batches=s.batches.filter(b=>b.productId===id&&offerAvailable(s,b)>0).sort((a,b)=>a.current_cents-b.current_cents||a.createdAt-b.createdAt);
 const b=batches[0],price=b?.current_cents??product.base;
 return {...product,quantity:batches.reduce((n,b)=>n+offerAvailable(s,b),0),offerQuantity:b?offerAvailable(s,b):0,discount:100*(1-price/product.base),price,batchId:b?.id,offerId:b?.offerId,saving:product.base-price,priceAt:b?.priceEvents.at(-1).at,inventoryAt:b?.observedAt,index:100*price/product.base,change:b?.priceEvents.length>1?100*(price/b.priceEvents.at(-2).price-1):null};
}
export function demand(s){return s.minute>=CLOSE-5?0:s.promotion?.kind==='rush'&&s.promotion.until>s.minute?95:s.minute<600?35:s.minute<660?50:s.minute<780?85:s.minute<900?35:s.minute<960?20:40;}
function point(s){return {at:s.minute,stock:s.batches.reduce((n,b)=>n+offerAvailable(s,b),0),demand:demand(s)};}
function finish(s){s.revision++;s.updatedAt=stamp();const p=point(s);if(s.history.at(-1)?.at===s.minute)s.history[s.history.length-1]=p;else s.history.push(p);s.history=s.history.slice(-601);return s;}
function event(s,text,kind='status'){s.events.unshift({text,kind,at:s.minute});s.events=s.events.slice(0,40);}
export function initialState(preset='deals'){
 const opening=preset==='opening',minute=opening?OPEN:960;
 let s={version:3,revision:0,minute,updatedAt:stamp(),surplusSold:0,sold:0,revenue:0,discarded:0,transferred:0,retained:0,sequence:CATALOG.length,preferences:{ticker:true},policy:{...DEFAULT_POLICY},promotion:null,history:[],batches:CATALOG.map((p,i)=>batch(p,i,opening?8:6+i%3,minute)),events:[{text:opening?'Connections Cafe opens. Fresh stock at menu prices.':'Afternoon demo. Pricing Specification 1.1 / Engine 2.1.',kind:'status',at:minute}]};
 // Explicit fixture assumptions only; they are not evidence about the cafe.
 s.batches.find(b=>b.productId==='buffalo').protected_units=1;
 s.batches.find(b=>b.productId==='roast').buffer_units=1;
 s.batches.find(b=>b.productId==='southwest').reserved_units=1;
 if(!opening)for(const b of s.batches){b.createdAt=OPEN;b.priceEvents[0].at=OPEN;}
 s.history=[point(s)];
 if(!opening)for(const id of ['buffalo','chocolate','blueberry']){const b=s.batches.find(b=>b.productId===id);s=executeDemoDecision(s,b.id,evaluateBatch(s,b.id),true,true,'afternoon-'+b.id);}
 return s;
}
export function validState(s){
 if(!s||s.version!==3||!Number.isInteger(s.minute)||s.minute<OPEN||s.minute>CLOSE||!Number.isInteger(s.revision)||s.revision<0||!Number.isFinite(Date.parse(s.updatedAt))||!Number.isInteger(s.sequence)||s.sequence<0||!s.policy||!s.preferences||typeof s.preferences.ticker!=='boolean'||!['sold','surplusSold','revenue','discarded','transferred','retained'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0)||s.surplusSold>s.sold)return false;
 if(!Array.isArray(s.batches)||s.batches.length>500||new Set(s.batches.map(b=>b.id)).size!==s.batches.length)return false;
 try{
  for(const b of s.batches){
   if(!CATALOG.some(p=>p.id===b.productId)||typeof b.id!=='string'||b.windowId!==b.id+'-close'||!Number.isInteger(b.observedAt)||b.observedAt>s.minute||!Number.isInteger(b.cutoff)||b.cutoff>CLOSE||!Number.isInteger(b.checkoutVersion)||!Array.isArray(b.priceEvents)||b.priceEvents.length<1||b.priceEvents.length>2||!b.priceEvents.every((e,i,a)=>Number.isInteger(e.price)&&e.price>0&&Number.isInteger(e.at)&&(i===0||e.price<a[i-1].price))||b.priceEvents.at(-1).price!==b.current_cents||b.markdowns_used>1)return false;
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
 const result=decide({...b,minutes_to_cutoff:b.cutoff-s.minute,count_age_minutes:s.minute-b.observedAt},demoScenarios(b,s.policy,profile),s.policy);
 return {...result,batchId:id,windowId:b.windowId,checkoutVersion:b.checkoutVersion,physical:b.physical_units,reserved:b.reserved_units,protected:b.protected_units,buffer:b.buffer_units,evaluatedAt:s.minute,profile};
}
export function executeDemoDecision(source,id,recommendation,authorized=false,acknowledged=false,operationId=''){
 const s=copy(source),b=s.batches.find(b=>b.id===id);
 if(!b||!operationId)throw new Error('A batch and operation ID are required.');
 if(b.decision?.operationId===operationId)return s;
 if(!recommendation.evaluation_completed)return s;
 if(b.window_committed)throw new Error('This batch/window is already committed.');
 if(recommendation.windowId!==b.windowId||recommendation.checkoutVersion!==b.checkoutVersion||recommendation.evaluatedAt!==s.minute||recommendation.physical!==b.physical_units||recommendation.reserved!==b.reserved_units||recommendation.protected!==b.protected_units||recommendation.buffer!==b.buffer_units)throw new Error('Time, checkout or stock changed. Evaluate again.');
 const check=evaluateBatch(s,id,recommendation.profile);
 if(!check.evaluation_completed||check.status!==recommendation.status||check.price_cents!==recommendation.price_cents)throw new Error('Decision changed. Evaluate again.');
 if(check.status==='MARKDOWN'){
  if(!authorized)throw new Error('Staff authorization is required.');
  if(!acknowledged){event(s,'Checkout update failed. '+b.label+' keeps its confirmed price.','failure');return finish(s);}
  b.current_cents=check.price_cents;b.checkoutVersion++;b.markdowns_used++;
  b.priceEvents.push({at:s.minute,price:b.current_cents,version:b.checkoutVersion,operationId});
 }
 b.window_committed=true;b.decision={...check,operationId};
 event(s,b.label+' · '+(check.status==='MARKDOWN'?'checkout acknowledged '+money(b.current_cents):'evaluated HOLD')+'. Window committed.',check.status==='MARKDOWN'?'drop':'hold');return finish(s);
}
export function sell(source,id){
 const s=copy(source),p=productView(s,id);if(!p.quantity)throw new Error('No available offer stock.');
 const b=s.batches.find(b=>b.id===p.batchId);b.physical_units--;b.observedAt=s.minute;s.sold++;s.revenue+=p.price;if(p.saving>0)s.surplusSold++;
 if(rawAvailable(b)===0)b.terminalAt=s.minute;
 event(s,p.symbol+' · '+money(p.price)+' sale · '+b.label+'.','sale');return finish(s);
}
export function restock(source,id,quantity=4){
 if(!Number.isInteger(quantity)||quantity<1||quantity>50)throw new Error('Restock 1–50 fresh items.');
 const s=copy(source),p=CATALOG.find(p=>p.id===id);if(!p)throw new Error('Unknown food.');
 if(s.minute>=CLOSE-5)throw new Error('Fulfillment window is closed.');
 s.batches.push(batch(p,s.sequence++,quantity,s.minute));event(s,p.symbol+' · '+quantity+' fresh items, new batch at '+money(p.base)+'.','restock');return finish(s);
}
export function observeStock(source){const s=copy(source);for(const b of s.batches)b.observedAt=s.minute;event(s,'Physical inventory reconciled in the simulator.','observation');return finish(s);}
export function setAllocations(source,id,reserved,protectedUnits,buffer){
 const s=copy(source),b=s.batches.find(b=>b.id===id);if(!b)throw new Error('Unknown batch.');
 if(![reserved,protectedUnits,buffer].every(n=>Number.isInteger(n)&&n>=0)||reserved+protectedUnits+buffer>b.physical_units)throw new Error('Allocations must be whole units within physical stock.');
 Object.assign(b,{reserved_units:reserved,protected_units:protectedUnits,buffer_units:buffer,observedAt:s.minute});
 event(s,b.label+' allocations updated.','allocation');return finish(s);
}
export function advance(source,minutes=1,{observe=true}={}){
 if(!Number.isInteger(minutes)||minutes<0||minutes>600)throw new Error('Invalid time step.');
 const s=copy(source);s.minute=Math.min(CLOSE,s.minute+minutes);
 if(observe)for(const b of s.batches)b.observedAt=s.minute;
 for(const b of s.batches)if(s.minute>=b.cutoff-b.fulfillment_buffer_minutes&&b.terminalAt===null)b.terminalAt=b.cutoff-b.fulfillment_buffer_minutes;
 if(s.promotion&&s.promotion.until<=s.minute)s.promotion=null;
 if(source.minute<CLOSE-5&&s.minute>=CLOSE-5)event(s,'5:55 PM · New availability withdrawn before the fulfillment cutoff.','closed');
 if(source.minute<CLOSE&&s.minute===CLOSE)for(const b of s.batches){
  s.transferred+=b.protected_units;s.retained+=b.physical_units-b.protected_units;
  b.physical_units=0;b.reserved_units=0;b.protected_units=0;b.buffer_units=0;
 }
 return finish(s);
}
export function triggerEvent(source,kind){
 if(!['crash','combo','rush','rescue'].includes(kind))throw new Error('Unknown event.');
 let s=copy(source);if(s.minute>=CLOSE-5)throw new Error('Start a new day to run an event.');
 s.promotion={kind,until:Math.min(CLOSE-5,s.minute+30)};
 const messages={crash:'STOCK CRASH REVIEW · Eligible bakery batches evaluated against all scenario gates.',combo:'STUDY BUDDY · Pair Buffalo Chicken + Blueberry Muffin at their independently confirmed prices.',rush:'LUNCH RUSH · Customer arrivals rise; confirmed prices hold.',rescue:'LAST-CALL REVIEW · Evaluate remaining eligible batches once. Protected stock stays protected.'};
 event(s,messages[kind],kind);s=finish(s);
 if(kind==='crash'||kind==='rescue'){
  for(const b of [...s.batches])if(kind==='rescue'||['Pastries','Bakery'].includes(CATALOG.find(p=>p.id===b.productId).category)){
   const r=evaluateBatch(s,b.id);if(r.evaluation_completed)s=executeDemoDecision(s,b.id,r,true,true,kind+'-'+b.windowId);
  }
 }
 return s;
}
export function comboView(s){const products=['buffalo','blueberry'].map(id=>productView(s,id));return {active:s.promotion?.kind==='combo'&&s.promotion.until>s.minute,available:products.every(p=>p.quantity>0),products,total:products.reduce((n,p)=>n+p.price,0),regular:products.reduce((n,p)=>n+p.base,0)};}
export function buyCombo(source){const c=comboView(source);if(!c.active||!c.available)throw new Error('This pairing is unavailable.');return buyBasket(source,{buffalo:1,blueberry:1});}
export function basketQuote(source,basket){let s=source,total=0;for(const [id,n] of Object.entries(basket)){if(!Number.isInteger(n)||n<1||n>50||productView(s,id).quantity<n)throw new Error('Stock changed. Review your basket.');for(let i=0;i<n;i++){total+=productView(s,id).price;s=sell(s,id);}}return {total,state:s};}
export function buyBasket(source,basket){return basketQuote(source,basket).state;}
export function applyTicker(source,enabled){const s=copy(source);s.preferences.ticker=!!enabled;return finish(s);}
export const SCHEDULE=[
 ...Array.from({length:15},(_,i)=>({at:500+i*10,action:'sale',id:CATALOG[i%5].id})),
 {at:660,action:'event',kind:'rush'},
 ...Array.from({length:20},(_,i)=>({at:665+i*5,action:'sale',id:FEATURED[i%6]})),
 {at:690,action:'restock',id:'buffalo',quantity:6},{at:705,action:'restock',id:'roast',quantity:6},
 {at:840,action:'event',kind:'combo'},{at:850,action:'combo'},
 {at:960,action:'event',kind:'crash'},
 ...['buffalo','roast','southwest','everything'].map(id=>({at:965,action:'review',id})),
 ...Array.from({length:20},(_,i)=>({at:975+i*5,action:'sale',id:FEATURED[i%6]})),
 {at:1050,action:'event',kind:'rescue'}
].sort((a,b)=>a.at-b.at);
export function stepSimulation(source,minutes=5){
 if(!Number.isInteger(minutes)||minutes<0||minutes>600)throw new Error('Invalid time step.');
 const until=Math.min(CLOSE,source.minute+minutes);let s=source;
 for(const e of SCHEDULE.filter(e=>e.at>source.minute&&e.at<=until)){
  s=advance(s,e.at-s.minute);
  if(e.action==='sale'&&productView(s,e.id).quantity)s=sell(s,e.id);
  else if(e.action==='restock')s=restock(s,e.id,e.quantity);
  else if(e.action==='event')s=triggerEvent(s,e.kind);
  else if(e.action==='combo'&&comboView(s).available&&comboView(s).active)s=buyCombo(s);
  else if(e.action==='review')for(const b of s.batches.filter(b=>b.productId===e.id)){const r=evaluateBatch(s,b.id);if(r.evaluation_completed)s=executeDemoDecision(s,b.id,r,true,true,'day-'+b.windowId);}
 }
 return advance(s,until-s.minute);
}
export function snapshotAt(minute){if(!Number.isInteger(minute)||minute<OPEN||minute>CLOSE)throw new Error('Invalid time.');return stepSimulation(initialState('opening'),minute-OPEN);}
