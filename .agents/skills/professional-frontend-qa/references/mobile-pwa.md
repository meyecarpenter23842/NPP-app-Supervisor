# Mobile PWA guidelines

- Map the 3-5 most common user jobs to primary navigation. Keep important actions reachable without deep menus.
- Fixed bottom navigation must respect safe-area insets and must not cover page content. Ensure the active tab is obvious.
- Verify mobile form labels and keyboard behavior, especially viewport shrink and fixed action bars.
- Ensure taps are large and well separated; avoid hover-only behavior or tiny icon-only controls.
- Keep cart, order status, search and confirmation screens focused. Preserve state when users navigate back.
- Provide loading skeleton/progress and explicit failure/retry states; never imply submission succeeded before confirmation.
- Test widths of 320, 360, 390 and 428 CSS px where practical; test landscape on important screens.
- Test long Vietnamese names, addresses and multi-line product descriptions.
- Prevent image stretching; reserve image space to limit layout shift; use optimized assets.
- Respect online/offline constraints without pretending server-backed actions work offline.
- Verify manifest, app icons, navigation and install paths only when within task scope and actually testable.
