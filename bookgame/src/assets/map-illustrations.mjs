// Decorative offline location images. Never infer geography, legal routes or
// travel duration from these IDs; the authored scene graph remains authoritative.
const BY_LOCATION = Object.freeze({
  "asteria_campus": "m01-campus",
  "asteria_campus_exit": "m01-campus",
  "asteria_farm": "m01-farm",
  "asteria_farm_road": "m01-country-road",
  "asteria_ginestre": "m01-ginestre",
  "asteria_m1_ecology": "m01-ecology",
  "asteria_mistwood": "m01-mistwood",
  "asteria_rookie_ring": "m01-ring",
  "valedarsena_arena": "m01-arena",
  "valedarsena_center": "m01-center",
  "valedarsena_city": "m01-valedarsena",
  "valedarsena_job_board": "m01-board",
  "valedarsena_ranger_post": "m01-ranger",
  "valedarsena_road": "m01-country-road",
  "valedarsena_trainer_shop": "m01-shop",
  "valedarsena_trainer_street": "m01-street",
  "valedarsena_warehouses": "m01-warehouses",
  "borgo_salice": "m02-borgo-salice",
  "borgo_salice_arena": "m01-arena",
  "borgo_salice_ranger": "m01-ranger",
  "borgo_salice_sala_verde": "m02-sala-verde",
  "borgo_salice_shop": "m01-shop",
  "m03_entry_point": "m02-east-road",
  "mir_marsh_approach": "m02-mirto",
  "ast_quarry": "m03-quarry",
  "ast_quarry_approach": "m03-quarry-approach",
  "ast_quarry_fauna_point": "m01-ecology",
  "ast_quarry_perimeter": "m03-quarry-approach",
  "fer_city": "m03-ferravia",
  "fer_city_archive": "m03-archive",
  "fer_city_arena": "m01-arena",
  "fer_city_dispatch": "m01-ranger",
  "fer_city_sala_verde": "m02-sala-verde",
  "fer_city_shop": "m01-shop",
  "fer_city_station": "m03-station",
  "fer_city_workshop": "m03-workshop",
  "ferrox_access": "m03-ferrox",
  "ferrox_rescue_perimeter": "m03-ferrox-rescue",
  "mar_city": "m04-mareasale",
  "mar_city_approach": "m04-coastal-road",
  "mar_city_arena": "m01-arena",
  "mar_city_cargo": "m04-docks",
  "mar_city_dock_office": "m04-docks",
  "mar_city_market": "m04-market",
  "mar_city_rest": "m01-center",
  "mar_city_weather": "m04-weather",
  "mar_reef_approach": "m04-reef",
  "sal_coast": "m04-coast",
  "sal_coast_high": "m04-cliffs",
  "sal_coast_jetty": "m04-jetty",
  "sal_coast_shore": "m04-coast"
});

export const APPROVED_MAP_ILLUSTRATION_IDS = new Set(["m01-ginestre","m01-valedarsena"]);
export const APPROVED_MAP_SVG_IDS = new Set([
  "m01-arena",
  "m01-board",
  "m01-campus",
  "m01-center",
  "m01-country-road",
  "m01-ecology",
  "m01-farm",
  "m01-mistwood",
  "m01-ranger",
  "m01-ring",
  "m01-shop",
  "m01-street",
  "m01-warehouses",
  "m02-borgo-salice",
  "m02-east-road",
  "m02-mirto",
  "m02-sala-verde",
  "m03-archive",
  "m03-ferravia",
  "m03-ferrox",
  "m03-ferrox-rescue",
  "m03-quarry",
  "m03-quarry-approach",
  "m03-station",
  "m03-workshop",
  "m04-cliffs",
  "m04-coast",
  "m04-coastal-road",
  "m04-docks",
  "m04-jetty",
  "m04-mareasale",
  "m04-market",
  "m04-reef",
  "m04-weather"
]);

export function mapIllustrationForLocation(locationId) {
  return BY_LOCATION[locationId] ?? null;
}

export function mapIllustrationFormat(illustrationId) {
  if (APPROVED_MAP_ILLUSTRATION_IDS.has(illustrationId)) return "png";
  if (APPROVED_MAP_SVG_IDS.has(illustrationId)) return "svg";
  return null;
}
