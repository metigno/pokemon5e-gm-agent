import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {ArenaService,parseTeamInput,practiceTeams} from '../battle-service.mjs';

const {Teams}=createRequire(import.meta.url)('pokemon-showdown');

function sharedItemTeams(){
 const originals=practiceTeams();
 const luke=Teams.unpack(originals.p1);
 const mattew=Teams.unpack(originals.p2);
 luke[0].item='Leftovers';
 mattew[0].item='Leftovers';
 return {luke,mattew};
}

test('Item Clause is scoped to one trainer: two opposing Pokémon may hold Leftovers',async()=>{
 const {luke,mattew}=sharedItemTeams();
 const p1team=parseTeamInput(Teams.export(luke),{teamLabel:'Luke'});
 const p2team=parseTeamInput(Teams.export(mattew),{teamLabel:'Mattew'});
 assert.equal(Teams.unpack(p1team)[0].item,'Leftovers');
 assert.equal(Teams.unpack(p2team)[0].item,'Leftovers');
 const dir=await mkdtemp(join(tmpdir(),'historia-item-clause-'));
 const arena=new ArenaService(dir);
 try{
  const battle=await arena.create({mode:'manual',p1team,p2team,p2name:'Mattew'});
  assert.equal(battle.status,'active');
  assert.equal(battle.p1roster[0].item,'Leftovers');
  assert.equal(battle.p2name,'Mattew');
 }finally{await arena.shutdown();await rm(dir,{recursive:true,force:true});}
});

test('Item Clause identifies the owner, repeated item and two Pokémon on the SAME team',()=>{
 const {luke,mattew}=sharedItemTeams();
 luke[2].item='Leftovers';
 assert.throws(
  ()=>parseTeamInput(Teams.export(luke),{teamLabel:'Luke'}),
  error=>/Item Clause \(Luke\)/.test(error.message)
   &&/Leftovers/.test(error.message)
   &&/Arcanine/.test(error.message)
   &&/Kyurem-Black/.test(error.message));
 assert.doesNotThrow(()=>parseTeamInput(Teams.export(mattew),{teamLabel:'Mattew'}));

 const clean=sharedItemTeams();
 clean.mattew[1].item='Leftovers';
 assert.throws(
  ()=>parseTeamInput(Teams.export(clean.mattew),{teamLabel:'Mattew'}),
  error=>/Item Clause \(Mattew\)/.test(error.message)
   &&/Leftovers/.test(error.message)
   &&/Feraligatr/.test(error.message)
   &&/Jolteon/.test(error.message));
 assert.doesNotThrow(()=>parseTeamInput(Teams.export(clean.luke),{teamLabel:'Luke'}));
});
