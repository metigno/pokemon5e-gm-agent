import { clearStatus, STATUS_IDS } from "./status.mjs";

function normalizeItemId(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function rollDiceExpression(expression, dice) {
  const match = /^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/.exec(expression.trim());
  if (!match) throw new Error(`Unsupported medicine dice expression: ${expression}`);
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const bonus = Number(match[3] ?? 0);
  const rolls = Array.from({ length: count }, () => dice.roll(sides));
  return {
    expression,
    rolls,
    bonus,
    total: rolls.reduce((sum, roll) => sum + roll, 0) + bonus
  };
}

function healingRule(item) {
  const text = item.description ?? "";
  const dice = text.match(/restore\s+(\d+d\d+(?:\s*\+\s*\d+)?)\s+HP/i);
  if (dice) return { kind: "heal", dice: dice[1].replace(/\s+/g, " ") };

  const fixed = text.match(/restores?\s+(\d+)\s+HP/i);
  if (fixed) return { kind: "heal_fixed", amount: Number(fixed[1]) };
  return null;
}

function ppRule(item) {
  const text = item.description ?? "";
  const amount = text.match(/restore\s+(\d+)\s+PP/i);
  if (!amount) return null;
  return {
    kind: /all moves/i.test(text) ? "restore_pp_all" : "restore_pp_one",
    amount: Number(amount[1])
  };
}

function statusRule(item) {
  const text = item.description ?? "";
  if (/all status conditions/i.test(text)) return { kind: "cure_all_status" };

  const map = [
    ["Poisoned", /Poisoned/i],
    ["BadlyPoisoned", /Badly Poisoned/i],
    ["Burned", /Burned/i],
    ["Frozen", /Frozen/i],
    ["Asleep", /Asleep/i],
    ["Paralysis", /Paralysis/i],
    ["Confused", /Confused/i],
    ["Flinched", /Flinched/i]
  ];
  const statuses = map.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
  return statuses.length > 0 ? { kind: "cure_status", statuses } : null;
}

export function compileItemRule(item) {
  const delayed = /\b10 minutes after consumption\b/i.test(item.description ?? "");
  const result = {
    itemId: item.id,
    itemType: item.type,
    action: /bonus action/i.test(item.description ?? "") ? "bonus_action_or_action" : "action",
    consumed: /consumed on use/i.test(item.description ?? ""),
    delayed,
    rules: []
  };

  for (const rule of [healingRule(item), ppRule(item), statusRule(item)]) {
    if (rule) result.rules.push(rule);
  }

  if (/fainted Pokémon/i.test(item.description ?? "")) {
    result.requiresFainted = true;
  }
  if (/adjacent Pokémon/i.test(item.description ?? "")) {
    result.requiresAdjacent = true;
  }

  result.supported = result.rules.length > 0 && !delayed;
  return result;
}

function cureAll(target) {
  const cured = [];
  for (const status of STATUS_IDS) {
    if (clearStatus(target, status)) cured.push(status);
  }
  return cured;
}

export function applyItemToPokemon({ item, target, dice, moveId = null }) {
  const compiled = compileItemRule(item);
  if (!compiled.supported) {
    return {
      applied: false,
      itemId: item.id,
      reason: compiled.delayed ? "delayed_item_requires_world_time" : "item_rule_not_runtime_resolved",
      compiled
    };
  }

  if (compiled.requiresFainted && target.hp.current > 0) {
    return { applied: false, itemId: item.id, reason: "target_not_fainted", compiled };
  }
  if (!compiled.requiresFainted && target.hp.current <= 0 && compiled.rules.some((rule) => rule.kind.startsWith("heal"))) {
    return { applied: false, itemId: item.id, reason: "target_fainted", compiled };
  }

  const effects = [];
  for (const rule of compiled.rules) {
    if (rule.kind === "heal") {
      const rolled = rollDiceExpression(rule.dice, dice);
      const before = target.hp.current;
      target.hp.current = Math.min(target.hp.max, target.hp.current + rolled.total);
      effects.push({ kind: "heal", before, after: target.hp.current, amount: target.hp.current - before, rolled });
    } else if (rule.kind === "heal_fixed") {
      const before = target.hp.current;
      target.hp.current = Math.min(target.hp.max, target.hp.current + rule.amount);
      effects.push({ kind: "heal", before, after: target.hp.current, amount: target.hp.current - before });
    } else if (rule.kind === "cure_all_status") {
      effects.push({ kind: "cure_status", statuses: cureAll(target) });
    } else if (rule.kind === "cure_status") {
      const cured = rule.statuses.filter((status) => clearStatus(target, status));
      effects.push({ kind: "cure_status", statuses: cured });
    } else if (rule.kind === "restore_pp_all") {
      const restored = {};
      for (const id of target.moveIds ?? []) {
        const max = target.maxPp?.[id] ?? target.pp?.[id] ?? 0;
        const before = target.pp?.[id] ?? 0;
        const after = Math.min(max, before + rule.amount);
        target.pp[id] = after;
        restored[id] = after - before;
      }
      effects.push({ kind: "restore_pp", restored });
    } else if (rule.kind === "restore_pp_one") {
      if (!moveId || !target.moveIds?.includes(moveId)) {
        return { applied: false, itemId: item.id, reason: "move_required", compiled };
      }
      const max = target.maxPp?.[moveId] ?? target.pp?.[moveId] ?? 0;
      const before = target.pp?.[moveId] ?? 0;
      const after = Math.min(max, before + rule.amount);
      target.pp[moveId] = after;
      effects.push({ kind: "restore_pp", restored: { [moveId]: after - before } });
    }
  }

  return {
    applied: true,
    itemId: item.id,
    consumed: compiled.consumed,
    effects,
    compiled
  };
}

export function findInventoryItemIndex(inventory, requested) {
  const wanted = normalizeItemId(requested);
  return inventory.findIndex((entry) => {
    const value = typeof entry === "string" ? entry : entry?.id ?? entry?.name;
    return normalizeItemId(value) === wanted;
  });
}
