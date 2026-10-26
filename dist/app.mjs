import {LOCATION_KEY,DEFAULT_LOCATION,stateKey,locationInfo,readLocations} from './locations.mjs';
import {chartSamples} from './price-history.mjs';
import {createExchange,sparkline,tickerMarkup} from './exchange-tv.mjs';
import {BLANK_FOOD_IMAGE,pricingFor,trafficPlan,catalogFor,RUSH_NAMES,trafficAt,applyPlan,CATALOG,CATEGORIES,hoursFor,migrateState,money,simTime,initialState,validState,productView,offerAvailable,rawAvailable,sell,restock,evaluateBatch,executeDemoDecision,observeStock,setAllocations,triggerEvent,comboView,buyCombo,basketQuote,applyTicker,stepSimulation,snapshotAt,demand,settingsFor,updateSettings,startPlannedDay,receiveStock,recountBatch,jumpToRush,endDeal} from './model.mjs';
import {createCase} from './case.mjs';
import {sustainabilityReport} from './sustainability.mjs';
const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search),displayOnly=['1','exchange'].includes(params.get('display'));
let view=displayOnly?(params.get('display')==='exchange'?'exchange':'tv'):params.get('view')||'home',state,playing=false,timer=null,storageAvailable=true,page=0,tvCategory='all',selectedBatch='batch-5',decision=null,basket={},dealsOnly=false,caseScene=null;
let registry;
try{registry=readLocations(localStorage);}catch{registry={version:1,activeId:'connections',locations:[{...DEFAULT_LOCATION}]};storageAvailable=false;}
let locationId=registry.locations.some(l=>l.id===params.get('location'))?params.get('location'):'connections',KEY=stateKey(locationId);
function locationUrl(viewName,display=false){const q=new URLSearchParams(display?{display:viewName}:{view:viewName});q.set('location',locationId);return '?'+q;}
function read(){try{const raw=localStorage.getItem(KEY),s=JSON.parse(raw);if(validState(s)&&s.settings.location&&s.batches.every(b=>b.reference_units!==undefined))return s;const migrated=migrateState(s);if(migrated){if(storageAvailable){localStorage.setItem(KEY+'-before-merge-update',JSON.stringify(s));localStorage.setItem(KEY,JSON.stringify(migrated));}return migrated;}if(raw!==null||locationId!=='connections')storageAvailable=false;}catch{storageAvailable=false;}return null;}
state=read()||initialState('opening');
if(!state.settings.location)state.settings.location={...DEFAULT_LOCATION};
const exchange=createExchange();
const foods=()=>catalogFor(state),onMenu=()=>foods().filter(p=>settingsFor(state).menu[p.id].enabled);
const timeFormat=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',second:'2-digit'});
const pct=n=>n.toFixed(1).replace(/\.0$/,'');
let toastTimer;
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function save(){if(!storageAvailable)return;try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageAvailable=false;}}
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
 if(push&&!displayOnly){history.pushState({},'',locationUrl(view));window.scrollTo(0,0);}
 if(view==='tv'&&!displayOnly){if(!caseScene)caseScene=createCase($('case-stage'));caseScene?.setState(state);caseScene?.resize();}
 if(view==='tv')resize();render();
}
function revealSection(id){const target=$(id);if(!target)return;for(let node=target;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});}
document.querySelectorAll('[data-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showView(a.dataset.view);if(a.hash)revealSection(a.hash.slice(1));}));
window.addEventListener('popstate',()=>{const p=new URLSearchParams(location.search),id=p.get('location');if(id&&id!==locationId){try{switchLocation(id);}catch(error){toast(error.message);}}showView(p.get('view')||'home',false);});
if(displayOnly){document.body.classList.add(view==='exchange'?'exchange-only':'tv-only');$('tv-tools').hidden=false;if(view==='exchange')$('tv-tools').querySelector('a').href='?view=exchange';}
function resize(){const r=$('tv-stage').getBoundingClientRect();if(!r.width)return;const scale=Math.min(r.width/1920,r.height/1080);$('tv').style.transform=document.fullscreenElement===$('tv-stage')?'translate(-50%,-50%) scale('+scale+')':'scale('+scale+')';}
new ResizeObserver(resize).observe($('tv-stage'));window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
for(const id of ['tv-category','inventory-category'])for(const c of CATEGORIES){const o=document.createElement('option');o.value=c;o.textContent=c;$(id).append(o);}
function tvProducts(){const menu=onMenu();return tvCategory==='all'?menu:menu.filter(p=>p.category===tvCategory);}
function renderTV(previous){
 const products=tvProducts(),pages=Math.max(1,Math.ceil(products.length/6));page=Math.min(page,pages-1);
 $('page-number').textContent=(page+1)+' / '+pages;$('prev-page').disabled=pages<2;$('next-page').disabled=pages<2;
 $('product-grid').innerHTML=products.slice(page*6,page*6+6).map(product=>{
  const p=productView(state,product.id),was=previous&&catalogFor(previous).some(f=>f.id===p.id)?productView(previous,p.id):null;
  return '<article class="food-card '+(p.saving?'discounted ':'')+(!p.quantity?'sold-out ':'')+(was&&p.price<was.price?'updated':'')+'" aria-label="'+escape(p.name)+' '+(p.quantity?money(p.price):'unavailable')+'"><div class="food-photo"><img src="'+escape(p.image)+'" alt="'+escape(p.name)+'"><span class="food-badge '+(p.quantity&&!p.saving?'regular':'')+'">'+(!p.quantity?'UNAVAILABLE':p.saving?'↓ '+pct(p.discount)+'% OFF':p.category.toUpperCase())+'</span>'+(p.quantity?'<span class="stock-badge '+(p.offerQuantity<=3?'low':'')+'">'+p.offerQuantity+' AVAILABLE</span>':'')+'</div><div class="food-info"><div><span class="food-symbol">'+escape(p.symbol)+'</span><h2 class="food-name">'+escape(p.name)+'</h2></div><div class="food-price"><strong>'+(p.quantity?money(p.price):'Unavailable')+'</strong><span class="old-price">'+(p.quantity?(p.saving?'<s>Was '+money(p.base)+'</s>':'Regular price'):'')+'</span></div></div></article>';
 }).join('');
 const offers=foods().map(p=>productView(state,p.id)).filter(p=>p.quantity&&p.saving);
 const promotion=state.promotion;
 $('menu-status').textContent=state.minute>=hoursFor(state).close-5?'OFFERS ENDED':promotion?({crash:'MARKET CRASH',combo:promotion.title.toUpperCase(),rush:(RUSH_NAMES[promotion.rushType]||'Lunch Rush').toUpperCase(),rescue:'CLOSING RUSH'}[promotion.kind]):offers.length?'PRICE DROPS NOW':'FRESH IN THE CASE';
 const combo=comboView(state);
 $('menu-message').textContent=state.minute>=hoursFor(state).close-5?'Thanks for making every bite count.':promotion?.kind==='combo'&&combo.available?combo.products.map(p=>p.name).join(' & ')+' · '+money(combo.total)+' together':promotion?.kind==='rush'?'The '+(promotion.rushType||'lunch')+' rush is on. Prices follow the same live market.':offers.length?'Good food. A little less. A lot less waste.':'Sandwiches, bagels, pastries & something sweet.';
 $('day-clock').textContent=simTime(state.minute);$('updated').textContent='Synced '+timeFormat.format(new Date(state.updatedAt));
 $('sync-status').textContent=storageAvailable?'Connected across tabs in this browser':'Session only · browser storage unavailable';
 renderTicker();
}
let tvRotating=!window.matchMedia('(prefers-reduced-motion: reduce)').matches,tvRemaining=15;
function rotationLabel(){ $('tv-rotate').textContent=tvRotating?'Pause Rotation':'Resume Rotation';$('tv-rotate').setAttribute('aria-pressed',String(!tvRotating)); }
rotationLabel();
function turnTV(delta){const count=Math.max(1,Math.ceil(tvProducts().length/6));page=(page+delta+count)%count;tvRemaining=15;renderTV();}
$('tv-category').onchange=e=>{tvCategory=e.target.value;page=0;tvRemaining=15;renderTV();};
$('prev-page').onclick=()=>turnTV(-1);
$('next-page').onclick=()=>turnTV(1);
$('tv-rotate').onclick=()=>{tvRotating=!tvRotating;rotationLabel();};
setInterval(()=>{if(view!=='tv'||document.hidden||!tvRotating)return;if(!--tvRemaining)turnTV(1);},1000);
let tickerSignature='';
function renderTicker(){
 const content=tickerMarkup(state);
 if(content!==tickerSignature){tickerSignature=content;for(const id of ['ticker-track','exchange-ticker-track'])$(id).innerHTML='<div class="ticker-group">'+content+'</div><div class="ticker-group" aria-hidden="true">'+content+'</div>';}
 for(const id of ['ticker-track','exchange-ticker-track'])$(id).classList.toggle('paused',!state.preferences.ticker);
}
// A missing remote photo keeps the menu readable without breaking the layout.
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement&&e.target.getAttribute('src')!==BLANK_FOOD_IMAGE)e.target.src=BLANK_FOOD_IMAGE;},true);
function renderInventory(){
 const cat=$('inventory-category').value;
 $('inventory-list').innerHTML=foods().filter(p=>cat==='all'||p.category===cat).map(product=>{
 const p=productView(state,product.id);return '<div class="inventory-row"><div class="inventory-product"><img src="'+escape(p.image)+'" alt=""><div><strong>'+escape(p.name)+'</strong><span>'+escape(p.symbol)+' · '+p.quantity+' available</span></div></div><div class="inventory-values"><b>'+(p.quantity?money(p.price):'—')+'</b><span>Regular '+money(p.base)+'</span></div><div class="inventory-actions"><button data-sell="'+p.id+'" '+(!p.quantity?'disabled':'')+'>Sell 1</button><button data-restock="'+p.id+'" '+(state.minute>=hoursFor(state).close-5?'disabled':'')+'>+4 fresh</button><button data-review="'+p.id+'">Review</button></div></div>';
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
 $('activity-list').replaceChildren(...state.events.slice(0,8).map(e=>{const li=document.createElement('li'),t=document.createElement('time'),span=document.createElement('span');t.textContent=simTime(e.at);span.textContent=e.text;if(e.kind==='drop')span.className='event-drop';li.append(t,span);return li;}));
 $('activity-count').textContent='Latest updates';
 $('impact-stats').textContent=state.surplusSold+' discounted sales · '+state.transferred+' transferred · '+state.retained+' retained · '+state.discarded+' discarded (demo).';
}
function batchOptions(){
 for(const id of ['chart-batch','decision-batch']){
 const prior=$(id).value||selectedBatch,signature=JSON.stringify([foods(),state.batches.map(b=>b.id)]);
 if($(id).dataset.signature!==signature){$(id).dataset.signature=signature;$(id).innerHTML=state.batches.map(b=>'<option value="'+b.id+'">'+escape((foods().find(p=>p.id===b.productId)?.symbol||'FOOD')+' · '+foods().find(p=>p.id===b.productId)?.name+' · Batch '+(Number(b.id.replace('batch-',''))+1))+'</option>').join('');}
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
 $('chart-demand').textContent=Math.round(demand(state))+' / Hour';
 const planned=trafficPlan(state);chart('demand-chart',planned,Math.max(40,...planned.map(e=>e.value)),v=>Math.round(v),true,hoursFor(state).close,'#d2a329');
}
$('chart-batch').onchange=renderCharts;
$('decision-batch').onchange=()=>{selectedBatch=$('decision-batch').value;decision=null;renderDecision();};
function evaluate(){pause();decision=evaluateBatch(state,$('decision-batch').value,'normal');renderDecision();}
$('evaluate').onclick=()=>{try{evaluate();}catch(e){toast(e.message);}};
$('observe').onclick=()=>change(s=>observeStock(s));
function renderDecision(){
 const b=state.batches.find(b=>b.id===$('decision-batch').value);if(!b)return;
 for(const [input,k] of [['reserved','reserved_units'],['protected','protected_units'],['buffer','buffer_units']])if(document.activeElement!==$(input))$(input).value=b[k];
 if(document.activeElement!==$('physical-count'))$('physical-count').value=b.physical_units;
 const pricing=pricingFor(state.settings);$('scenario-table').textContent='Prices follow available stock and time before closing. Reviewed every '+pricing.reviewMinutes+' minutes, with a '+pricing.maxStep+'% step and a '+pricing.maxDiscount+'% maximum discount.';
 $('publish-price').hidden=true;$('fail-price').hidden=true;
 if(!decision){$('decision-result').innerHTML='<p>Physical '+b.physical_units+' − reserved '+b.reserved_units+' − protected '+b.protected_units+' − buffer '+b.buffer_units+' = '+rawAvailable(b)+' offer units. '+(b.window_committed?'Dynamic pricing is active.':'Prices update with time and purchases.')+'</p>';return;}
 const d=decision;
 $('decision-result').innerHTML='<span class="result-status '+d.status.toLowerCase()+'">'+d.status+'</span><p>'+escape(d.reason)+'</p>'+(d.floor_cents!==null?'<p>Floor '+money(d.floor_cents)+' · '+d.available+' offer units'+''+'</p>':'')+(d.rows.length?'<table><thead><tr><th>Candidate</th><th>Expected sales</th><th>Expected gain</th><th>Worst listed gain</th><th>Passes gates</th></tr></thead><tbody>'+d.rows.map(r=>'<tr class="'+(r.admissible?'accepted':'')+'"><td>'+money(r.price_cents)+(r.price_cents===d.price_cents?' · selected':'')+'</td><td>'+r.expected_sales.toFixed(2)+'</td><td>'+money(r.expected_gain_cents)+'</td><td>'+money(r.worst_gain_cents)+'</td><td>'+(r.admissible?'Yes':r.price_cents===b.current_cents?'Baseline':'No')+'</td></tr>').join('')+'</tbody></table>':'');
 if(d.evaluation_completed){$('publish-price').hidden=false;$('publish-price').textContent=d.status!=='HOLD'?'Publish '+money(d.price_cents)+' to demo screens':'Keep this price for this batch';$('fail-price').hidden=d.status==='HOLD';}
}
$('publish-price').onclick=()=>{const d=decision;if(!d)return;change(s=>executeDemoDecision(s,d.batchId,d,true,true,'manual-'+d.windowId+'-'+d.checkoutVersion)).then(()=>{decision=null;renderDecision();});};
$('fail-price').onclick=()=>{const d=decision;if(d)change(s=>executeDemoDecision(s,d.batchId,d,true,false,'failed-'+d.windowId));};
$('save-allocations').onclick=()=>change(s=>setAllocations(s,$('decision-batch').value,Number($('reserved').value),Number($('protected').value),Number($('buffer').value))).then(()=>{decision=null;renderDecision();});

function updatePlayback(){
 for(const id of ['pause-day','mobile-pause','exchange-play','launch-market','impact-play']){$(id).textContent=playing?'Pause':'Play';$(id).disabled=!playing&&state.minute>=hoursFor(state).close;}
 if(!playing&&marketSelectionPending&&$('market-event').selectedOptions[0]?.disabled)$('launch-market').disabled=true;
 for(const id of ['run-day','mobile-replay','exchange-replay'])$(id).textContent='Restart';
 $('exchange-playback-status').textContent=playing?'Playing':state.minute>=hoursFor(state).close?'Day Complete':'Paused';
 $('impact-status').textContent=$('exchange-playback-status').textContent;
}
function pause(){clearInterval(timer);timer=null;playing=false;updatePlayback();}
function start(){if(state.minute>=hoursFor(state).close)return;clearInterval(timer);playing=true;updatePlayback();timer=setInterval(async()=>{await change(s=>stepSimulation(s,5),{stop:false});if(state.minute>=hoursFor(state).close)pause();},60000/((hoursFor(state).close-hoursFor(state).open)/5)/settingsFor(state).traffic.speed);}
let marketSelectionPending=true;
$('run-day').onclick=()=>{marketSelectionPending=true;basket={};decision=null;change(s=>startPlannedDay(s));};
$('pause-day').onclick=()=>playing?pause():start();
$('exchange-speed').onchange=async e=>{await change(s=>{const cfg=structuredClone(settingsFor(s));cfg.traffic.speed=Number(e.target.value);return updateSettings(s,cfg);});};
$('exchange-play').onclick=$('pause-day').onclick;
$('exchange-replay').onclick=$('run-day').onclick;
$('exchange-forward').onclick=()=>change(s=>stepSimulation(s,5));
$('day-slider').oninput=e=>{const minute=Number(e.target.value);basket={};decision=null;change(s=>snapshotAt(minute,settingsFor(s)));};
$('exchange-slider').oninput=$('day-slider').oninput;
$('impact-slider').oninput=$('day-slider').oninput;
$('impact-play').onclick=$('pause-day').onclick;
$('impact-restart').onclick=$('run-day').onclick;
function renderMarket(){
 const cfg=settingsFor(state),{open,close}=hoursFor(state),choice=$('market-event').value;
 for(const option of $('market-event').options){const r=cfg.rushes[option.value];if(r){option.textContent=RUSH_NAMES[option.value]+' · '+simTime(r.at);option.disabled=r.at<open||r.at+r.duration>close-5;}else option.textContent=({crash:'Market Crash',combo:cfg.deal.kind==='combo'?cfg.deal.title:'Food Bundle',rescue:'Closing Rush'})[option.value];}
 $('launch-market').textContent=playing?'Pause':'Play';$('launch-market').disabled=!playing&&marketSelectionPending&&$('market-event').selectedOptions[0].disabled;
 const p=state.promotion,c=comboView(state),saved=cfg.deal.ids.map(id=>foods().find(f=>f.id===id).name).join(' & ');
 $('market-current').innerHTML=p?'<span class="market-state-label">ON THE MENU</span><strong>'+escape(p.title)+'</strong><span>'+(p.kind==='combo'?c.products.map(p=>escape(p.name)).join(' & ')+' · '+money(c.total)+' together · ':'')+'Until '+simTime(p.until)+'</span>':'<span class="market-state-label">SAVED OFFER</span><strong>'+escape(cfg.deal.title)+'</strong><span>'+escape(cfg.deal.kind==='combo'?saved:'Eligible surplus price review')+' · '+simTime(cfg.deal.at)+'</span>';
}
$('market-event').onchange=()=>{pause();marketSelectionPending=true;renderMarket();};
$('launch-market').onclick=async()=>{if(playing){pause();return;}if(!marketSelectionPending){start();return;}const type=$('market-event').value;let success=false;await change(s=>{const next=Object.hasOwn(RUSH_NAMES,type)?jumpToRush(s,type):triggerEvent(s,type);success=true;return next;});if(success){marketSelectionPending=false;decision=null;basket={};start();}};
function renderMobile(){
 const search=$('menu-search').value.trim().toLowerCase();
 $('mobile-open').textContent=state.minute<hoursFor(state).close-5?'Offers available · demo '+simTime(state.minute):'Offers ended for today';
 $('mobile-updated').textContent='Updated '+simTime(state.minute);
 const drops=foods().map(p=>productView(state,p.id)).filter(p=>p.quantity>0&&p.saving>0);
 $('mobile-drops').hidden=!drops.length;
 $('mobile-drops').innerHTML=drops.length?'<button id="show-price-drops" class="primary-button">Price Drops ↓</button>':'';
 $('clear-drops').hidden=!dealsOnly;
 renderAlerts(drops);
 const promo=state.promotion,c=comboView(state);
 $('mobile-promotion').innerHTML=promo?'<div class="mobile-deal"><strong>'+escape(promo.title||({crash:'The Market Crash',combo:'Study Buddy Bundle',rush:'Rush Is On',rescue:'Closing Rush'}[promo.kind]))+'</strong><p>'+({crash:'Watch eligible bakery prices at each scheduled review. Catch your favorite while it lasts.',combo:c.products.map(p=>escape(p.name)).join(' & ')+' · '+money(c.total)+' together. Each item keeps its confirmed price.',rush:'The '+escape(promo.rushType||'lunch')+' rush is on. Prices follow the live market.',rescue:'Find eligible surplus offers before the selling window closes.'}[promo.kind])+'</p><p>Event ends at '+simTime(promo.until)+'</p>'+(promo.kind==='combo'?'<button id="add-combo" '+(!c.available?'disabled':'')+'>'+(c.available?'Add both to basket':'Bundle unavailable')+'</button>':'')+'</div>':'';
 const matches=onMenu().filter(p=>(!search||(p.name+' '+escape(p.symbol)+' '+p.category).toLowerCase().includes(search))&&(!dealsOnly||(productView(state,p.id).saving>0&&productView(state,p.id).quantity>0)));
 $('mobile-menu').innerHTML=matches.length?CATEGORIES.map((category,i)=>{
 const products=matches.filter(p=>p.category===category);if(!products.length)return '';
 return '<section class="mobile-menu-section" id="mobile-category-'+i+'"><h3>'+category+'</h3>'+products.map(product=>{
 const p=productView(state,product.id),priceBatch=state.batches.find(b=>b.id===p.batchId)??state.batches.filter(b=>b.productId===product.id).at(-1);return '<article class="mobile-card '+(!p.quantity?'unavailable':p.saving?'discounted':'')+'"><div class="mobile-card-info"><span class="mobile-symbol">'+escape(p.symbol)+'</span><h4>'+escape(p.name)+'</h4><div class="mobile-price">'+(p.quantity?money(p.price):'Unavailable')+(p.quantity&&p.saving?'<s>Was '+money(p.base)+'</s>':'')+'</div>'+(p.quantity&&p.saving?'<div class="mobile-drop">↓ '+pct(p.discount)+'% Off'+'</div>':'')+'<div class="mobile-quantity">'+(p.quantity?p.offerQuantity+' Available · '+simTime(p.priceAt):'Check back for fresh stock')+'</div><div class="mobile-item-history"><span>Price History</span>'+sparkline(priceBatch,state)+'</div></div><div class="mobile-thumb"><img src="'+escape(p.image)+'" alt="'+escape(p.name)+'" loading="lazy"><button class="mobile-add" data-add="'+p.id+'" aria-label="Add '+escape(p.name)+'" '+(!p.quantity?'disabled':'')+'>+</button></div></article>';
 }).join('')+'</section>';
 }).join(''):'<p class="empty-menu">No matching foods. Try another search or clear the price-drop filter.</p>';
 renderBasket();
}
function renderAlerts(drops){
 const best=[...drops].sort((a,b)=>b.saving-a.saving)[0],promo=state.promotion,closing=state.minute>=settingsFor(state).rushes.closing.at&&state.minute<hoursFor(state).close-5;
 const cards=[];
 if(promo&&['crash','rescue','combo'].includes(promo.kind))cards.push(['event-'+promo.kind,promo.title,promo.kind==='combo'?comboView(state).products.map(p=>p.name).join(' & ')+' · '+money(comboView(state).total)+' together.':'Confirmed offers are on the menu until '+simTime(promo.until)+'.']);
 if(closing&&best)cards.push(['closing','Closing Rush Special',best.name+' is '+money(best.price)+'. Pick up a bite before the cafe closes.']);
 if(best)cards.push(['drop-'+best.id,'A Price Worth Catching',best.name+' · '+money(best.price)+' (was '+money(best.base)+'). '+best.offerQuantity+' available.']);
 if(state.surplusSold)cards.push(['impact','Good Food, Less Left Behind',state.surplusSold+' surplus items sold in this demo. Your next bite can help prepared food find a buyer.']);
 if(!cards.length)cards.push(['welcome','Your Next Deal Starts Here','Play the cafe day. Price drops and closing specials will appear here as they go live.']);
 $('alerts-time').textContent=simTime(state.minute);
 const signature=JSON.stringify(cards);
 if($('alert-bubbles').dataset.signature!==signature){const oldKeys=[...$('alert-bubbles').children].map(n=>n.dataset.key);$('alert-bubbles').dataset.signature=signature;$('alert-bubbles').innerHTML=cards.slice(0,3).map(([key,title,body])=>'<article class="phone-notification '+(oldKeys.includes(key)?'':'notification-new')+'" data-key="'+escape(key)+'"><div class="notification-app"><img src="assets/mb-navy.png" alt=""><span>MARKETBITE</span><small>Now</small></div><h3>'+escape(title)+'</h3><p>'+escape(body)+'</p></article>').join('');}
}
$('menu-search').oninput=renderMobile;
$('clear-drops').onclick=()=>{dealsOnly=false;renderMobile();};
$('mobile-drops').onclick=e=>{if(e.target.closest('#show-price-drops')){dealsOnly=true;$('menu-search').value='';renderMobile();$('mobile-menu').scrollIntoView({behavior:'smooth',block:'start'});}};
function add(id){const p=productView(state,id);if((basket[id]||0)>=p.quantity){toast('All available '+escape(p.symbol)+' units are already in your basket.');return;}basket[id]=(basket[id]||0)+1;renderBasket();toast(p.name+' added.');}
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
 renderLocation();exchange.update(state);renderHours();renderSustainability();renderDesk();renderMarket();renderTV(previous);batchOptions();renderInventory();renderActivity();renderCharts();renderDecision();renderMobile();
 $('simulation-time').textContent=simTime(state.minute);$('mobile-demo-time').textContent=simTime(state.minute);$('mobile-day-slider').value=state.minute;$('day-slider').value=state.minute;
 $('exchange-slider').value=state.minute;$('exchange-slider').setAttribute('aria-valuetext',simTime(state.minute));$('exchange-playback-time').textContent=simTime(state.minute);$('exchange-forward').disabled=state.minute>=hoursFor(state).close;$('exchange-speed').value=settingsFor(state).traffic.speed;
 $('total-stock').textContent=state.batches.reduce((n,b)=>n+offerAvailable(state,b),0);$('total-sold').textContent=state.sold;$('in-person-orders').textContent=state.orders.inPerson;$('mobile-orders').textContent=state.orders.mobile;updatePlayback();caseScene?.setState(state);
}
function syncLatest(){
 const next=read();if(!next||(next.revision===state.revision&&next.updatedAt===state.updatedAt))return;
 // A purchase or price update at the current time must not stop the day playing in another tab.
 // A different time or restarted run yields playback to that tab instead of advancing twice.
 if(next.minute!==state.minute||next.revision<state.revision)pause();
 const old=state;state=next;decision=null;render(old);
}
window.addEventListener('storage',e=>{if(e.key===KEY)syncLatest();if(e.key===LOCATION_KEY){try{registry=readLocations(localStorage);renderLocation();}catch{toast('Location list could not be refreshed.');}}});
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
 for(const id of ['day-slider','mobile-day-slider','exchange-slider','impact-slider']){$(id).min=open;$(id).max=close;}
 $('timeline-labels').innerHTML='<span>'+simTime(open)+' · Open</span><span>'+simTime(close-120)+' · Review</span><span>'+simTime(close)+' · Close</span>';
 $('mobile-hours').textContent='Cafe hours · '+simTime(open)+'–'+simTime(close);
}
function renderSustainability(){
 const r=sustainabilityReport(state),{open,close}=hoursFor(state);
 $('impact-time').textContent=simTime(state.minute);$('impact-slider').value=state.minute;$('impact-slider').setAttribute('aria-valuetext',simTime(state.minute));$('impact-open').textContent=simTime(open);$('impact-close').textContent=simTime(close);
 $('sustainability-counts').innerHTML=[
  ['Discounted Foods Sold',state.surplusSold,'Purchased below regular price'],
  [r.savingsComplete?'Customer Savings':'Tracked Savings',money(r.savings),'Based on prices paid at purchase'],
  ['Food Sold',pct(r.sellThrough)+'%',state.sold+' of '+r.accounted+' accounted items'],
  [r.closed?'Unsold at Close':'Still in the Case',r.closed?state.retained+state.transferred+state.discarded:r.remaining,r.closed?'See destinations below':'Includes reserved & protected stock']
 ].map(([label,value,note])=>'<article><span>'+label+'</span><strong>'+value+'</strong><p>'+note+'</p></article>').join('');
 $('impact-total').textContent=r.accounted+' Items';
 $('impact-flow-bar').innerHTML=r.outcomes.filter(o=>o.count).map(o=>'<span class="outcome-'+o.key+'" style="flex-grow:'+o.count+'" title="'+o.label+': '+o.count+'"></span>').join('');
 $('impact-flow-bar').setAttribute('aria-label',r.outcomes.map(o=>o.label+': '+o.count).join(', '));
 $('impact-legend').innerHTML=r.outcomes.map(o=>'<div><dt><i class="outcome-'+o.key+'" aria-hidden="true"></i>'+o.label+'</dt><dd>'+o.count+'</dd></div>').join('');
 $('impact-outcome-note').textContent=(r.closed?'Day complete. Unsold stock has moved to the closing ledger.':'Stock received or recounted in Cafe Desk updates this balance.')+' Food sold is sales divided by all accounted items. Retained food is not automatically discarded.';
 $('impact-chart-value').textContent=money(r.savings);$('impact-revenue').textContent=money(state.revenue);
 const points=state.history.filter(p=>Number.isFinite(p.savings)).map(p=>({at:p.at,value:p.savings}));
 chart('impact-savings-chart',points,Math.max(100,Math.ceil(r.savings/100)*100),money,true);
 $('impact-savings-note').textContent=r.savingsComplete?'Savings add up from actual simulated purchases, including mobile orders and bundles. Later price changes do not alter earlier savings.':'This saved day predates savings tracking. Only new purchases are included here. Restart for a complete day’s savings.';
 $('impact-pricing-note').textContent='Prices are reviewed every '+r.pricing.reviewMinutes+' minutes, with up to '+r.pricing.maxDiscount+'% off and cafe-set minimums. '+(r.offers.length?r.offers.length+' foods currently have a price drop; the largest drops are shown below.':'No discounted food is available at this moment. Play the day to follow price changes and purchases.');
 $('impact-offers').innerHTML=r.offers.length?r.offers.slice(0,5).map(p=>'<tr><th scope="row"><span class="impact-food"><img src="'+escape(p.image)+'" alt="" loading="lazy"><span>'+escape(p.name)+'<small>'+escape(p.symbol)+'</small></span></span></th><td>'+money(p.price)+'</td><td>↓ '+pct(p.discount)+'%</td><td>'+p.offerQuantity+'</td></tr>').join(''):'<tr><td colspan="4" class="impact-empty">'+(r.closed?'The cafe day is complete. Restart to explore another day.':'As prices change, available surplus offers will appear here.')+'</td></tr>';
}
$('hours-form').oninput=()=>{hoursDirty=true;$('hours-status').textContent='Unsaved hours';};
$('hours-form').onsubmit=e=>{e.preventDefault();change(s=>{const cfg=structuredClone(settingsFor(s));cfg.hours={open:minuteInput($('hours-open').value),close:minuteInput($('hours-close').value)};const next=applyPlan(s,cfg);hoursDirty=false;decision=null;basket={};$('hours-status').textContent='Hours Applied';toast('Cafe hours updated on every screen.');return next;});};
const settingsCopy=()=>structuredClone(settingsFor(state));
function photoOptions(image=BLANK_FOOD_IMAGE){
 const custom=image!==BLANK_FOOD_IMAGE&&!CATALOG.some(p=>p.image===image);
 return '<option value="'+BLANK_FOOD_IMAGE+'" '+(image===BLANK_FOOD_IMAGE?'selected':'')+'>No Photo</option>'+CATALOG.map(p=>'<option value="'+p.image+'" '+(p.image===image?'selected':'')+'>'+escape(p.name)+' Photo</option>').join('')+'<option value="custom" '+(custom?'selected':'')+'>Custom Photo URL</option>';
}
function photoFields(p){
 const custom=p.image!==BLANK_FOOD_IMAGE&&!CATALOG.some(f=>f.image===p.image);
 return '<select aria-label="'+escape(p.name)+' Photo" data-photo="'+p.id+'">'+photoOptions(p.image)+'</select><input type="url" data-photo-url="'+p.id+'" aria-label="'+escape(p.name)+' Photo URL" placeholder="https://…" maxlength="2048" value="'+(custom?escape(p.image):'')+'" '+(!custom?'hidden':'required')+'>';
}
$('opening-form').onchange=e=>{if(e.target.dataset.photo){const input=document.querySelector('[data-photo-url="'+e.target.dataset.photo+'"]');input.hidden=e.target.value!=='custom';input.required=!input.hidden;}};
function renderDesk(){
 $('desk-time').textContent='DEMO TIME · '+simTime(state.minute);
 const cfg=settingsFor(state),signature=JSON.stringify(cfg);
 if(signature!==deskSignature&&!planDirty){
  deskSignature=signature;
  $('opening-rows').innerHTML=foods().map(p=>{const m=cfg.menu[p.id];return '<tr><th><input class="food-name-input" aria-label="'+escape(p.name)+' Name" data-food="'+p.id+'" data-field="name" value="'+escape(p.name)+'" maxlength="90" required><div class="food-meta-fields"><input aria-label="'+escape(p.name)+' Ticker" data-food="'+p.id+'" data-field="symbol" value="'+escape(p.symbol)+'" pattern="[A-Za-z0-9]{3,6}" maxlength="6" required><select aria-label="'+escape(p.name)+' Category" data-food="'+p.id+'" data-field="category">'+CATEGORIES.map(c=>'<option '+(p.category===c?'selected':'')+'>'+c+'</option>').join('')+'</select></div>'+photoFields(p)+'</th><td><input aria-label="'+escape(p.name)+' On Menu" data-plan="'+p.id+'" data-field="enabled" type="checkbox" '+(m.enabled?'checked':'')+'></td>'+[['stock',m.stock,'1','0','1000'],['price',(m.price/100).toFixed(2),'.01','.01','100'],['floor',(m.floor/100).toFixed(2),'.01','.01','100'],['cost',(m.cost/100).toFixed(2),'.01','0','100']].map(([key,value,step,min,max])=>'<td><input aria-label="'+escape(p.name)+' '+key+'" data-plan="'+p.id+'" data-field="'+key+'" type="number" value="'+value+'" step="'+step+'" min="'+min+'" max="'+max+'" required></td>').join('')+'</tr>';}).join('');
 }
 renderDeskForms(cfg);
 const d=state.promotion;
 $('deal-preview').textContent=d?'ON AIR: '+(d.title||({combo:'Study Buddy',crash:'Market Crash',rush:'Rush',rescue:'Closing Rush'}[d.kind]))+' · ends '+simTime(d.until):'No offer announcement is running. Confirmed prices are still available.';
}
$('opening-form').oninput=()=>{planDirty=true;$('plan-status').textContent='Unsaved opening plan';};
function openingSettings(){
 const cfg=settingsCopy();
 for(const input of document.querySelectorAll('[data-plan]'))cfg.menu[input.dataset.plan][input.dataset.field]=input.dataset.field==='enabled'?input.checked:input.dataset.field==='stock'?Number(input.value):cents(input.value);
 for(const input of document.querySelectorAll('[data-food]')){const p=cfg.foods.find(f=>f.id===input.dataset.food);p[input.dataset.field]=input.dataset.field==='symbol'?input.value.toUpperCase():input.value.trim();}
 for(const select of document.querySelectorAll('[data-photo]')){const p=cfg.foods.find(f=>f.id===select.dataset.photo);p.image=select.value==='custom'?document.querySelector('[data-photo-url="'+p.id+'"]').value.trim():select.value;p.kind=CATALOG.find(f=>f.image===p.image)?.kind||p.kind;}
 return cfg;
}
function cents(text){if(!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(String(text)))throw new Error('Enter prices with at most two decimal places.');return Math.round(Number(text)*100);}
$('opening-form').onsubmit=e=>{e.preventDefault();change(s=>{const next=applyPlan(s,openingSettings());planDirty=false;decision=null;basket={};$('plan-status').textContent='Inventory Applied';toast('The display, case, and mobile menu now use this plan.');return next;});};
$('new-food-category').innerHTML=CATEGORIES.map(c=>'<option>'+c+'</option>').join('');
$('new-food-photo').innerHTML=photoOptions();
$('new-food-photo').onchange=()=>{const custom=$('new-food-photo').value==='custom';$('new-food-url-label').hidden=!custom;$('new-food-url').required=custom;};
$('add-food-form').onsubmit=e=>{e.preventDefault();change(s=>{const cfg=settingsCopy(),photo=CATALOG.find(p=>p.image===$('new-food-photo').value),id='food-'+crypto.randomUUID().slice(0,8),price=cents($('new-food-price').value);const image=$('new-food-photo').value==='custom'?$('new-food-url').value.trim():$('new-food-photo').value,kind=photo?.kind||({'Breakfast Sandwiches':'wrap','Lunch Sandwich':'sandwich',Bagels:'bagel',Pastries:'croissant',Bakery:'muffin'}[$('new-food-category').value]);cfg.foods.push({id,image,kind,name:$('new-food-name').value.trim(),symbol:$('new-food-symbol').value.trim().toUpperCase(),category:$('new-food-category').value,base:price});cfg.menu[id]={stock:Number($('new-food-stock').value),price,floor:1,cost:20,enabled:true};const next=applyPlan(s,cfg);planDirty=false;tvCategory='all';$('tv-category').value='all';toast('Food added to the shared menu.');return next;});};
function receiveDefaults(){const m=settingsFor(state).menu[$('receive-product').value];for(const k of ['price','floor','cost'])$('receive-'+k).value=(m[k]/100).toFixed(2);}
$('receive-product').onchange=receiveDefaults;
$('receive-form').onsubmit=e=>{e.preventDefault();change(s=>{const next=receiveStock(s,$('receive-product').value,Number($('receive-quantity').value),cents($('receive-price').value),cents($('receive-floor').value),cents($('receive-cost').value));toast('Fresh batch received. Case and menus updated.');return next;});};
$('recount-batch').onclick=()=>change(s=>recountBatch(s,$('decision-batch').value,Number($('physical-count').value))).then(()=>{decision=null;renderDecision();});
let trafficDirty=false,dealDirty=false,pricingDirty=false,formsSignature='';
function renderDeskForms(cfg){
 const signature=JSON.stringify(cfg);if(signature===formsSignature)return;formsSignature=signature;
 for(const id of ['receive-product','deal-first','deal-second']){const prior=$(id).value;$(id).innerHTML=foods().map(p=>'<option value="'+p.id+'">'+escape(p.name)+'</option>').join('');if(foods().some(p=>p.id===prior))$(id).value=prior;}
 if(!trafficDirty){$('traffic-person').value=cfg.traffic.inPerson;$('traffic-mobile').value=cfg.traffic.mobile;$('speed').value=cfg.traffic.speed;for(const [type,r] of Object.entries(cfg.rushes)){$(type+'-time').value=clockInput(r.at);$(type+'-duration').value=r.duration;$(type+'-multiplier').value=r.multiplier;}}
 if(!dealDirty){const d=cfg.deal;$('deal-kind').value=d.kind==='rescue'?'crash':d.kind;$('deal-title').value=d.kind==='rescue'?'Market Crash':d.title;$('deal-duration').value=d.duration;$('deal-time').value=clockInput(d.at);$('deal-first').value=d.ids[0];$('deal-second').value=d.ids[1];$('deal-category').value=d.category;dealFields();}
 if(!pricingDirty)for(const [key,value] of Object.entries(pricingFor(cfg)))$('pricing-'+key).value=['contribution','orderFee'].includes(key)?(value/100).toFixed(2):value;
 receiveDefaults();
}
$('traffic-form').oninput=()=>{trafficDirty=true;};
$('traffic-form').onsubmit=e=>{e.preventDefault();change(s=>{const cfg=settingsCopy();cfg.traffic={inPerson:Number($('traffic-person').value),mobile:Number($('traffic-mobile').value),speed:Number($('speed').value)};for(const type of Object.keys(RUSH_NAMES))cfg.rushes[type]={at:minuteInput($(type+'-time').value),duration:Number($(type+'-duration').value),multiplier:Number($(type+'-multiplier').value)};const next=applyPlan(s,cfg);trafficDirty=false;formsSignature='';$('traffic-status').textContent='Simulation Applied';toast('Move the Market now uses these rushes and purchase rates.');return next;});};
$('deal-form').oninput=()=>{dealDirty=true;};
function dealFields(){const pair=$('deal-kind').value==='combo';$('pair-one-label').hidden=!pair;$('pair-two-label').hidden=!pair;$('deal-category-label').hidden=$('deal-kind').value!=='crash';}
$('deal-kind').onchange=()=>{const k=$('deal-kind').value;$('deal-title').value={combo:'Food Bundle',crash:'Market Crash'}[k];dealFields();};
function dealSettings(){const cfg=settingsCopy();cfg.deal={kind:$('deal-kind').value,title:$('deal-title').value.trim(),duration:Number($('deal-duration').value),at:minuteInput($('deal-time').value),category:$('deal-category').value,ids:[$('deal-first').value,$('deal-second').value]};return cfg;}
function applyDeal(launch){if(!$('deal-form').reportValidity())return;change(s=>{const cfg=dealSettings();let next=updateSettings(s,cfg);if(launch)next=triggerEvent(next,cfg.deal.kind);dealDirty=false;formsSignature='';$('market-event').value=cfg.deal.kind==='rescue'?'closing':cfg.deal.kind;toast(launch?'Offer is on both menus.':'Saved offer is ready under Move the Market.');return next;});}
$('deal-form').onsubmit=e=>{e.preventDefault();applyDeal(false);};
$('launch-deal').onclick=()=>applyDeal(true);
$('end-deal').onclick=()=>change(s=>endDeal(s));
$('mobile-replay').onclick=$('run-day').onclick;
$('mobile-pause').onclick=$('pause-day').onclick;
$('mobile-day-slider').oninput=$('day-slider').oninput;


function renderLocation(){
 const place=locationInfo(state.settings);document.title='MarketBite · '+place.name;
 document.querySelectorAll('[data-location-name]').forEach(el=>el.textContent=place.name);
 document.querySelectorAll('[data-location-caption]').forEach(el=>el.textContent=[place.caption,place.name].filter(Boolean).join(' · ').toUpperCase());
 document.querySelectorAll('[data-location-address]').forEach(el=>el.textContent=place.address);
 $('menu-search').placeholder='Search '+place.name;$('menu-search').setAttribute('aria-label','Search '+place.name);
 document.querySelectorAll('a[data-view],a[href^="?display="],.tv-tools a').forEach(a=>{const q=new URL(a.href).searchParams;q.set('location',locationId);a.href='?'+q+a.hash;});
}
function resetDrafts(){planDirty=false;hoursDirty=false;trafficDirty=false;dealDirty=false;pricingDirty=false;deskSignature='';hoursSignature='';formsSignature='';tickerSignature='';marketSelectionPending=true;basket={};decision=null;page=0;selectedBatch='batch-0';}
function switchLocation(id){
 pause();if(!registry.locations.some(l=>l.id===id))throw new Error('Choose a saved location.');
 const raw=localStorage.getItem(stateKey(id)),next=migrateState(raw?JSON.parse(raw):null);if(!next)throw new Error('This location’s saved day could not be loaded. Its data has been kept.');
 const nextRegistry={...registry,activeId:id};localStorage.setItem(LOCATION_KEY,JSON.stringify(nextRegistry));registry=nextRegistry;locationId=id;KEY=stateKey(id);state=next;resetDrafts();history.replaceState({},'',locationUrl(view));render();
}
$('pricing-form').oninput=()=>{pricingDirty=true;};
$('pricing-form').onsubmit=e=>{e.preventDefault();change(s=>{const cfg=settingsCopy();cfg.pricing=Object.fromEntries(Object.keys(pricingFor(cfg)).map(key=>[key,['contribution','orderFee'].includes(key)?cents($('pricing-'+key).value):Number($('pricing-'+key).value)]));const next=applyPlan(s,cfg);pricingDirty=false;formsSignature='';decision=null;basket={};$('pricing-status').textContent='Pricing Applied';toast('Pricing rules updated across all displays.');return next;});};

renderDeskForms(settingsFor(state));
clock();setInterval(clock,1000);if(!read())save();showView(view,false);

// The sandwich story can pause independently of the cafe simulation.
$('journey-pause').onclick=()=>{
 const paused=$('bite-journey').classList.toggle('journey-paused');
 $('journey-pause').textContent=paused?'Play':'Pause';
 $('journey-pause').setAttribute('aria-label',paused?'Play animation':'Pause animation');
};
