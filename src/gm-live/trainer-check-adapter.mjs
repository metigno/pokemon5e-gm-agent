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
   return {allowed:true};
  },
  async resolveAction({campaign,intent}) {
   const score=campaign.character.abilities[intent.ability];
   const result=abilityCheck({score,dc:intent.dc,proficient:intent.proficient===true,
    proficiencyBonus:intent.proficiencyBonus??0,advantage:intent.advantage??'normal'});
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
