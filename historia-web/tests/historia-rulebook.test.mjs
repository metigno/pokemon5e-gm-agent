import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {practiceTeams,validatePackedTeam} from '../battle-service.mjs';

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
 assert.equal(restored.level,100);
});
