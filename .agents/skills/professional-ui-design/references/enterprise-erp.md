# Enterprise / ERP / Company interfaces

Goal: look professionally designed *while making daily tasks faster*. Warehouse, ordering, debt, stock reports and logistics screens are not marketing landing pages.

## Layout priorities

1. Orientation: strong page title, breadcrumb or section context only where needed, one salient primary action.
2. Fast filtering: visible search, clear advanced filters, filter chips or count, explicit reset.
3. Data: legible, dense and predictable tables; optional compact mode; stable row heights, alignment, sortable states, sufficient headers.
4. Actions: row action placements predictable; disabled/permission states explain why; dangerous actions separated.
5. Feedback: saving, success, failure, no matching data and permissions always have meaningful presentation.

## Data-rich visual craft

- Numeric columns right-aligned with units and consistent separators; names left-aligned; dates consistent.
- Use stronger font emphasis for amounts that drive decisions, not for every number.
- Treat columns as meaningful groups (SKU, unit, quantity, price, status, updated).
- Reduce visual noise from borders and status badges. One useful badge is better than five tiny indicators per row.
- When sections are adjacent, one clean surface can work better than 5 nested cards.
- For inventory or order status, keep text labels alongside colors so color-blind users can interpret states.

## Workflow-specific checks

- Order screen: item scanning/search speed, SKU and unit ambiguity, per-line edits, totals, fulfillment status, print actions.
- Warehouse: location / lot / expiry hierarchy, stock units, warnings, overflow and large datasets.
- Logistics: journey status, undelivered/partial returns, clear primary actions and error paths.
- Reporting: period controls, filters, currency formatting, meaningful comparison periods, no fictional metrics.

## Visual direction examples

Precise / calm / accessible: restrained neutral backgrounds, one brand accent, subtle dividers, compact but readable controls, moderate radius, strong typography. Keep very different functions visually grouped without repetitive cards. Do not reuse arbitrary marketing gradients.

## Protect scope

No change to accounting logic, privileges, quantities, API calls, status transitions, or database behavior solely for a visual improvement. If redesign requires changing flow or schema, propose it separately and obtain approval.
