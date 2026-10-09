import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {practiceTeams,validatePackedTeam,parseTeamInput} from '../battle-service.mjs';

const {Teams,Dex}=createRequire(import.meta.url)('pokemon-showdown');

test('Historia rejects all Z-crystals, even though Gen 8 Custom Game might allow them',()=>{
 const team=Teams.unpack(practiceTeams().p1);
 team[0].item='Firium Z';
 assert.ok(Dex.items.get('firiumz').zMove,'Showdown classifies this as a Z-Crystal');
 assert.throws(()=>validatePackedTeam(Teams.pack(team)),/Mosse Z/);
});

test('Historia refuses missing major-legendary classification for official competition',()=>{
 assert.throws(()=>validatePackedTeam(practiceTeams().p1,{official:true}),/Classificazione canonica/);
});

test('Historia limits major legendary according to supplied verified base-form registry',()=>{
 const team=Teams.unpack(practiceTeams().p1);
 team[0].species='Mewtwo';
 team[2].species='Kyurem-Black';
 assert.throws(()=>validatePackedTeam(Teams.pack(team),{official:true,majorLegendarySpecies:['Mewtwo','Kyurem','Lugia']}),/Massimo un leggendario/);
 assert.doesNotThrow(()=>validatePackedTeam(Teams.pack(team),{official:true,majorLegendarySpecies:['Mewtwo','Lugia']}));
});

test('Arcanine di Hisui uses simulator species data; no artificial Alpha bonus is applied to packed set',()=>{
 const data=Dex.species.get('Arcanine-Hisui');
 assert.equal(data.exists,true);
 assert.deepEqual(data.types,['Fire','Rock']);
 const team=Teams.unpack(practiceTeams().p1);
 team[0].species='Arcanine-Hisui';team[0].name='Arcanine Alpha';
 const packed=Teams.pack(team);
 assert.equal(validatePackedTeam(packed),packed);
 const restored=Teams.unpack(packed)[0];
 assert.equal(restored.species,'Arcanine-Hisui');
 assert.equal(restored.level??100,100,'Packed Showdown teams omit level 100 because it is the default');
});

test('Alpha cannot exceed normal IV and EV ceilings',()=>{
 const team=Teams.unpack(practiceTeams().p1);
 team[0].name='Alpha Arcanine';
 team[0].evs={hp:252,atk:252,spe:252};
 assert.throws(()=>validatePackedTeam(Teams.pack(team)),/EV fuori/);
 team[0].evs={atk:252,spe:252,hp:4};
 team[0].ivs={hp:32};
 assert.throws(()=>validatePackedTeam(Teams.pack(team)),/IV fuori/);
 team[0].ivs={hp:31};
 assert.doesNotThrow(()=>validatePackedTeam(Teams.pack(team)));
});

test('Gigantamax bit remains on allowed species; unsupported species are rejected',()=>{
 const team=Teams.unpack(practiceTeams().p2);
 team[0].species='Blastoise';
 team[0].name='Blastoise';
 team[0].gigantamax=true;
 const packed=Teams.pack(team);
 assert.equal(Teams.unpack(packed)[0].gigantamax,true,'Showdown roundtrip preserves Gigantamax');
 assert.equal(validatePackedTeam(packed),packed);
 team[0].species='Magikarp';
 assert.throws(()=>validatePackedTeam(Teams.pack(team)),/non compatibile con Gigantamax/);
});


test('Item Clause is per trainer, same Leftovers on Luke and rival is valid',()=>{
 const p1=Teams.unpack(practiceTeams().p1),p2=Teams.unpack(practiceTeams().p2);
 p1[0].item='Leftovers';p2[0].item='Leftovers';
 const exportedLuke=Teams.export(p1),exportedRival=Teams.export(p2);
 assert.doesNotThrow(()=>parseTeamInput(exportedLuke,{teamLabel:'Luke'}));
 assert.doesNotThrow(()=>parseTeamInput(exportedRival,{teamLabel:'Mattew'}));
 // Each independent import must use its own item collection.
 assert.doesNotThrow(()=>validatePackedTeam(Teams.pack(p1),{teamLabel:'Luke'}));
 assert.doesNotThrow(()=>validatePackedTeam(Teams.pack(p2),{teamLabel:'Mattew'}));
});

test('Item Clause identifies item, trainer and both Pokémon for same-team duplicates',()=>{
 const p1=Teams.unpack(practiceTeams().p1);
 p1[0].item='Leftovers';p1[2].item='Leftovers';
 assert.throws(()=>parseTeamInput(Teams.export(p1),{teamLabel:'Luke'}),
  err=>/Item Clause/.test(err.message)&&/Luke/.test(err.message)&&/Leftovers/.test(err.message)&&/Arcanine/.test(err.message)&&/Kyurem-Black/.test(err.message));
 const p2=Teams.unpack(practiceTeams().p2);
 p2[0].item='Choice Scarf';p2[1].item='Choice Scarf';
 assert.throws(()=>validatePackedTeam(Teams.pack(p2),{teamLabel:'Mattew'}),
  err=>/Mattew/.test(err.message)&&/Choice Scarf/.test(err.message)&&/Feraligatr/.test(err.message)&&/Jolteon/.test(err.message));
});
