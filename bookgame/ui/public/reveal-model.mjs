export const TEXT_SPEEDS = Object.freeze({
  slow: 52,
  normal: 32,
  fast: 18,
  instant: 0
});

export function normalizeTextSpeed(value) {
  return Object.hasOwn(TEXT_SPEEDS, value) ? value : "normal";
}

export function revealDelayForCharacter(character, speed = "normal") {
  const base = TEXT_SPEEDS[normalizeTextSpeed(speed)];
  if (base === 0) return 0;
  if (character === "\n") return base + 70;
  if (/[.!?]/.test(character)) return base + 95;
  if (/[,;:]/.test(character)) return base + 50;
  return base;
}

export function storyParagraphs(story) {
  if (Array.isArray(story?.stitches) && story.stitches.length > 0) {
    return story.stitches
      .map((stitch) => String(stitch?.text ?? "").trim())
      .filter(Boolean);
  }

  return String(story?.text ?? "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}
