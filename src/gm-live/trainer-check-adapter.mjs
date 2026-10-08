import { abilityCheck } from './ability-check.mjs';

/**
 * Real canonical trainer ability checks; deliberately refuses combat,
 * capture, evolution and any operation lacking an authoritative adapter.
 */
export function createTrainerCheckAdapter() {
 return {
  async validateAction({campaign,intent}) {
   if (intent.kind !== 'trainer-check') return {allowed:false,reason:'Mechanical action requires a dedicated canonical adapter'};
   if (!['STR','DEX','CON','INT','WIS','CHA'].includes(intent.ability)) return {allowed:false,reason:'Invalid ability'};
   if (!Number.isSafeInteger(intent.dc) || intent.dc < 0) return {allowed:false,reason:'Invalid DC'};
   if (!campaign?.character?.abilities) return {allowed:false,reason:'Trainer sheet missing'};
   if (!Number.isSafeInteger(campaign.character.abilities[intent.ability])) return {allowed:false,reason:'Ability score missing'};
   if (intent.proficient === true || intent.proficiencyBonus !== undefined) return {allowed:false,reason:'Client cannot grant proficiency; use a canonical trained skill'};
   if (intent.skill !== undefined && typeof intent.skill !== 'string') return {allowed:false,reason:'Invalid skill'};
   if (intent.skill !== undefined && !Array.isArray(campaign.character.skills)) return {allowed:false,reason:'Trainer skill sheet missing'};
   if (intent.advantage !== undefined && intent.advantage !== 'normal') return {allowed:false,reason:'Advantage requires a canonical adjudication source'};
   if (intent.dc > 30) return {allowed:false,reason:'DC outside supported range'};
   return {allowed:true};
  },
  async resolveAction({campaign,intent}) {
   const score=campaign.character.abilities[intent.ability];
   const trained=typeof intent.skill === 'string' && campaign.character.skills.includes(intent.skill);
   const bonus=trained ? campaign.character.proficiencyBonus : 0;
   if (trained && (!Number.isSafeInteger(bonus) || bonus < 2 || bonus > 9)) throw new Error('Canonical proficiency bonus missing');
   const result=abilityCheck({score,dc:intent.dc,proficient:trained,
    proficiencyBonus:bonus,advantage:intent.advantage??'normal'});
   return {
    narration:result.success?'Ability check succeeds':'Ability check fails',
    statePatch:{world:{...campaign.world,flags:{...campaign.world.flags,lastTrainerCheck:{
      ability:intent.ability,dc:intent.dc,rolls:result.rolls,total:result.total,success:result.success
    }}}}
   };
  },
  async validateState({outcome}) {
   return {valid:outcome.statePatch?.world?.flags?.lastTrainerCheck?.total !== undefined};
  }
 };
}
