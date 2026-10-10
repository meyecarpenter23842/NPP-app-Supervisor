---
name: professional-ui-design
description: "Use for visual design or redesign of websites, React/TypeScript applications, ERP/admin dashboards, Retail PWAs, and Electron desktop interfaces. Create distinctive, professional visual direction, design tokens, typography, spacing, tables, forms, color and responsive layouts; improve generic-looking AI UI while preserving existing business logic. Complements frontend QA, debugging, and database skills."
---

# Professional UI Design — thẩm mỹ frontend chuyên nghiệp

This skill is a **visual design and art-direction workflow**, NOT merely a bug checklist. Use it when the user asks to create, beautify, polish, redesign, or visually critique frontend interfaces, dashboards, retail/PWA workflows, tables, forms, charts, or React/Electron applications. Also apply when the user explicitly requests an aesthetic design audit.

**Relationship to other skills:** First design with this skill; then use Professional Frontend QA for functional/accessibility/responsive quality gates. If a reported UI problem is caused by application logic, route the investigation to Systematic Debugging. Never confuse visual polish with verified bug fixes.

## Non-negotiable constraints

- Follow the user's current request, existing project rules, established branding, screenshots, and components. If a style is already approved, **refine it instead of replacing it**. Never repaint an entire app because of a small task.
- Preserve business semantics, field names, validation, roles/permissions, existing user flows, API contracts, data model, and working actions unless the user explicitly authorizes changes. **No invented data, fake actions, or dead buttons.**
- Never silently install packages, add remote fonts, change dependency locks, edit DB, run migrations, restart production, deploy, merge, force-push, or touch secrets. Obtain explicit authorization for operations beyond the task. Prefer existing local fonts and assets.
- Don't claim you inspected the rendered result, ran visual tests, used browser tooling, or measured accessibility unless actually done. If browser/image/code access is missing, state that the output is a reasoned design proposal rather than a verified result.
- If asked for audit-only or mockup-only, do **not** edit code. If asked to implement, edit only within scope and provide evidence of changes/tests when available.
- Do not copy proprietary source or depend on external CLI/asset resources from other skill repositories. This bundle is an independently authored guidance skill; links to inspirations are in `references/sources-and-scope.md`.

## Phase 1 — Understand the existing product BEFORE styling

1. Identify the surface: B2B ERP/admin dashboard, retail/mobile PWA, Electron desktop app, consumer page, or other. Identify the top 1–3 user jobs and why this screen exists.
2. Inspect available evidence: repository styling conventions (`package.json`, tokens, tailwind config, CSS vars, reusable components), current screenshots, target viewport, navigation, content density, Vietnamese language requirements, brand colors.
3. Separate **facts from assumptions**. Ask a concise question only if an essential product constraint cannot be inferred. Otherwise declare a reasonable visual direction without stalling.
4. Preserve existing navigational hierarchy and high-frequency work steps. Identify clutter, inconsistencies, weak typographic hierarchy, alignment issues, excessive cards, table density, and interaction states.
5. Read the applicable reference:
   - Visual identity and aesthetic anti-patterns → `references/visual-direction.md`
   - Tokens, font, palette, spacing, component states → `references/design-system.md`
   - Warehouse/ordering/reporting and other complex enterprise interfaces → `references/enterprise-erp.md`
   - Mobile-first retail/PWA → `references/retail-pwa.md`
   - Electron/React Windows desktop → `references/electron-desktop.md`
   - Final inspection and acceptance → `references/visual-review.md`

## Phase 2 — Make visual decisions deliberately

Define a brief design direction before implementation. Keep to at most 6 lines:
- Audience and dominant workflow (e.g., warehouse employee looking up stock rapidly).
- Visual personality in 3 adjectives (e.g., precise, trustworthy, energetic).
- One coherent typography strategy with a Vietnamese-capable font stack.
- Palette roles: canvas, surfaces, foreground, muted, borders, primary, success, warning, danger.
- Information density and layout rhythm (compact admin vs spacious retail).
- ONE restrained signature detail (e.g., refined section headers, purposeful accent, distinct active tabs). Avoid decorative flourishes competing with data.

