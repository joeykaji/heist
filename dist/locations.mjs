export const LOCATION_KEY='marketbite-locations-v1';
export const DEFAULT_LOCATION={id:'connections',name:'Connections Cafe',address:'735 Library Rd. · University of Rochester',caption:'Rochester'};
export const stateKey=id=>id==='connections'?'marketbite-connections-v3':'marketbite-connections-v3:'+id;
export function locationInfo(settings){return settings.location||DEFAULT_LOCATION;}
export function validateLocation(location){
 if(!location||!/^[a-z0-9-]{1,60}$/.test(location.id)||typeof location.name!=='string'||!location.name.trim()||location.name.length>70||typeof location.address!=='string'||location.address.length>140||typeof location.caption!=='string'||location.caption.length>50)throw new Error('Enter a location name, a short address, and a city or campus.');
 return location;
}
export function readLocations(storage){
 const fallback={version:1,activeId:'connections',locations:[{...DEFAULT_LOCATION}]};
 const raw=storage.getItem(LOCATION_KEY);if(!raw)return fallback;
 const registry=JSON.parse(raw);
 if(registry?.version!==1||!Array.isArray(registry.locations)||!registry.locations.length||registry.locations.length>30||new Set(registry.locations.map(l=>l.id)).size!==registry.locations.length||!registry.locations.some(l=>l.id===registry.activeId))throw new Error('Saved locations could not be read. Existing data has been kept.');
 registry.locations.forEach(validateLocation);return registry;
}
export function saveLocation(storage,registry,location,state){
 validateLocation(location);
 const exists=registry.locations.some(l=>l.id===location.id);
 if(!exists&&registry.locations.length>=30)throw new Error('This demo supports up to 30 locations in one browser.');
 const next={version:1,activeId:location.id,locations:exists?registry.locations.map(l=>l.id===location.id?location:l):[...registry.locations,location]};
 // Write the complete state before advertising a location in the directory.
 storage.setItem(stateKey(location.id),JSON.stringify(state));storage.setItem(LOCATION_KEY,JSON.stringify(next));return next;
}
