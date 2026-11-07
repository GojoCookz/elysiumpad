import {readFile,writeFile} from 'node:fs/promises';
import {createMarketDiscovery} from '../discovery-runtime.mjs';
const manifest=JSON.parse(await readFile(new URL('../elysium/manifest-purrlysium-99901.json',import.meta.url)));
const apiBase='https://elysiumpad-production.up.railway.app';
const fetcher=fetch;
const app=await createMarketDiscovery({env:process.env,manifest,fetcher,apiBase,autoStart:false});
await app.refresh();
await writeFile(new URL('../discovery-seed.json',import.meta.url),JSON.stringify(app.exportState(),null,2));
console.log(JSON.stringify({sources:app.snapshot().sources,rows:app.snapshot().rows.length,first:app.snapshot().rows.slice(0,3).map(r=>({symbol:r.symbol,address:r.address,provenance:r.provenance}))},null,2));
