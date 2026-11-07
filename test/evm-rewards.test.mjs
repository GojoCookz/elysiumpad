import {test} from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{runInNewContext}from'node:vm';
import{parseAbi,encodeFunctionData,decodeFunctionData,toHex,zeroAddress}from'viem';
import{exposeEvmRewards}from'../source/release-launch-overlay.mjs';
const original=await readFile(new URL('../source/approved/elysium/launch.mjs',import.meta.url),'utf8'),source=exposeEvmRewards(original);
const abiSource=await readFile(new URL('../source/approved/elysium/abi.mjs',import.meta.url),'utf8');
const ABI=runInNewContext(abiSource.replace("import { parseAbi } from 'viem';",'').replaceAll('export const','const')+';ABI',{parseAbi});
test('reward controls become visible before Create without modifying launch builder or defaults',()=>{
 assert.match(source,/buy: 3, sell: 3, you: 100, holders: 0, burn: 0/);
 assert.ok(source.indexOf("'Elysium rewards'",source.indexOf('main.replaceChildren'))<source.indexOf('      cost, go,'));
 const builder=s=>s.slice(s.indexOf('    const kept ='),s.indexOf('    if (!await reviewTransaction'));
 assert.equal(builder(source),builder(original));assert.match(source,/Selected allocation/);
});
test('existing preset and slider allocations encode their actual creator and burn basis points',async()=>{
 const builder=source.slice(source.indexOf('    const kept ='),source.indexOf('    if (!await reviewTransaction'));
 for(const [you,holders,burn,expectedCreator,expectedBurn]of [[100,0,0,10000,0],[0,100,0,0,0],[0,0,100,0,10000],[50,30,20,6250,2000],[35,45,20,4375,2000]]){
  const data=await runInNewContext('(async()=>{'+builder+'return data;})()',{
   st:{you,holders,burn,buy:3,sell:3,digest:'0x'+'1'.repeat(64)},name:{value:'Test'},ticker:{value:'TST'},SUPPLY:10n**27n,S:{m:{whype:'0x'+'2'.repeat(40)}},mcap:20n*10n**18n,devWei:0n,toHex,crypto:{getRandomValues:a=>a},zeroAddress,ctx:{},ref:null,ZERO32:'0x'+'0'.repeat(64),infoCid:'0x'+'0'.repeat(64),ABI,call:(abi,functionName,args)=>encodeFunctionData({abi,functionName,args})
  });
  const p=decodeFunctionData({abi:ABI.launcher,data}).args[0];assert.equal(p.creatorBps,expectedCreator);assert.equal(p.burnBps,expectedBurn);assert.equal(p.feeBps,300);assert.equal(p.sellFeeBps,300);
 }
});
