# Spectrum

A lean, agentic-development workflow built around plain Markdown — **issues**, implementation-ready **tickets**, current-state **specs**, and **ADRs**.

Spectrum's guiding idea is to **push human involvement to the edges**: a human agrees on the intent, the work is executed autonomously, and it comes back for human QA. Specs stay authoritative; tickets are disposable.

## What it's for

Use Spectrum when you want an AI coding agent to do real work without hovering over every step, while keeping a clear paper trail of *what* was agreed and *why*.

- **Issue** — a durable exploration space for an idea, bug, feature, or gap that isn't yet authorized for production work.
- **Ticket** — a self-contained, AFK-ready change proposal with enough scope, context, and acceptance criteria to implement autonomously.
- **Spec** — a concise description of the system's current expected behavior. The source of truth.
- **ADR** — a durable record of a surprising architectural trade-off worth not relitigating.

The flow is: capture an issue → explore it → propose a ticket → implement it autonomously → hand back for human QA → close.

## Install

Spectrum is packaged as a skill and installs with the [`skills`](https://www.npmjs.com/package/skills) CLI:

```sh
# Install into the current project's ./.claude/skills
npx skills add elucidata/spectrum@spectrum

# Or install globally, skipping prompts
npx skills add elucidata/spectrum@spectrum -g -y
```

Once installed, your agent picks up the skill automatically — just describe what you want ("capture an issue about…", "turn this into a ticket", "implement ticket 9f3kq2").

## How to use

Spectrum routes a request to one of six workflows:

| Intent | Route |
| --- | --- |
| Record an idea, bug, feature, or note | **Capture** |
| Discuss, research, prototype, or resume an issue | **Explore** |
| Turn agreed scope into executable work | **Propose** |
| Execute a ticket by ID | **Implement** |
| Test, fix, approve, close, or archive a ticket | **QA** |
| List, inspect, transition, or validate artifacts | **Operate** |

A deterministic CLI handles the mechanics (ID generation, file moves, transition checks, validation) so the agent doesn't have to:

```sh
node skills/spectrum/scripts/spectrum.mjs <command>
```

Common commands:

```text
init [path]                          Initialize Spectrum in a repo
new issue --title <title>            Create an issue
new ticket --title <title> [--issue <id>]   Create a ticket, optionally linked to an issue
list [issues|tickets|all] [--status <status>] [--archived]
show <id>                            Show an artifact
transition <id> <status>             Move an artifact through its lifecycle
block <id> <reason>                  Record a blocker
unblock <id> <reason-number>         Clear a blocker
archive <id>                         Archive a terminal artifact
doctor                               Validate the repository's Spectrum files
help                                 List all commands
```

Artifacts live in the working tree:

```text
docs/
  adrs/          ADRs (YYYYMMDD-<decision>.adr.md)
  specs/         Specs (<subject>.spec.md)
spectrum/
  config.json
  issues/        <id>-<slug>.issue.md
  tickets/       <id>-<slug>.ticket.md
  archives/      Archived issues and tickets
```

IDs are 6-character lowercase [Crockford base32](https://www.crockford.com/base32.html) (e.g. `9f3kq2`); the artifact type is carried by the `.issue.md` / `.ticket.md` filename suffix.

## Develop

```sh
npm test    # runs the CLI test suite
```

Requires Node.js ≥ 20.
