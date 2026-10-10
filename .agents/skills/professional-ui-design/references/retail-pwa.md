# Retail PWA: mobile-first design and interaction

Goal: reduce taps and confusion in high-frequency ordering, cart and delivery flows; keep a branded, polished visual feel.

## Above-the-fold hierarchy

- Give search a first-class, discoverable placement if product finding is a dominant action.
- Visible product image/name/variant/price/unit/stock state; avoid deceptive CTA on unavailable items.
- Cart count and total accessible as relevant, with actions large enough for thumb usage.
- Bottom navigation is reserved for 3–5 stable top-level destinations only when product design calls for it; show active state, icons plus labels, proper safe-area padding.
- Avoid giant hero banners, decorative gradients or nested tabs pushing products beneath the viewport.

## Product and order details

- Cards must handle long Vietnamese product names, variants, discounts, stock errors and multiple SKUs.
- Price should be legible and unambiguous. Distinguish original vs sale prices without relying on a color change alone.
- Stepper quantity, add-to-cart, checkout and order status must show immediate feedback, disabling and pending states.
- For ordered products, use clear fulfillment and return statuses with readable timelines; do not invent outcomes.
- Include empty cart, poor connection, retry and partial error states. Offline indicators must reflect actual application capabilities.

## Responsive / visual polish

- Test narrow devices (e.g., 360px), mid mobile (390/430px), tablet and desktop view; landscape where important.
- Prevent clipped text and buttons behind fixed bottom nav; test on-screen keyboard interactions.
- Use consistent image ratios and graceful fallback if images missing; no forced stretch.
- Prefer restrained motion, soft feedback and predictable transitions over gimmicky effects.

## Implementation constraints

Preserve actual cart math, SKU variations, pricing, taxes, business permissions, fulfillment rules and network API contracts. 'Pretty' checkout that misstates price or fulfillment is an unacceptable regression.
