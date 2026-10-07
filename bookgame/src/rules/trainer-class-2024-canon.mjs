// Canonical Trainer-class constants transcribed from the pinned Pokémon 5e 2024 source.
// Source ref: Auroratide/poke5e@b411a993eba07f36218f8ea70dd2c402e2e7c91a
export const TRAINER_2024_STARTING_EQUIPMENT = Object.freeze([
  Object.freeze({ id: "pokeball", quantity: 5 }),
  Object.freeze({ id: "potion", quantity: 1 }),
  Object.freeze({ id: "trainer-license", quantity: 1 }),
  Object.freeze({ id: "pokedex", quantity: 1 })
]);

export const TRAINER_2024_CORE_FEATURES = Object.freeze({
  1: Object.freeze(["trainer-license", "starter-pokemon", "pokedex", "pokeslots", "specialization"]),
  2: Object.freeze(["trainer-path"]),
  3: Object.freeze(["control-upgrade"]),
  4: Object.freeze(["ability-score-improvement"]),
  5: Object.freeze(["trainer-path-feature", "pokeslot"]),
  6: Object.freeze(["control-upgrade"]),
  7: Object.freeze(["specialization"]),
  8: Object.freeze(["ability-score-improvement", "control-upgrade"]),
  9: Object.freeze(["trainer-path-feature"]),
  10: Object.freeze(["trainers-resolve", "pokeslot"]),
  11: Object.freeze(["control-upgrade"]),
  12: Object.freeze(["ability-score-improvement"]),
  13: Object.freeze(["pokemon-tracker"]),
  14: Object.freeze(["control-upgrade"]),
  15: Object.freeze(["trainer-path-feature", "pokeslot"]),
  16: Object.freeze(["ability-score-improvement"]),
  17: Object.freeze(["control-upgrade"]),
  18: Object.freeze(["specialization"]),
  19: Object.freeze(["epic-boon"]),
  20: Object.freeze(["master-trainer"])
});

export function trainerCoreFeaturesAtLevel(level){
 if(!Number.isInteger(level)||level<1||level>20)throw new RangeError("Trainer level must be 1..20");
 const out=[]; for(let n=1;n<=level;n++) for(const id of TRAINER_2024_CORE_FEATURES[n]??[]) if(!out.includes(id)) out.push(id);
 return out;
}
export function trainerStartingInventory(){
 return TRAINER_2024_STARTING_EQUIPMENT.map(x=>({...x}));
}
