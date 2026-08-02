# Artifact format and operations

Spectrum stores ordinary Markdown with a small YAML frontmatter subset. The CLI owns mechanical edits.

## Project layout

```text
docs/
  adrs/
  specs/
spectrum/
  config.json
  archives/
    issues/
    tickets/
  issues/
  tickets/
```

Keep archives in the working tree. Use CLI filtering to avoid loading them into context.

Artifact files are named `<id>-<slug>.<kind>.md`. IDs are 6-character lowercase Crockford base32 (`0-9` and `a-z` excluding `i`, `l`, `o`, `u`); the type is carried by the `.issue.md` / `.ticket.md` suffix, not the ID.

## States

Issues:

```text
open -> ready -> ticketed
          ^         |
          +---------+
```

`open` includes capture and active exploration. `ready` means enough is known to create an AFK-ready ticket. `ticketed` means the issue has produced at least one ticket.

Tickets:

```text
draft -> ready -> active -> qa -> done
           ^        ^      |
           |        +------+
           +--------+
```

`draft` is a file-editing state and is never executable. `ready` is the first AFK-executable state. `qa` requires implementation, validation, review, and spec updates. `done` requires explicit human approval.

Record blockers in the `blocked_by` array without changing status.

## Issue body

Preserve these headings:

- `Problem`
- `Desired outcome`
- `Notes`
- `Open questions`
- `Research and prototypes`
- `Decisions`
- `Next session`

## Ticket body

Preserve these headings:

- `Outcome`
- `Scope` with `In scope` and `Out of scope`
- `Context`
- `Acceptance criteria`
- `Implementation plan`
- `Validation`
- `Spec updates`
- `ADR candidates`
- `Execution log`
- `Human QA`
- `QA notes`

Use standard task-list syntax. Ticket frontmatter links the source issue and final spec and ADR paths.

## CLI

```text
init [path]
new issue --title <title>
new ticket --title <title> [--issue <id>]
list [issues|tickets|all] [--status <status>] [--archived]
show <id>
transition <id> <status>
block <id> <reason>
unblock <id> <reason-number>
archive <id>
doctor
help
```

Commands discover the nearest initialized project. `doctor` exits nonzero for errors and prints plain-English fixes. Warnings identify incomplete drafts or non-fatal cleanup.

## Specs

Name specs `<subject>.spec.md`. Describe complete current behavior, invariants, failure behavior, and important constraints. Prefer one cohesive spec per stable capability over one file per ticket.

## ADRs

Name ADRs `YYYYMMDD-<decision>.adr.md`. A minimal ADR states context, decision, and why. Add alternatives or consequences only when they prevent future relitigation.

## Archive policy

Archive terminal artifacts by moving them to `spectrum/archives`. Do not use a separate Git branch: an orphan archive branch makes lookup, linking, review, and atomic changes harder while providing little context benefit. Revisit external or packed archives only after repository size or search performance becomes a measured problem.
