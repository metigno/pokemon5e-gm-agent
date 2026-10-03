import test from 'node:test';
import assert from 'node:assert/strict';
import {
  abilityModifier,
  convertMotorToDnd,
  getLegacyIntentResolution,
  validateLegacyStats,
} from '../src/bridge/motor-to-poke5e.mjs';

const profiles={
  Luke:{tattica:17,strategia:17,prediction:18,mindGames:15,conoscenza:16,adattamento:18,gestioneTeam:17,gestioneRischio:16},
  Mattew:{tattica:20,strategia:20,prediction:20,mindGames:19,conoscenza:20,adattamento:20,gestioneTeam:20,gestioneRischio:20},
  Daniel:{tattica:20,strategia:20,prediction:20,mindGames:20,conoscenza:20,adattamento:20,gestioneTeam:20,gestioneRischio:20},
  Edward:{tattica:18,strategia:16,prediction:18,mindGames:12,conoscenza:17,adattamento:17,gestioneTeam:17,gestioneRischio:18},
  Fab:{tattica:19,strategia:19,prediction:19,mindGames:15,conoscenza:18,adattamento:19,gestioneTeam:19,gestioneRischio:19},
};

test('classic d20 modifier curve',()=>{
  assert.equal(abilityModifier(10),0);
  assert.equal(abilityModifier(18),4);
  assert.equal(abilityModifier(20),5);
});

test('legacy profiles validate',()=>{
  for(const p of Object.values(profiles)) assert.equal(validateLegacyStats(p),true);
});

test('canonical conversions are stable',()=>{
  assert.deepEqual(convertMotorToDnd(profiles.Luke),{
    strength:10,dexterity:18,constitution:10,intelligence:16,wisdom:17,charisma:17,
  });
  assert.deepEqual(convertMotorToDnd(profiles.Mattew),{
    strength:10,dexterity:20,constitution:10,intelligence:20,wisdom:20,charisma:20,
  });
  assert.deepEqual(convertMotorToDnd(profiles.Daniel),{
    strength:10,dexterity:20,constitution:10,intelligence:20,wisdom:20,charisma:20,
  });
  assert.deepEqual(convertMotorToDnd(profiles.Edward),{
    strength:10,dexterity:18,constitution:10,intelligence:15,wisdom:18,charisma:17,
  });
  assert.deepEqual(convertMotorToDnd(profiles.Fab),{
    strength:10,dexterity:19,constitution:10,intelligence:18,wisdom:19,charisma:19,
  });
});

test('Mind Games is now INT-based',()=>{
  const r=getLegacyIntentResolution('mindGames');
  assert.equal(r.ability,'INT');
  assert.ok(r.skills.includes('Investigation'));
});

test('no legacy custom skill is returned as an ability',()=>{
  for(const key of ['strategia','prediction','conoscenza','adattamento','gestioneTeam','gestioneRischio']){
    assert.ok(['STR','DEX','CON','INT','WIS','CHA'].includes(getLegacyIntentResolution(key).ability));
  }
});
