# P1 contract — danh mục chuẩn, bảng giá theo NPP và tra cứu

**Issue:** #37. **Parent:** Master Plan merged PR #36, Issue #19. **Scope:** SQLite additive 005 and typed backend; no price import, Sales revenue inference, UI rebuild, production operations.

## Data model
- Existing "products" is the canonical **SKU** with immutable primary key referenced by existing facts. Existing "product_families" is the parent product; "sku_aliases" is distributor+external-code+source-unit+business-date mapping. "sku_unit_conversions" is explicit ratio (numerator/denominator).
- "catalog_categories", "catalog_brands", "catalog_units" are lightweight lookup tables. Backfill from legacy family.category/brand and SKU/base/source units; preserve legacy text; family.category_id/brand_id nullable FKs. Do not deduce missing classifications, historical SKU names, or new SKUs from NPP codes.
- "price_lists": distributor, code, explicit price_type, name, active, VND, inclusive effective_from/to.
- "price_list_items": list, canonical SKU, registered unit, VND integer amount, inclusive effective_from/to, active, optional source, immutable ID. Reject overlapping *active periods within the same list/SKU/unit*. Different lists in same NPP/type can coexist; resolution reports AMBIGUOUS instead of picking an arbitrary/default list. Updater must close old interval (inclusive) before adding next, not silently overwrite.
- No fixed types BUY/SELL hardcoded; price_type is a controlled code chosen by caller. No percentage discount, customer/promotion rules, tax guessing, channel-priority resolver or automatic conversion between two price units in P1.

## Lookup contract
Input (distributorId, rawSkuCode, rawUnit, businessDate, optional priceType).
1. Resolve alias at the given day, detect NOT_FOUND/AMBIGUOUS, return canonical SKU, SKU name, parent name, base unit, explicit conversion ratio.
2. With priceType, find *exact-source-unit* reference price for the same NPP and day. One price => FOUND with price list source; none => NOT_FOUND; more than one => AMBIGUOUS. Without priceType => NOT_REQUESTED. All amounts are reference prices only: never infer a Sale In/Out amount or transaction.
3. Keep codes including leading zero as TEXT; use inclusive temporal bounds; no cross-NPP fallback.
4. P2 imports catalog/price Excel into the same domain and gives real UI. P1 typed native API is intentionally not advertised as user-facing UI functionality.

## Database update
- 001-004 checksums unchanged. Rust runner backs up old file before upgrade and adds 005 in one transaction with ledger + foreign-key/integrity checks. New DB applies 001→005 in order.
- Tests must cover legacy upgrade with data, FK and ID preservation; price period overlap, adjacent date bounds, NPP codes, price absence/ambiguity, 0-prefix codes and calendar-valid dates. Existing sales facts unchanged.
- Review & CI gate before merge, and owner permission required to merge. Windows installer smoke required by repo workflows. Release R2 and local F: not modified.

## Pending owner policy decisions
- Whether multiple price lists should have explicit priority, and which price type is default for Sales In/Out. In P1 resolver requires a selected priceType and refuses to choose on ambiguity.
- The genuine 1,446-row price workbook and source units have not been checked; field contract remains customizable for P2.
