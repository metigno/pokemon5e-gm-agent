import test from 'node:test';
import assert from 'node:assert/strict';
import {
  abilityModifier,validateMotorStats,tacticalChecks,
  projectNpcAbilities,derivedTacticalSkills,
} from '../src/bridge/motor-to-poke5e.mjs';

test('motor and d20 modifier curve match',()=>{
  assert.equal(abilityModifier(1),-5);
  assert.equal(abilityModifier(10),0);
  assert.equal(abilityModifier(17),3);
  assert.equal(abilityModifier(18),4);
  assert.equal(abilityModifier(20),5);
});

test('invalid motor scores are rejected',()=>{
  const s={tattica:21,strategia:10,prediction:10,mindGames:10,conoscenza:10,adattamento:10,gestioneTeam:10,gestioneRischio:10};
  assert.throws(()=>validateMotorStats(s));
});

test('NPC projection does not invent STR or CON from tactics',()=>{
  const s={tattica:17,strategia:17,prediction:18,mindGames:15,conoscenza:16,adattamento:18,gestioneTeam:17,gestioneRischio:16};
  assert.deepEqual(projectNpcAbilities(s),{
    strength:10,dexterity:14,constitution:10,
    intelligence:17,wisdom:17,charisma:17,
  });
});

test('supplied physical scores are preserved',()=>{
  const s={tattica:10,strategia:10,prediction:10,mindGames:10,conoscenza:10,adattamento:10,gestioneTeam:10,gestioneRischio:10};
  assert.deepEqual(
    projectNpcAbilities(s,{strength:16,constitution:14,dexterity:12}),
    {strength:16,dexterity:12,constitution:14,intelligence:10,wisdom:10,charisma:10}
  );
});

test('tactical checks and composite skills are deterministic',()=>{
  const s={tattica:18,strategia:16,prediction:14,mindGames:12,conoscenza:20,adattamento:15,gestioneTeam:13,gestioneRischio:11};
  assert.equal(tacticalChecks(s).conoscenza.modifier,5);
  assert.equal(derivedTacticalSkills(s,3).pokemonKnowledge.proficientModifier,7);
});
