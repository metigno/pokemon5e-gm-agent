const MOVE_IDS = `
after-you ally-switch amnesia aromatic-mist assist attract aurora-veil baby-doll-eyes baneful-bunker baton-pass belly-drum bestow bide block camouflage captivate chilly-reception coaching conversion conversion-2 copycat court-change crafty-shield decorate destiny-bond detect diamond-storm doodle double-team dragon-cheer eerie-spell electric-terrain electrify embargo encore endure entrainment explosion final-gambit flash fling flower-shield focus-punch follow-me foresight gastro-acid gear-up glare grassy-terrain gravity growth grudge guard-split guard-swap happy-hour heal-block heart-swap helping-hand hold-hands howl instruct ion-deluge kings-shield light-screen lucky-chant magic-coat magic-room magnetic-flux mat-block me-first memento metal-burst metronome mimic miracle-eye mirror-coat mirror-move misty-terrain mud-sport nasty-plot nature-power nightmare noble-roar obstruct octolock odor-sleuth outrage parting-shot perish-song play-nice powder power-shift power-split power-swap power-trick protect psych-up psychic-terrain psycho-shift quash quick-guard rage rage-powder recycle reflect retaliate revenge revival-blessing roar role-play roost rototiller scary-face sharpen shed-tail shelter silk-trap simple-beam sing sketch skill-swap slack-off sleep-talk smokescreen snatch snowscape speed-swap spicy-extract spider-web spiky-shield spite splash spotlight sticky-web strength-sap string-shot stuff-cheeks substitute switcheroo swords-dance tailwind take-heart teatime telekinesis teleport tidy-up topsy-turvy torment transform trick trick-room vital-throw water-sport whirlwind wide-guard withdraw wonder-room work-up worry-seed yawn
`.trim().split(/\s+/);

export const CANONICAL_SPECIAL_MOVE_IDS = new Set(MOVE_IDS);

const REACTION_TRIGGERS = {
  "attract": "hit_by_attack",
  "baby-doll-eyes": "targeted_by_attack",
  "baneful-bunker": "targeted_by_attack",
  "block": "target_switch_or_flee",
  "captivate": "hit_by_attack",
  "court-change": "non_damaging_move_declared",
  "crafty-shield": "status_condition_inflicted",
  "detect": "move_effect_received",
  "electrify": "hit_by_melee_attack",
  "encore": "targeted_by_move",
  "endure": "would_faint_from_damage",
  "follow-me": "ally_targeted_by_move",
  "grudge": "would_faint_from_move",
  "heal-block": "hp_recovery_declared",
  "hold-hands": "ally_attack_or_targeted",
  "kings-shield": "targeted_by_attack",
  "light-screen": "hit_by_ranged_attack",
  "lucky-chant": "critical_hit",
  "magic-coat": "negative_status_inflicted",
  "me-first": "targeted_by_single_target_move",
  "metal-burst": "hit_by_melee_attack",
  "noble-roar": "targeted_by_attack",
  "obstruct": "move_effect_received",
  "powder": "fire_move_declared",
  "protect": "move_effect_received",
  "quick-guard": "first_turn_attack",
  "reflect": "hit_by_melee_attack",
  "retaliate": "ally_fainted",
  "revenge": "hit_by_melee_attack",
  "shed-tail": "hit_by_attack",
  "shelter": "hit_by_attack",
  "silk-trap": "hit_by_melee_attack",
  "sketch": "move_seen",
  "snatch": "positive_self_move_declared",
  "spiky-shield": "hit_by_melee_attack",
  "spite": "hit_by_attack",
  "sticky-web": "target_switched_in",
  "strength-sap": "stat_boost_declared",
  "take-heart": "negative_status_inflicted",
  "torment": "hit_by_attack",
  "wide-guard": "area_damage_declared",
  "withdraw": "targeted_by_attack"
};

