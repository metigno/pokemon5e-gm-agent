import { evaluateCondition } from "./conditions.mjs";
import { mapIllustrationForLocation, mapIllustrationFormat } from "../assets/map-illustrations.mjs";

// Schematic map of authored locations only. No new world graph, distances or shortcuts.
const LOCATION_LABELS = Object.freeze({
  asteria_campus: "Campus Licenze",
  asteria_campus_exit: "Uscita del Campus",
  asteria_ginestre: "Via delle Ginestre",
  asteria_farm_road: "Strada per la Fattoria del Vento",
  valedarsena_road: "Strada per Valedarsena",
  valedarsena_city: "Valedarsena",
  valedarsena_center: "Centro Pokémon di Valedarsena",
  valedarsena_job_board: "Bacheca incarichi di Valedarsena",
  valedarsena_arena: "Arena Civica di Valedarsena",
  valedarsena_trainer_street: "Via Allenatori di Valedarsena",
  asteria_mistwood: "Bosco Bruma",
  borgo_salice: "Borgo Salice",
  mir_marsh_approach: "Strada per Palude Mirto",
  world_village: "Villaggio del Mondiale"
});

export function locationLabel(locationId) {
  const id = String(locationId ?? "");
  return LOCATION_LABELS[id] ?? id.replace(/_/g, " ").replace(/\b[a-zà-ÿ]/g, (letter) => letter.toUpperCase());
}

// These are exactly the choices exposed by the current authored scene. The
// existing engine, not the map, validates and resolves their costs and effects.
export function buildTravelMap(state, story) {
  const currentLocationId = state?.world?.locationId;
  if (!currentLocationId || typeof currentLocationId !== "string") {
    return { nodes: [], currentLocationId: null, schematic: true };
  }

  const locations = new Map();
  function add(id, visited = false) {
    if (typeof id !== "string" || !id || id.length > 120) return;
    if (!locations.has(id)) {
      const illustrationId = mapIllustrationForLocation(id);
      locations.set(id, { id, label: locationLabel(id), illustrationId, illustrationFormat: mapIllustrationFormat(illustrationId), visited, current: id === currentLocationId, routes: [] });
    } else if (visited) {
      locations.get(id).visited = true;
    }
  }

  for (const id of state.world.visitedLocationIds ?? []) add(id, true);
  add(currentLocationId, true);

  if (!state.pending && !story?.pending && !story?.trainerProgression) {
    for (const choice of story?.choices ?? []) {
      // No combat/check/ecology/random-result edge can ever become a map shortcut.
      if (choice.combat || choice.check || choice.save || choice.ecology ||
          !evaluateCondition(state, choice.conditions)) continue;
      const locationEffects = (choice.effects ?? []).filter((effect) =>
        effect?.type === "set_location" && typeof effect.locationId === "string"
      );
      if (locationEffects.length === 0 || typeof choice.goto !== "string") continue;
      // A choice may cross several authored waypoints; the last location is
      // where the actual runtime leaves the player.
      const destination = locationEffects.at(-1).locationId;
      add(destination);
      locations.get(destination).routes.push({
        choiceId: choice.id,
        label: choice.text,
        timeCostMinutes: Number.isFinite(choice.timeCostMinutes) ? choice.timeCostMinutes : null
      });
    }
  }

  const nodes = [...locations.values()].sort((a, b) =>
    Number(b.current) - Number(a.current) ||
    Number(Boolean(b.routes.length)) - Number(Boolean(a.routes.length)) ||
    a.label.localeCompare(b.label, "it")
  );

  return { currentLocationId, schematic: true, nodes };
}
