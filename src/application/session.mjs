import {randomUUID, createHash} from 'node:crypto';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {initialState, validState, migrateState, CATALOG, evaluateBatch, executeDemoDecision, offerAvailable, rawAvailable, restock, recountBatch, setAllocations, hoursFor, repriceDynamic} from '../../dist/model.mjs';
export class CommandError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const assert=(ok,message,status=400)=>{if(!ok)throw new CommandError(message,status);};
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function seed(){
 const model=initialState('opening');model.batches=model.batches.filter(b=>['southwest','buffalo','chocolate'].includes(b.productId));
 model.minute=780;for(const b of model.batches)b.observedAt=780;
 model.history=[];model.events=[];
 return {schema:1,generation:randomUUID(),revision:0,model,clock:{playing:false,speed:1},reviews:{},pending:{},orders:[],operations:{},journal:[]};
}
function fingerprint(s,b){return createHash('sha256').update(JSON.stringify({batch:b,minute:s.model.minute,policy:s.model.policy})).digest('hex');}
function batch(s,id){const b=s.model.batches.find(b=>b.id===id||b.offerId===id);assert(b,'Unknown offer',404);return b;}
function available(s,b){return b.closed||s.pending[b.id]?0:offerAvailable(s.model,b);}
function log(s,type,text,entity=null){s.journal.push({id:randomUUID(),revision:s.revision+1,generation:s.generation,at:s.model.minute,recordedAt:new Date().toISOString(),type,text,entity});s.journal=s.journal.slice(-300);}
function status(s,b){if(b.closed)return 'Closed';if(s.pending[b.id])return s.pending[b.id].state==='unknown'?'Checkout uncertain':'Awaiting confirmation';if(!b.safe_and_approved)return 'Paused';if(s.model.minute>=b.cutoff-b.fulfillment_buffer_minutes)return 'Closed';if(s.model.minute-b.observedAt>s.model.policy.max_count_age_minutes)return 'Count stale';if(rawAvailable(b)===0)return 'Sold out';return offerAvailable(s.model,b)?'Available':'Paused';}
export function snapshot(s){return {generation:s.generation,revision:s.revision,minute:s.model.minute,clock:s.clock,offers:s.model.batches.map(b=>{
 const p=CATALOG.find(p=>p.id===b.productId);return {...b,name:p.name,symbol:p.symbol,image:'/'+p.image,category:p.category,available:available(s,b),status:status(s,b),review:s.reviews[b.id]??null,pending:s.pending[b.id]??null};
}),orders:s.orders,events:[...s.journal].reverse(),policy:s.model.policy,cutoff:hoursFor(s.model).close};}
export class Session {
 constructor(state,file){this.state=state;this.file=file;this.tail=Promise.resolve();this.listeners=new Set();}
 static async open(file){let s;try{s=JSON.parse(await readFile(file,'utf8'));if(s&&s.model&&!validState(s.model)){const upgraded=migrateState(s.model);if(upgraded)s.model=upgraded;}assert(s.schema===1&&validState(s.model)&&integer(s.revision)&&typeof s.generation==='string'&&s.operations&&s.reviews&&s.pending&&Array.isArray(s.orders)&&Array.isArray(s.journal)&&typeof s.clock?.playing==='boolean'&&integer(s.clock.speed,1,10),'Invalid saved session');}catch(e){if(e.code!=='ENOENT')throw e;s=seed();}for(const b of s.model.batches)b.reference_units??=Math.max(1,b.physical_units);const service=new Session(s,file);await service.persist(s);return service;}
 async persist(s){if(!this.file)return;await mkdir(dirname(this.file),{recursive:true});const temp=this.file+'.tmp';await writeFile(temp,JSON.stringify(s),'utf8');await rename(temp,this.file);}
 get(){return snapshot(this.state);}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 command(c){const work=this.tail.then(()=>this.apply(c));this.tail=work.catch(()=>{});return work;}
 async apply(c){
 assert(c&&typeof c==='object','Command required');assert(typeof c.id==='string'&&c.id.length>=1&&c.id.length<=100,'Operation ID required');
 assert(c.generation===this.state.generation,'Session was reset; refresh before retrying',409);
 const digest=createHash('sha256').update(JSON.stringify({type:c.type,payload:c.payload??{}})).digest('hex');
 const old=this.state.operations[c.id];if(old){assert(old.digest===digest,'Operation ID reused with different input',409);return {snapshot:this.get(),result:old.result,duplicate:true};}
 assert(c.revision===this.state.revision,'State changed; refresh and try again',409);
 let s=structuredClone(this.state),result={},p=c.payload??{};
 switch(c.type){
 case 'reset': {const revision=s.revision;s=seed();s.revision=revision;log(s,'reset','Demo reset to three synthetic offers');break;}
 case 'clock': assert(typeof p.playing==='boolean'&&integer(p.speed,1,10),'Invalid clock');s.clock={playing:p.playing,speed:p.speed};log(s,'clock',p.playing?'Demo clock running':'Demo clock paused');break;
 case 'advance': {assert(integer(p.minutes,1,120),'Advance 1–120 minutes');const prior=s.model.minute;const until=Math.min(hoursFor(s.model).close,s.model.minute+p.minutes);while(s.model.minute<until){s.model.minute++;if(s.model.minute%30===0)s.model=repriceDynamic(s.model,Object.keys(s.pending));}if(s.model.minute>=hoursFor(s.model).close)s.clock.playing=false;
 for(const b of s.model.batches)if(prior<b.cutoff-b.fulfillment_buffer_minutes&&s.model.minute>=b.cutoff-b.fulfillment_buffer_minutes)b.terminalAt=b.cutoff-b.fulfillment_buffer_minutes;
 log(s,'clock','Demo advanced to '+s.model.minute+' minutes');break;}
 case 'recount': {const b=batch(s,p.offer);s.model=recountBatch(s.model,b.id,p.quantity);log(s,'inventory','Physical count reconciled',b.offerId);break;}
 case 'allocations': {const b=batch(s,p.offer);const active=s.orders.filter(o=>o.batchId===b.id&&o.status==='accepted').reduce((n,o)=>n+o.quantity,0);assert(integer(p.reserved)&&p.reserved>=active,'Reservations must cover accepted orders');s.model=setAllocations(s.model,b.id,p.reserved,p.protected,p.buffer);log(s,'inventory','Stock allocations updated',b.offerId);break;}
 case 'restock': {const b=batch(s,p.offer);s.model=restock(s.model,b.productId,p.quantity);log(s,'inventory','Fresh stock received as a separate batch',s.model.batches.at(-1).offerId);break;}
 case 'remove': {const b=batch(s,p.offer);assert(integer(p.quantity,1)&&p.quantity<=rawAvailable(b),'Removal exceeds unallocated stock');b.physical_units-=p.quantity;log(s,'inventory',p.quantity+' units removed from offer inventory',b.offerId);break;}
 case 'approval': {const b=batch(s,p.offer);assert(typeof p.approved==='boolean','Approval must be explicit');assert(!b.closed,'Closed offers cannot reopen');b.safe_and_approved=p.approved;if(!p.approved)b.terminalAt=s.model.minute;else b.terminalAt=null;log(s,'staff',p.approved?'Offer approved / resumed':'Offer paused',b.offerId);break;}
 case 'close': {const b=batch(s,p.offer);b.closed=true;b.safe_and_approved=false;b.terminalAt=s.model.minute;log(s,'staff','Staff ended offer',b.offerId);break;}
 case 'pauseAll': for(const b of s.model.batches){b.safe_and_approved=false;b.terminalAt=s.model.minute;}log(s,'staff','All offers paused');break;
 case 'review': {const b=batch(s,p.offer);assert(!s.pending[b.id],'Checkout is pending');assert(['normal','weak','missing'].includes(p.profile),'Unknown scenario profile');let r=evaluateBatch(s.model,b.id,p.profile==='weak'?'weak':'normal');if(p.profile==='missing')r={...r,status:'REVIEW',price_cents:null,evaluation_completed:false,expected_gain_cents:null,worst_gain_cents:null,rows:[],missing_inputs:['reviewed demand'],reason:'Synthetic missing-evidence scenario'};
 s.reviews[b.id]={...r,fingerprint:fingerprint(s,b),id:randomUUID()};result=s.reviews[b.id];log(s,'review','Pricing reviewed: '+r.status,b.offerId);break;}
 case 'authorize': {const b=batch(s,p.offer),r=s.reviews[b.id];assert(r&&r.id===p.review,'Review this offer first');assert(r.fingerprint===fingerprint(s,b),'Inputs changed; evaluate again',409);assert(r.evaluation_completed,'Review has no executable comparison');assert(!b.closed&&!s.pending[b.id],'Offer cannot publish');
 if(r.status==='HOLD'){s.model=executeDemoDecision(s.model,b.id,r,true,true,c.id);log(s,'hold','Evaluated hold committed',b.offerId);}else{assert(['MARKDOWN','INCREASE'].includes(r.status),'No price adjustment');assert(['ack','reject'].includes(p.providerOutcome??'ack'),'Unknown provider outcome');s.pending[b.id]={id:c.id,review:r,state:'pending',providerOutcome:p.providerOutcome??'ack'};log(s,'checkout','Staff authorized; awaiting mock checkout acknowledgment',b.offerId);}break;}
 case 'checkout': {let b=batch(s,p.offer);const pending=s.pending[b.id];assert(pending&&pending.id===p.operation,'Unknown pending checkout');assert(['ack','reject','unknown','reconcile'].includes(p.action),'Invalid checkout action');
 if(p.action==='unknown'){pending.state='unknown';log(s,'checkout','Mock checkout timed out; reconciliation required',b.offerId);break;}
 assert(pending.state!=='unknown'||p.action==='reconcile','Reconcile unknown checkout before proceeding');
 const outcome=p.action==='reconcile'?pending.providerOutcome:p.action;
 if(outcome==='ack'&&pending.review.fingerprint===fingerprint(s,b)&&!b.closed&&offerAvailable(s.model,b)>0){s.model=executeDemoDecision(s.model,b.id,pending.review,true,true,pending.id);log(s,'price','Checkout confirmed '+pending.review.price_cents+' cents',b.offerId);}
 else if(outcome==='ack'){b.safe_and_approved=false;b.terminalAt=s.model.minute;log(s,'failure','Checkout acknowledged after inputs changed; offer withdrawn for fresh reconciliation',b.offerId);}
 else log(s,'failure','Mock checkout rejected; confirmed price unchanged',b.offerId);
 delete s.pending[b.id];break;}
 case 'purchase': {const b=batch(s,p.offer);assert(integer(p.quantity,1,20),'Choose 1–20 units');assert(p.checkoutVersion===b.checkoutVersion,'Price changed; review the fresh offer',409);assert(available(s,b)>=p.quantity,'Offer unavailable or insufficient stock',409);
 b.reserved_units+=p.quantity;const order={id:c.id,batchId:b.id,offerId:b.offerId,quantity:p.quantity,priceCents:b.current_cents,checkoutVersion:b.checkoutVersion,status:'accepted',acceptedAt:s.model.minute};s.orders.push(order);assert(s.orders.length<=1000,'Reset the demo before creating more orders');result=order;log(s,'order','Accepted '+p.quantity+' × '+CATALOG.find(x=>x.id===b.productId).name,b.offerId);break;}
 case 'fulfill': {const o=s.orders.find(o=>o.id===p.order);assert(o&&o.status==='accepted','Order is not awaiting fulfillment');const b=batch(s,o.batchId);assert(s.model.minute<b.cutoff,'Fulfillment deadline reached');b.physical_units-=o.quantity;b.reserved_units-=o.quantity;o.status='fulfilled';o.fulfilledAt=s.model.minute;s.model.sold+=o.quantity;s.model.revenue+=o.quantity*o.priceCents;if(o.priceCents<b.original_cents)s.model.surplusSold+=o.quantity;log(s,'fulfillment','Order fulfilled at its accepted price',b.offerId);break;}
 default: throw new CommandError('Unknown command');
 }
 s.revision++;s.model.updatedAt=new Date().toISOString();assert(validState(s.model),'Update failed model validation');s.operations[c.id]={digest,result};assert(Object.keys(s.operations).length<=10000,'Reset the demo to clear the operation journal');await this.persist(s);this.state=s;for(const fn of this.listeners){try{fn(this.get());}catch{}}return {snapshot:this.get(),result};
 }
 async tick(){if(!this.state.clock.playing)return;try{await this.command({id:randomUUID(),generation:this.state.generation,revision:this.state.revision,type:'advance',payload:{minutes:this.state.clock.speed}});}catch(e){if(e.status!==409){this.lastClockError=e.message;}}}
}