const FAMILIES = {
  initiative: new Set(["after-you","quash","trick-room"]),
  position: new Set(["ally-switch","splash","teleport"]),
  switch: new Set(["baton-pass","chilly-reception","parting-shot","shed-tail"]),
  type: new Set(["camouflage","conversion","conversion-2","ion-deluge","foresight","miracle-eye","odor-sleuth"]),
  copyMove: new Set(["assist","copycat","instruct","me-first","metronome","mimic","mirror-move","nature-power","sleep-talk","sketch"]),
  ability: new Set(["doodle","entrainment","gastro-acid","role-play","simple-beam","skill-swap","transform","worry-seed"]),
  item: new Set(["bestow","embargo","fling","magic-room","recycle","stuff-cheeks","switcheroo","teatime","trick"]),
  terrain: new Set(["electric-terrain","grassy-terrain","misty-terrain","psychic-terrain","rototiller","smokescreen","snowscape","tailwind","wonder-room","gravity"]),
  delayed: new Set(["bide","focus-punch","outrage","perish-song","slack-off","vital-throw","yawn"]),
  hp: new Set(["belly-drum","explosion","final-gambit","memento","revival-blessing","roost","substitute"]),
  modifier: new Set([
    "amnesia","aromatic-mist","aurora-veil","coaching","decorate","destiny-bond","double-team","dragon-cheer",
    "eerie-spell","flower-shield","gear-up","growth","guard-split","guard-swap","heart-swap","helping-hand","howl",
    "light-screen","magnetic-flux","mat-block","mud-sport","nasty-plot","play-nice","power-shift","power-split","power-swap",
    "power-trick","psych-up","rage","reflect","sharpen","shelter","snowscape","speed-swap","spicy-extract","spotlight",
    "string-shot","swords-dance","topsy-turvy","water-sport","whirlwind","work-up"
  ]),
  control: new Set([
    "glare","rage-powder","roar","scary-face","spider-web","telekinesis","tidy-up","torment"
  ]),
  reaction: new Set(Object.keys(REACTION_TRIGGERS)),
  specialDamage: new Set(["diamond-storm","nightmare","powder","metal-burst","mirror-coat","retaliate","revenge"]),
  utility: new Set(["flash","happy-hour","heal-block","hold-hands","lucky-chant","magic-coat","octolock","psycho-shift","quick-guard","sing","snatch","spite","take-heart"])
};

function familyForMoveId(id) {
  for (const [family, ids] of Object.entries(FAMILIES)) {
    if (ids.has(id)) return family;
  }
  return "canonical-special";
}

export function isCanonicalSpecialMove(moveOrId) {
  const id = typeof moveOrId === "string" ? moveOrId : moveOrId?.id;
  return CANONICAL_SPECIAL_MOVE_IDS.has(id);
}

export function canonicalReactionTrigger(moveOrId) {
  const id = typeof moveOrId === "string" ? moveOrId : moveOrId?.id;
  return REACTION_TRIGGERS[id] ?? null;
}

export function compileCanonicalMoveRule(move) {
  const supported = isCanonicalSpecialMove(move);
  return {
    id: move?.id ?? null,
    supported,
    family: supported ? familyForMoveId(move.id) : null,
    reactionTrigger: supported ? canonicalReactionTrigger(move) : null,
    requiresChoice: supported && /choose|choice|select|your choice|DM/i.test(move.description ?? ""),
    description: move?.description ?? ""
  };
}

const ITEM_SCOPES = {
  "pokeball": "capture",
  "medicine": "pokemon_use",
  "evolution": "progression",
  "berry": "held_or_consumable",
  "held item": "held_passive",
  "trainer gear": "trainer_world"
};

export function compileCanonicalItemRule(item) {
  const scope = ITEM_SCOPES[item?.type] ?? null;
  return {
    itemId: item?.id ?? null,
    supported: scope != null,
    scope,
    runtimeContext:
      scope === "capture" ? "capture" :
      scope === "progression" ? "evolution" :
      scope === "trainer_world" ? "world" :
      "combat_or_party",
    description: item?.description ?? ""
  };
}

export function compileCanonicalAbilityRule(ability) {
  const id = ability?.id ?? null;
  const text = ability?.description ?? "";
  let family = "passive";
  if (/^form-change-/.test(id ?? "")) family = "form_change";
  else if (/knows .+ as a fifth move/i.test(text)) family = "fifth_move";
  else if (/outside (?:of )?combat|short rest|long rest|overworld|wild/i.test(text)) family = "world_utility";
  else if (/when|whenever|upon|after|before|if |while|at the (?:start|end|beginning)/i.test(text)) family = "triggered";
  else if (/weather|terrain|sunlight|rain|snow|sandstorm|hail/i.test(text)) family = "environment";
  return {
    abilityId: id,
    supported: Boolean(id && text),
    family,
    description: text
  };
}

export function auditCanonicalRuntime({ moves = [], abilities = [], items = [] } = {}) {
  const unresolvedMoves = moves.filter((move) => !compileCanonicalMoveRule(move).supported);
  const unresolvedAbilities = abilities.filter((ability) => !compileCanonicalAbilityRule(ability).supported);
  const unresolvedItems = items.filter((item) => !compileCanonicalItemRule(item).supported);
  return {
    moves: { total: moves.length, unresolved: unresolvedMoves.map((entry) => entry.id) },
    abilities: { total: abilities.length, unresolved: unresolvedAbilities.map((entry) => entry.id) },
    items: { total: items.length, unresolved: unresolvedItems.map((entry) => entry.id) }
  };
}
