import {chartSamples} from './price-history.mjs';
import {createExchange,sparkline} from './exchange-tv.mjs';
import {CATALOG,CATEGORIES,FEATURED,hoursFor,migrateState,money,simTime,initialState,validState,productView,offerAvailable,rawAvailable,sell,restock,evaluateBatch,executeDemoDecision,observeStock,setAllocations,demoScenarios,triggerEvent,comboView,buyCombo,basketQuote,applyTicker,stepSimulation,snapshotAt,demand,settingsFor,updateSettings,startPlannedDay,receiveStock,recountBatch,jumpToRush,endDeal} from './model.mjs';
import {createCase} from './case.mjs';
const $=id=>document.getElementById(id),KEY='marketbite-connections-v3',escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search),displayOnly=['1','exchange'].includes(params.get('display'));
let view=displayOnly?(params.get('display')==='exchange'?'exchange':'tv'):params.get('view')||'home',state,playing=false,timer=null,storageAvailable=true,page=0,tvCategory='featured',selectedBatch='batch-5',decision=null,basket={},dealsOnly=false,caseScene=null;
function read(){try{const s=JSON.parse(localStorage.getItem(KEY));if(validState(s))return s;const migrated=migrateState(s);if(migrated){localStorage.setItem(KEY+'-before-hours-update',JSON.stringify(s));localStorage.setItem(KEY,JSON.stringify(migrated));return migrated;}}catch{storageAvailable=false;}return null;}
state=read()||initialState();
const exchange=createExchange();
const timeFormat=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',second:'2-digit'});
const pct=n=>n.toFixed(1).replace(/\.0$/,'');
let toastTimer;
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageAvailable=false;}}
function commit(next){if(!validState(next))throw new Error('The update did not pass validation.');const prior=state;state=next;save();render(prior);}
async function change(fn,{stop=true}={}){
 if(stop)pause();
 const run=()=>{const latest=read();if(latest)state=latest;try{const next=fn(state);if(next)commit(next);}catch(e){toast(e.message);}};
 // Browser-local locking serializes demo publications and stock changes across tabs.
 if(navigator.locks)await navigator.locks.request(KEY,run);else run();
}
function showView(next,push=true){
 view=next==='simulation'?'tv':['home','tv','exchange','mobile','sustainability','inventory'].includes(next)?next:'home';
 for(const id of ['home','tv','exchange','mobile','simulation','sustainability','inventory'])$('view-'+id).hidden=id==='simulation'?view!=='tv'||displayOnly:id!==view;
 document.querySelectorAll('.workspace-bar [data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(push&&!displayOnly){history.pushState({},'', '?view='+view);window.scrollTo(0,0);}
 if(view==='tv'&&!displayOnly){if(!caseScene)caseScene=createCase($('case-stage'));caseScene?.setState(state);caseScene?.resize();}
 if(view==='tv')resize();render();
}
function revealSection(id){const target=$(id);if(!target)return;for(let node=target;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});}
document.querySelectorAll('[data-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showView(a.dataset.view);if(a.hash)revealSection(a.hash.slice(1));}));
window.addEventListener('popstate',()=>showView(new URLSearchParams(location.search).get('view')||'home',false));
if(displayOnly){document.body.classList.add(view==='exchange'?'exchange-only':'tv-only');$('tv-tools').hidden=false;if(view==='exchange')$('tv-tools').querySelector('a').href='?view=exchange';}
function resize(){const r=$('tv-stage').getBoundingClientRect();if(!r.width)return;const scale=Math.min(r.width/1920,r.height/1080);$('tv').style.transform=document.fullscreenElement===$('tv-stage')?'translate(-50%,-50%) scale('+scale+')':'scale('+scale+')';}
new ResizeObserver(resize).observe($('tv-stage'));window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
for(const id of ['tv-category','inventory-category'])for(const c of CATEGORIES){const o=document.createElement('option');o.value=c;o.textContent=c;$(id).append(o);}
function tvProducts(){return tvCategory==='featured'?FEATURED.map(id=>CATALOG.find(p=>p.id===id)):tvCategory==='all'?CATALOG:CATALOG.filter(p=>p.category===tvCategory);}
function renderTV(previous){
 const products=tvProducts(),pages=Math.ceil(products.length/6);page=Math.min(page,pages-1);
 $('page-number').textContent=(page+1)+' / '+pages;$('prev-page').disabled=pages<2;$('next-page').disabled=pages<2;
 $('product-grid').innerHTML=products.slice(page*6,page*6+6).map(product=>{
  const p=productView(state,product.id),was=previous?productView(previous,p.id):null;
  return '<article class="food-card '+(p.saving?'discounted ':'')+(!p.quantity?'sold-out ':'')+(was&&p.price<was.price?'updated':'')+'" aria-label="'+escape(p.name)+' '+(p.quantity?money(p.price):'unavailable')+'"><div class="food-photo"><img src="'+p.image+'" alt="'+escape(p.name)+'"><span class="food-badge '+(p.quantity&&!p.saving?'regular':'')+'">'+(!p.quantity?'UNAVAILABLE':p.saving?'↓ '+pct(p.discount)+'% OFF':p.category.toUpperCase())+'</span>'+(p.quantity?'<span class="stock-badge '+(p.offerQuantity<=3?'low':'')+'">'+p.offerQuantity+' AT THIS PRICE</span>':'')+'</div><div class="food-info"><div><span class="food-symbol">'+p.symbol+'</span><h2 class="food-name">'+escape(p.name)+'</h2></div><div class="food-price"><strong>'+(p.quantity?money(p.price):'Unavailable')+'</strong><span class="old-price">'+(p.quantity?(p.saving?'was <s>'+money(p.base)+'</s>':'Regular price'):'')+'</span><span class="saving">'+(p.quantity&&p.saving?'Save '+money(p.saving):'')+'</span></div></div></article>';
 }).join('');
 const offers=CATALOG.map(p=>productView(state,p.id)).filter(p=>p.quantity&&p.saving);
 const promotion=state.promotion;
 $('menu-status').textContent=state.minute>=hoursFor(state).close-5?'OFFERS ENDED':promotion?({crash:'STOCK CRASH',combo:'STUDY BUDDY',rush:(promotion.rushType||'lunch').toUpperCase()+' RUSH',rescue:'LAST-CALL OFFERS'}[promotion.kind]):offers.length?'PRICE DROPS NOW':'FRESH IN THE CASE';
 const combo=comboView(state);
 $('menu-message').textContent=state.minute>=hoursFor(state).close-5?'Thanks for making every bite count.':promotion?.kind==='combo'&&combo.available?combo.products.map(p=>p.symbol).join(' & ')+' · '+money(combo.total)+' together':promotion?.kind==='rush'?'The '+(promotion.rushType||'lunch')+' rush is on. Your confirmed prices hold.':offers.length?'Good food. A little less. A lot less waste.':'Sandwiches, bagels, pastries & something sweet.';
 $('day-clock').textContent=simTime(state.minute);$('tv-impact').textContent=state.surplusSold+' surplus items sold · demo';$('updated').textContent='Synced '+timeFormat.format(new Date(state.updatedAt));
 $('sync-status').textContent=storageAvailable?'Connected across tabs in this browser':'Session only · browser storage unavailable';
 renderTicker();
}
$('tv-category').onchange=e=>{tvCategory=e.target.value;page=0;renderTV();};
$('prev-page').onclick=()=>{page=(page-1+Math.ceil(tvProducts().length/6))%Math.ceil(tvProducts().length/6);renderTV();};
$('next-page').onclick=()=>{page=(page+1)%Math.ceil(tvProducts().length/6);renderTV();};
let tickerSignature='';
function renderTicker(){
 const signature=JSON.stringify([CATALOG.map(p=>{const v=productView(state,p.id);return [v.price,v.quantity];}),state.promotion?.kind,state.events[0]?.text]);
 if(signature!==tickerSignature){
  tickerSignature=signature;
  const content=CATALOG.map(product=>{const p=productView(state,product.id);return '<div class="ticker-item"><span class="ticker-symbol">'+p.symbol+'</span><span class="ticker-price">'+(p.quantity?money(p.price):'UNAVAILABLE')+'</span>'+(p.quantity&&p.saving?'<span class="ticker-drop">SAVE '+money(p.saving)+' · '+pct(p.discount)+'%</span>':'')+'<span class="ticker-quantity">'+p.quantity+' AVAILABLE</span></div>';}).join('')+'<span class="ticker-item ticker-news">'+escape(state.events[0]?.text||'Taste more. Waste less.')+'</span>';
  $('ticker-track').innerHTML='<div class="ticker-group">'+content+'</div><div class="ticker-group" aria-hidden="true">'+content+'</div>';
 }
 $('ticker-track').classList.toggle('paused',!state.preferences.ticker);
 for(const id of ['ticker-toggle']){$(id).textContent=state.preferences.ticker?'Pause ticker':'Resume ticker';$(id).setAttribute('aria-pressed',String(!state.preferences.ticker));}
}
for(const id of ['ticker-toggle'])$(id).onclick=()=>change(s=>applyTicker(s,!s.preferences.ticker),{stop:false});
function renderInventory(){
 const cat=$('inventory-category').value;
 $('inventory-list').innerHTML=CATALOG.filter(p=>cat==='all'||p.category===cat).map(product=>{
 const p=productView(state,product.id);return '<div class="inventory-row"><div class="inventory-product"><img src="'+p.image+'" alt=""><div><strong>'+escape(p.name)+'</strong><span>'+p.symbol+' · '+p.quantity+' available</span></div></div><div class="inventory-values"><b>'+(p.quantity?money(p.price):'—')+'</b><span>Regular '+money(p.base)+'</span></div><div class="inventory-actions"><button data-sell="'+p.id+'" '+(!p.quantity?'disabled':'')+'>Sell 1</button><button data-restock="'+p.id+'" '+(state.minute>=hoursFor(state).close-5?'disabled':'')+'>+4 fresh</button><button data-review="'+p.id+'">Review</button></div></div>';
 }).join('');
}
$('inventory-category').onchange=renderInventory;
$('inventory-list').onclick=e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.sell)change(s=>sell(s,b.dataset.sell));
 if(b.dataset.restock)change(s=>restock(s,b.dataset.restock));
 if(b.dataset.review){pause();showView('inventory');selectedBatch=productView(state,b.dataset.review).batchId||state.batches.find(bat=>bat.productId===b.dataset.review).id;$('decision-batch').value=selectedBatch;$('chart-batch').value=selectedBatch;evaluate();revealSection('decision-result');}
};
function renderActivity(){
 $('activity-list').replaceChildren(...state.events.slice(0,15).map(e=>{const li=document.createElement('li'),t=document.createElement('time'),span=document.createElement('span');t.textContent=simTime(e.at);span.textContent=e.text;if(e.kind==='drop')span.className='event-drop';li.append(t,span);return li;}));
 $('activity-count').textContent='Latest updates';
 $('impact-stats').textContent=state.surplusSold+' discounted sales · '+state.transferred+' transferred · '+state.retained+' retained · '+state.discarded+' discarded (demo).';
}
function batchOptions(){
 for(const id of ['chart-batch','decision-batch']){
 const prior=$(id).value||selectedBatch,signature=state.batches.map(b=>b.id+':'+b.window_committed).join(',');
 if($(id).dataset.signature!==signature){$(id).dataset.signature=signature;$(id).innerHTML=state.batches.map(b=>'<option value="'+b.id+'">'+b.label+(b.window_committed?' · committed':'')+'</option>').join('');}
 $(id).value=state.batches.some(b=>b.id===prior)?prior:state.batches[0].id;
 }
}
function chart(id,points,max,format,step=false,end=state.minute,color='#0f2d44'){
 const {open,close}=hoursFor(state),x=t=>45+(t-open)/(close-open)*330,y=v=>77-v/max*55;
 let d='';
 for(const [i,p] of points.entries()){d+=(i?'L':'M')+x(p.at)+' '+y(p.value)+' ';if(step&&i<points.length-1)d+='L'+x(points[i+1].at)+' '+y(p.value)+' ';}
 const latest=points.at(-1);if(step&&latest&&end>latest.at)d+='L'+x(end)+' '+y(latest.value);
 $(id).setAttribute('viewBox','0 0 400 113');
 $(id).innerHTML=[0,max/2,max].map(v=>'<line x1="45" y1="'+y(v)+'" x2="375" y2="'+y(v)+'" stroke="#e4ebee"/><text x="37" y="'+(y(v)+3)+'" text-anchor="end">'+format(v)+'</text>').join('')+'<text x="45" y="102">'+simTime(open)+'</text><text x="210" y="102" text-anchor="middle">'+simTime(Math.round((open+close)/2))+'</text><text x="375" y="102" text-anchor="end">'+simTime(close)+'</text>'+(latest?'<circle cx="'+x(Math.min(latest.at,end))+'" cy="'+y(latest.value)+'" r="3" fill="'+color+'"/>':'')+(d?'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2.5"/>':'')+'<line x1="'+x(state.minute)+'" x2="'+x(state.minute)+'" y1="15" y2="80" stroke="#bdc9d0" stroke-dasharray="3 4"/>';
}
function renderCharts(){
 const b=state.batches.find(b=>b.id===$('chart-batch').value)||state.batches[0],available=offerAvailable(state,b)>0;
 $('chart-price').textContent=available?money(b.current_cents):'Offer unavailable';
 const terminal=b.terminalAt??(available?state.minute:Math.min(state.minute,b.observedAt+state.policy.max_count_age_minutes));
 chart('price-chart',chartSamples(b.priceEvents).map(e=>({at:e.at,value:e.price})),b.original_cents,v=>'$'+(v/100).toFixed(2),false,terminal);
 $('chart-stock').textContent=state.history.at(-1).stock+' units';
 chart('stock-chart',state.history.map(e=>({at:e.at,value:e.stock})),Math.max(10,...state.history.map(e=>e.stock)),v=>Math.round(v),true);
 $('chart-demand').textContent=demand(state)+' / 100';
 chart('demand-chart',state.history.map(e=>({at:e.at,value:e.demand})),100,v=>Math.round(v),false,state.minute,'#d2a329');
}
$('chart-batch').onchange=renderCharts;
$('decision-batch').onchange=()=>{selectedBatch=$('decision-batch').value;decision=null;renderDecision();};
function evaluate(){pause();decision=evaluateBatch(state,$('decision-batch').value,$('scenario-profile').value);renderDecision();}
$('evaluate').onclick=()=>{try{evaluate();}catch(e){toast(e.message);}};
$('observe').onclick=()=>change(s=>observeStock(s));
function renderDecision(){
 const b=state.batches.find(b=>b.id===$('decision-batch').value);if(!b)return;
 for(const [input,k] of [['reserved','reserved_units'],['protected','protected_units'],['buffer','buffer_units']])if(document.activeElement!==$(input))$(input).value=b[k];
 if(document.activeElement!==$('physical-count'))$('physical-count').value=b.physical_units;
 $('scenario-table').innerHTML='<p>Dynamic prices follow unallocated stock and time before closing. Sales can raise prices; unsold stock gradually lowers them. Evaluated every 30 simulated minutes. Each adjustment is capped at 5% of regular price.</p>';
 $('publish-price').hidden=true;$('fail-price').hidden=true;
 if(!decision){$('decision-result').innerHTML='<p>Physical '+b.physical_units+' − reserved '+b.reserved_units+' − protected '+b.protected_units+' − buffer '+b.buffer_units+' = '+rawAvailable(b)+' offer units. '+(b.window_committed?'Dynamic pricing is active.':'Prices update with time and purchases.')+'</p>';return;}
 const d=decision;
 $('decision-result').innerHTML='<span class="result-status '+d.status.toLowerCase()+'">'+d.status+'</span><p>'+escape(d.reason)+'</p>'+(d.floor_cents!==null?'<p>Floor '+money(d.floor_cents)+' · '+d.available+' offer units'+''+'</p>':'')+(d.rows.length?'<table><thead><tr><th>Candidate</th><th>Expected sales</th><th>Expected gain</th><th>Worst listed gain</th><th>Passes gates</th></tr></thead><tbody>'+d.rows.map(r=>'<tr class="'+(r.admissible?'accepted':'')+'"><td>'+money(r.price_cents)+(r.price_cents===d.price_cents?' · selected':'')+'</td><td>'+r.expected_sales.toFixed(2)+'</td><td>'+money(r.expected_gain_cents)+'</td><td>'+money(r.worst_gain_cents)+'</td><td>'+(r.admissible?'Yes':r.price_cents===b.current_cents?'Baseline':'No')+'</td></tr>').join('')+'</tbody></table>':'');
 if(d.evaluation_completed&&!b.window_committed){$('publish-price').hidden=false;$('publish-price').textContent=d.status!=='HOLD'?'Publish '+money(d.price_cents)+' to demo screens':'Keep this price for this batch';$('fail-price').hidden=d.status==='HOLD';}
}
$('publish-price').onclick=()=>{const d=decision;if(!d)return;change(s=>executeDemoDecision(s,d.batchId,d,true,true,'manual-'+d.windowId+'-'+d.checkoutVersion)).then(()=>{decision=null;renderDecision();});};
$('fail-price').onclick=()=>{const d=decision;if(d)change(s=>executeDemoDecision(s,d.batchId,d,true,false,'failed-'+d.windowId));};
$('save-allocations').onclick=()=>change(s=>setAllocations(s,$('decision-batch').value,Number($('reserved').value),Number($('protected').value),Number($('buffer').value))).then(()=>{decision=null;renderDecision();});
$('scenario-profile').onchange=()=>{decision=null;renderDecision();};
function updatePlayback(){for(const id of ['pause-day','mobile-pause','mobile-mini-play','exchange-play'])$(id).textContent=playing?'Pause':'Play';for(const id of ['pause-day','mobile-pause','mobile-mini-play','exchange-play'])$(id).disabled=!playing&&state.minute>=hoursFor(state).close;$('run-day').textContent=playing?'Restart day':'Replay day';$('exchange-playback-status').textContent=playing?'Playing':state.minute>=hoursFor(state).close?'Day complete':'Paused';$('exchange-replay').textContent=playing?'Restart day':'Replay day';}
function pause(){clearInterval(timer);timer=null;playing=false;updatePlayback();}
function start(){if(state.minute>=hoursFor(state).close)return;clearInterval(timer);playing=true;updatePlayback();timer=setInterval(async()=>{await change(s=>stepSimulation(s,5),{stop:false});if(state.minute>=hoursFor(state).close)pause();},60000/((hoursFor(state).close-hoursFor(state).open)/5)/Number($('speed').value));}
$('run-day').onclick=()=>change(s=>startPlannedDay(s)).then(()=>{decision=null;start();});
$('pause-day').onclick=()=>playing?pause():start();
$('speed').onchange=()=>{$('exchange-speed').value=$('speed').value;if(playing)start();};
$('exchange-speed').onchange=e=>{$('speed').value=e.target.value;if(playing)start();};
$('exchange-play').onclick=$('pause-day').onclick;
$('exchange-replay').onclick=$('run-day').onclick;
$('exchange-forward').onclick=()=>change(s=>stepSimulation(s,5));
$('reset').onclick=()=>{basket={};decision=null;change(s=>initialState('deals',settingsFor(s)));};
$('day-slider').oninput=e=>{const minute=Number(e.target.value);basket={};decision=null;change(s=>snapshotAt(minute,settingsFor(s)));};
$('exchange-slider').oninput=$('day-slider').oninput;
document.querySelectorAll('[data-event]').forEach(button=>button.onclick=async()=>{
 const kind=button.dataset.event;await change(s=>triggerEvent(s,kind,kind==='combo'?{title:'Study Buddy',ids:['buffalo','blueberry']}:{ }));toast(kind==='crash'||kind==='rescue'?'Eligible batches reviewed. Confirmed prices stay in place.':'Sandwich & muffin pairing is on the mobile menu.');
});
$('open-deals').onclick=()=>{showView('inventory');revealSection('deal-desk');};
function renderMobile(){
 const search=$('menu-search').value.trim().toLowerCase();
 $('mobile-open').textContent=state.minute<hoursFor(state).close-5?'Offers available · demo '+simTime(state.minute):'Offers ended for today';
 $('mobile-updated').textContent='Updated '+simTime(state.minute);
 const drops=CATALOG.map(p=>productView(state,p.id)).filter(p=>p.quantity>0&&p.saving>0);
 $('mobile-drops').hidden=!drops.length;
 $('mobile-drops').innerHTML=drops.length?'<div class="mobile-drops-heading"><h3>Price drops now</h3><span>'+drops.length+' FOODS</span></div><p>'+drops.slice(0,2).map(p=>escape(p.name)+' · '+money(p.price)+' <s>'+money(p.base)+'</s>').join('<br>')+'</p><button id="show-price-drops">'+(dealsOnly?'Show the full menu':'See all '+drops.length+' price drops')+' →</button>':'';
 renderAlerts(drops);
 const promo=state.promotion,c=comboView(state);
 $('mobile-promotion').innerHTML=promo?'<div class="mobile-deal"><strong>'+escape(promo.title||({crash:'The Bakery Stock Crash',combo:'Study Buddy Pairing',rush:'Rush Is On',rescue:'Last-call Offers'}[promo.kind]))+'</strong><p>'+({crash:'Freshly confirmed savings on eligible bakery batches. Catch your favorite while it lasts.',combo:c.products.map(p=>escape(p.name)).join(' & ')+' · '+money(c.total)+' together. Each item keeps its confirmed price.',rush:'The '+escape(promo.rushType||'lunch')+' rush is on. Confirmed prices hold.',rescue:'Find eligible surplus offers before the selling window closes.'}[promo.kind])+'</p><p>Event ends at '+simTime(promo.until)+'</p>'+(promo.kind==='combo'?'<button id="add-combo" '+(!c.available?'disabled':'')+'>'+(c.available?'Add both to basket':'Pairing unavailable')+'</button>':'')+'</div>':'';
 const matches=CATALOG.filter(p=>(!search||(p.name+' '+p.symbol+' '+p.category).toLowerCase().includes(search))&&(!dealsOnly||(productView(state,p.id).saving>0&&productView(state,p.id).quantity>0)));
 $('mobile-menu').innerHTML=matches.length?CATEGORIES.map((category,i)=>{
 const products=matches.filter(p=>p.category===category);if(!products.length)return '';
 return '<section class="mobile-menu-section" id="mobile-category-'+i+'"><h3>'+category+'</h3>'+products.map(product=>{
 const p=productView(state,product.id),priceBatch=state.batches.find(b=>b.id===p.batchId)??state.batches.filter(b=>b.productId===product.id).at(-1);return '<article class="mobile-card '+(!p.quantity?'unavailable':p.saving?'discounted':'')+'"><div class="mobile-card-info"><span class="mobile-symbol">'+p.symbol+'</span><h4>'+escape(p.name)+'</h4><div class="mobile-price">'+(p.quantity?money(p.price):'Unavailable')+(p.quantity&&p.saving?'<s>'+money(p.base)+'</s>':'')+'</div>'+(p.quantity&&p.saving?'<div class="mobile-drop">↓ '+pct(p.discount)+'% · Save '+money(p.saving)+'</div>':'')+'<div class="mobile-quantity">'+(p.quantity?p.offerQuantity+' at this price · '+simTime(p.priceAt):'Check back for fresh stock')+'</div><div class="mobile-item-history"><span>Price history</span>'+sparkline(priceBatch,state)+'</div></div><div class="mobile-thumb"><img src="'+p.image+'" alt="'+escape(p.name)+'" loading="lazy"><button class="mobile-add" data-add="'+p.id+'" aria-label="Add '+escape(p.name)+'" '+(!p.quantity?'disabled':'')+'>+</button></div></article>';
 }).join('')+'</section>';
 }).join(''):'<p class="empty-menu">No matching foods. Try another search or clear the price-drop filter.</p>';
 $('deals-only').setAttribute('aria-pressed',String(dealsOnly));renderBasket();
}
function renderAlerts(drops){
 const best=[...drops].sort((a,b)=>b.saving-a.saving)[0],promo=state.promotion;
 const eventActive=promo&&['crash','rescue','combo'].includes(promo.kind);
 const eventTitle=eventActive?(promo.title||({crash:'Bakery stock crash',rescue:'Last-call offers',combo:'Food pairing'}[promo.kind])):'Catch the next stock crash';
 const eventCopy=eventActive?'On the menu until '+simTime(promo.until)+'. Check the confirmed prices and remaining stock.':'Bakery price drops and last-call offers appear here when launched from Cafe Display.';
 const cards=[
  ['↓','PRICE DROP',best?escape(best.name)+' · '+money(best.price):'Your next deal starts here',best?'Save '+money(best.saving)+' from '+money(best.base)+'. '+best.offerQuantity+' available at this price.':'No discounted food is available at this point in the day. Play the day to watch for new offers.'],
  ['↘',eventActive?'ON THE MENU':'MARKET WATCH',escape(eventTitle),eventCopy],
  ['&','SAVE MORE. WASTE LESS.',best?'Save '+money(best.saving)+'. Give good food a chance.':'Good food deserves a buyer.',(best?'Choose an available surplus offer to help food move before its selling window ends. ':'Timely offers help prepared food find a buyer. ')+state.surplusSold+' surplus items sold in this demo.'],
  ['↗','FOLLOW THE PRICE','Find the best deal available now.','Compare current savings with the Price drops filter. Prices and stock update with the cafe simulation; future prices and availability are not guaranteed.']
 ];
 $('alerts-time').textContent='Menu updates · '+simTime(state.minute);
 $('alert-bubbles').innerHTML=cards.map(([icon,label,title,body])=>'<article class="alert-bubble"><span class="alert-icon" aria-hidden="true">'+icon+'</span><div><span class="eyebrow">'+label+'</span><h3>'+title+'</h3><p>'+body+'</p></div></article>').join('');
}
$('alerts-show-deals').onclick=()=>{dealsOnly=true;$('menu-search').value='';renderMobile();revealSection('phone-scroll');};
$('menu-search').oninput=renderMobile;
$('deals-only').onclick=()=>{dealsOnly=!dealsOnly;renderMobile();};
$('mobile-drops').onclick=e=>{if(e.target.closest('#show-price-drops')){dealsOnly=!dealsOnly;$('menu-search').value='';renderMobile();$('mobile-menu').scrollIntoView({behavior:'smooth',block:'start'});}};
function add(id){const p=productView(state,id);if((basket[id]||0)>=p.quantity){toast('All available '+p.symbol+' units are already in your basket.');return;}basket[id]=(basket[id]||0)+1;renderBasket();toast(p.name+' added.');}
$('mobile-menu').onclick=e=>{const b=e.target.closest('[data-add]');if(b)add(b.dataset.add);};
$('mobile-promotion').onclick=e=>{if(e.target.id==='add-combo'){const c=comboView(state);if(c.available){for(const p of c.products)add(p.id);}}};
$('categories').onclick=()=>{$('category-dialog').showModal();$('categories').setAttribute('aria-expanded','true');};
$('category-dialog').addEventListener('close',()=>$('categories').setAttribute('aria-expanded','false'));
$('category-links').innerHTML=CATEGORIES.map((c,i)=>'<button data-category="'+i+'">'+c+'</button>').join('');
$('category-links').onclick=e=>{const b=e.target.closest('[data-category]');if(!b)return;$('menu-search').value='';dealsOnly=false;renderMobile();$('category-dialog').close();const section=$('mobile-category-'+b.dataset.category),phone=$('phone-scroll');if(section)phone.scrollTo({top:section.getBoundingClientRect().top-phone.getBoundingClientRect().top+phone.scrollTop-document.querySelector('.mobile-search').offsetHeight,behavior:'smooth'});};
$('mobile-info').onclick=()=>$('info-dialog').showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
function renderBasket(){
 const count=Object.values(basket).reduce((a,b)=>a+b,0);let total=null;try{total=basketQuote(state,basket).total;}catch{}
 $('basket-open').hidden=!count;$('basket-label').textContent=count+' item'+(count===1?'':'s')+' · View basket';$('basket-total').textContent=total===null?'Review stock':money(total);
 $('basket-items').innerHTML=Object.entries(basket).map(([id,n])=>{const p=productView(state,id);return '<div><div><strong>'+escape(p.name)+'</strong><small>'+n+' × current offer '+money(p.price)+(n>p.quantity?' · exceeds stock':'')+'</small></div><button data-remove="'+id+'" aria-label="Remove one '+escape(p.name)+'">−</button></div>';}).join('')+(count?'<div><strong>Current total</strong><strong>'+(total===null?'Review stock':money(total))+'</strong></div>':'<p>Your basket is empty.</p>');
 $('checkout').disabled=!count||total===null;
}
$('basket-open').onclick=()=>{renderBasket();$('basket-dialog').showModal();};
$('basket-items').onclick=e=>{const id=e.target.closest('[data-remove]')?.dataset.remove;if(!id)return;if(--basket[id]===0)delete basket[id];renderBasket();};
$('checkout').onclick=async()=>{let success=false;await change(s=>{const result=basketQuote(s,basket);success=true;return result.state;});if(success){basket={};renderBasket();$('basket-dialog').close();toast('Demo purchase complete. Case inventory updated.');}};
function render(previous){
 exchange.update(state);renderHours();renderSustainability();renderDesk();renderTV(previous);batchOptions();renderInventory();renderActivity();renderCharts();renderDecision();renderMobile();
 $('simulation-time').textContent=simTime(state.minute);$('mobile-demo-time').textContent=simTime(state.minute);$('mobile-live-time').textContent='DEMO / '+simTime(state.minute);$('mobile-day-slider').value=state.minute;$('day-slider').value=state.minute;$('exchange-slider').value=state.minute;$('exchange-slider').setAttribute('aria-valuetext',simTime(state.minute));$('exchange-playback-time').textContent=simTime(state.minute);$('exchange-forward').disabled=state.minute>=hoursFor(state).close;
 $('total-stock').textContent=state.batches.reduce((n,b)=>n+offerAvailable(state,b),0);$('total-sold').textContent=state.sold;updatePlayback();caseScene?.setState(state);
}
function syncLatest(){
 const next=read();if(!next||(next.revision===state.revision&&next.updatedAt===state.updatedAt))return;
 // A purchase or price update at the current time must not stop the day playing in another tab.
 // A different time or restarted run yields playback to that tab instead of advancing twice.
 if(next.minute!==state.minute||next.revision<state.revision)pause();
 const old=state;state=next;decision=null;render(old);
}
window.addEventListener('storage',e=>{if(e.key===KEY)syncLatest();});
window.addEventListener('focus',syncLatest);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncLatest();});
let toolsTimer;if(displayOnly)window.addEventListener('pointermove',()=>{document.body.classList.add('show-tools');clearTimeout(toolsTimer);toolsTimer=setTimeout(()=>document.body.classList.remove('show-tools'),2500);});
function clock(){const now=new Date();$('clock').textContent=timeFormat.format(now);$('clock').dateTime=now.toISOString();}

