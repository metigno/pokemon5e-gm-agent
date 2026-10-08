// Decorative CC0 OpenRPG illustrations. Never infer geography or travel edges
// from image selection; the authored scene and runtime remain authoritative.
const BY_LOCATION = Object.freeze({
  asteria_ginestre: "m01-ginestre",
  valedarsena_road: "m01-ginestre",
  valedarsena_city: "m01-valedarsena",
  valedarsena_center: "m01-valedarsena",
  valedarsena_job_board: "m01-valedarsena",
  valedarsena_arena: "m01-valedarsena",
  valedarsena_trainer_street: "m01-valedarsena"
});

export const APPROVED_MAP_ILLUSTRATION_IDS = new Set([
  "m01-ginestre", "m01-valedarsena"
]);

export function mapIllustrationForLocation(locationId) {
  return BY_LOCATION[locationId] ?? null;
}
