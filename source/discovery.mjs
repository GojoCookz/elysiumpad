import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { parseAbi, decodeEventLog, encodeEventTopics, encodeFunctionData, decodeFunctionResult, keccak256, encodeAbiParameters } from 'viem';
import { mergeMarkets, platformProof, sourceFailure, sourceNote, retainPartialRows } from './discovery-core.mjs';
import {matchesPumpReceipt} from './pump-provenance.mjs';
import {createArtwork,imageRoute} from './artwork.mjs';
export {recordPumpBuild} from './pump-provenance.mjs';
const launchAbi = parseAbi(['event Launched(address indexed token,address indexed creator,address indexed pair,bytes32 poolId,uint256 supply,uint256 openingMarketCap,uint16 feeBps)']);
const initAbi = parseAbi(['event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)']);
const tokenAbi = parseAbi(['function name() view returns (string)','function symbol() view returns (string)','function decimals() view returns (uint8)']);
const launchTopic = encodeEventTopics({ abi: launchAbi, eventName: 'Launched' })[0];
const initTopic = encodeEventTopics({ abi: initAbi, eventName: 'Initialize' })[0];
const ZERO = '0x0000000000000000000000000000000000000000';
const ECOSYSTEM = 'CsMF3EMEVm9ow925mtFVwnAvTYUgckcQJrFUWEFMpump';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = (s, n = 80) => String(s || '').replace(/[\u0000-\u001f\u007f\u202a-\u202e]/g, '').slice(0, n);
const emptyRow = (chain, address) => ({ chain, address, name: address, symbol: address.slice(0, 8), price: null, volume: null, cap: null, change: null, holders: null, series: [], unit: chain === 'solana' ? 'USD' : 'HYPE', pair: '' });
export async function createMarketDiscovery({ env = process.env, manifest, fetcher = fetch, apiBase = `http://127.0.0.1:${env.PORT || 3000}`, seedPath = new URL('./discovery-seed.json', import.meta.url), autoStart = true, decodeMessage, getCachedArtwork, metadataAddress }) {
  const dir = path.join(env.PAD_DATA_DIR || './data', 'discovery'), file = path.join(dir, 'verified-markets.json');
  let state = { version: 1, chainId: manifest.chainId, launcher: manifest.carbon.launcher.toLowerCase(), launches: [], rows: [], sources: Object.fromEntries(['platformEvm','platformSolana','evmMarkets','solanaMarkets','ecosystem'].map(name=>[name,{status:'pending',complete:false,count:null}])), cursor: manifest.carbon.deployBlock - 1 };
  for (const location of [seedPath, file]) {
    try { const saved = JSON.parse(await readFile(location, 'utf8')); if (saved.version === 1 && saved.chainId === manifest.chainId && saved.launcher === state.launcher) state = saved; } catch {}
  }
  let busy = false, nextAttempt = 0, failures = 0;
  const urls = (env.ELYSIUM_RPC_URL || manifest.rpcFailover.join(',')).split(',').map(x => x.trim()).filter(Boolean);
  let provider = 0;
  async function json(url, options = {}) {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(typeof result.error === 'string' ? result.error : result.error.message);
    return result;
  }
  async function rpc(method, params) {
    let error;
    for (let i = 0; i < urls.length * 2; i++) {
      try { const out = await json(urls[provider % urls.length], { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }); if (out.result === undefined) throw Error('RPC result missing'); return out.result; }
      catch (e) { error = e; provider++; await sleep(Math.min(250 * 2 ** i, 2000)); }
    }
    throw error;
  }
  async function persist() { await mkdir(dir, { recursive: true }); await writeFile(file + '.tmp', JSON.stringify(state)); await rename(file + '.tmp', file); }
  async function metadata(address) {
    const old = state.rows.find(row => row.chain === 'elysium' && row.address.toLowerCase() === address.toLowerCase());
    if (old?.metadataVerified) return { name: old.name, symbol: old.symbol, decimals: old.decimals, metadataVerified: true };
    const values = {};
    for (const name of ['symbol', 'name', 'decimals']) {
      const result = await rpc('eth_call', [{ to: address, data: encodeFunctionData({ abi: tokenAbi, functionName: name }) }, 'latest']);
      values[name] = decodeFunctionResult({ abi: tokenAbi, functionName: name, data: result });
    }
    return { name: clean(values.name), symbol: clean(values.symbol, 24), decimals: Number(values.decimals), metadataVerified: true };
  }
  async function evm() {
    const chain = Number(BigInt(await rpc('eth_chainId', [])));
    if (chain !== 99901) throw Error('Unexpected Elysium chain ID');
    const head = Number(BigInt(await rpc('eth_blockNumber', []))), to = head - 64;
    if (to < state.cursor - 64) throw Error('RPC head is behind the saved launch checkpoint');
    if ((await rpc('eth_getCode', [manifest.carbon.launcher, 'latest'])) === '0x') throw Error('Authorized launcher has no bytecode');
    const from = Math.max(manifest.carbon.deployBlock, state.cursor - 64);
    const launchRows = state.rows.filter(r => r.chain === 'elysium' && r.provenance?.kind === 'platform');
    for (let block = from; block <= to; block += 50000) {
      const end = Math.min(block + 49999, to);
      const logs = await rpc('eth_getLogs', [{ address: manifest.carbon.launcher, topics: [launchTopic], fromBlock: `0x${block.toString(16)}`, toBlock: `0x${end.toString(16)}` }]);
      for (const log of logs) {
        if (!platformProof(log, manifest.carbon.launcher, launchTopic, block, end)) continue;
        const { args: a } = decodeEventLog({ abi: launchAbi, data: log.data, topics: log.topics });
        let key;
        for (const tickSpacing of [60, 200, 10, 1, 100, 2000, 50, 20, 120]) {
          const [currency0, currency1] = [a.token, a.pair].sort((x, y) => BigInt(x) < BigInt(y) ? -1 : 1);
          const candidate = { currency0, currency1, fee: 0, tickSpacing, hooks: manifest.carbon.feeHook };
          const id = keccak256(encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint24'},{type:'int24'},{type:'address'}], Object.values(candidate)));
          if (id === a.poolId) key = candidate;
        }
        if (!key) throw Error('Platform event pool key could not be verified');
        const item = { ...a, supply: a.supply.toString(), openingMarketCap: a.openingMarketCap.toString(), key, block: Number(BigInt(log.blockNumber)), transactionHash: log.transactionHash };
        state.launches = state.launches.filter(x => x.token.toLowerCase() !== a.token.toLowerCase()).concat(item);
        let meta = {}; try { meta = await metadata(a.token); } catch {}
        launchRows.push({ ...emptyRow('elysium', a.token), ...meta, pair: a.pair, poolId: a.poolId, provenance: { kind: 'platform', verified: true, source: 'Authorized HypurrLabs launcher event', launcher: manifest.carbon.launcher, transactionHash: log.transactionHash, block: item.block } });
      }
      state.cursor = end; state.rows = mergeMarkets(state.rows, launchRows); await persist();
      await sleep(150);
    }
    state.sources.platformEvm = { status: 'complete', complete: true, count: state.launches.length, fromBlock: manifest.carbon.deployBlock, throughBlock: to, head, confirmations: 64, checkedAt: new Date().toISOString() };
    if (state.sources.evmMarkets?.checkedAt && Date.now() - Date.parse(state.sources.evmMarkets.checkedAt) < 300000) return;
    // Wider discovery is explicitly bounded. No claim to index every Elysium market.
    const marketFrom = Math.max(0, to - 200000), pools = new Map();
    try {
      for (let block = marketFrom; block <= to; block += 50000) {
        const logs = await rpc('eth_getLogs', [{ topics: [initTopic], fromBlock: `0x${block.toString(16)}`, toBlock: `0x${Math.min(block + 49999, to).toString(16)}` }]);
        for (const log of logs) {
          if (log.removed) continue;
          const { args: a } = decodeEventLog({ abi: initAbi, data: log.data, topics: log.topics });
          const native = [ZERO, manifest.whype.toLowerCase()];
          const address = native.includes(a.currency0.toLowerCase()) ? a.currency1 : native.includes(a.currency1.toLowerCase()) ? a.currency0 : null;
          if (address && !native.includes(address.toLowerCase())) pools.set(address.toLowerCase(), { address, poolId: a.id, manager: log.address, block: Number(BigInt(log.blockNumber)), transactionHash: log.transactionHash, key: {currency0:a.currency0,currency1:a.currency1,fee:a.fee,tickSpacing:a.tickSpacing,hooks:a.hooks} });
        }
        await sleep(150);
      }
      const candidates = [...pools.values()].sort((a,b)=>b.block-a.block).slice(0,30), rows = [];
      let missingMetadata = 0;
      for (const pool of candidates) {
        let meta = {}; try { meta = await metadata(pool.address); } catch { missingMetadata++; }
        rows.push({ ...emptyRow('elysium', pool.address), ...meta, pair: 'HYPE / WHYPE', poolId: pool.poolId, manager: pool.manager, key: pool.key, provenance: { kind: 'market', verified: true, source: 'V4 pool initialization event (not platform launch)', transactionHash: pool.transactionHash, block: pool.block } });
      }
      state.rows = mergeMarkets(state.rows.filter(r => r.chain !== 'elysium' || r.provenance?.kind === 'platform'), rows);
      state.sources.evmMarkets = { status: 'partial', complete: false, count: rows.length, observedCandidates: pools.size, limit:30, fromBlock: marketFrom, throughBlock: to, missingMetadata, checkedAt: new Date().toISOString(), coverage: 'Latest 30 native/WHYPE V4 pools initialized in the last 200,000 confirmed blocks; metrics unavailable until indexed.' };
    } catch(e) { state.sources.evmMarkets = sourceFailure(state.sources.evmMarkets, 'Elysium wider discovery provider unavailable'); }
  }
  function dexRow(pair, mint, provenance) {
    const token = pair.baseToken;
    if (pair.chainId !== 'solana' || token?.address !== mint) return null;
    return { ...emptyRow('solana', mint), name: clean(token.name), symbol: clean(token.symbol,24), image: pair.info?.imageUrl || '', pair: pair.quoteToken?.symbol || '', price: pair.priceUsd == null ? null : Number(pair.priceUsd), volume: pair.volume?.h24 ?? null, cap: pair.marketCap ?? null, change: pair.priceChange?.h24 ?? null, original: { mint, name: clean(token.name), symbol: clean(token.symbol), quoteSymbol: pair.quoteToken?.symbol, priceUsd:pair.priceUsd, marketCapUsd:pair.marketCap, volume24hUsd:pair.volume?.h24, change24h:pair.priceChange?.h24, pairAddress:pair.pairAddress }, provenance };
  }
  async function mintMarket(mint, provenance) {
    let pairs;
    try { pairs = await json(`https://api.dexscreener.com/token-pairs/v1/solana/${mint}`); }
    catch { return {...emptyRow('solana',mint),...state.rows.find(r=>r.chain==='solana'&&r.address===mint),original:state.rows.find(r=>r.chain==='solana'&&r.address===mint)?.original||{mint},provenance,metadataUnavailable:true}; }
    const pair = pairs.filter(p => p.chainId === 'solana' && p.baseToken?.address === mint).sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
    return pair ? dexRow(pair, mint, provenance) : { ...emptyRow('solana', mint), original:{mint}, provenance };
  }
  async function solana() {
    const now = () => new Date().toISOString();
    let directError=null;
    try {
      let candidates=[];try{candidates=JSON.parse(await readFile(path.join(dir,'pump-builds.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
      const pending=candidates.filter(c=>!state.rows.some(r=>r.chain==='solana'&&r.address===c.mint&&r.provenance?.kind==='platform')&&Date.now()-Date.parse(c.createdAt)<86400000).slice(-10);
      if(pending.length&&!decodeMessage)throw Error('Receipt decoder unavailable');
      const endpoint=env.PURRLYSIUM_SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com';
      const solRpc=async(method,params)=>(await json(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})})).result;
      for(const candidate of pending){
        const signatures=await solRpc('getSignaturesForAddress',[candidate.mint,{limit:5,commitment:'confirmed'}]);
        for(const entry of signatures||[]){
          if(entry.err)continue;
          const tx=await solRpc('getTransaction',[entry.signature,{encoding:'base64',commitment:'confirmed',maxSupportedTransactionVersion:0}]);
          if(!tx?.transaction?.[0]||tx.meta?.err!==null)continue;
          const curve=await json(apiBase+'/api/purrlysium/solana/launch/state?mint='+candidate.mint);
          if(!matchesPumpReceipt(candidate,tx,decodeMessage(tx.transaction[0]),curve))continue;
          const row=await mintMarket(candidate.mint,{kind:'platform',verified:true,source:'Confirmed Pump creation matching the persisted server-built transaction message',transactionHash:entry.signature,messageHash:candidate.messageHash});
          state.rows=mergeMarkets(state.rows,[row]);break;
        }
      }
    }catch(e){directError='Direct Pump receipt verification is incomplete; retained prior verified records.';}
    try {
      const registry = await json(apiBase + '/api/purrlysium/solana/launches');
      if (!registry.available) throw Error('Platform registry is not configured; historical launch provenance unavailable');
      const verified = [];
      for (const record of registry.records.slice(0,50)) {
        const check = await json(apiBase + '/api/purrlysium/solana/launch/state?mint=' + encodeURIComponent(record.mint));
        if (!check.registeredHere) continue;
        verified.push(await mintMarket(record.mint, { kind:'platform',verified:true,source:'Verified platform program record and matching Pump curve',programId:registry.programId,record:record.address }));
      }
      const incomplete=registry.truncated||registry.records.length>50;
      const missing=incomplete?state.rows.filter(r=>r.chain==='solana'&&r.provenance?.kind==='platform'&&r.provenance?.programId&&!verified.some(v=>v.address===r.address)).map(r=>({...r,stale:true})):[];
      state.rows = mergeMarkets(state.rows.filter(r=>r.chain!=='solana'||r.provenance?.kind!=='platform'||!r.provenance?.programId),missing,verified);
      state.sources.platformSolana = {status:registry.truncated||registry.records.length>50?'partial':'complete',complete:!registry.truncated&&registry.records.length<=50,count:verified.length,checkedAt:now()};
    } catch(e) { state.sources.platformSolana = sourceFailure(state.sources.platformSolana,'Legacy program registry is unavailable; pre-migration direct Pump launch provenance is unknown. New server-built messages are persisted and verified against confirmed receipts.');state.sources.platformSolana.count=state.rows.filter(r=>r.chain==='solana'&&r.provenance?.kind==='platform').length || null; }
    const known=state.rows.filter(r=>r.chain==='solana'&&r.provenance?.kind==='platform').length;
    if(state.sources.platformSolana.complete)state.sources.platformSolana.count=known;
    if(known&&state.sources.platformSolana.status==='unavailable')state.sources.platformSolana={...state.sources.platformSolana,status:'partial',count:known,complete:false,checkedAt:now()};
    if(directError)state.sources.platformSolana={...state.sources.platformSolana,status:known?'stale':'unavailable',complete:false,error:directError};
    try {
      const endpoint = env.PURRLYSIUM_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const account = await json(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getAccountInfo',params:[ECOSYSTEM,{encoding:'jsonParsed',commitment:'confirmed'}]})});
      if (!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(account.result?.value?.owner) || account.result.value.data?.parsed?.type !== 'mint') throw Error('Ecosystem mint account could not be verified');
      const row = await mintMarket(ECOSYSTEM,{kind:'ecosystem',verified:true,source:'Owner-specified ecosystem mint; SPL mint verified; not proven platform-launched'});
      state.rows = mergeMarkets(state.rows,[row]);
      state.sources.ecosystem = {status:'complete',complete:true,count:1,checkedAt:now()};
    } catch(e) { state.sources.ecosystem = sourceFailure(state.sources.ecosystem,'Ecosystem mint verification provider unavailable'); }
    try {
      const scan = await json(apiBase+'/api/purrlysium/solana/scan');
      const rows = (scan.tokens||[]).map(t=>({...emptyRow('solana',t.mint),name:t.name,symbol:t.symbol,image:t.image,imageCandidates:t.imageCandidates||[],pair:t.quoteSymbol||'',price:t.priceUsd??null,volume:t.volume24hUsd??null,cap:t.marketCapUsd??null,change:t.change24h??null,original:t,provenance:{kind:'market',verified:false,source:'Dexscreener bounded market scan; no platform-launch claim'}}));
      const retained=retainPartialRows(state.rows.filter(r=>r.chain==='solana'&&r.provenance?.kind==='market'),rows,scan.warnings||[]);
      state.rows=mergeMarkets(state.rows.filter(r=>r.chain!=='solana'||r.provenance?.kind!=='market'),retained.rows);
      state.sources.solanaMarkets={status:retained.sourceFailed?'partial-error':'partial',complete:false,count:retained.rows.length,returned:rows.length,retainedStale:retained.retained,checkedAt:scan.checkedAt,coverage:scan.coverage,warnings:scan.warnings||[]};
    }catch(e){state.sources.solanaMarkets=sourceFailure(state.sources.solanaMarkets,'Solana market provider unavailable');}
  }
  async function refresh() {
    if (busy || Date.now()<nextAttempt) return;
    busy=true;
    try {
      await Promise.all([evm().catch(e=>{state.sources.platformEvm=sourceFailure(state.sources.platformEvm,'Platform launch scan incomplete: RPC unavailable');}),solana()]);
      state.checkedAt=new Date().toISOString();await persist();
      failures=['stale','unavailable'].includes(state.sources.platformEvm?.status)?Math.min(failures+1,3):0;
    }finally{busy=false;nextAttempt=Date.now()+60000*2**failures;}
  }
  const artwork=createArtwork({env,directory:path.join(dir,'artwork'),getRows:()=>state.rows,getCachedArtwork,metadataAddress,fetcher,getAccounts:async(addresses,encoding)=>{const data=await json(env.PURRLYSIUM_SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getMultipleAccounts',params:[addresses,{encoding,commitment:'confirmed'}]})});return data.result.value;}});
  const snapshot=()=>{ const sources=Object.fromEntries(Object.entries(state.sources).map(([name,s])=>[name,s.checkedAt && Date.now()-Date.parse(s.checkedAt)>600000?{...s,status:'stale',complete:false}:s]));return {version:1,rows:mergeMarkets(state.rows).map(row=>({...row,image:imageRoute(row)})),artwork:artwork.status(),sources,launches:state.launches,checkedAt:state.checkedAt||null,partial:true,complete:false,refreshing:busy,coverageNote:'Platform provenance first, then ecosystem and bounded wider markets. '+sourceNote(sources)};};
  let timer;
  if(autoStart){const run=()=>refresh().catch(()=>{state.sources.persistence={status:'unavailable',complete:false,error:'Discovery snapshot could not be saved'};});timer=setTimeout(()=>{void run();timer=setInterval(()=>void run(),60000);timer.unref?.();},2000);timer.unref?.();}
  return {snapshot,refresh,exportState:()=>state,artwork,close:()=>clearInterval(timer)};
}
