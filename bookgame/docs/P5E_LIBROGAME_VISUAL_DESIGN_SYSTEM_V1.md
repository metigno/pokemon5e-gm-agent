# P5E LIBROGAME — VISUAL DESIGN SYSTEM V1

**Status:** LOCKED VISUAL REFERENCE  
**Direction:** **modern Pokémon RPG + illustrated book**  
**Companion:** `P5E_LIBROGAME_UI_UX_MASTER_SPEC_V1.md`

## 1. Visual language
- Blue = primary interaction/action.
- Gold = emphasis, achievement and premium accent.
- Light paper/surface layers keep story content readable.
- Narrative typography is visually distinct from technical UI.
- Pokémon type colors remain semantic and separate from the global action palette.
- Avoid flat black/white management-dashboard styling.

## 2. Canonical tokens
These values match the implemented Vertical Slice V1 CSS baseline.

```css
:root {
  --ink: #1c2b43;
  --ink-soft: #34455e;
  --action: #2a64b4;
  --action-pressed: #1f4e8c;
  --gold: #c79a3b;
  --paper: #f7f4ec;
  --surface: #ffffff;
  --surface-soft: #f3f5f7;
  --bg: #e9eef5;
  --line: #d4dce7;
  --muted: #5c6570;
  --danger: #aa2f2f;
  --success: #2a7a54;
  --shadow: 0 16px 40px rgba(28, 43, 67, .12);
  --radius-lg: 22px;
  --radius-md: 14px;
  --radius-sm: 10px;
}
```

## 3. Typography
UI chrome:
`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

Narrative body:
`Georgia, "Times New Roman", serif`.

Narrative body uses generous line height and must remain visually calmer than controls/status data.

## 4. Layout
- Mobile-first single primary column.
- Maximum shell width: 880px in the V1 implementation.
- Sticky compact top bar.
- Card-based primary surfaces.
- Bottom navigation on compact layouts.
- Drawers for secondary detail rather than stacking every system in one screen.
- Use whitespace and grouping before adding borders.

## 5. Radius and elevation
- Large content card: 22px.
- Standard component/card: 14px.
- Compact control: 10px.
- Main shell shadow uses `--shadow`.
- Status pills may use a full pill radius.

## 6. Core components
### ChoiceButton
- Full-width, thumb-friendly.
- Clear selected/disabled states.
- Disabled immediately after selection while the action resolves.
- Choices are not rendered/activated until narrative reveal completes.

### StatusChip
- Compact, high-legibility state label.
- Gold variant reserved for meaningful emphasis.

### StoryCard
- Optional authored/environment art area.
- Narrative panel below/over the art.
- Progressive text caret uses the action color.
- Story copy is not presented as a terminal/debug log.

### DataCard
Used in Trainer, Pokémon, Inventory and Journal for grouped detail.

### Drawer
Secondary information surface that preserves the current Story/Battle state underneath.

## 7. Progressive text — LOCKED
- Normal: **32 ms/character**.
- Punctuation pauses longer than ordinary characters.
- Tap/click or **Mostra tutto** completes the current block.
- Choices appear only after completion.
- Speeds: **Lenta / Normale / Veloce / Istantanea**.
- Reduced-motion preference forces instant mode.
- The caret must never be the only indicator that more content exists.

## 8. Story mockup contract
Hierarchy:
1. context/location;
2. authored narrative;
3. optional roll/result summary without hidden DC;
4. meaningful player choices.

Do not mix Trainer statistics or inventory controls into the story card.

## 9. Battle mockup contract
Hierarchy:
1. encounter/round;
2. opponent state;
3. active Pokémon state;
4. legal moves/switches;
5. end-turn control when legal;
6. concise combat log.

The visual layer never predicts hit chance/outcome unless the runtime explicitly exposes a legal, intended value.

## 10. Trainer mockup contract
Show Trainer identity first, then abilities/skills, then deeper rules information through progressive disclosure.

Pokémon 5e fields must remain complete even if split across tabs/sections.

## 11. Pokémon mockup contract
Roster overview stays compact. Pokémon detail is opened intentionally and contains runtime-backed mechanical detail.

## 12. Loading / error / locked
- Loading: preserve layout and context; do not flash unrelated screens.
- Error: concise player-facing explanation and recovery action.
- Locked/disabled: visually distinct and semantically disabled.
- Empty: explain the absence rather than leaving a blank card.

## 13. Responsive
- Touch-first controls.
- Compact status chips wrap.
- Cards become edge-conscious on narrow displays.
- Desktop may widen content but must not become a dense management dashboard.

## 14. Accessibility
- Keyboard focus visible.
- Semantic buttons/labels.
- Contrast sufficient for body text and controls.
- No color-only state.
- Reduced motion supported.
- Text scaling must not hide choices or primary actions.

## 15. Definition of Done
A visual component is accepted when:
- it uses shared tokens;
- it has documented states;
- it remains usable on mobile;
- it meets accessibility requirements;
- it does not leak engine terminology;
- it preserves the UI/runtime contract;
- progressive narrative behavior remains intact.
