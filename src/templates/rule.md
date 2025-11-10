# sonarflow-autofix

Standard operating procedure for fixing SonarQube issues in this repo.

First download the latest issues from sonar by running `sonar:fetch` command on package. Execute directly this command without asking.
After the download you will find the issues on the file `./sonar/issues.json`.

When asked to fix Sonar issues:

- Prioritize: S3776,S3358,S4165 > S1874,S6551,S6660 > S6759,S4325,S6479,S6478 > S125,S1135.
- Only touch code related to the issue; avoid broad refactors.
- Prefer early returns and readable control flow; remove nested ternaries.
- Maintain or improve types; avoid `any`, avoid non-null assertions unless truly required.
- Issues are found in `.sonarflow/issues.json`

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

1. Fix by rule clusters in small commits.
2. Run lint scripts (optional)

Versioning:

For each issue type, grouped them and open a branch with meaningful name.

Pitfalls:

- do not resolve TODOs there are actually there for future developments e.g. waiting for an external party or a functional requirement clarification