Do not let the agent default to generic AI design: oversized pill cards, homogeneous 3-column cards, saturated purple gradients, random glow, excessive shadows/glassmorphism, icons replacing descriptive text, emoji as primary icons, huge empty hero sections inside internal applications, or unrelated font mixtures. These are **warnings to evaluate**, not universal bans.

## Phase 3 — Build or refine a real design system

- Reuse existing tokens/components first; change styles through tokens and shared components rather than one-off CSS hacks. Document intentional exceptions.
- Establish clear hierarchy: page title and one main action; section headings; labels; help text; strong numeric/data emphasis. Make tables and forms readable without forcing whitespace.
- Control alignment: predictable left edges, consistent baselines, logical spacing increments (e.g., 4/8-based), consistent border treatments, restrained radii, coherent icon sizes.
- Plan density around the device and task: compact, scannable on desktop admin; finger-friendly on handheld retail.
- Maintain functional states: hover, focus-visible, active, selected, disabled, loading, empty, error, validation, success, and destructive confirmation.
- Plan responsive behavior; do not shrink a wide desktop table until unreadable. Prefer card/list transformations or prioritized columns on small screens.
- Treat accessibility as part of aesthetics: legible contrast, visible focus, semantic labels, keyboard path, readable Vietnamese accents, reduced motion.

## Phase 4 — Implement only when requested

1. Respect the repo's framework and existing primitives (React, TypeScript, Vite, design libraries); avoid unnecessary UI dependencies.
2. Make targeted and coherent changes. Prefer shared token fixes for systemic visual issues; preserve forms, events, routes, API contracts and business logic.
3. Where a new UI needs data, render meaningful states instead of placeholder statistics or fake graphs.
4. Write descriptive labels in Vietnamese where the product is in Vietnamese. Use realistic label length to avoid clipping; test currency, quantities and dates.
5. Do not introduce inaccessible color-only state, animation blocking actions, slow-loading giant assets, layout shifts, or huge component rewrites without need.

## Phase 5 — Inspect, critique, refine (bounded)

Use `references/visual-review.md` to inspect **rendered** results, if browsing/screenshots are available:
- Review desktop and mobile in the same pass; for desktop apps review their real window dimensions.
- Find the **three most noticeable visual problems** first, group edits, and fix them together.
- Recheck critical screens once after edits, rather than endless aesthetic tweaking.
- Check content states: long Vietnamese strings, many rows, zero results, validation error, slow loading, dialogs, and high-density view.
- Don't mark something 'passed' without observation. If only source code is available, report 'not visually verified'.

## Required handoff

For a critique-only request: return a brief prioritized audit with **current issue → visual consequence → concrete design recommendation**, and optionally a proposed style direction. Never claim code was changed.

For implementation: summarize visual direction, main style changes, preserved behavior, viewport/state checks run (and not run), and any remaining limitations. If user requires a file/report rather than long chat, honor that formatting requirement.

## Practical default for owner's projects

- **NPP-Platform (Company / ERP):** clarity, speed, trustworthy data, table ergonomics, status visibility, measured visual refinement; see `references/enterprise-erp.md`.
- **Retail PWA:** thumb-friendly product discovery, cart, orders, status and bottom navigation; see `references/retail-pwa.md`.
- **Page Auto (Electron desktop):** efficient Windows-style workbench, dense grids and non-blocking feedback; see `references/electron-desktop.md`.
- **Workflow restrictions:** audit `main`/target PR SHA before source changes when relevant. For CI issues, gather failed evidence once, group root causes, do not rerun/merge/deploy unless explicitly requested. This design skill does not override any stricter project instructions.
