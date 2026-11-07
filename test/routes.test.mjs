import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveRoute} from '../route-policy.mjs';
test('fresh root defaults Solana while remembered deliberate choice survives',()=>{
 assert.equal(resolveRoute('https://hypeliysium.fun/').chain,'solana');
 assert.equal(resolveRoute('https://hypeliysium.fun/','elysium').chain,'elysium');
});
test('explicit chain links override saved preference',()=>{
 assert.equal(resolveRoute('https://hypeliysium.fun/?chain=elysium','solana').chain,'elysium');
 assert.equal(resolveRoute('https://hypeliysium.fun/?chain=solana','elysium').chain,'solana');
});
test('legacy EVM token links stay on Elysium and wrong-chain addresses reject',()=>{
 const token='0x'+'1'.repeat(40);
 assert.equal(resolveRoute('https://hypeliysium.fun/?token='+token).chain,'elysium');
 assert.throws(()=>resolveRoute('https://hypeliysium.fun/?chain=solana&token='+token));
});
