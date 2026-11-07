// Rebuild the approved sibling source without modifying the shared application.
// This release-only overlay corrects empty/error copy found by independent review.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {exposeEvmRewards} from '../source/release-launch-overlay.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.dirname(root);
const source = path.join(workspace, 'getrektdonhype/source/elysium');
const { build } = await import(pathToFileURL(path.join(workspace, 'monerochanpad-v2/node_modules/esbuild/lib/main.js')));
const routePolicy=(await readFile(path.join(source,'routes.mjs'),'utf8')).replace("remembered = 'elysium'","remembered = 'solana'");
await writeFile(path.join(root,'route-policy.mjs'),routePolicy);
await build({entryPoints:[path.join(root,'source/discovery.mjs')],bundle:true,format:'esm',platform:'node',target:'node24',nodePaths:[path.join(workspace,'hoodstonk/app/node_modules')],outfile:path.join(root,'discovery-runtime.mjs'),legalComments:'eof'});
await build({
  entryPoints: [path.join(source, 'app.mjs')],
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  nodePaths: [path.join(workspace, 'hoodstonk/app/node_modules')],
  outfile: path.join(root, 'elysium/purrlysium/app.js'), legalComments: 'eof',
  define: { __PURRLYSIUM__: 'true' },
  plugins: [{ name: 'release-empty-state', setup(build) {
    build.onLoad({filter:/[/\\]elysium[/\\]app\.mjs$/},async({path:file})=>{
      let contents=await readFile(file,'utf8');
      contents=`import {releaseMarkets} from ${JSON.stringify(path.join(root,'source/release-markets.mjs'))};\n`+contents;
      contents=contents.replace("let remembered = 'elysium'", "let remembered = 'solana'").replace("getItem('purrlysium.active-chain') || remembered", "getItem('purrlysium.active-chain') || remembered");
      contents=contents.replace("const hasMc3 = (await rpc", "let initialChain='solana'; try { initialChain=resolveRoute(location.href,sessionStorage.getItem('purrlysium.active-chain')||'solana').chain; } catch {}\n  const hasMc3 = initialChain === 'elysium' && (await rpc");
      const marker="  if (__PURRLYSIUM__ && wallets.active === 'solana') {";
      if(!contents.includes(marker))throw Error('Market render insertion point changed');
      contents=contents.replace(marker,"  if (__PURRLYSIUM__ && (S.tab === 'markets' || S.tab === 'trade' && !new URLSearchParams(location.search).get('token'))) { releaseMarkets(box, {h, chain:wallets.active, current:()=>generation===viewGeneration}).catch(e=>box.textContent=e.message); return; }\n"+marker);
      const begin=contents.indexOf('async function loadLaunches() {'),end=contents.indexOf('\nasync function quoteZap',begin);
      if(begin<0||end<0)throw Error('Launch loader changed');
      const eth=contents.slice(begin,end).match(/const ethKeys = [\s\S]*?;\n/)[0];
      contents=contents.slice(0,begin)+`async function loadLaunches() { const r=await fetch('/api/discovery'); if(!r.ok)throw Error('Platform launch registry unavailable'); const data=await r.json(); if(!data.sources.platformEvm?.complete)throw Error('Platform launch scan incomplete; retry after source recovery.'); S.launches=data.launches.map(l=>({...l,supply:BigInt(l.supply),openingMarketCap:BigInt(l.openingMarketCap)})); }\n${eth}`+contents.slice(end);
      return{contents,loader:'js',resolveDir:path.dirname(file)};
    });
    build.onLoad({filter:/[/\\]elysium[/\\]market-directory\.mjs$/},async({path:file})=>{
      let contents=await readFile(file,'utf8');
      contents=`import {rank} from ${JSON.stringify(path.join(root,'source/discovery-core.mjs'))};\n`+contents;
      contents=contents.replaceAll("h('small', {}, row.name)","h('small', {}, row.name), h('small', {class:'market-route',title:row.address}, `${row.address.slice(0,8)}…${row.address.slice(-6)}`), row.chain === 'elysium' ? h('small', {class:'market-route',title:row.poolId||''}, `Pool ${(row.poolId||'').slice(0,10)}…${(row.poolId||'').slice(-6)} · ${row.price == null ? 'Unpriced pool record' : 'Observed price'}`) : null");
      contents=contents.replace("h('h2', {}, `${featured.symbol} · ${featured.name}`)","h('h2', {}, `${featured.symbol} · ${featured.name}`), h('p', {class:'purr-address',title:featured.address}, `Contract ${featured.address.slice(0,8)}…${featured.address.slice(-6)}${featured.chain==='elysium'&&featured.price==null?' · Unpriced pool record':''}`)");
      contents=contents.replace('    const x = metric(a[key]), y = metric(b[key]);','    if(rank(a)!==rank(b))return rank(a)-rank(b);\n    const x = metric(a[key]), y = metric(b[key]);');
      contents=contents.replace('`${chainName} adapter`',"row.provenance?.kind === 'platform' && row.provenance?.verified ? 'Verified platform launch' : row.provenance?.kind === 'ecosystem' ? 'Ecosystem · not proven platform-launched' : 'Wider market · no platform provenance'");
      contents=contents.replace("'Observed market'), h('h2'", "featured.provenance?.kind === 'ecosystem' ? 'Ecosystem · not proven platform-launched' : featured.provenance?.kind === 'platform' && featured.provenance?.verified ? 'Verified platform launch' : 'Observed market'), h('h2'");
      contents=contents.replace("h('small', { class: 'market-route' }, `${rowChain === 'solana' ? 'Solana' : 'Elysium'} adapter route`)","h('small', { class: 'market-route' }, row.provenance?.kind === 'ecosystem' ? 'Ecosystem · not proven platform-launched' : row.provenance?.kind === 'platform' && row.provenance?.verified ? 'Verified platform launch' : 'Wider market · no platform provenance')");
      contents=contents.replace("h('small', { class: 'market-route' }, `${chainName} adapter route`)","h('small', { class: 'market-route' }, row.stale ? 'Cached market · stale source' : `${chainName} adapter route`)");
      contents=contents.replaceAll('Ecosystem · not proven platform-launched','Ecosystem token').replaceAll('Wider market · no platform provenance','Wider market');
      contents=contents.replace("`${chain === 'solana' ? 'Solana' : 'Elysium'} markets, sourced from their active adapter. Review before signing.`","`Discover tokens and explore the ${chain === 'solana' ? 'Solana' : 'Elysium'} ecosystem.`");
      return{contents,loader:'js',resolveDir:path.dirname(file)};
    });
    build.onLoad({filter:/[/\\]elysium[/\\]routes\.mjs$/},async({path:file})=>({contents:routePolicy,loader:'js',resolveDir:path.dirname(file)}));
    build.onLoad({filter:/[/\\]elysium[/\\]launch\.mjs$/},async({path:file})=>({contents:exposeEvmRewards(await readFile(file,'utf8')),loader:'js',resolveDir:path.dirname(file)}));
    build.onLoad({ filter: /[/\\]elysium[/\\]terminal\.mjs$/ }, async ({ path: file }) => {
      let contents = await readFile(file, 'utf8');
      const replacements = [
        ["'Other pads: indexing Elysium…'", "ext.error ? 'Other pads: unavailable' : 'Other pads: indexing Elysium…'"],
        [": 'No coins match.'));", ": !q && !rows.length && !extRows.length ? 'No coins yet' : 'No coins match.'));"]
      ];
      for (const [before, after] of replacements) {
        if (!contents.includes(before)) throw new Error(`Approved source changed; review release overlay: ${before}`);
        contents = contents.replace(before, after);
      }
      return { contents, loader: 'js', resolveDir: path.dirname(file) };
    });
  }}]
});
