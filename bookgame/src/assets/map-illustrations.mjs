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
  "mir_marsh_approach": "m02-mirto"
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
  "m02-sala-verde"
]);

export function mapIllustrationForLocation(locationId) {
  return BY_LOCATION[locationId] ?? null;
}

export function mapIllustrationFormat(illustrationId) {
  if (APPROVED_MAP_ILLUSTRATION_IDS.has(illustrationId)) return "png";
  if (APPROVED_MAP_SVG_IDS.has(illustrationId)) return "svg";
  return null;
}