let deskSignature='',planDirty=false,hoursSignature='',hoursDirty=false;
const clockInput=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const minuteInput=value=>{if(!/^\d{2}:\d{2}$/.test(value))throw new Error('Choose opening and closing times.');const [h,m]=value.split(':').map(Number);return h*60+m;};
function renderHours(){
 $('exchange-open').textContent=simTime(hoursFor(state).open);$('exchange-close').textContent=simTime(hoursFor(state).close);
 const {open,close}=hoursFor(state),signature=open+':'+close;
 if(signature!==hoursSignature&&!hoursDirty){$('hours-open').value=clockInput(open);$('hours-close').value=clockInput(close);hoursSignature=signature;}
 for(const id of ['day-slider','mobile-day-slider','exchange-slider']){$(id).min=open;$(id).max=close;}
 $('timeline-labels').innerHTML='<span>'+simTime(open)+' · Open</span><span>'+simTime(close-120)+' · Review</span><span>'+simTime(close)+' · Close</span>';
 $('mobile-hours').textContent='Cafe hours · '+simTime(open)+'–'+simTime(close);rushAvailability();
}
function renderSustainability(){
 $('sustainability-counts').innerHTML=[['Surplus items sold',state.surplusSold],['Transferred',state.transferred],['Retained at close',state.retained],['Discarded',state.discarded]].map(([label,value])=>'<div><strong>'+value+'</strong><span>'+label+'</span></div>').join('');
}
$('hours-form').oninput=()=>{hoursDirty=true;$('hours-status').textContent='Unsaved hours';};
$('hours-form').onsubmit=e=>{e.preventDefault();change(s=>{const cfg=structuredClone(settingsFor(s));cfg.hours={open:minuteInput($('hours-open').value),close:minuteInput($('hours-close').value)};const next=startPlannedDay(s,cfg);hoursDirty=false;decision=null;basket={};$('hours-status').textContent='Hours applied · new day started';toast('Cafe hours updated on every screen.');return next;});};
const settingsCopy=()=>structuredClone(settingsFor(state));
function renderDesk(){
 $('desk-time').textContent='DEMO TIME · '+simTime(state.minute);
 const cfg=settingsFor(state),signature=JSON.stringify(cfg);
 if(signature!==deskSignature&&!planDirty){
  deskSignature=signature;
  $('opening-rows').innerHTML=CATALOG.map(p=>{const m=cfg.menu[p.id];return '<tr><th><b>'+escape(p.name)+'</b><small>'+p.symbol+'</small></th>'+[['stock',m.stock,'1','0','200'],['price',(m.price/100).toFixed(2),'.01','.01','100'],['floor',(m.floor/100).toFixed(2),'.01','.01','100'],['cost',(m.cost/100).toFixed(2),'.01','0','100']].map(([key,value,step,min,max])=>'<td><input aria-label="'+escape(p.name)+' '+key+'" data-plan="'+p.id+'" data-field="'+key+'" type="number" value="'+value+'" step="'+step+'" min="'+min+'" max="'+max+'" required></td>').join('')+'</tr>';}).join('');
 }
 const d=state.promotion;
 $('deal-preview').textContent=d?'ON AIR / '+(d.title||({combo:'Study Buddy',crash:'Bakery Stock Crash',rush:'Rush',rescue:'Last-call Offers'}[d.kind]))+' · ends '+simTime(d.until):'No offer announcement is running. Confirmed prices are still available.';
}
$('opening-form').oninput=()=>{planDirty=true;$('plan-status').textContent='Unsaved opening plan';};
function openingSettings(){
 const cfg=settingsCopy();
 for(const input of document.querySelectorAll('[data-plan]'))cfg.menu[input.dataset.plan][input.dataset.field]=input.dataset.field==='stock'?Number(input.value):cents(input.value);
 return cfg;
}
function cents(text){if(!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(String(text)))throw new Error('Enter prices with at most two decimal places.');return Math.round(Number(text)*100);}
$('save-plan').onclick=()=>{if(!$('opening-form').reportValidity())return;change(s=>{const next=updateSettings(s,openingSettings());planDirty=false;$('plan-status').textContent='Saved for the next day or fresh batch';return next;});};
$('opening-form').onsubmit=e=>{e.preventDefault();change(s=>{const next=startPlannedDay(s,openingSettings());planDirty=false;decision=null;basket={};$('plan-status').textContent='Plan applied · new day started';toast('Opening plan is now on every screen.');return next;});};
for(const id of ['receive-product','deal-first','deal-second'])$(id).innerHTML=CATALOG.map(p=>'<option value="'+p.id+'">'+escape(p.name)+'</option>').join('');
function receiveDefaults(){const m=settingsFor(state).menu[$('receive-product').value];for(const k of ['price','floor','cost'])$('receive-'+k).value=(m[k]/100).toFixed(2);}
$('receive-product').onchange=receiveDefaults;
$('receive-form').onsubmit=e=>{e.preventDefault();change(s=>{const next=receiveStock(s,$('receive-product').value,Number($('receive-quantity').value),cents($('receive-price').value),cents($('receive-floor').value),cents($('receive-cost').value));toast('Fresh batch received. Case and menus updated.');return next;});};
$('recount-batch').onclick=()=>change(s=>recountBatch(s,$('decision-batch').value,Number($('physical-count').value))).then(()=>{decision=null;renderDecision();});
function rushDefaults(){const r=settingsFor(state).rushes[$('rush-type').value];$('rush-time').value=String(Math.floor(r.at/60)).padStart(2,'0')+':'+String(r.at%60).padStart(2,'0');$('rush-orders').value=r.orders;$('rush-duration').value=r.duration;rushAvailability();}
$('rush-type').onchange=rushDefaults;
function rushAvailability(){
 const {open,close}=hoursFor(state);let at;try{at=minuteInput($('rush-time').value);}catch{at=NaN;}const duration=Number($('rush-duration').value),outside=!Number.isInteger(at)||at<open||at+duration>close-5;
 $('start-rush').disabled=outside;$('rush-hours-note').hidden=!outside;$('rush-hours-note').textContent='Choose a rush between '+simTime(open)+' and '+simTime(close-5)+', or extend hours in Cafe Desk.';
}
for(const id of ['rush-time','rush-duration'])$(id).addEventListener('input',rushAvailability);
function rushSettings(){
 const cfg=settingsCopy(),value=$('rush-time').value;if(!/^\d{2}:\d{2}$/.test(value))throw new Error('Choose a rush time.');
 const [h,m]=value.split(':').map(Number);cfg.rushes[$('rush-type').value]={at:h*60+m,orders:Number($('rush-orders').value),duration:Number($('rush-duration').value)};return cfg;
}
$('save-rush').onclick=()=>change(s=>{const next=updateSettings(s,rushSettings());toast('Rush schedule saved.');return next;});
$('start-rush').onclick=async()=>{let success=false;await change(s=>{const next=jumpToRush(updateSettings(s,rushSettings()),$('rush-type').value);success=true;return next;});if(success){decision=null;basket={};start();toast('Rush started. Watch the shelves and menus.');}};
function dealFields(){const pair=$('deal-kind').value==='combo';$('pair-one-label').hidden=!pair;$('pair-two-label').hidden=!pair;$('deal-category-label').hidden=$('deal-kind').value!=='crash';}
$('deal-kind').onchange=()=>{const k=$('deal-kind').value;$('deal-title').value={combo:'Study Buddy',crash:'Bakery Stock Crash',rescue:'Last-call Offers'}[k];dealFields();};
$('deal-form').onsubmit=e=>{e.preventDefault();change(s=>{const cfg=settingsCopy();cfg.deal={kind:$('deal-kind').value,title:$('deal-title').value.trim(),duration:Number($('deal-duration').value),category:$('deal-category').value,ids:[$('deal-first').value,$('deal-second').value]};const next=triggerEvent(updateSettings(s,cfg),cfg.deal.kind);toast('Offer is on the menu. Eligible price drops were reviewed.');return next;});};
$('end-deal').onclick=()=>change(s=>endDeal(s));
$('mobile-replay').onclick=$('run-day').onclick;$('mobile-mini-replay').onclick=$('run-day').onclick;
$('mobile-pause').onclick=$('pause-day').onclick;$('mobile-mini-play').onclick=$('pause-day').onclick;
$('mobile-day-slider').oninput=$('day-slider').oninput;
const d=settingsFor(state).deal;$('deal-kind').value=d.kind;$('deal-title').value=d.title;$('deal-duration').value=d.duration;$('deal-first').value=d.ids[0];$('deal-second').value=d.ids[1];$('deal-category').value=d.category;
dealFields();rushDefaults();receiveDefaults();
clock();setInterval(clock,1000);if(!read())save();showView(view,false);

