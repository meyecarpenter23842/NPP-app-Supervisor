# Enterprise UI: warehouse, sales, inventory, orders and operations

## Information architecture
- Lead with the task users need to perform, not a decorative hero section.
- In dense workflows, favor a clear top action bar, search/filter row, main data grid, and contextual details.
- Use separate visual treatments for information (read-only), actions (interactive), warnings (caution), and destructive operations.
- Retain recognizable navigation labels; avoid hiding common actions inside mysterious icons.

## Data grids
- Keep important identifiers, customer/product names, status, counts, dates and actions visible in sensible priority.
- Right-align numeric values and make number/units and currencies explicit.
- Preserve filtering/sorting/pagination state where workflows need it; surface applied filters.
- Make empty results distinguishable from load errors or permission denial.
- For narrow viewports, use a deliberately designed condensed list/row-detail pattern or controlled table scrolling, not squeezed unreadable columns.

## Operational workflow
- Display status transitions honestly: requested, processing, partially completed, completed, failed.
- Require confirmation where an action is irreversible, and report the exact result after the server responds.
- Explain what blocked an action and how an authorized user can resolve it.
- Never optimistically show `Completed` while a backend mutation remains pending or failed.

## Visual restraint
- Prefer one or two clear surfaces rather than a card for every label.
- Give priority to text legibility, column rhythm and functional density.
- Use one icon family and repeated action labels across screens.
- Use charts only where they clarify an actual decision; do not fabricate KPIs or meaningless graphs.
