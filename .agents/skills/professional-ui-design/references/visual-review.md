# Visual review / acceptance checklist

## Two distinct review passes

**A. Aesthetic craft:** Does this feel purpose-built rather than an AI template?
- [ ] Clear visual hierarchy: primary user job obvious in 3 seconds.
- [ ] Type: well-chosen weight/size/line height, Vietnamese diacritics render cleanly.
- [ ] Layout: coherent left edges, grids and section spacing; no pointless nested cards.
- [ ] Color: intentional semantic roles, consistent surfaces, one clear primary action.
- [ ] Polish: icon consistency, dividers, corner radii, hover/focus, empty/loading states.
- [ ] Data density appropriate for target user and device.

**B. Real-world usability:** Does the design work with actual application content?
- [ ] Desktop widths and narrow mobile checked as relevant.
- [ ] Long labels, Vietnamese currency, large numbers and many rows do not break layout.
- [ ] Keyboard navigation, focus, form errors, disabled and loading states visible.
- [ ] Table has meaningful overflow/fallback on small screens.
- [ ] No action clipped/blocked by sticky header, footer or keyboard.
- [ ] Text/status contrast acceptable; reduced motion respected.
- [ ] No invented values, routes, buttons or status logic.

## Visual scoring rubric (0–5 each)

1. Composition and information hierarchy
2. Typography and readability
3. Palette coherence and contrast
4. Spacing, alignment and craft
5. Data/forms/table ergonomics
6. Responsive and UI state design
7. Product identity (not generic template)

If any criterion is <=2, identify a concrete fix instead of claiming 'professional'. Scores are *subjective expert judgments*, not automated measurements. Only score inspected surfaces; don't fabricate visual observations.

## How to inspect when tools exist

Capture one representative desktop view and one mobile view per key screen, plus main component states. Compare to baseline and identify the three largest visible issues. Group changes in one bounded iteration, verify once more. If inspection tools do not exist, provide checklist and specify 'not verified with rendered UI'.

## Short handoff format

- **Visual direction:** [3 style adjectives + what changed]
- **High-impact changes:** [max 3–5]
- **Business logic preserved:** [explicitly what was not touched]
- **Verified:** [actual viewport and state results]
- **Not verified / open risk:** [honest limits]

Audit-only format: priority | screen/component | issue observed | visual impact | recommended change | evidence (screenshot/code if present).
