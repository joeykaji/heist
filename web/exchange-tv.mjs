import {chartSamples,hourlyPoints} from './price-history.mjs';
import {CATALOG,productView,hoursFor,money,simTime,offerAvailable} from './model.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sparkline(batch,state){
 if(!batch)return '<span class="exchange-no-history">No active batch</span>';
 if(batch.closed||(batch.terminalAt!=null&&batch.terminalAt<=state.minute)||offerAvailable(state,batch)<=0)return ''; 
 const end=Math.min(state.minute,batch.terminalAt??Infinity,batch.cutoff-batch.fulfillment_buffer_minutes,batch.observedAt+state.policy.max_count_age_minutes);
 const points=chartSamples(batch.priceEvents.filter(p=>p.at<=end)),start=points[0]?.at??end,span=Math.max(1,batch.cutoff-start),x=t=>6+(t-start)/span*168,y=p=>54-p/batch.original_cents*44;
 let path='';for(let i=0;i<points.length;i++){const p=points[i];path+=(i?' L':'M')+x(p.at)+' '+y(p.price)+(points[i+1]?'':' H'+x(end));}
 return '<svg viewBox="0 0 180 64" role="img" aria-label="'+esc(batch.label)+' confirmed price history"><path d="M6 10H174 M6 32H174 M6 54H174" class="exchange-grid"/><path d="'+path+'" class="exchange-line"/>'+hourlyPoints(batch.priceEvents.filter(p=>p.at<=end),end).map(p=>'<circle cx="'+x(p.at)+'" cy="'+y(p.price)+'" r="3"><title>'+money(p.price)+' at '+simTime(p.at)+'</title></circle>').join('')+'</svg>';
}
export function exchangeRows(state,page=0){
 const products=CATALOG.slice(page*12,page*12+12);
 return [products.slice(0,6),products.slice(6,12)].map(column=>'<div class="exchange-column"><div class="exchange-labels"><span>ITEM / AVAILABLE</span><span>PRICE / SAVING</span><span>HISTORY</span></div>'+column.map(product=>{
 const p=productView(state,product.id),batch=state.batches.find(b=>b.id===p.batchId)??state.batches.filter(b=>b.productId===product.id).at(-1),available=p.quantity>0;
 return '<article class="exchange-row"><div class="exchange-item"><strong>'+esc(p.name)+'</strong><small>'+esc(p.symbol)+' · '+(available?p.quantity+' available':'Unavailable')+'</small></div><div class="exchange-price"><strong>'+(available?money(p.price):'—')+'</strong><small class="'+(available&&p.saving?'exchange-saving':'')+'">'+(available?(p.saving?'↓ '+money(p.saving)+' saved':'Regular price'):(batch?'Last '+money(batch.current_cents):'No offer'))+'</small></div><div class="exchange-spark">'+sparkline(batch,state)+'</div></article>';
 }).join('')+'</div>').join('');
}
export function createExchange(){
 let current=null,page=0,remaining=15,rotating=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const rotationButton=document.getElementById('exchange-rotate');rotationButton.textContent=rotating?'Pause rotation':'Resume rotation';rotationButton.setAttribute('aria-pressed',String(!rotating));
 const board=document.getElementById('exchange-board'),body=document.getElementById('exchange-rows');
 function update(state){current=state;page=Math.min(page,Math.ceil(CATALOG.length/12)-1);body.innerHTML=exchangeRows(state,page);
 document.getElementById('exchange-time').textContent=simTime(state.minute)+' ET';
 document.getElementById('exchange-page').textContent='PAGE '+(page+1)+' / '+Math.ceil(CATALOG.length/12);
 document.getElementById('exchange-news').textContent=state.events[0]?.text||'Taste more. Waste less. · Confirmed prices shared with Cafe Display and Cafe Desk.';
 document.getElementById('exchange-status').textContent=state.minute>=hoursFor(state).close-5?'OFFERS CLOSED':'CONFIRMED PRICES';
 document.getElementById('exchange-countdown').textContent=rotating?'NEXT PAGE '+remaining+'s':'ROTATION PAUSED';
 }
 function turn(delta){page=(page+delta+Math.ceil(CATALOG.length/12))%Math.ceil(CATALOG.length/12);remaining=15;if(current)update(current);}
 document.getElementById('exchange-prev').onclick=()=>turn(-1);
 document.getElementById('exchange-next').onclick=()=>turn(1);
 document.getElementById('exchange-rotate').onclick=e=>{rotating=!rotating;e.target.textContent=rotating?'Pause rotation':'Resume rotation';e.target.setAttribute('aria-pressed',String(!rotating));if(current)update(current);};
 document.getElementById('exchange-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.getElementById('exchange-stage').requestFullscreen();}catch{document.getElementById('exchange-countdown').textContent='Use browser fullscreen';}};
 setInterval(()=>{if(!current||document.hidden||document.getElementById('view-exchange').hidden)return;if(rotating&&!--remaining)turn(1);document.getElementById('exchange-countdown').textContent=rotating?'NEXT PAGE '+remaining+'s':'ROTATION PAUSED';},1000);
 return {update};
}
