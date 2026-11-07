import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {messageHash,matchesPumpReceipt,recordPumpBuild} from '../source/pump-provenance.mjs';
test('same wallet is insufficient; exact server-built message and successful confirmed state required',()=>{
 const message=Buffer.from('audited-builder-message').toString('base64');
 const candidate={wallet:'owner',quoteMint:'quote',messageHash:messageHash(message)};
 const tx={meta:{err:null}},curve={creator:'owner',quoteMint:'quote',creatorFeeBps:300,curve:'curve-account'};
 assert.equal(matchesPumpReceipt(candidate,tx,message,curve),true);
 assert.equal(matchesPumpReceipt(candidate,tx,Buffer.from('different-launch-same-wallet').toString('base64'),curve),false);
 assert.equal(matchesPumpReceipt(candidate,{meta:{err:{InstructionError:1}}},message,curve),false);
 assert.equal(matchesPumpReceipt(candidate,tx,message,{...curve,creator:'other'}),false);
 assert.equal(matchesPumpReceipt(candidate,tx,message,{...curve,quoteMint:'other'}),false);
 assert.equal(matchesPumpReceipt(candidate,tx,message,{...curve,creatorFeeBps:200}),false);
});
test('unsigned builds persist only as pending candidates and concurrent builds do not overwrite',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'pump-provenance-'));
 try{
  await Promise.all(['one','two'].map(mint=>recordPumpBuild({directory,built:{mint,wallet:'owner',quote:{mint:'quote'}},message:Buffer.from(mint).toString('base64')})));
  const rows=JSON.parse(await readFile(path.join(directory,'pump-builds.json'),'utf8'));
  assert.equal(rows.length,2);assert.ok(rows.every(r=>r.messageHash&&!r.verified&&!r.transaction));
 }finally{await rm(directory,{recursive:true,force:true});}
});
