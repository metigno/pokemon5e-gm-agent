import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorldCupSlots} from '../worldcup-service.mjs';
import {ArenaService} from '../battle-service.mjs';
import {canonicalTeam,listCanonicalRosters} from '../canonical-2060-teams.mjs';

test('All tournament fixture types automatically select exact roster of EACH named trainer', {timeout:25000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'historia-auto2060-'));
 const owner='d'.repeat(40),slots=new WorldCupSlots(join(directory,'slots'));
 const arena=new ArenaService(join(directory,'battles'));
 try{
  const {cup}=await slots.newHistoricalHypothesis(owner,1);
  const supported=new Set(listCanonicalRosters().filter(x=>x.available).map(x=>x.id));
  const luke=cup.schedule.find(g=>[g.homeId,g.awayId].includes('Luke')&&
   supported.has(g.homeId)&&supported.has(g.awayId));
  const npc=cup.schedule.find(g=>g.homeId!=='Luke'&&g.awayId!=='Luke'&&
   supported.has(g.homeId)&&supported.has(g.awayId));
  assert.ok(luke);assert.ok(npc);
  const p=await slots.startLukeFixture(owner,1,luke.id,{mode:'manual'},arena);
  const player=arena.sessions.get(p.battle.id);
  assert.equal(player.p1team,canonicalTeam('Luke'));
  const opponent=luke.homeId==='Luke'?luke.awayId:luke.homeId;
  assert.equal(player.p2team,canonicalTeam(opponent));
  const n=await slots.startNpcFixture(owner,1,npc.id,{},arena);
  const bots=arena.sessions.get(n.battle.id);
  assert.equal(bots.p1team,canonicalTeam(npc.homeId));
  assert.equal(bots.p2team,canonicalTeam(npc.awayId));
  assert.equal(bots.kind,'worldcup-what-if');
  assert.equal(p.battle.mode,'manual');
  assert.equal(n.battle.mode,'auto');
  assert.equal((await slots.startNpcFixture(owner,1,npc.id,{},arena)).battle.id,n.battle.id);
 }finally{await arena.shutdown();await rm(directory,{force:true,recursive:true});}
});
