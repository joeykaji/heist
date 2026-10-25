export const CATALOG=[
 {id:'turkey',symbol:'TURK',name:'Turkey & cheddar',category:'Sandwiches',detail:'Turkey · cheddar · multigrain',base:600,image:'assets/turkey.png'},
 {id:'caprese',symbol:'CAPR',name:'Caprese sandwich',category:'Sandwiches',detail:'Mozzarella · tomato · basil',base:600,image:'assets/caprese.png'},
 {id:'hummus',symbol:'HUMM',name:'Hummus & veg',category:'Sandwiches',detail:'Hummus · cucumber · greens',base:500,image:'assets/hummus.png'},
 {id:'blueberry',symbol:'BLUE',name:'Blueberry muffin',category:'Bakery',detail:'Blueberries · golden crumble',base:300,image:'assets/blueberry.png'},
 {id:'butter',symbol:'CROI',name:'Butter croissant',category:'Bakery',detail:'Golden · flaky · buttery',base:400,image:'assets/butter.png'},
 {id:'chocolate',symbol:'CHOC',name:'Pain au chocolat',category:'Bakery',detail:'Flaky pastry · dark chocolate',base:450,image:'assets/chocolate.png'}
];
export const OPEN=480,CLOSE=1080;
export const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export const simTime=n=>`${Math.floor(n/60)%12||12}:${String(n%60).padStart(2,'0')} ${n>=720?'PM':'AM'}`;
const copy=s=>structuredClone(s);
const stamp=()=>new Date().toISOString();
export function initialState(preset='deals'){
 const opening=preset==='opening';
 const quantities=opening?[12,10,8,12,10,8]:[6,3,4,2,5,4];
 return {version:1,revision:0,minute:opening?OPEN:990,updatedAt:stamp(),surplusSold:opening?0:12,sold:opening?0:36,revenue:opening?0:15630,expired:0,sequence:6,
  preferences:{ticker:true},batches:CATALOG.map((p,i)=>({id:`batch-${i}`,productId:p.id,quantity:quantities[i],discount:opening?0:[0,30,15,30,15,0][i],sellBy:CLOSE})),
  events:[{text:opening?'Café opens. Fresh food at regular prices.':'Afternoon menu loaded. Four offers available.',kind:'status',at:opening?OPEN:990}]};
}
export function validState(s){
 return !!s&&s.version===1&&Number.isInteger(s.minute)&&s.minute>=OPEN&&s.minute<=CLOSE&&Number.isInteger(s.revision)&&s.revision>=0&&Number.isFinite(Date.parse(s.updatedAt))&&Number.isInteger(s.sequence)&&s.sequence>=0&&['surplusSold','sold','revenue','expired'].every(k=>Number.isInteger(s[k])&&s[k]>=0)&&s.surplusSold<=s.sold&&s.preferences&&typeof s.preferences.ticker==='boolean'&&Array.isArray(s.batches)&&s.batches.length<=500&&s.batches.every(b=>b&&typeof b.id==='string'&&CATALOG.some(p=>p.id===b.productId)&&Number.isInteger(b.quantity)&&b.quantity>=0&&b.quantity<=500&&[0,15,30,45].includes(b.discount)&&Number.isInteger(b.sellBy)&&b.sellBy>=OPEN&&b.sellBy<=CLOSE)&&new Set(s.batches.map(b=>b.id)).size===s.batches.length&&Array.isArray(s.events)&&s.events.length<=40&&s.events.every(e=>e&&typeof e.text==='string'&&e.text.length<250&&Number.isInteger(e.at)&&typeof e.kind==='string');
}
export function productView(s,id){
 const product=CATALOG.find(p=>p.id===id);
 if(!product)throw new Error('Unknown product');
 const batches=s.batches.filter(b=>b.productId===id&&b.quantity>0&&b.sellBy>s.minute).sort((a,b)=>b.discount-a.discount||a.sellBy-b.sellBy);
 const batch=batches[0];
 const discount=batch?.discount||0;
 const price=Math.round(product.base*(100-discount)/100);
 return {...product,quantity:batches.reduce((sum,b)=>sum+b.quantity,0),offerQuantity:batches.filter(b=>b.discount===discount).reduce((sum,b)=>sum+b.quantity,0),discount,price,batchId:batch?.id,saving:product.base-price};
}
function event(s,text,kind='status'){s.events.unshift({text,kind,at:s.minute});s.events=s.events.slice(0,40);}
function finish(s){s.revision++;s.updatedAt=stamp();return s;}
export function sell(source,id){
 const s=copy(source),p=productView(s,id);
 if(!p.quantity)throw new Error('This item is sold out.');
 const batch=s.batches.find(b=>b.id===p.batchId);batch.quantity--;
 s.sold++;s.revenue+=p.price;if(batch.discount>0)s.surplusSold++;
 event(s,`${p.name} sold for ${money(p.price)}. ${p.quantity-1} left.`, 'sale');return finish(s);
}
export function restock(source,id,quantity=4){
 if(!Number.isInteger(quantity)||quantity<1||quantity>50)throw new Error('Restock 1–50 items.');
 const s=copy(source),p=productView(s,id);
 if(s.minute>=CLOSE)throw new Error('The café is closed. Start a new day to restock.');
 if(p.quantity+quantity>500)throw new Error('Inventory limit reached.');
 s.batches=s.batches.filter(b=>b.quantity>0);
 s.batches.push({id:`batch-${s.sequence++}`,productId:id,quantity,discount:0,sellBy:CLOSE});
 event(s,`${quantity} fresh ${p.name.toLowerCase()} added at ${money(p.base)}.`, 'restock');return finish(s);
}
export function markdown(source,id){
 const s=copy(source),p=productView(s,id);
 if(!p.quantity)throw new Error('No stock available for a markdown.');
 const batch=s.batches.find(b=>b.id===p.batchId);
 if(batch.sellBy-s.minute>120)throw new Error('Markdowns start in the final two hours of the batch.');
 if(batch.discount>=45)throw new Error('This batch is already at the 45% demo limit.');
 batch.discount+=15;
 const after=productView(s,id);
 event(s,`${p.name} drops to ${money(after.price)} — ${after.discount}% off.`, 'drop');return finish(s);
}
export function advance(source,minutes=1){
 if(!Number.isInteger(minutes)||minutes<0||minutes>600)throw new Error('Invalid time step.');
 const s=copy(source);s.minute=Math.min(CLOSE,s.minute+minutes);
 for(const batch of s.batches)if(batch.sellBy<=s.minute&&batch.quantity){s.expired+=batch.quantity;batch.quantity=0;}
 if(source.minute<CLOSE&&s.minute===CLOSE)event(s,'Café closed. Remaining offers have ended.','closed');
 return finish(s);
}
export function applyTicker(source,enabled){const s=copy(source);s.preferences.ticker=!!enabled;return finish(s);}
// The schedule is illustrative, not a demand forecast or a tested business outcome.
export const SCHEDULE=[
 {at:510,action:'sale',id:'butter'},{at:525,action:'sale',id:'blueberry'},{at:540,action:'sale',id:'chocolate'},
 ...Array.from({length:24},(_,i)=>({at:630+i*5,action:'sale',id:CATALOG[i%6].id})),
 {at:690,action:'restock',id:'turkey',quantity:4},{at:720,action:'restock',id:'caprese',quantity:4},
 ...Array.from({length:12},(_,i)=>({at:780+i*12,action:'sale',id:CATALOG[(i+2)%6].id})),
 ...['caprese','blueberry','butter','hummus'].map(id=>({at:960,action:'markdown',id})),
 {at:975,action:'sale',id:'blueberry'},{at:985,action:'sale',id:'butter'},
 ...['caprese','blueberry'].map(id=>({at:990,action:'markdown',id})),
 ...Array.from({length:10},(_,i)=>({at:997+i*6,action:'sale',id:CATALOG[(i+1)%6].id})),
 ...['caprese','blueberry','butter'].map(id=>({at:1050,action:'markdown',id})),
 {at:1060,action:'sale',id:'blueberry'},{at:1065,action:'sale',id:'caprese'},{at:1070,action:'sale',id:'butter'}
].sort((a,b)=>a.at-b.at);
export function stepSimulation(source,minutes=5){
 const until=Math.min(CLOSE,source.minute+minutes);let s=source;
 for(const e of SCHEDULE.filter(e=>e.at>source.minute&&e.at<=until)){
  s=advance(s,e.at-s.minute);
  if(e.action==='sale'&&productView(s,e.id).quantity)s=sell(s,e.id);
  else if(e.action==='restock')s=restock(s,e.id,e.quantity);
  else if(e.action==='markdown'&&productView(s,e.id).quantity&&productView(s,e.id).discount<45)s=markdown(s,e.id);
 }
 return advance(s,until-s.minute);
}
export function snapshotAt(minute){
 if(!Number.isInteger(minute)||minute<OPEN||minute>CLOSE)throw new Error('Invalid time.');
 return stepSimulation(initialState('opening'),minute-OPEN);
}
