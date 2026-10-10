# Design system: concrete, reusable guidance

## Token roles, never arbitrary values per screen

Adapt to existing repository tokens first. If creating a new system, define:
- `--color-canvas`, `--color-surface`, `--color-surface-raised`, `--color-text`, `--color-text-muted`, `--color-border`.
- `--color-primary`, `--color-primary-hover`, `--color-focus`, `--color-success`, `--color-warning`, `--color-danger` and subtle fills.
- `--radius-sm/md/lg`, `--space-*`, `--shadow-float`, `--font-body`, `--font-heading`, `--font-mono` or tabular numeric treatment.

A role-based palette is more durable than 'blue everywhere'. Typical enterprise direction: quiet off-white/slate neutral surfaces + one purposeful accent (blue, deep teal or indigo depending on brand) + semantic colors. Don't force a preset over an established identity. Respect contrast and dark mode if present.

## Typography

- Prefer the project's existing fonts. Vietnamese diacritics and numeric glyph quality matter; if picking new, confirm Vietnamese support. Use system fallback rather than stealth network imports.
- Build an intentional scale for page titles, section headings, table headings, body, help, compact labels. Keep line height legible; avoid making every piece of text 14px in the same weight.
- Align prices, quantities, decimals and dates; use `font-variant-numeric: tabular-nums` when appropriate.
- Sentence case for Vietnamese action labels; avoid all-caps in large blocks.
- Do not make crucial helper or status labels tiny just to fit a pretty composition.

## Spacing and layouts

- Choose a consistent spacing scale, preferably 4-based or 8-based; group related controls more tightly than unrelated sections.
- Keep forms constrained to readable widths; use a clear multi-column desktop layout only when the task benefits.
- Maintain consistent page gutters within a product.
- Avoid nested card framing except when a distinct semantic/elevation boundary is needed.

## Component contracts

- **Buttons:** primary/secondary/ghost/destructive hierarchy; label describes the action; busy state; min target appropriate to device.
- **Inputs:** visible label and error; helpful placeholder not a substitute for label; clear focus and disabled states.
- **Navigation:** active state unmistakable; location and back path clear.
- **Dialogs:** descriptive title, escape/cancel path, safe destructive-action confirmation, proper focus.
- **Tables:** aligned headers/cells, readable numbers, sorting/filter visibility, horizontal overflow when necessary, pinned context if high-density.
- **Cards:** use for real objects or summaries, not as an automatic wrapper for every row.
- **Charts:** annotate units, legend, date period, source/empty/loading/error states. Never invent data.

## Accessibility is a design quality signal

- Aim for WCAG AA text contrast: 4.5:1 normal text and 3:1 for large text; non-text controls need distinguishable boundaries. Evaluate actual colors rather than assuming.
- Keyboard focus visibly differentiated from hover. Don't rely only on color to encode status.
- Touch targets should be comfortable for handheld use (commonly ~44 CSS px).
- Honor reduced-motion preferences; animations should clarify transitions, not block operations.

## Change management

If repo already has a component library (e.g., shadcn/Radix/MUI/custom), extend it rather than building incompatible duplicates. Consolidate repeated style changes into shared tokens only when scoped and safely verifiable.
