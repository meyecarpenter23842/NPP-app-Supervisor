---
name: systematic-debugging
description: Investigate bugs, red CI checks, build failures, API errors, flaky tests, regressions and production incidents systematically. Use when asked to debug, diagnose, audit a failing workflow, find root causes or propose a verified fix. Do not patch based only on symptoms.
---

# Systematic Debugging — Evidence Before Fixes

## Purpose
Diagnose technical failures using evidence and a reproducible hypothesis. The goal is the **root cause**, not a temporary masking change. Apply this skill to frontend, backend, VPS, GitHub Actions and integration issues.

## Required workflow
1. **Establish scope and authority.** Identify repository, environment, branch, affected workflow, exact revision/head SHA, expected behavior and permitted actions. Do not write, merge, deploy, restart production or migrate without authorization.
2. **Capture facts once.** Collect full relevant error text, first failed step, first useful stack trace, versions, diff relative to main, test assertion expected/actual and dependency state. Redact secrets. For CI collect all currently failed jobs before grouping root causes; do not repeatedly re-run jobs just to observe the same failure.
3. **Reproduce safely.** State the smallest reproducible case and whether reproduction was actually attempted. Production systems default to read-only inspection. If you cannot reproduce, say so; request the missing evidence rather than guessing.
4. **Trace across boundaries.** Identify where known-good data becomes invalid (browser → API → service → DB, runner → build → test, VPS → proxy → app). Compare a working path against the failing path. Classify cause vs. downstream symptoms.
5. **Form and validate a falsifiable hypothesis.** State the suspected root cause, supporting evidence, and the minimal observation/test that would disprove it. Keep observations distinct from inferences.
6. **Plan a minimal fix.** Propose a regression test (preferably failing before fix), bounded code change and a validation matrix. Do not bundle unrelated refactors. If the user allowed edits, implement only in scope.
7. **Verify and report.** Explain what was executed and what was not, with exact command/result or workflow run. Do not claim green CI, fixed production, deployment or migration without direct proof.

## Stop conditions
- A key log or dependency is missing, the evidence conflicts, or the hypothesis is not testable → stop and request evidence.
- Multiple unrelated fixes are being proposed without proof → group failures by likely common cause first.
- Two or more attempted fixes did not resolve the issue → re-evaluate architecture and assumptions before another patch.
- Any operation could delete data, expose secrets or affect production → ask for explicit approval and establish rollback/backup readiness.

## Special CI mode for this user's workflow
- Audit **current main** and **exact PR head SHA** before any proposed code change.
- Collect **failed workflow logs only**, once; group root causes and suggest one coherent fix pass.
- Never force-push or spam reruns; no automatic merge or deploy.
- When asked only to export failures, output one concise `.md` file and avoid a lengthy chat report.
- Include workflow, job, run ID, first failed step, narrow log context, first useful stack, failing test, expected/actual and PG16/17 migration matrix where relevant.
- Do not treat warnings or cancelled jobs as proven failures.

## Output styles
- **Audit only:** evidence, verified cause or uncertainty, impact and a minimal plan. No code changes.
- **Fix requested:** evidence → change → regression test → actual verification results → remaining risk.
- **CI logs only:** use `assets/red-ci-report-template.md`; never print credentials or environment variable values.

Read `references/diagnosis-checklist.md` for investigations with multiple components.
