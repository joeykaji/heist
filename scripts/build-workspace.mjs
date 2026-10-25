import {copyFile} from 'node:fs/promises';
for(const file of ['price-history.mjs','workspace.html','workspace.css','workspace.mjs','market-chart.mjs','exchange-tv.mjs','exchange-tv.css'])await copyFile(new URL('../web/'+file,import.meta.url),new URL('../dist/'+file,import.meta.url));
