# UI audit checklist

Check each item as PASS / FAIL / NOT TESTED with a link to the actual evidence when possible.

## Visual consistency
- Hierarchy answers: Where am I? What can I do? What matters now?
- Spacing is consistent across same-level screens and components.
- Font sizes, weight, line-height and Vietnamese accents are readable.
- Colors/icons have stable semantic meaning; warnings are not color-only.
- Buttons, badges, panels, dialogs, toasts and filters follow shared component patterns.
- No gratuitous gradient, universal shadow, nested-card syndrome, uneven padding or meaningless filler.

## Responsiveness
- No horizontal body scroll unless explicitly intended.
- Important actions remain discoverable at mobile/tablet/desktop widths.
- Tables, charts, menus, dialogs, drawers and date pickers remain usable.
- Sticky/fixed navigation doesn't cover the last row or bottom call to action.
- Images scale without clipping key content or altering their aspect ratio.

## Functionality & states
- Each visible control has a real action and appropriate state.
- Keyboard Tab, Enter, Escape and focus styles work where appropriate.
- Forms have labels, field errors and recoverable submission behavior.
- Loading, zero results, invalid input, server error and insufficient permissions are distinguishable.
- Long text, large numbers, many list rows and very small data sets are handled.
- Destructive operations cannot be triggered by ambiguous UI and are not reported successful prematurely.

## Performance, accessibility and handoff
- Contrast and focus are visible. Appropriate alt text and accessible names exist.
- Motion respects reduced-motion setting; large content doesn't unexpectedly jump.
- Run the available project's checks; record exact commands/results.
- Save actual screenshots or browser evidence if tools permit; otherwise mark NOT TESTED.
- Record remaining issues and distinguish code complete from production verified.
