import {catalogFor,RUSH_NAMES,trafficAt,applyPlan,CATALOG,CATEGORIES,FEATURED,hoursFor,migrateState,money,simTime,initialState,validState,productView,offerAvailable,rawAvailable,sell,restock,evaluateBatch,executeDemoDecision,observeStock,setAllocations,demoScenarios,triggerEvent,comboView,buyCombo,basketQuote,applyTicker,stepSimulation,snapshotAt,demand,settingsFor,updateSettings,startPlannedDay,receiveStock,recountBatch,jumpToRush,endDeal} from './model.mjs';
import {createCase} from './case.mjs';
const $=id=>document.getElementById(id),KEY='marketbite-connections-v3',escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search),displayOnly=params.get('display')==='1';
let view=displayOnly?'tv':params.get('view')||'home',state,playing=false,timer=null,storageAvailable=true,page=0,tvCategory='featured',selectedBatch='batch-5',decision=null,basket={},dealsOnly=false,caseScene=null;
function read(){try{const s=JSON.parse(localStorage.getItem(KEY));if(validState(s))return s;const migrated=migrateState(s);if(migrated){localStorage.setItem(KEY+'-before-v6-update',JSON.stringify(s));localStorage.setItem(KEY,JSON.stringify(migrated));return migrated;}}catch{storageAvailable=false;}return null;}
state=read()||initialState('opening');
const foods=()=>catalogFor(state),onMenu=()=>foods().filter(p=>settingsFor(state).menu[p.id].enabled);

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
 view=next==='simulation'?'tv':['home','tv','mobile','sustainability','inventory'].includes(next)?next:'home';
 for(const id of ['home','tv','mobile','simulation','sustainability','inventory'])$('view-'+id).hidden=id==='simulation'?view!=='tv'||displayOnly:id!==view;
 document.querySelectorAll('.workspace-bar [data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(push&&!displayOnly){history.pushState({},'', '?view='+view);window.scrollTo(0,0);}
 if(view==='tv'&&!displayOnly){if(!caseScene)caseScene=createCase($('case-stage'));caseScene?.setState(state);caseScene?.resize();}
 if(view==='tv')resize();render();
}
function revealSection(id){const target=$(id);if(!target)return;for(let node=target;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});}
document.querySelectorAll('[data-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showView(a.dataset.view);if(a.hash)revealSection(a.hash.slice(1));}));
window.addEventListener('popstate',()=>showView(new URLSearchParams(location.search).get('view')||'home',false));
if(displayOnly){document.body.classList.add('tv-only');$('tv-tools').hidden=false;}
function resize(){const r=$('tv-stage').getBoundingClientRect();if(!r.width)return;const scale=Math.min(r.width/1920,r.height/1080);$('tv').style.transform=document.fullscreenElement===$('tv-stage')?'translate(-50%,-50%) scale('+scale+')':'scale('+scale+')';}
new ResizeObserver(resize).observe($('tv-stage'));window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
for(const id of ['tv-category','inventory-category'])for(const c of CATEGORIES){const o=document.createElement('option');o.value=c;o.textContent=c;$(id).append(o);}
function tvProducts(){const menu=onMenu();return tvCategory==='featured'?[...menu.filter(p=>FEATURED.includes(p.id)),...menu.filter(p=>!FEATURED.includes(p.id))].slice(0,6):tvCategory==='all'?menu:menu.filter(p=>p.category===tvCategory);}
function renderTV(previous){
 const products=tvProducts(),pages=Math.max(1,Math.ceil(products.length/6));page=Math.min(page,pages-1);
 $('page-number').textContent=(page+1)+' / '+pages;$('prev-page').disabled=pages<2;$('next-page').disabled=pages<2;
 $('product-grid').innerHTML=products.slice(page*6,page*6+6).map(product=>{
  const p=productView(state,product.id),was=previous?productView(previous,p.id):null;
  return '<article class="food-card '+(p.saving?'discounted ':'')+(!p.quantity?'sold-out ':'')+(was&&p.price<was.price?'updated':'')+'" aria-label="'+escape(p.name)+' '+(p.quantity?money(p.price):'unavailable')+'"><div class="food-photo"><img src="'+p.image+'" alt="'+escape(p.name)+'"><span class="food-badge '+(p.quantity&&!p.saving?'regular':'')+'">'+(!p.quantity?'UNAVAILABLE':p.saving?'↓ '+pct(p.discount)+'% OFF':p.category.toUpperCase())+'</span>'+(p.quantity?'<span class="stock-badge '+(p.offerQuantity<=3?'low':'')+'">'+p.offerQuantity+' AVAILABLE</span>':'')+'</div><div class="food-info"><div><span class="food-symbol">'+escape(p.symbol)+'</span><h2 class="food-name">'+escape(p.name)+'</h2></div><div class="food-price"><strong>'+(p.quantity?money(p.price):'Unavailable')+'</strong><span class="old-price">'+(p.quantity?(p.saving?'<s>Was '+money(p.base)+'</s>':'Regular price'):'')+'</span></div></div></article>';
 }).join('');
 const offers=foods().map(p=>productView(state,p.id)).filter(p=>p.quantity&&p.saving);
 const promotion=state.promotion;
 $('menu-status').textContent=state.minute>=hoursFor(state).close-5?'OFFERS ENDED':promotion?({crash:'STOCK CRASH',combo:promotion.title.toUpperCase(),rush:(RUSH_NAMES[promotion.rushType]||'Lunch Rush').toUpperCase(),rescue:'CLOSING RUSH'}[promotion.kind]):offers.length?'PRICE DROPS NOW':'FRESH IN THE CASE';
 const combo=comboView(state);
 $('menu-message').textContent=state.minute>=hoursFor(state).close-5?'Thanks for making every bite count.':promotion?.kind==='combo'&&combo.available?combo.products.map(p=>p.name).join(' & ')+' · '+money(combo.total)+' together':promotion?.kind==='rush'?'The '+(promotion.rushType||'lunch')+' rush is on. Your confirmed prices hold.':offers.length?'Good food. A little less. A lot less waste.':'Sandwiches, bagels, pastries & something sweet.';
 $('day-clock').textContent=simTime(state.minute);$('tv-impact').textContent=state.surplusSold+' surplus items sold · demo';$('updated').textContent='Synced '+timeFormat.format(new Date(state.updatedAt));
 $('sync-status').textContent=storageAvailable?'Connected across tabs in this browser':'Session only · browser storage unavailable';
 renderTicker();
}
$('tv-category').onchange=e=>{tvCategory=e.target.value;page=0;renderTV();};
$('prev-page').onclick=()=>{page=(page-1+Math.ceil(tvProducts().length/6))%Math.ceil(tvProducts().length/6);renderTV();};
$('next-page').onclick=()=>{page=(page+1)%Math.ceil(tvProducts().length/6);renderTV();};
let tickerSignature='';
function renderTicker(){
 const signature=JSON.stringify([foods().map(p=>{const v=productView(state,p.id);return [v.price,v.quantity];}),state.promotion?.kind,state.events[0]?.text]);
 if(signature!==tickerSignature){
  tickerSignature=signature;
  const content=onMenu().map(product=>{const p=productView(state,product.id);return '<div class="ticker-item"><span class="ticker-label"><b class="ticker-symbol">'+escape(p.symbol)+'</b><small>'+escape(p.name)+'</small></span><span class="ticker-price">'+(p.quantity?money(p.price):'UNAVAILABLE')+'</span>'+(p.quantity&&p.saving?'<span class="ticker-drop">↓ '+pct(p.discount)+'% · Was '+money(p.base)+'</span>':'')+'<span class="ticker-quantity">'+p.quantity+' AVAILABLE</span></div>';}).join('')+'<span class="ticker-item ticker-news">'+escape(state.events[0]?.text||'Taste more. Waste less.')+'</span>';
  $('ticker-track').innerHTML='<div class="ticker-group">'+content+'</div><div class="ticker-group" aria-hidden="true">'+content+'</div>';
 }
 $('ticker-track').classList.toggle('paused',!state.preferences.ticker);
}
function renderInventory(){
 const cat=$('inventory-category').value;
 $('inventory-list').innerHTML=foods().filter(p=>cat==='all'||p.category===cat).map(product=>{
 const p=productView(state,product.id);return '<div class="inventory-row"><div class="inventory-product"><img src="'+p.image+'" alt=""><div><strong>'+escape(p.name)+'</strong><span>'+escape(p.symbol)+' · '+p.quantity+' available</span></div></div><div class="inventory-values"><b>'+(p.quantity?money(p.price):'—')+'</b><span>Regular '+money(p.base)+'</span></div><div class="inventory-actions"><button data-sell="'+p.id+'" '+(!p.quantity?'disabled':'')+'>Sell 1</button><button data-restock="'+p.id+'" '+(state.minute>=hoursFor(state).close-5?'disabled':'')+'>+4 fresh</button><button data-review="'+p.id+'">Review</button></div></div>';
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
 chart('price-chart',b.priceEvents.map(e=>({at:e.at,value:e.price})),b.original_cents,v=>'$'+(v/100).toFixed(2),true,terminal);
 $('chart-stock').textContent=state.history.at(-1).stock+' units';
 chart('stock-chart',state.history.map(e=>({at:e.at,value:e.stock})),Math.max(10,...state.history.map(e=>e.stock)),v=>Math.round(v),true);
 $('chart-demand').textContent=Math.round(demand(state))+' / Hour';
 chart('demand-chart',state.history.map(e=>({at:e.at,value:e.demand})),Math.max(40,...state.history.map(e=>e.demand)),v=>Math.round(v),false,state.minute,'#d2a329');
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
 const scenarios=demoScenarios(b,state.policy,$('scenario-profile').value);
 const prices=Object.keys(scenarios[0]?.demand||{});
 $('scenario-table').innerHTML='<table><thead><tr><th>Assumed demand</th>'+prices.map(p=>'<th>'+money(Number(p))+'</th>').join('')+'</tr></thead><tbody>'+scenarios.map(s=>'<tr><td>'+s.label+' ('+Number(s.weight)*100+'%)</td>'+prices.map(p=>'<td>'+s.demand[p]+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 $('publish-price').hidden=true;$('fail-price').hidden=true;
 if(!decision){$('decision-result').innerHTML='<p>Physical '+b.physical_units+' − reserved '+b.reserved_units+' − protected '+b.protected_units+' − buffer '+b.buffer_units+' = '+rawAvailable(b)+' offer units. '+(b.window_committed?'This window is committed.':'Evaluate to compare the permitted prices.')+'</p>';return;}
 const d=decision;
 $('decision-result').innerHTML='<span class="result-status '+d.status.toLowerCase()+'">'+d.status+'</span><p>'+escape(d.reason)+'</p>'+(d.floor_cents!==null?'<p>Floor '+money(d.floor_cents)+' · '+d.available+' offer units'+(d.evaluation_completed?' · baseline leftovers '+d.expected_baseline_leftovers.toFixed(2):'')+'</p>':'')+(d.rows.length?'<table><thead><tr><th>Candidate</th><th>Expected sales</th><th>Expected gain</th><th>Worst listed gain</th><th>Passes gates</th></tr></thead><tbody>'+d.rows.map(r=>'<tr class="'+(r.admissible?'accepted':'')+'"><td>'+money(r.price_cents)+(r.price_cents===d.price_cents?' · selected':'')+'</td><td>'+r.expected_sales.toFixed(2)+'</td><td>'+money(r.expected_gain_cents)+'</td><td>'+money(r.worst_gain_cents)+'</td><td>'+(r.admissible?'Yes':r.price_cents===b.current_cents?'Baseline':'No')+'</td></tr>').join('')+'</tbody></table>':'');
 if(d.evaluation_completed&&!b.window_committed){$('publish-price').hidden=false;$('publish-price').textContent=d.status==='MARKDOWN'?'Publish '+money(d.price_cents)+' to demo screens':'Keep this price for this batch';$('fail-price').hidden=d.status!=='MARKDOWN';}
}
$('publish-price').onclick=()=>{const d=decision;if(!d)return;change(s=>executeDemoDecision(s,d.batchId,d,true,true,'manual-'+d.windowId+'-'+d.checkoutVersion)).then(()=>{decision=null;renderDecision();});};
$('fail-price').onclick=()=>{const d=decision;if(d)change(s=>executeDemoDecision(s,d.batchId,d,true,false,'failed-'+d.windowId));};
$('save-allocations').onclick=()=>change(s=>setAllocations(s,$('decision-batch').value,Number($('reserved').value),Number($('protected').value),Number($('buffer').value))).then(()=>{decision=null;renderDecision();});
$('scenario-profile').onchange=()=>{decision=null;renderDecision();};
function updatePlayback(){
 for(const id of ['pause-day','mobile-pause']){$(id).textContent=playing?'Pause':'Play';$(id).disabled=!playing&&state.minute>=hoursFor(state).close;}
 for(const id of ['run-day','mobile-replay'])$(id).textContent='Restart';
}
function pause(){clearInterval(timer);timer=null;playing=false;updatePlayback();}
function start(){if(state.minute>=hoursFor(state).close)return;clearInterval(timer);playing=true;updatePlayback();timer=setInterval(async()=>{await change(s=>stepSimulation(s,5),{stop:false});if(state.minute>=hoursFor(state).close)pause();},60000/((hoursFor(state).close-hoursFor(state).open)/5)/settingsFor(state).traffic.speed);}
$('run-day').onclick=()=>{basket={};decision=null;change(s=>startPlannedDay(s));};
$('pause-day').onclick=()=>playing?pause():start();
$('day-slider').oninput=e=>{const minute=Number(e.target.value);basket={};decision=null;change(s=>snapshotAt(minute,settingsFor(s)));};
function renderMarket(){
 const cfg=settingsFor(state),{open,close}=hoursFor(state),choice=$('market-event').value;
 for(const option of $('market-event').options){const r=cfg.rushes[option.value];if(r){option.textContent=RUSH_NAMES[option.value]+' · '+simTime(r.at);option.disabled=r.at<open||r.at+r.duration>close-5;}else option.textContent=({crash:'Stock Crash',combo:cfg.deal.kind==='combo'?cfg.deal.title:'Food Pairing',rescue:'Closing Rush'})[option.value];}
 $('launch-market').textContent=cfg.rushes[choice]?'Start Rush':'Launch Offer';$('launch-market').disabled=$('market-event').selectedOptions[0].disabled||(!cfg.rushes[choice]&&state.minute>=close-5);
 const p=state.promotion,c=comboView(state),saved=cfg.deal.ids.map(id=>foods().find(f=>f.id===id).name).join(' & ');
 $('market-current').innerHTML=p?'<span class="market-state-label">ON THE MENU</span><strong>'+escape(p.title)+'</strong><span>'+(p.kind==='combo'?c.products.map(p=>escape(p.name)).join(' & ')+' · '+money(c.total)+' together · ':'')+'Until '+simTime(p.until)+'</span>':'<span class="market-state-label">SAVED OFFER</span><strong>'+escape(cfg.deal.title)+'</strong><span>'+escape(cfg.deal.kind==='combo'?saved:'Eligible surplus price review')+' · '+simTime(cfg.deal.at)+'</span>';
}
$('market-event').onchange=renderMarket;
$('launch-market').onclick=async()=>{const type=$('market-event').value;let success=false;await change(s=>{const next=Object.hasOwn(RUSH_NAMES,type)?jumpToRush(s,type):triggerEvent(s,type);success=true;return next;});if(success&&Object.hasOwn(RUSH_NAMES,type)){decision=null;basket={};start();}};
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
 $('mobile-promotion').innerHTML=promo?'<div class="mobile-deal"><strong>'+escape(promo.title||({crash:'The Bakery Stock Crash',combo:'Study Buddy Pairing',rush:'Rush Is On',rescue:'Closing Rush'}[promo.kind]))+'</strong><p>'+({crash:'Freshly confirmed savings on eligible bakery batches. Catch your favorite while it lasts.',combo:c.products.map(p=>escape(p.name)).join(' & ')+' · '+money(c.total)+' together. Each item keeps its confirmed price.',rush:'The '+escape(promo.rushType||'lunch')+' rush is on. Confirmed prices hold.',rescue:'Find eligible surplus offers before the selling window closes.'}[promo.kind])+'</p><p>Event ends at '+simTime(promo.until)+'</p>'+(promo.kind==='combo'?'<button id="add-combo" '+(!c.available?'disabled':'')+'>'+(c.available?'Add both to basket':'Pairing unavailable')+'</button>':'')+'</div>':'';
 const matches=onMenu().filter(p=>(!search||(p.name+' '+escape(p.symbol)+' '+p.category).toLowerCase().includes(search))&&(!dealsOnly||(productView(state,p.id).saving>0&&productView(state,p.id).quantity>0)));
 $('mobile-menu').innerHTML=matches.length?CATEGORIES.map((category,i)=>{
 const products=matches.filter(p=>p.category===category);if(!products.length)return '';
 return '<section class="mobile-menu-section" id="mobile-category-'+i+'"><h3>'+category+'</h3>'+products.map(product=>{
 const p=productView(state,product.id);return '<article class="mobile-card '+(!p.quantity?'unavailable':p.saving?'discounted':'')+'"><div class="mobile-card-info"><span class="mobile-symbol">'+escape(p.symbol)+'</span><h4>'+escape(p.name)+'</h4><div class="mobile-price">'+(p.quantity?money(p.price):'Unavailable')+(p.quantity&&p.saving?'<s>Was '+money(p.base)+'</s>':'')+'</div>'+(p.quantity&&p.saving?'<div class="mobile-drop">↓ '+pct(p.discount)+'% Off'+'</div>':'')+'<div class="mobile-quantity">'+(p.quantity?p.offerQuantity+' Available · '+simTime(p.priceAt):'Check back for fresh stock')+'</div></div><div class="mobile-thumb"><img src="'+p.image+'" alt="'+escape(p.name)+'" loading="lazy"><button class="mobile-add" data-add="'+p.id+'" aria-label="Add '+escape(p.name)+'" '+(!p.quantity?'disabled':'')+'>+</button></div></article>';
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
 renderHours();renderSustainability();renderDesk();renderMarket();renderTV(previous);batchOptions();renderInventory();renderActivity();renderCharts();renderDecision();renderMobile();
 $('simulation-time').textContent=simTime(state.minute);$('mobile-demo-time').textContent=simTime(state.minute);$('mobile-day-slider').value=state.minute;$('day-slider').value=state.minute;
 $('total-stock').textContent=state.batches.reduce((n,b)=>n+offerAvailable(state,b),0);$('total-sold').textContent=state.sold;$('in-person-orders').textContent=state.orders.inPerson;$('mobile-orders').textContent=state.orders.mobile;updatePlayback();caseScene?.setState(state);
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
 const {open,close}=hoursFor(state),signature=open+':'+close;
 if(signature!==hoursSignature&&!hoursDirty){$('hours-open').value=clockInput(open);$('hours-close').value=clockInput(close);hoursSignature=signature;}
 for(const id of ['day-slider','mobile-day-slider']){$(id).min=open;$(id).max=close;}
 $('timeline-labels').innerHTML='<span>'+simTime(open)+' · Open</span><span>'+simTime(close-120)+' · Review</span><span>'+simTime(close)+' · Close</span>';
 $('mobile-hours').textContent='Cafe hours · '+simTime(open)+'–'+simTime(close);
}
function renderSustainability(){
 $('sustainability-counts').innerHTML=[['Surplus items sold',state.surplusSold],['Transferred',state.transferred],['Retained at close',state.retained],['Discarded',state.discarded]].map(([label,value])=>'<div><strong>'+value+'</strong><span>'+label+'</span></div>').join('');
}
$('hours-form').oninput=()=>{hoursDirty=true;$('hours-status').textContent='Unsaved hours';};
$('hours-form').onsubmit=e=>{e.preventDefault();change(s=>{const cfg=structuredClone(settingsFor(s));cfg.hours={open:minuteInput($('hours-open').value),close:minuteInput($('hours-close').value)};const next=applyPlan(s,cfg);hoursDirty=false;decision=null;basket={};$('hours-status').textContent='Hours Applied';toast('Cafe hours updated on every screen.');return next;});};
const settingsCopy=()=>structuredClone(settingsFor(state));
function renderDesk(){
 $('desk-time').textContent='DEMO TIME · '+simTime(state.minute);
 const cfg=settingsFor(state),signature=JSON.stringify(cfg);
 if(signature!==deskSignature&&!planDirty){
  deskSignature=signature;
  $('opening-rows').innerHTML=foods().map(p=>{const m=cfg.menu[p.id];return '<tr><th><input class="food-name-input" aria-label="'+escape(p.name)+' Name" data-food="'+p.id+'" data-field="name" value="'+escape(p.name)+'" maxlength="90" required><div class="food-meta-fields"><input aria-label="'+escape(p.name)+' Ticker" data-food="'+p.id+'" data-field="symbol" value="'+escape(p.symbol)+'" pattern="[A-Za-z0-9]{3,6}" maxlength="6" required><select aria-label="'+escape(p.name)+' Category" data-food="'+p.id+'" data-field="category">'+CATEGORIES.map(c=>'<option '+(p.category===c?'selected':'')+'>'+c+'</option>').join('')+'</select></div><select aria-label="'+escape(p.name)+' Photo" data-food="'+p.id+'" data-field="image">'+CATALOG.map(f=>'<option value="'+f.image+'" '+(f.image===p.image?'selected':'')+'>'+escape(f.name)+' Photo</option>').join('')+'</select></th><td><input aria-label="'+escape(p.name)+' On Menu" data-plan="'+p.id+'" data-field="enabled" type="checkbox" '+(m.enabled?'checked':'')+'></td>'+[['stock',m.stock,'1','0','1000'],['price',(m.price/100).toFixed(2),'.01','.01','100'],['floor',(m.floor/100).toFixed(2),'.01','.01','100'],['cost',(m.cost/100).toFixed(2),'.01','0','100']].map(([key,value,step,min,max])=>'<td><input aria-label="'+escape(p.name)+' '+key+'" data-plan="'+p.id+'" data-field="'+key+'" type="number" value="'+value+'" step="'+step+'" min="'+min+'" max="'+max+'" required></td>').join('')+'</tr>';}).join('');
 }
 renderDeskForms(cfg);
 const d=state.promotion;
 $('deal-preview').textContent=d?'ON AIR: '+(d.title||({combo:'Study Buddy',crash:'Bakery Stock Crash',rush:'Rush',rescue:'Closing Rush'}[d.kind]))+' · ends '+simTime(d.until):'No offer announcement is running. Confirmed prices are still available.';
}
$('opening-form').oninput=()=>{planDirty=true;$('plan-status').textContent='Unsaved opening plan';};
function openingSettings(){
 const cfg=settingsCopy();
 for(const input of document.querySelectorAll('[data-plan]'))cfg.menu[input.dataset.plan][input.dataset.field]=input.dataset.field==='enabled'?input.checked:input.dataset.field==='stock'?Number(input.value):cents(input.value);
 for(const input of document.querySelectorAll('[data-food]')){const p=cfg.foods.find(f=>f.id===input.dataset.food);p[input.dataset.field]=input.dataset.field==='symbol'?input.value.toUpperCase():input.value.trim();if(input.dataset.field==='image')p.kind=CATALOG.find(f=>f.image===input.value)?.kind||p.kind;}
 return cfg;
}
function cents(text){if(!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(String(text)))throw new Error('Enter prices with at most two decimal places.');return Math.round(Number(text)*100);}
$('opening-form').onsubmit=e=>{e.preventDefault();change(s=>{const next=applyPlan(s,openingSettings());planDirty=false;decision=null;basket={};$('plan-status').textContent='Inventory Applied';toast('The display, case, and mobile menu now use this plan.');return next;});};
$('new-food-category').innerHTML=CATEGORIES.map(c=>'<option>'+c+'</option>').join('');
$('new-food-photo').innerHTML=CATALOG.map(p=>'<option value="'+p.id+'">'+escape(p.name)+'</option>').join('');
$('add-food-form').onsubmit=e=>{e.preventDefault();change(s=>{const cfg=settingsCopy(),photo=CATALOG.find(p=>p.id===$('new-food-photo').value),id='food-'+crypto.randomUUID().slice(0,8),price=cents($('new-food-price').value);cfg.foods.push({...photo,id,name:$('new-food-name').value.trim(),symbol:$('new-food-symbol').value.trim().toUpperCase(),category:$('new-food-category').value,base:price});cfg.menu[id]={stock:Number($('new-food-stock').value),price,floor:1,cost:20,enabled:true};const next=applyPlan(s,cfg);planDirty=false;tvCategory='all';$('tv-category').value='all';toast('Food added to the shared menu.');return next;});};
function receiveDefaults(){const m=settingsFor(state).menu[$('receive-product').value];for(const k of ['price','floor','cost'])$('receive-'+k).value=(m[k]/100).toFixed(2);}
$('receive-product').onchange=receiveDefaults;
$('receive-form').onsubmit=e=>{e.preventDefault();change(s=>{const next=receiveStock(s,$('receive-product').value,Number($('receive-quantity').value),cents($('receive-price').value),cents($('receive-floor').value),cents($('receive-cost').value));toast('Fresh batch received. Case and menus updated.');return next;});};
$('recount-batch').onclick=()=>change(s=>recountBatch(s,$('decision-batch').value,Number($('physical-count').value))).then(()=>{decision=null;renderDecision();});
let trafficDirty=false,dealDirty=false,formsSignature='';
function renderDeskForms(cfg){
 const signature=JSON.stringify(cfg);if(signature===formsSignature)return;formsSignature=signature;
 for(const id of ['receive-product','deal-first','deal-second']){const prior=$(id).value;$(id).innerHTML=foods().map(p=>'<option value="'+p.id+'">'+escape(p.name)+'</option>').join('');if(foods().some(p=>p.id===prior))$(id).value=prior;}
 if(!trafficDirty){$('traffic-person').value=cfg.traffic.inPerson;$('traffic-mobile').value=cfg.traffic.mobile;$('speed').value=cfg.traffic.speed;for(const [type,r] of Object.entries(cfg.rushes)){$(type+'-time').value=clockInput(r.at);$(type+'-duration').value=r.duration;$(type+'-multiplier').value=r.multiplier;}}
 if(!dealDirty){const d=cfg.deal;$('deal-kind').value=d.kind;$('deal-title').value=d.title;$('deal-duration').value=d.duration;$('deal-time').value=clockInput(d.at);$('deal-first').value=d.ids[0];$('deal-second').value=d.ids[1];$('deal-category').value=d.category;dealFields();}
 receiveDefaults();
}
$('traffic-form').oninput=()=>{trafficDirty=true;};
$('traffic-form').onsubmit=e=>{e.preventDefault();change(s=>{const cfg=settingsCopy();cfg.traffic={inPerson:Number($('traffic-person').value),mobile:Number($('traffic-mobile').value),speed:Number($('speed').value)};for(const type of Object.keys(RUSH_NAMES))cfg.rushes[type]={at:minuteInput($(type+'-time').value),duration:Number($(type+'-duration').value),multiplier:Number($(type+'-multiplier').value)};const next=updateSettings(s,cfg);trafficDirty=false;formsSignature='';$('traffic-status').textContent='Simulation Applied';toast('Move the Market now uses these rushes and purchase rates.');return next;});};
$('deal-form').oninput=()=>{dealDirty=true;};
function dealFields(){const pair=$('deal-kind').value==='combo';$('pair-one-label').hidden=!pair;$('pair-two-label').hidden=!pair;$('deal-category-label').hidden=$('deal-kind').value!=='crash';}
$('deal-kind').onchange=()=>{const k=$('deal-kind').value;$('deal-title').value={combo:'Study Buddy',crash:'Bakery Stock Crash',rescue:'Closing Rush'}[k];dealFields();};
function dealSettings(){const cfg=settingsCopy();cfg.deal={kind:$('deal-kind').value,title:$('deal-title').value.trim(),duration:Number($('deal-duration').value),at:minuteInput($('deal-time').value),category:$('deal-category').value,ids:[$('deal-first').value,$('deal-second').value]};return cfg;}
function applyDeal(launch){if(!$('deal-form').reportValidity())return;change(s=>{const cfg=dealSettings();let next=updateSettings(s,cfg);if(launch)next=triggerEvent(next,cfg.deal.kind);dealDirty=false;formsSignature='';$('market-event').value=cfg.deal.kind==='rescue'?'closing':cfg.deal.kind;toast(launch?'Offer is on both menus.':'Saved offer is ready under Move the Market.');return next;});}
$('deal-form').onsubmit=e=>{e.preventDefault();applyDeal(false);};
$('launch-deal').onclick=()=>applyDeal(true);
$('end-deal').onclick=()=>change(s=>endDeal(s));
$('mobile-replay').onclick=$('run-day').onclick;
$('mobile-pause').onclick=$('pause-day').onclick;
$('mobile-day-slider').oninput=$('day-slider').oninput;
renderDeskForms(settingsFor(state));
clock();setInterval(clock,1000);if(!read())save();showView(view,false);

// This story is independent of the shared cafe-day playback.
$('journey-pause').onclick=()=>{
 const paused=$('bite-journey').classList.toggle('journey-paused');
 $('journey-pause').textContent=paused?'Play':'Pause';
 $('journey-pause').setAttribute('aria-label',paused?'Play animation':'Pause animation');
};
