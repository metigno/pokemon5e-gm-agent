import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {canonicalTeam} from '../canonical-2060-teams.mjs';
const {Battle,Teams}=createRequire(import.meta.url)('pokemon-showdown');
for(const [trainer,species,forme,ability] of [['N','Excadrill','Excadrill-Mega','piercingdrill'],['Lucas','Staraptor','Staraptor-Mega','contrary']]){
 test(`${trainer}: exact roster actually Mega Evolves with installed Showdown ability`,()=>{
  const sets=Teams.unpack(canonicalTeam(trainer));
  const lead=sets.find(x=>x.species===species);
  const battle=new Battle({formatid:'gen8customgame',seed:[1,2,3,4],p1:{name:trainer,team:Teams.pack([lead,...sets.filter(x=>x!==lead)])},p2:{name:'Opponent',team:Teams.pack(Array.from({length:6},()=>({species:'Magikarp',moves:['Splash'],level:100})))}});
  battle.makeChoices('team 123456','team 123456');
  battle.makeChoices('move 1 mega','move 1');
  assert.equal(battle.p1.active[0].species.name,forme);
  assert.equal(battle.p1.active[0].ability,ability);
  assert.ok(battle.log.some(x=>x.startsWith('|-mega|')));
  battle.destroy();
 });
}
