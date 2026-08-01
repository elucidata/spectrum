---
name: spectrum
description: Run a lean agentic-development workflow around Markdown issues, implementation-ready tickets, current-state specs, and ADRs. Use when capturing or exploring a feature, bug, idea, or technical gap; triaging Spectrum issues; turning an issue or conversation into an AFK-ready ticket; implementing a ticket; validating acceptance criteria; handing work back for human QA; closing or archiving work; or diagnosing the integrity of a repository's Spectrum files.
---

# Spectrum

Push human involvement to the edges: agree on the work, execute it autonomously, then return it for human QA. Keep specs authoritative and tickets disposable.

## Route the request

Choose one route from the user's intent:

| Intent | Route | Read |
| --- | --- | --- |
| Record an idea, bug, feature, or note | Capture | `references/capture-and-explore.md` |
| Discuss, research, prototype, or resume an issue | Explore | `references/capture-and-explore.md` |
| Turn agreed scope into executable work | Propose | `references/propose.md` |
| Execute a ticket by ID | Implement | `references/implement.md` |
| Test, fix, approve, close, or archive a ticket | QA | `references/qa-and-close.md` |
| List, inspect, transition, or validate artifacts | Operate | `references/artifact-format.md` |

Read only the routed reference. Read `references/artifact-format.md` as well when creating or editing artifacts.

## Find the project and CLI

Treat the nearest ancestor containing `spectrum/config.json` as the project root. If none exists, ask to initialize Spectrum or run:

```sh
node <skill-directory>/scripts/spectrum.mjs init
```

Use the deterministic CLI for mechanics:

```sh
node <skill-directory>/scripts/spectrum.mjs <command>
```

Run `help` for commands. Do not recreate ID generation, file moves, transition checks, or repository-wide validation by hand.

## Apply these invariants

- Treat `docs/specs/*.spec.md` as the source of truth for current behavior.
- Use issues as non-production exploration spaces. Do not implement production work from an issue.
- Make a ticket self-contained and AFK-executable before setting it to `ready`.
- Record desired spec changes in the ticket, then patch the actual specs during implementation. Do not create delta-spec files.
- Create an ADR only for a durable, surprising trade-off that future contributors would otherwise relitigate.
- Keep progress state separate from blockers. Record blockers in `blocked_by`.
- Do not ask routine implementation questions after a ticket is `ready`. Stop only for missing authority, unsafe ambiguity, or a blocker the ticket could not resolve.
- Move a ticket to `qa` only after implementation, acceptance checks, code review, and spec/ADR updates.
- Move a ticket to `done` only after explicit human approval.
- Load only the selected artifact and the specs, ADRs, or source issue it references. Do not scan all prose into context.

## Preserve user control

Explain material scope or design assumptions before creating a ready ticket. During implementation, stay within the ticket's authority. Never publish, deploy, merge, purchase, message third parties, or perform destructive actions unless the ticket and current user authorization explicitly permit it.

If the environment explicitly permits delegation, use subagents only for independent implementation or review work with clear ownership. Keep one orchestrator responsible for ticket state, integration, validation, spec updates, and final handoff.

## Finish every route

Run:

```sh
node <skill-directory>/scripts/spectrum.mjs doctor
```

Fix errors introduced by the current work. Report the artifact ID, resulting status, validations performed, and the next human action.
