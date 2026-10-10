import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalTeam} from '../canonical-2060-teams.mjs';
import {createShowdownBattle} from '../showdown-engine.mjs';
test('Historia starts six at level 100 without revealing unrevealed team preview',async()=>{
 const game=await createShowdownBattle({format:'historia',p1team:canonicalTeam('Luke'),p2team:canonicalTeam('Mattew')});
 try{
  let log='';
  for await(const chunk of game.spectator){log+=String(chunk);if(log.includes('|turn|1'))break;}
  assert.doesNotMatch(log,/\|poke\||\|teampreview/);
  assert.match(log,/Historia/);
 }finally{await game.close();}
});
