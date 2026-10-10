# Root cause investigation checklist

## Confirm identity and reproducibility
- Which repo, revision, environment and deployment are involved? Is the observed environment the same as the tested environment?
- What should happen, what actually happened, and exactly when was it last known to work?
- Is the failure deterministic, timing-dependent, or correlated with data volume?
- Which command/test reproduces it without touching live user data?

## Trace data and code paths
1. Start at the first failing boundary, not at the last visible error banner.
2. Follow the failing input backward to its origin; track schema, type, IDs and state transitions.
3. Compare a successful request/job with a failed one on the same revision where possible.
4. Inspect the smallest relevant diff and any infrastructure change (runtime, DNS, proxy, DB, env-variable *names*).
5. Separate logs of secondary retries/timeouts from the earliest causal error.
6. If uncertain, suggest one safe diagnostic observation (not a speculative fix).

## Typical evidence by layer
| Layer | Useful evidence | Common traps |
|---|---|---|
| Browser/PWA | Console stack, network status, failed request payload with secrets removed | Assuming a 503 proves frontend bug |
| API/service | Route matched, correlation ID, validation error, first exception | Replacing error handler rather than fixing invalid state |
| PostgreSQL | SQLSTATE, constraint, query plan, migration version, lock waits | Running destructive maintenance before diagnosis |
| VPS/proxy | Health endpoint, service state, upstream address, request trace | Restarting everything before finding failing component |
| CI | Head SHA, job/step, exact assertion, first stack, dependency versions | Rerunning entire matrix for every possible guess |

## Hypothesis card
- Observation: ... (source and timestamp)
- Suspected cause: ...
- Why this cause explains all known symptoms: ...
- Evidence against: ...
- Smallest falsifying test: ...
- Confidence: high / medium / low (never assert untested certainty)
- Permission needed before action: ...
