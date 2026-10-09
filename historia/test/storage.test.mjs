import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {FileSaveStore} from '../src/storage.mjs';import {createNewWorldCup} from '../src/new-game.mjs';
const entrants=Array.from({length:32},(_,i)=>({id:'trainer-'+i,rankingPoints:3200-i}));
async function withStore(fn){const dir=await mkdtemp(join(tmpdir(),'historia-'));try{await fn(new FileSaveStore(dir));}finally{await rm(dir,{recursive:true,force:true});}}
test('three independent slots and reload without reroll',async()=>withStore(async s=>{const a=createNewWorldCup(entrants),b=createNewWorldCup(entrants);await s.write(1,a);await s.write(2,b);assert.deepEqual((await s.load(1)).cup,a);assert.deepEqual((await s.load(2)).cup,b);assert.equal((await s.list()).filter(x=>x.occupied).length,2);await s.delete(1);assert.equal(await s.load(1),null);assert.deepEqual((await s.load(2)).cup,b)}));
test('corrupt primary recovers from previous good backup',async()=>withStore(async s=>{const a=createNewWorldCup(entrants);await s.write(1,a);await s.write(1,a,{updatedAt:'later'});await writeFile(s.path(1),'corrupt');const loaded=await s.load(1);assert.equal(loaded.recovered,true);assert.deepEqual(loaded.cup,a)}));
test('slot range protected',async()=>withStore(async s=>{assert.throws(()=>s.path(0));assert.throws(()=>s.path(4));}));
