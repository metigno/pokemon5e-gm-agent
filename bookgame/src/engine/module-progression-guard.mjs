import { experienceNeededAtLevel } from "./state.mjs";

export const MODULE_TRAINER_LEVEL_BANDS=Object.freeze({
 M01:Object.freeze({min:1,max:3}), M02:Object.freeze({min:3,max:5}),
 M03:Object.freeze({min:5,max:9}), M04:Object.freeze({min:8,max:12}),
 M05:Object.freeze({min:11,max:15}), M06:Object.freeze({min:14,max:18}),
 M07:Object.freeze({min:17,max:20}), M08:Object.freeze({min:18,max:20}),
 M09:Object.freeze({min:18,max:20}), M10:Object.freeze({min:18,max:20}),
 M11:Object.freeze({min:18,max:20}), M12:Object.freeze({min:18,max:20})
});

export function normalizeModuleId(value){
 const match=/M(?:ODULE)?[-_ ]?0?(\d{1,2})/i.exec(String(value??""));
 if(!match) return null;
 const number=Number(match[1]);
 return number>=1&&number<=12?`M${String(number).padStart(2,"0")}`:null;
}

export function moduleTrainerLevelBand(moduleId){
 const id=normalizeModuleId(moduleId);
 if(!id) throw new Error("Unknown campaign module: "+moduleId);
 return MODULE_TRAINER_LEVEL_BANDS[id];
}

export function moduleTrainerLevelCap(moduleId){return moduleTrainerLevelBand(moduleId).max;}

export function moduleTrainerXpCap(moduleId){
 return experienceNeededAtLevel(moduleTrainerLevelCap(moduleId));
}

export function assertLevelWithinModuleCap(moduleId,level,{label="Trainer"}={}){
 const cap=moduleTrainerLevelCap(moduleId);
 if(Number(level)>cap) throw new RangeError(`${label} level ${level} exceeds ${moduleId} cap ${cap}`);
 return true;
}

export function clampLevelToModuleBand(moduleId,level){
 const {min,max}=moduleTrainerLevelBand(moduleId);
 return Math.max(min,Math.min(max,Number(level)));
}
