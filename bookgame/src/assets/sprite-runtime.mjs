export function normalizeSpriteId(species, form = null) {
  if (typeof species !== "string" || !species.trim()) throw new TypeError("species is required");
  let id = species.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (form) {
    const f = String(form).trim().toLowerCase();
    const regional = { hisuian: "hisui", alolan: "alola", galarian: "galar", paldean: "paldea" };
    if (regional[f]) id += "-" + regional[f];
    else if (f === "mega") id = "mega-" + id;
    else id += "-" + f.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  if (id.includes("gmax") || id.includes("gigantamax")) {
    throw new Error("Gigantamax sprites are excluded from the Pokemon 5e Bookgame");
  }
  return id;
}

export function validateSpriteMap(map) {
  const errors = [];
  if (!map || map.format !== "p5e-librogame-sprite-runtime-map") errors.push("invalid format");
  for (const [id, entry] of Object.entries(map?.sprites ?? {})) {
    if (id.includes("gmax") || id.includes("gigantamax")) errors.push(id + ": Gigantamax is forbidden");
    for (const role of ["battleFront", "battleBack", "icon"]) {
      if (!entry.assets?.[role]) errors.push(id + ": missing " + role);
    }
  }
  return { valid: errors.length === 0, errors };
}
