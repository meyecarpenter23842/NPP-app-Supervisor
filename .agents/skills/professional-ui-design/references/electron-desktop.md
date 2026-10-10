# Electron / Windows desktop workbench

Goal: a polished professional tool that remains efficient with many rows and task windows. Think durable Windows productivity software, not a mobile app blown up onto a desktop.

## Workspace composition

- Stable sidebar or functional tabs (Accounts, Page Tabs, Scheduler, Logs, Proxy where applicable), content title, action toolbar, filter row, data grid, optional contextual details.
- Account Manager: density matters. Expose UID/username, status, category, note and operational fields in a scannable grid; never display secrets or session tokens on screen unnecessarily.
- Clear badges for automation worker state (queued, running, waiting, failed, complete) with text labels, not color alone.
- Important actions (start, pause, stop, import, export) must be predictable and never accidentally adjacent to destructive actions.

## Appearance

- Keep titlebars/window controls/native behavior in mind. Use pragmatic table row height, compact navigation, muted borders and visible keyboard focus.
- Typography supports Vietnamese labels; do not shrink every field to fit all columns at once.
- Use consistent icon style; reserve accent for primary workflow and meaningful status.
- Dialogs, context menus, progress displays and resize behavior should feel natural on Windows 10/11.

## Avoid UI hangs

Do not add synchronous heavy processing to React render. Background workers and Playwright processes must remain separate as already architected. UI polish must not block or conceal status and errors.

## Test states

Large account sets, long names, narrow window, resizing, light/dark (if supported), high-DPI, network failures, worker crash/restart, empty data and partial import errors.
