import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {allowedArtworkURL,imageType,imageRoute,createArtwork} from '../source/artwork.mjs';
import {createTokenMetadata,artworkCandidates} from '../source/token-metadata.mjs';
const mint='CsMF3EMEVm9ow925mtFVwnAvTYUgckcQJrFUWEFMpump';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1EAAAAASUVORK5CYII=','base64');
const resolveHost=async()=>[{address:'8.8.8.8'}];
test('same-origin artwork mapping does not discard fallback identity',()=>{
 assert.equal(imageRoute({chain:'solana',address:mint,image:null}),'/api/discovery/art/solana/'+mint);
 assert.equal(imageRoute({chain:'elysium',address:'0xabc'}),'');
 assert.equal(artworkCandidates('ipfs://bafkreiaiz3zrcb5izi4vhva2bgdzztwt64bxkfjt6gdwnkgvtq7bjqdcge').length,2);
});
test('image route permits only fixed trusted HTTPS hosts, never arbitrary URLs',()=>{
 assert.equal(allowedArtworkURL('https://cdn.dexscreener.com/a.png'),true);
 for(const u of ['http://cdn.dexscreener.com/a','https://127.0.0.1/a','https://localhost/a','https://cdn.dexscreener.com.evil.test/a','https://user:pass@cdn.dexscreener.com/a','https://cdn.dexscreener.com:444/a'])assert.equal(allowedArtworkURL(u),false);
 assert.equal(imageType(Buffer.from('<svg onload="alert(1)">')),null);
 assert.equal(imageType(png),'image/png');
});
test('known mint uses imageCandidates after primary fails and caches bytes',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'pad-art-'));const seen=[];
 const row={chain:'solana',address:mint,image:'https://cdn.dexscreener.com/missing',imageCandidates:['https://cdn.dexscreener.com/good']};
 const service=createArtwork({env:{},directory,getRows:()=>[row],getAccounts:async()=>[],metadataAddress:()=>'',resolveHost,fetcher:async u=>{seen.push(u);return u.endsWith('/good')?new Response(png):new Response('missing',{status:404});}});
 try{const result=await service.get(mint);assert.equal(result.type,'image/png');assert.equal(seen.length,2);await service.get(mint);assert.equal(seen.length,2);assert.equal(await service.get('So11111111111111111111111111111111111111112'),null);assert.equal(seen.length,2);}finally{await rm(directory,{recursive:true,force:true});}
});
test('redirect to private or unapproved host is rejected before fetching it',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'pad-art-'));const seen=[];
 const row={chain:'solana',address:mint,image:'https://cdn.dexscreener.com/redirect'};
 const service=createArtwork({env:{},directory,getRows:()=>[row],getAccounts:async()=>[],metadataAddress:()=>'',resolveHost,fetcher:async u=>{seen.push(u);return u.endsWith('/redirect')?new Response(null,{status:302,headers:{location:'https://127.0.0.1/secret'}}):new Response('missing',{status:404});}});
 try{assert.equal(await service.get(mint),null);assert.ok(!seen.some(u=>u.includes('127.0.0.1')));}finally{await rm(directory,{recursive:true,force:true});}
});
test('on-chain Token-2022 image fallback works with Jupiter and Pump unavailable',async()=>{
 const cid='bafkreiaiz3zrcb5izi4vhva2bgdzztwt64bxkfjt6gdwnkgvtq7bjqdcge';
 const service=createTokenMetadata({env:{},resolveHost,metadataAddress:()=>'',infrastructure:{getAccounts:async()=>[{owner:'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',data:{parsed:{info:{extensions:[{extension:'tokenMetadata',state:{uri:'ipfs://'+cid}}]}}}}]},fetcher:async u=>u.includes('/ipfs/')?new Response(JSON.stringify({image:'ipfs://'+cid})):new Response('unavailable',{status:401})});
 const result=(await service.resolve([{mint,image:null}])).get(mint);
 assert.equal(result.source,'on-chain metadata');assert.ok(result.images[0].startsWith('https://ipfs.filebase.io/ipfs/'));assert.equal(service.status().jupiterKeyConfigured,false);
});
