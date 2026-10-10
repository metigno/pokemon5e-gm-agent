import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {WorldCupSlots} from '../worldcup-service.mjs';
import {ArenaService} from '../battle-service.mjs';
import {getCanonicalShowdownTeam} from '../canonical-teams.mjs';
const {Teams}=createRequire(import.meta.url)('pokemon-showdown');
const supported=id=>{try{return !!getCanonicalShowdownTeam(id);}catch{return false;}};

test('Mondiale starts Luke fixture without any team paste, using locked server-side 2060 builds', {timeout:40000}, async()=>{
 const directory=await mkdtemp(join(tmpdir(),'historia-auto-teams-'));
 const owner='z'.repeat(40);
 const slots=new WorldCupSlots(join(directory,'slots')),arena=new ArenaService(join(directory,'battles'));
 try{
  const {cup}=await slots.newHistoricalHypothesis(owner,1);
  const f=cup.schedule.find(m=>(m.homeId==='Luke'||m.awayId==='Luke')&&
   supported(m.homeId==='Luke'?m.awayId:m.homeId));
  assert.ok(f,'at least one supported opponent of Luke must be available');
  const started=await slots.startLukeFixture(owner,1,f.id,{mode:'manual'},arena);
  assert.equal(started.battle.p1name,'Luke');
  const roster=started.battle.p1roster;
  assert.equal(roster.length,6);
  assert.deepEqual(roster.map(p=>p.species),['Arcanine-Hisui','Venusaur','Kyurem-Black','Great Tusk','Blastoise','Kilowattrel']);
  assert.equal(roster[1].item,'Venusaurite');
  assert.equal(roster[4].gigantamax,true);
  assert.equal(roster[5].item,'Focus Sash');
  const matchState=arena.sessions.get(started.battle.id);
  assert.equal(matchState.p1team,getCanonicalShowdownTeam('Luke'));
  assert.equal(matchState.p2team,getCanonicalShowdownTeam(f.homeId==='Luke'?f.awayId:f.homeId));
  assert.equal(started.battle.kind,'worldcup-what-if');
  assert.equal(started.battle.p2roster,undefined,'never expose full private opponent roster');
  const resumed=await slots.startLukeFixture(owner,1,f.id,{},arena);
  assert.equal(resumed.battle.id,started.battle.id);
  assert.equal(resumed.resumed,true);
 }finally{await arena.shutdown();await rm(directory,{force:true,recursive:true});}
});
