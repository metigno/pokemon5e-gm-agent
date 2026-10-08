import test from 'node:test';
import assert from 'node:assert/strict';
import { CanonicalEngineBridge } from '../src/gm-live/canonical-bridge.mjs';

test('missing engine cannot resolve actions',()=>{
 assert.throws(()=>new CanonicalEngineBridge({}),/Missing canonical engine adapter/);
});
test('adapter validates actions and state before returning result',async()=>{
 const calls=[];
 const bridge=new CanonicalEngineBridge({
  validateAction:async()=>{calls.push('action');return {allowed:true};},
  resolveAction:async()=>{calls.push('resolve');return {narration:'The attempt succeeds',statePatch:{world:{location:'forest'}}};},
  validateState:async()=>{calls.push('state');return {valid:true};}
 });
 const result=await bridge.resolve({campaignId:'x'},{text:'Explore the forest'});
 assert.equal(result.status,'resolved');
 assert.deepEqual(calls,['action','resolve','state']);
});
test('engine rejection does not resolve or mutate',async()=>{
 const bridge=new CanonicalEngineBridge({
  validateAction:async()=>({allowed:false,reason:'No PP'}),
  resolveAction:async()=>{throw new Error('should not resolve');},
  validateState:async()=>({valid:true})
 });
 assert.deepEqual(await bridge.resolve({},{text:'Use a move'}),{status:'rejected',reason:'No PP'});
});
