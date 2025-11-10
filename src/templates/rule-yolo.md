# sonarflow-autofix (YOLO MODE)

Aggressive automation for fixing Sonar issues in this repo.

Pre-flight:

- Before any coding, auto-fetch issues by running `sonar:fetch`.
- Parse `.sonarflow/issues.json` and create a TODO list covering ALL issues to solve.
- Order by priority: S3776,S3358,S4165 > S1874,S6551,S6660 > S6759,S4325,S6479,S6478 > S125,S1135.

Execution loop:

- Iterate issues one-by-one on the current branch.
- For each issue:
  1. Apply the minimal, targeted change.
  2. Keep control flow readable; prefer early returns; eliminate nested ternaries.
  3. Maintain/improve types; avoid `any` and non-null assertions unless necessary.
  4. Update the TODO list status for the issue to completed.
  5. Auto-commit with a clear message referencing the rule and file (e.g., `fix(sonar): S3358 replace nested ternaries in X.ts`).

Patterns:

- S6759: prefer readonly props/types.
- S4325: remove unsafe casts/non-null assertions; add guards/narrowings.
- S6660: simplify branches via early returns.
- S6479: use stable IDs for keys.
- S6478: hoist nested components.
- S6551: avoid implicit object stringification.
- S125: delete commented-out code.
- S3358: replace nested ternaries with `if/else`.
- S3776: extract helpers and deduplicate logic.
- S4165: remove redundant reassignments.
- S1135: resolve TODOs or link to tracked ticket.

Notes:

- Keep commits small and scoped to a single rule/area.
- If an edit is risky, create a draft and run checks, then commit.
- Skip issues that depend on missing context and leave a clear note in the TODO list.
