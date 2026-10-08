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
  world_village: "Villaggio del Mondiale",
  asteria_farm: "Fattoria del Vento",
  asteria_m1_ecology: "Habitat della prima rotta",
  asteria_rookie_ring: "Circuito Esordienti",
  valedarsena_ranger_post: "Postazione Ranger di Valedarsena",
  valedarsena_trainer_shop: "Negozio Allenatori di Valedarsena",
  valedarsena_warehouses: "Magazzini di Valedarsena",
  borgo_salice_arena: "Arena di Borgo Salice",
  borgo_salice_ranger: "Postazione Ranger di Borgo Salice",
  borgo_salice_sala_verde: "Sala Verde di Borgo Salice",
  borgo_salice_shop: "Negozio di Borgo Salice",
  m03_entry_point: "Strada verso Ferravia",
  ast_quarry: "Cava Grigia",
  ast_quarry_approach: "Accesso alla Cava Grigia",
  ast_quarry_fauna_point: "Fauna della Cava Grigia",
  ast_quarry_perimeter: "Perimetro della Cava Grigia",
  fer_city: "Ferravia",
  fer_city_archive: "Archivio di Ferravia",
  fer_city_arena: "Arena di Ferravia",
  fer_city_dispatch: "Centrale operativa di Ferravia",
  fer_city_sala_verde: "Sala Verde di Ferravia",
  fer_city_shop: "Negozio Allenatori di Ferravia",
  fer_city_station: "Stazione di Ferravia",
  fer_city_workshop: "Officine di Ferravia",
  ferrox_access: "Accesso alle Gallerie Ferrox",
  ferrox_rescue_perimeter: "Perimetro di soccorso Ferrox",
  mar_city: "Mareasale",
  mar_city_approach: "Strada per Mareasale",
  mar_city_arena: "Arena di Mareasale",
  mar_city_cargo: "Depositi del porto di Mareasale",
  mar_city_dock_office: "Ufficio del porto di Mareasale",
  mar_city_market: "Mercato di Mareasale",
  mar_city_rest: "Area riposo di Mareasale",
  mar_city_weather: "Osservatorio meteo di Mareasale",
  mar_reef_approach: "Accesso alla Barriera Azzurra",
  sal_coast: "Costa di Sale",
  sal_coast_high: "Alture della Costa di Sale",
  sal_coast_jetty: "Pontile della Costa di Sale",
  sal_coast_shore: "Spiaggia della Costa di Sale",
  alt_town: "Altacima",
  alt_town_clinic: "Centro medico di Altacima",
  alt_town_crest: "Cresta di Altacima",
  alt_town_gate: "Accesso ad Altacima",
  alt_town_logistics: "Centro logistico di Altacima",
  alt_town_market: "Mercato di Altacima",
  alt_town_weather: "Osservatorio di Altacima",
  fer_mountains: "Monti Ferrox",
  ful_ascent: "Salita all'Altopiano Fulgore",
  ful_plateau: "Altopiano Fulgore",
  alt_town_terminal: "Terminal di Altacima",
  far_ruins: "Rovine del Primo Faro",
  far_ruins_approach: "Strada delle rovine",
  far_ruins_gate: "Ingresso alle rovine del Primo Faro",
  interregional_archive: "Archivio Interregionale",
  interregional_circuit: "Circuito Interregionale",
  interregional_continental_arena: "Arena della Coppa Continentale",
  interregional_continental_hall: "Sala della Coppa Continentale",
  interregional_masters_hall: "Sala Masters",
  interregional_transit: "Terminal Interregionale",
  luminara_hub: "Luminara",
  solaria_hub: "Solaria",
  first_lighthouse_ruins: "Rovine del Primo Faro",
  meridiana_city: "Meridiana",
  meridiana_grand_arena: "Grand Arena di Meridiana",
  meridiana_grand_hall: "Grand Hall di Meridiana",
  meridiana_media_district: "Distretto media di Meridiana",
  meridiana_training_quarter: "Quartiere degli allenamenti di Meridiana",
  meridiana_international_station: "Stazione internazionale di Meridiana",
  world_accreditation_center: "Centro accrediti del Mondiale",
  world_championship_venue: "Sede del Campionato Mondiale",
  world_draw_hall: "Sala del sorteggio mondiale",
  world_main_arena: "Arena principale del Mondiale",
  world_media_center: "Centro media del Mondiale",
  world_medical_center: "Centro medico del Mondiale",
  world_registration_desk: "Segreteria iscrizioni del Mondiale",
  world_training_hall: "Sala allenamento del Mondiale",
  world_group_arena: "Arena dei gironi mondiali",
  world_knockout_hall: "Sala eliminazione diretta"
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
