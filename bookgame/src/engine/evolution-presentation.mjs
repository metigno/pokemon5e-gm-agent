const DEFAULT_PHASES = Object.freeze([
  { id: "spiral", durationMs: 1050, effect: "sparkle_spiral_up" },
  { id: "arc", durationMs: 850, effect: "sparkle_arc_down" },
  { id: "morph", durationMs: 2100, effect: "alternating_scale_accelerating" },
  { id: "circle", durationMs: 800, effect: "sparkle_circle_in" },
  { id: "flash", durationMs: 650, effect: "sparkle_spray_flash" },
  { id: "reveal", durationMs: 900, effect: "evolved_reveal" }
]);

function clone(value) {
  return structuredClone(value);
}

export function evolutionPresentationFromResult(result, {
  reducedMotion = false,
  assetBase = "/assets/evolution"
} = {}) {
  if (!result || typeof result !== "object") throw new TypeError("Evolution result is required");

  if (result.status === "choice_required") {
    return {
      status: "choice_required",
      choice: clone(result.choice),
      presentation: null
    };
  }

  if (result.status !== "evolved") {
    throw new Error(`Unsupported evolution result status: ${result.status ?? "missing"}`);
  }

  if (result.mode === "additional") {
    return {
      status: "evolved",
      mode: "additional",
      presentation: {
        kind: "additional_pokemon",
        pokemon: clone(result.additionalPokemon),
        phases: reducedMotion
          ? [{ id: "reveal", durationMs: 0, effect: "instant_reveal" }]
          : clone(DEFAULT_PHASES.slice(-2))
      }
    };
  }

  const from = result.evolution?.from ?? result.from ?? null;
  const to = result.evolution?.to ?? result.to ?? result.pokemon?.speciesId ?? null;
  if (!to) throw new Error("Evolution presentation requires the evolved species id");

  return {
    status: "evolved",
    mode: result.mode ?? "replace",
    presentation: {
      kind: "species_evolution",
      from,
      to,
      pokemon: clone(result.pokemon),
      cancellable: false,
      assetBase,
      background: `${assetBase}/bg.png`,
      sparkle: `${assetBase}/evo_sparkle.png`,
      phases: reducedMotion
        ? [{ id: "reveal", durationMs: 0, effect: "instant_reveal" }]
        : clone(DEFAULT_PHASES)
    }
  };
}

export function evolutionPresentationPhases() {
  return clone(DEFAULT_PHASES);
}
