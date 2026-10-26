import {chartSamples,hourlyPoints} from './price-history.mjs';
import {catalogFor,productView,money,simTime,offerAvailable} from './model.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function tickerMarkup(state){
 return catalogFor(state).filter(p=>state.settings.menu[p.id].enabled).map(food=>{
  const p=productView(state,food.id),drop=p.discount.toFixed(1).replace(/\.0$/,'');
  return '<div class="ticker-item"><b class="ticker-symbol">'+esc(p.symbol)+'</b><span class="ticker-price">'+(p.quantity?money(p.price):'—')+'</span><span class="ticker-drop">'+(p.quantity?(p.saving?'↓ '+drop+'%':'0%'):'')+'</span></div>';
 }).join('');
}
export function sparkline(batch,state){
 if(!batch)return '<span class="exchange-no-history">No active batch</span>';
 if(batch.closed||(batch.terminalAt!=null&&batch.terminalAt<=state.minute)||offerAvailable(state,batch)<=0)return ''; 
 const end=Math.min(state.minute,batch.terminalAt??Infinity,batch.cutoff-batch.fulfillment_buffer_minutes,batch.observedAt+state.policy.max_count_age_minutes);
 const points=chartSamples(batch.priceEvents.filter(p=>p.at<=end)),start=points[0]?.at??end,span=Math.max(1,batch.cutoff-start),x=t=>6+(t-start)/span*168,y=p=>54-p/batch.original_cents*44;
 let path='';for(let i=0;i<points.length;i++){const p=points[i];path+=(i?' L':'M')+x(p.at)+' '+y(p.price)+(points[i+1]?'':' H'+x(end));}
 return '<svg viewBox="0 0 180 64" role="img" aria-label="'+esc(batch.label)+' confirmed price history"><path d="M6 10H174 M6 32H174 M6 54H174" class="exchange-grid"/><path d="'+path+'" class="exchange-line"/>'+hourlyPoints(batch.priceEvents.filter(p=>p.at<=end),end).map(p=>'<circle cx="'+x(p.at)+'" cy="'+y(p.price)+'" r="3"><title>'+money(p.price)+' at '+simTime(p.at)+'</title></circle>').join('')+'</svg>';
}
export function exchangeRows(state,page=0){
 const products=catalogFor(state).filter(p=>state.settings.menu[p.id].enabled).slice(page*12,page*12+12);
 return [products.slice(0,6),products.slice(6,12)].map(column=>'<div class="exchange-column"><div class="exchange-labels"><span>ITEM / AVAILABLE</span><span>PRICE / WAS</span><span>HISTORY</span></div>'+column.map(product=>{
 const p=productView(state,product.id),batch=state.batches.find(b=>b.id===p.batchId)??state.batches.filter(b=>b.productId===product.id).at(-1),available=p.quantity>0;
 return '<article class="exchange-row"><div class="exchange-item"><strong>'+esc(p.name)+'</strong><small>'+esc(p.symbol)+' · '+(available?p.quantity+' available':'Unavailable')+'</small></div><div class="exchange-price"><strong>'+(available?money(p.price):'—')+'</strong><small class="'+(available&&p.saving?'exchange-saving':'')+'">'+(available?(p.saving?'<s>Was '+money(p.base)+'</s>':'Regular price'):(batch?'Last '+money(batch.current_cents):'No offer'))+'</small></div><div class="exchange-spark">'+sparkline(batch,state)+'</div></article>';
 }).join('')+'</div>').join('');
}
export function createExchange(){
 let current=null,page=0,remaining=15,rotating=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const pageCount=()=>Math.max(1,Math.ceil(catalogFor(current).filter(p=>current.settings.menu[p.id].enabled).length/12));
 const board=document.getElementById('exchange-board'),body=document.getElementById('exchange-rows');
 function update(state){current=state;page=Math.min(page,pageCount()-1);body.innerHTML=exchangeRows(state,page);
 document.getElementById('exchange-time').textContent=simTime(state.minute)+' ET';
 document.getElementById('exchange-page').textContent='PAGE '+(page+1)+' / '+pageCount();
 }
 function turn(delta){page=(page+delta+pageCount())%pageCount();remaining=15;if(current)update(current);}
 setInterval(()=>{if(!current||document.hidden||document.getElementById('view-exchange').hidden)return;if(rotating&&!--remaining)turn(1);},1000);
 return {update};
}