// A small illustrative market, independent of the cafe's shared simulation.
const miniFoods=[
 {name:'Buffalo Chicken',symbol:'BUFF',base:899,stock:12,prices:[899,849,799,749,699,729]},
 {name:'Blueberry Muffin',symbol:'BLUE',base:399,stock:18,prices:[399,379,349,329,299,319]},
 {name:'Turkey Club',symbol:'TCLB',base:949,stock:9,prices:[949,899,849,799,829,779]},
 {name:'Chocolate Cookie',symbol:'CHOC',base:299,stock:22,prices:[299,279,259,239,219,229]}
];
let miniTick=0,miniPaused=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const miniNews=['Surplus meets a better price.','Prices ease as surplus becomes available.','A better deal brings the next bite closer.','More meals sold. Less food left behind.','Demand picks up. Prices adjust with it.','Small price moves. A bigger opportunity.'];
function renderMiniMarket(){
 const step=miniTick%6;
 $('mini-market-time').textContent=simTime(720+step*15);
 $('mini-market-news').textContent=miniNews[step];
 const ticker=miniFoods.map(food=>{const price=food.prices[step],up=price>food.prices[Math.max(0,step-1)];return food.symbol+' <'+(up?'em':'b')+'>'+(up?'▲':'▼')+' '+money(price)+'</'+(up?'em':'b')+'> &nbsp; ';}).join('');
 document.querySelector('.mini-market-ticker>div').innerHTML=ticker+ticker;
 $('mini-market-rows').innerHTML=miniFoods.map(food=>{
  const price=food.prices[step],previous=food.prices[Math.max(0,step-1)],change=price-previous;
  const history=food.prices.slice(0,step+1),x=i=>6+i*21.6,y=p=>64-(p/food.base)*48;
  let path='M'+x(0)+' '+y(history[0]);
  history.slice(1).forEach((p,i)=>{path+=' H'+x(i+1)+' V'+y(p);});
  if(step===0)path+=' H24';
  return '<article class="mini-market-row"><div><strong>'+food.name+'</strong><small>'+food.symbol+' · '+(food.stock-step)+' available</small></div><div class="mini-market-price"><strong>'+money(price)+'</strong><small class="'+(change>0?'mini-market-rise':'')+'">'+(change===0?'Opening price':(change>0?'↑ ':'↓ ')+money(Math.abs(change)))+'</small></div><div class="mini-market-chart"><svg viewBox="0 0 120 74" role="img" aria-label="'+food.name+' illustrative price history"><path class="mini-grid" d="M6 16H114 M6 40H114 M6 64H114"/><path class="mini-line" d="'+path+'"/><circle cx="'+(step?x(step):24)+'" cy="'+y(price)+'" r="3"/></svg></div></article>';
 }).join('');
 $('mini-market-pause').textContent=miniPaused?'Play':'Pause';
 $('mini-market-pause').setAttribute('aria-pressed',String(miniPaused));
 $('mini-market-pause').setAttribute('aria-label',miniPaused?'Play miniature exchange':'Pause miniature exchange');
}
$('mini-market-pause').onclick=()=>{miniPaused=!miniPaused;renderMiniMarket();};
renderMiniMarket();
setInterval(()=>{if(miniPaused||document.hidden||$('view-home').hidden)return;miniTick++;renderMiniMarket();},4000);

// The sandwich story can pause independently of the exchange preview.
$('journey-pause').onclick=()=>{
 const paused=$('bite-journey').classList.toggle('journey-paused');
 $('journey-pause').textContent=paused?'Play':'Pause';
 $('journey-pause').setAttribute('aria-label',paused?'Play animation':'Pause animation');
};
