import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,initialState,applyPlan,stepSimulation,validState,validFoodImage,BLANK_FOOD_IMAGE} from '../dist/model.mjs';
import {tickerMarkup,exchangeRows} from '../dist/exchange-tv.mjs';

test('blank and custom photos survive shared menu updates, unsafe URLs are rejected',()=>{
 for(const image of [BLANK_FOOD_IMAGE,'https://example.com/house-wrap.jpg?size=600&fit=crop']){
  assert.ok(validFoodImage(image));
  const cfg=defaultSettings(),food={...cfg.foods[0],id:'house-wrap',symbol:'HOUSE',name:'House Wrap',image};
  cfg.foods.push(food);cfg.menu[food.id]={stock:12,price:500,floor:100,cost:20,enabled:true};
  const state=applyPlan(initialState('opening'),cfg);
  assert.ok(validState(state));assert.equal(state.settings.foods.at(-1).image,image);
  assert.match(exchangeRows(state,2),/House Wrap/);assert.match(tickerMarkup(state),/HOUSE/);
 }
 for(const image of ['javascript:alert(1)','data:image/svg+xml,x','http://example.com/x.png','https://user:pass@example.com/x.png','https://example.com/" onerror="x','assets/../../x.png'])assert.equal(validFoodImage(image),false,image);
});

test('shared stock ticker shows symbols, current prices and changes without menu details',()=>{
 const cfg=defaultSettings();cfg.traffic.inPerson=0;cfg.traffic.mobile=0;cfg.menu.roast.enabled=false;
 const state=stepSimulation(initialState('opening',cfg),240),html=tickerMarkup(state);
 assert.match(html,/ticker-symbol/);assert.match(html,/ticker-price/);assert.match(html,/↓ [\d.]+%/);
 assert.doesNotMatch(html,/Was |available|South West Wrap|RBEF/i);
 state.settings.foods[0].symbol='WRAP';assert.match(tickerMarkup(state),/>WRAP</);
});
