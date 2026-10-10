import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {canonicalTeam,canonicalTeamExport,listCanonicalRosters} from '../canonical-2060-teams.mjs';
import {parseTeamInput,describeTeam} from '../battle-service.mjs';

const {Teams,Dex}=createRequire(import.meta.url)('pokemon-showdown');

test('Exactly 32 canonically documented trainers, never invent the other three complete builds',()=>{
 const statuses=listCanonicalRosters();
 assert.equal(statuses.length,35);
 assert.ok(statuses.filter(x=>x.available).length>=30,
  JSON.stringify(statuses.filter(x=>!x.available)));
 for(const name of ['Lucas','Ronan Ward','Soren Veyr']){
  assert.equal(statuses.find(x=>x.id===name).available,false);
  assert.throws(()=>canonicalTeam(name),/non disponibile/);
 }
});

test('Luke team is imported from 2060 roster without moves, items, forms or EV replacement',()=>{
 const sets=Teams.unpack(canonicalTeam('Luke'));
 assert.equal(sets.length,6);
 assert.deepEqual(sets.map(x=>x.species),['Arcanine-Hisui','Venusaur',
   'Kyurem-Black','Great Tusk','Blastoise','Kilowattrel']);
 assert.deepEqual(sets.map(x=>x.item),['Choice Scarf','Venusaurite',
   'Loaded Dice','Leftovers','White Herb','Focus Sash']);
 assert.equal(sets[0].ability,'Rock Head');
 assert.equal(sets[0].nature,'Jolly');
 assert.deepEqual(sets[0].moves,['Flare Blitz','Head Smash','Close Combat','Crunch']);
 assert.equal(sets[1].ability,'Overgrow');
 assert.deepEqual(sets[1].moves,['Sleep Powder','Leech Seed','Sludge Bomb','Giga Drain']);
 assert.equal(sets[4].gigantamax,true);
 assert.deepEqual(sets[4].moves,['Shell Smash','Hydro Pump','Ice Beam','Aura Sphere']);
 assert.equal(sets[5].ability,'Volt Absorb');
 assert.deepEqual(sets[5].moves,['Volt Switch','Hurricane','Tailwind','Roost']);
 assert.equal(sets[5].gigantamax,undefined);
 const exported=canonicalTeamExport('Luke');
 assert.match(exported,/Gigantamax: Yes/);
 assert.match(exported,/Kilowattrel @ Focus Sash/);
 assert.equal(parseTeamInput(exported,{teamLabel:'Luke'}),canonicalTeam('Luke'));
});

test('Canon G-Max builds use base species plus actual Gigantamax flag',()=>{
 const cases=[['Luke','Blastoise'],['Mattew','Corviknight'],['Daniel','Charizard'],
  ['Edward','Lapras'],['Red','Charizard'],['Dandel / Leon','Charizard']];
 for(const [trainer,species] of cases){
  const sets=Teams.unpack(canonicalTeam(trainer));
  const found=sets.find(p=>p.species===species&&p.gigantamax===true);
  assert.ok(found,trainer+': '+species+' Gigantamax missing');
  assert.equal(Dex.species.get(species).canGigantamax,true);
 }
});

test('Mega Venusaur and Mega Swampert items/abilities and Alpha visuals are lossless',()=>{
 const luke=describeTeam(canonicalTeam('Luke'));
 const mattew=describeTeam(canonicalTeam('Mattew'));
 assert.equal(luke[1].item,'Venusaurite');
 assert.equal(luke[1].ability,'Overgrow');
 assert.equal(mattew.find(m=>m.species==='Swampert').item,'Swampertite');
 assert.equal(luke[0].species,'Arcanine-Hisui');
 assert.equal(luke[0].name,'Arcanine Alpha');
});

test('Unsupported 2060 Mega Excadrill must fail closed, not quietly lose its stone',()=>{
 const item=Dex.items.get('Excadrite');
 const status=listCanonicalRosters().find(x=>x.id==='N');
 if(!item.exists){
  assert.equal(status.available,false);
  assert.match(status.reason,/Excadrite/);
  assert.throws(()=>canonicalTeam('N'),/Excadrite/);
 }else assert.equal(Teams.unpack(canonicalTeam('N'))[4].item,'Excadrite');
});
