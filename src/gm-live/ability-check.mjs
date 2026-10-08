import { abilityModifier } from '../bridge/motor-to-poke5e.mjs';
import { randomInt } from 'node:crypto';

/** Canonical 5e ability check arithmetic only. No invented species combat data. */
export function abilityCheck({ score, proficiencyBonus = 0, proficient = false, dc, advantage = 'normal', roll = () => randomInt(1,21) }) {
 if (![score,proficiencyBonus,dc].every(Number.isSafeInteger) || score < 1 || score > 30 || proficiencyBonus < 0 || dc < 0) throw new Error('Invalid check parameters');
 if (!['normal','advantage','disadvantage'].includes(advantage)) throw new Error('Invalid advantage');
 const first=roll(), second=advantage==='normal'?null:roll();
 if (![first,second].filter(x=>x!==null).every(x=>Number.isSafeInteger(x)&&x>=1&&x<=20)) throw new Error('Invalid d20 result');
 const chosen=second===null?first:advantage==='advantage'?Math.max(first,second):Math.min(first,second);
 const modifier=abilityModifier(score)+(proficient?proficiencyBonus:0);
 const total=chosen+modifier;
 return {rolls:second===null?[first]:[first,second],chosen,modifier,total,dc,success:total>=dc};
}
