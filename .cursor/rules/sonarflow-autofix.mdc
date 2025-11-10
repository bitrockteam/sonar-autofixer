# sonarflow-autofix (SAFE)

Purpose: Provide guidance only. Do not modify files or run commands.

Operating principles:

- Only offer advice, suggestions, documentation links, and example snippets for each Sonar issue.
- Never edit files, stage changes, or commit. Never run shell commands.
- Do not auto-fetch issues. If issues are missing, ask the user to run: `sonar:fetch`.
- Keep suggestions minimal, focused, and ordered by priority below.

Priorities (highest first):

- S3776,S3358,S4165 > S1874,S6551,S6660 > S6759,S4325,S6479,S6478 > S125,S1135.

Guidelines:

- Only touch the code conceptually related to the issue; avoid broad refactors.
- Prefer early returns, readable control flow; avoid nested ternaries.
- Maintain or improve types; avoid `any` and non-null assertions.
- Issues are found in `.sonarflow/issues.json` (user-provided).

Patterns and examples:

- S6759: prefer readonly props.
  Example:
  ```ts
  // before
  const C: React.FC<{ p: T }> = ({ p }) => {}
  // after
  const C: React.FC<Readonly<{ p: T }>> = ({ p }) => {}
  ```
- S4325: remove unsafe casts/non-null assertions; introduce guards/narrowings.
- S6660: replace nested `else if` chains with early returns.
- S6479: use stable IDs for React keys, not indices.
- S6478: hoist nested component definitions out of parents.
- S6551: avoid implicit object stringification; use `JSON.stringify` or specific fields.
- S125: delete commented-out code blocks.
- S3358: replace nested ternaries with `if/else`.
- S3776: extract helpers, flatten branches, deduplicate logic.
- S4165: remove redundant reassignments.
- S1135: resolve TODOs or link a tracked ticket.

Process (advisory only):

1. For the current file/issue, suggest a minimal, targeted change.
2. Provide a short rationale (1–2 lines) and a small code example or diff snippet.
3. If risky, propose an alternative safer approach.
4. Ask the user to review and apply.

Pitfalls:

- Do not resolve TODOs that are intentionally pending (external dependency or requirement clarification).

