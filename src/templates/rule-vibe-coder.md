# sonarflow-autofix (VIBE-CODER)

Standard operating procedure for fixing Sonar issues in this repo.

Fetching issues:

- Do not auto-run commands. When issues are needed, ask the user to run:
  - `sonar:fetch`
- Issues will be available at `.sonarflow/issues.json` after the user runs the command.

When asked to fix Sonar issues:

- Prioritize: S3776,S3358,S4165 > S1874,S6551,S6660 > S6759,S4325,S6479,S6478 > S125,S1135.
- Only touch code related to the issue; avoid broad refactors.
- Prefer early returns and readable control flow; remove nested ternaries.
- Maintain or improve types; avoid `any`, avoid non-null assertions unless truly required.
- Issues are found in `.sonarflow/issues.json`.

Patterns:

- S6759: `({ p }: { p:T })` -> `({ p }: Readonly<{ p:T }>)`.
- S4325: Remove `as T` / `!`; add guards or narrowings where needed.
- S6660: Replace `else { if (c) A(); else B(); }` with early returns.
- S6479: Keys must be stable IDs, not array indices.
- S6478: Hoist nested component definitions out of parents.
- S6551: Avoid implicit object stringification; use `JSON.stringify(o)` or fields.
- S125: Delete commented-out code blocks.
- S3358: Replace nested ternaries with `if/else`.
- S3776: Extract helpers, flatten branches, deduplicate logic.
- S4165: Remove redundant reassignments.
- S1135: Resolve TODOs or replace with tracked ticket references.

Process:

1. Fix by rule clusters in small commits. Do not auto-commit; prepare diffs only.
2. Optionally suggest running lint/test scripts after changes.

Versioning:

- For each issue type, suggest grouping changes and meaningful branch naming.

Pitfalls:

- Do not resolve TODOs that are intentionally pending (waiting for third-party or requirements).
