import {CATALOG,OPEN,CLOSE,money,simTime,initialState,validState,productView,sell,restock,markdown,applyTicker,stepSimulation,snapshotAt} from './model.mjs';
const $=id=>document.getElementById(id);
const KEY='marketbite-tv-v1';
const displayOnly=new URLSearchParams(location.search).get('display')==='1';
let storageAvailable=true,state,playing=false,timer=null,toastTimer=null,highlightTimer=null,selected=null;
const read=()=>{try{const raw=localStorage.getItem(KEY);if(raw){const s=JSON.parse(raw);if(validState(s))return s;}}catch{storageAvailable=false;}return null;};
state=read()||initialState();
const timeFormat=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',second:'2-digit'});
if(displayOnly){document.body.classList.add('tv-only');$('tv-tools').hidden=false;}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function resize(){
 const r=$('tv-stage').getBoundingClientRect();
 const scale=Math.min(r.width/1920,r.height/1080);
 $('tv').style.transform=document.fullscreenElement===$('tv-stage')?`translate(-50%, -50%) scale(${scale})`:`scale(${scale})`;
}
new ResizeObserver(resize).observe($('tv-stage'));
window.addEventListener('resize',resize);
document.addEventListener('fullscreenchange',resize);
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('tv-stage').requestFullscreen();}catch{toast('Use the browser full-screen command for this display.');}}
$('fullscreen').addEventListener('click',fullscreen);$('tv-fullscreen').addEventListener('click',fullscreen);
function photoFallback(e){e.currentTarget.style.opacity='.2';e.currentTarget.alt='Food photo unavailable';}
function makeCard(p){
 const card=document.createElement('article');card.className='food-card';card.id='food-'+p.id;
 card.innerHTML=`<div class="food-photo"><img src="${p.image}" alt="${p.name}" width="1536" height="1024"><span class="food-badge" data-badge></span><span class="stock-badge" data-stock></span></div><div class="food-info"><div><h2 class="food-name">${p.name}</h2><p class="food-description">${p.detail}</p><div class="food-availability" data-availability></div></div><div class="food-price"><strong data-price></strong><span class="old-price" data-old></span><span class="saving" data-saving></span></div></div>`;
 card.querySelector('img').addEventListener('error',photoFallback);
 return card;
}
CATALOG.forEach(p=>$('product-grid').append(makeCard(p)));
function renderCards(previous){
 CATALOG.forEach(product=>{
  const p=productView(state,product.id),el=$('food-'+p.id),available=p.quantity>0;
  const before=previous?productView(previous,p.id):null;
  el.classList.toggle('discounted',available&&p.discount>0);el.classList.toggle('sold-out',!available);
  el.setAttribute('aria-label',available?`${p.name}, ${money(p.price)}${p.discount?', '+p.discount+' percent off':''}, ${p.quantity} available`:`${p.name}, unavailable`);
  const badge=el.querySelector('[data-badge]');badge.classList.toggle('regular',available&&!p.discount);
  badge.textContent=!available?'SOLD OUT':p.discount?'↓ '+p.discount+'% OFF':p.category.toUpperCase();
  const stock=el.querySelector('[data-stock]');stock.hidden=!available;stock.textContent=p.quantity<=3?'ONLY '+p.quantity+' LEFT':p.quantity+' AVAILABLE';stock.classList.toggle('low',p.quantity<=3);
  el.querySelector('[data-price]').textContent=available?money(p.price):'Sold out';
  el.querySelector('[data-old]').innerHTML=available&&p.discount?`was <s>${money(p.base)}</s>`:available?'Regular price':'';
  el.querySelector('[data-saving]').textContent=available&&p.discount?'Save '+money(p.saving):'';
  el.querySelector('[data-availability]').innerHTML=!available?(state.minute>=CLOSE?'Offers ended for today':'Currently unavailable'):p.offerQuantity<p.quantity?`<strong>${p.offerQuantity} at this price</strong> · Fresh batch ${money(p.base)}`:p.discount?'<strong>Surplus offer</strong> · While this batch lasts':'Ready when you are';
  if(before&&before.price!==p.price&&available&&p.price<before.price){el.classList.remove('updated');void el.offsetWidth;el.classList.add('updated');}
 });
}
function renderTicker(){
 const group=document.createElement('div');group.className='ticker-group';
 CATALOG.forEach(product=>{
  const p=productView(state,product.id),item=document.createElement('div');item.className='ticker-item';
  item.innerHTML=`<span class="ticker-symbol">${p.symbol}</span><span class="ticker-price">${p.quantity?money(p.price):'SOLD OUT'}</span>${p.quantity&&p.discount?`<span class="ticker-drop">▼ ${p.discount}% OFF</span>`:''}<span class="ticker-quantity">${p.quantity} IN STOCK</span>`;group.append(item);
 });
 const news=document.createElement('span');news.className='ticker-item ticker-news';news.textContent=state.events[0]?.text||'Taste more. Waste less.';group.append(news);
 const repeated=group.cloneNode(true);repeated.setAttribute('aria-hidden','true');
 $('ticker-track').replaceChildren(group,repeated);
 $('ticker-track').classList.toggle('paused',!state.preferences.ticker);
 const paused=!state.preferences.ticker;
 for(const id of ['ticker-toggle','tv-ticker']){$(id).textContent=paused?'Resume ticker':'Pause ticker';$(id).setAttribute('aria-pressed',String(paused));}
}
function highlight(id){
 selected=selected===id?null:id;clearTimeout(highlightTimer);
 CATALOG.forEach(p=>$('food-'+p.id).classList.toggle('highlighted',p.id===selected));
 document.querySelectorAll('[data-select]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.select===selected)));
 if(selected)highlightTimer=setTimeout(()=>{selected=null;CATALOG.forEach(p=>$('food-'+p.id).classList.remove('highlighted'));document.querySelectorAll('[data-select]').forEach(el=>el.setAttribute('aria-pressed','false'));},7000);
}
function renderInventory(){
 $('inventory-list').replaceChildren();
 CATALOG.forEach(product=>{
  const p=productView(state,product.id),row=document.createElement('div');row.className='inventory-row';
  row.innerHTML=`<button class="inventory-product" data-select="${p.id}" aria-pressed="${selected===p.id}"><img src="${p.image}" alt="" width="60" height="44"><div><strong>${p.name}</strong><span>${p.offerQuantity<p.quantity?p.offerQuantity+' at offer price · '+p.quantity+' total':p.quantity+' available'}${p.discount?' · '+p.discount+'% off':''}</span></div></button><div class="inventory-values"><b>${p.quantity?money(p.price):'Sold out'}</b><span>Regular ${money(p.base)}</span></div><div class="inventory-actions"><button data-action="sell" ${!p.quantity?'disabled':''} aria-label="Sell one ${p.name}">Sell 1</button><button data-action="restock" ${state.minute>=CLOSE?'disabled':''} aria-label="Add four ${p.name}">+4 fresh</button><button data-action="markdown" class="markdown-button" ${!p.quantity||p.discount>=45?'disabled':''} aria-label="Lower the price of ${p.name} by one discount step">↓ Price</button></div>`;
  row.querySelector('[data-select]').addEventListener('click',()=>highlight(p.id));
  row.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
   pause();const latest=read();if(latest)state=latest;
   try{const action=button.dataset.action;commit(action==='sell'?sell(state,p.id):action==='restock'?restock(state,p.id,4):markdown(state,p.id));toast(state.events[0].text);}catch(error){toast(error.message);}
  }));
  $('inventory-list').append(row);
 });
}
function renderActivity(){
 const list=$('activity-list');list.replaceChildren();
 state.events.slice(0,12).forEach(e=>{const li=document.createElement('li'),time=document.createElement('time'),text=document.createElement('span');time.textContent=simTime(e.at);text.textContent=e.text;if(e.kind==='drop')text.classList.add('event-drop');li.append(time,text);list.append(li);});
 $('activity-count').textContent=state.events.length+' recent updates';
}
function render(previous){
 renderCards(previous);renderTicker();
 $('day-clock').textContent=simTime(state.minute);$('impact-count').textContent=state.surplusSold;
 const offers=CATALOG.map(p=>productView(state,p.id)).filter(p=>p.quantity&&p.discount);
 $('menu-status').textContent=state.minute>=CLOSE?'CAFÉ CLOSED':offers.length?'PRICE DROPS NOW':'FRESH IN THE CASE';
 $('menu-message').textContent=state.minute>=CLOSE?'Thanks for making every bite count.':offers.length?offers.length+' good reasons to grab a bite.':'Sandwiches, pastries & something sweet.';
 $('updated').textContent='Updated '+timeFormat.format(new Date(state.updatedAt));
 $('simulation-time').textContent=simTime(state.minute);$('day-slider').value=state.minute;
 $('total-stock').textContent=CATALOG.reduce((total,p)=>total+productView(state,p.id).quantity,0);
 $('total-sold').textContent=state.sold;$('total-surplus').textContent=state.surplusSold;
 $('sync-status').textContent=storageAvailable?'Changes sync between tabs in this browser':'Storage unavailable · Changes last until this page closes';
 renderInventory();renderActivity();updatePlayback();
}
function commit(next){
 if(!validState(next))throw new Error('The menu update could not be validated.');
 const previous=state;state=next;state.updatedAt=new Date().toISOString();
 try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageAvailable=false;}
 render(previous);
}
function updatePlayback(){
 $('pause-day').disabled=!playing&&state.minute>=CLOSE;
 $('pause-day').textContent=playing?'Pause':state.minute>=CLOSE?'Day complete':'Resume';
 $('run-day').textContent=playing?'↻ Restart day':'▶ Run a day';
}
function pause(){clearInterval(timer);timer=null;playing=false;updatePlayback();}
function start(){
 if(state.minute>=CLOSE)commit(initialState('opening'));
 clearInterval(timer);playing=true;updatePlayback();
 timer=setInterval(()=>{
  try{commit(stepSimulation(state,5));if(state.minute>=CLOSE){pause();toast('Day complete. Remaining offers have ended.');}}
  catch(error){pause();toast(error.message);}
 },500/Number($('speed').value));
}
$('run-day').addEventListener('click',()=>{pause();commit(initialState('opening'));start();});
$('pause-day').addEventListener('click',()=>playing?pause():start());
$('speed').addEventListener('change',()=>{if(playing)start();});
$('reset').addEventListener('click',()=>{pause();commit(initialState());toast('Afternoon offers restored.');});
$('day-slider').addEventListener('input',e=>{$('simulation-time').textContent=simTime(Number(e.target.value));});
$('day-slider').addEventListener('change',e=>{pause();commit(snapshotAt(Number(e.target.value)));toast('Demo replayed to '+simTime(state.minute)+'.');});
function toggleTicker(){commit(applyTicker(state,!state.preferences.ticker));}
$('ticker-toggle').addEventListener('click',toggleTicker);$('tv-ticker').addEventListener('click',toggleTicker);
window.addEventListener('storage',e=>{
 if(e.key!==KEY||!e.newValue)return;
 try{const next=JSON.parse(e.newValue);if(!validState(next))return;pause();const previous=state;state=next;render(previous);}catch{}
});
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='f'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();fullscreen();}});
let toolsTimer;
if(displayOnly)window.addEventListener('pointermove',()=>{document.body.classList.add('show-tools');clearTimeout(toolsTimer);toolsTimer=setTimeout(()=>document.body.classList.remove('show-tools'),2500);});
function clock(){const now=new Date();$('clock').textContent=timeFormat.format(now);$('clock').dateTime=now.toISOString();}
clock();setInterval(clock,1000);render();resize();
if(!read()){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageAvailable=false;}}
