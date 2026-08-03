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

See [`GLOSSARY.md`](GLOSSARY.md) for the full ubiquitous language.

## Install

Spectrum is packaged as a skill and installs with the [`skills`](https://www.npmjs.com/package/skills) CLI:

```sh
# Install into the current project's ./.claude/skills
npx skills add elucidata/spectrum@spectrum

# Or install globally, skipping prompts
npx skills add elucidata/spectrum@spectrum -g -y
```

Once installed, your agent picks up the skill automatically — just describe what you want ("capture an issue about…", "turn this into a ticket", "implement ticket 9f3kq2").

## Setup

After installing the skill, run `init` **inside the repo** you want to manage:

```sh
node skills/spectrum/scripts/spectrum.mjs init   # or: spectrum init
```

`init` scaffolds the `spectrum/` and `docs/` directories, writes `spectrum/config.json`, and adds a short **Spectrum block to `AGENTS.md`** (creating the file if it doesn't exist). That block is what makes agents which read `AGENTS.md` — Codex, OpenCode, Pi — aware the project uses Spectrum; Claude Code already picks it up through the skill directly. The block is wrapped in `<!-- spectrum:start -->` / `<!-- spectrum:end -->` markers, so re-running `init` updates it in place rather than duplicating, and any surrounding content is left untouched.

This only takes effect when you **run your agent inside that repo** — that's how the `AGENTS.md` guidance gets loaded into context. To skip the `AGENTS.md` write entirely:

```sh
spectrum init --no-agents
```

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

## Customizing

Two things are configurable per project: the **templates** used for new artifacts, and the **contract** that `doctor` and `transition` check readiness against.

### Templates

Default templates for `issue`, `ticket`, and the `AGENTS.md` bootstrap block ship inside the skill at `skills/spectrum/templates/`. To customize one, create the same file at `spectrum/templates/<name>.md` in your project — `issue.md`, `ticket.md`, or `agents.md`. When a project file exists, the CLI uses it instead of the shipped default; when it doesn't, the shipped default applies. The override is per-file and lives in your repo, so it survives skill upgrades.

For `agents.md`, only write the content that goes *inside* the block — the `<!-- spectrum:start -->` / `<!-- spectrum:end -->` markers are added by `init` automatically; keep them out of your override.

### The contract

`spectrum/config.json` (schemaVersion 2) carries a `contract` object describing what "ready" means for each artifact kind at each lifecycle gate. `doctor` and `transition` both check artifacts against it. Here's an annotated excerpt — `config.json` itself is strict JSON, so the `//` comments below are for this README only, not something you can write in the real file:

```jsonc
// spectrum/config.json (schemaVersion 2)
{
  "contract": {
    "ticket": {
      "ready": {
        "sections": ["Outcome", "Context"],   // ## headings that must be present and non-empty
        "subsections": ["In scope"],           // ### headings that must be present and non-empty
        "checklists": ["Acceptance criteria"]  // must have >=1 checkbox, no "placeholder" text
      },
      "qa": {
        "checklistsComplete": ["Acceptance criteria"], // every checkbox must be checked
        "sections": ["Execution log"]
      },
      "done": {
        "checklistsComplete": ["Human QA"],  // every checkbox must be checked
        "qaApproved": true                    // "approved" must appear in QA notes
      }
    }
  }
}
```

The `sections` / `subsections` / `checklists` / `checklistsComplete` lists are authoritative — add or remove headings freely to match how your team writes issues and tickets. The lifecycle states themselves (`draft` → `ready` → `active` → `qa` → `done` for tickets; `open` → `ready` → `ticketed` for issues) are fixed and not configurable.

### Worked example: require a Rollback plan before `ready`

Say every ticket should document a rollback plan before it can leave `draft`:

1. Add `"Rollback"` to `contract.ticket.ready.sections` in `spectrum/config.json`.
2. Add a `## Rollback` heading to `spectrum/templates/ticket.md` — create the override (starting from the shipped default) if you don't already have one.
3. Run `spectrum doctor` to confirm the template satisfies the contract.

From then on, new tickets carry the heading from the template, and `transition <id> ready` fails until the `## Rollback` section is filled in.

### What `doctor` says about the contract

- **Structural problems are always errors.** Missing project directories, malformed frontmatter, duplicate IDs, and a template missing a contract-required heading all fail `doctor` with a non-zero exit code, regardless of any artifact's status.
- **An in-flight artifact missing a required section is a warning, never a blocker.** A `ready` ticket whose `## Context` is empty, for example, is flagged so you notice — but that alone doesn't fail `doctor`.
- **Terminal and archived artifacts are exempt.** `ticketed` issues, `done` tickets, and anything under `spectrum/archives/` are not re-checked against the contract.
- **A template missing a contract-required heading is a loud error.** `doctor` resolves the template the same way artifact creation does — a project override if present, otherwise the shipped default — and checks it against every `sections`/`subsections` heading named anywhere in the contract, at the matching heading level (`##` for sections, `###` for subsections); `checklists`/`checklistsComplete` headings aren't checked against the template this way. Tighten the contract without updating the template, and `doctor` reports it as an error even if you have no override in place at all (it checks the shipped default template too).
- **A gate that enforces nothing is a warning, not an error.** The `sections` list — and each gate as a whole — is yours to empty; a gate (or an entire kind) that requires nothing is a legitimate way to run Spectrum loosely. But because a gutted gate is also how a truncated or mis-merged `config.json` slips through unnoticed, `doctor` surfaces it: `contract gate ticket.ready enforces nothing; that transition is unenforced.` (or, for a whole kind, `contract defines no readiness gates for ticket; ...`). It's a warning only — enforcement is off, not blocked — so intentional loosening stays visible and accidental gutting gets caught.

### Changing the contract on a live project

Editing `contract` in `config.json` affects `doctor` and `transition` differently. `doctor`'s warning tier reflects the *current* contract immediately: any in-flight (non-terminal, non-archived) artifact missing a newly-required section shows up as a warning on the very next `doctor` run, with no transition needed — and, as always, warnings never block or fail the run. `transition`'s *blocking* check, by contrast, only validates the gate an artifact is actually crossing, so work that already passed a gate keeps moving, and terminal (`ticketed`/`done`) and archived artifacts are fully exempt from both. To force an in-flight artifact through the new contract's blocking check, transition it back a step and forward again (e.g. `active` → `ready` → `active`) — the backward step re-enters the earlier gate under the current contract.

### Upgrading an older project

If `doctor` warns:

```text
config is schemaVersion 1; run `spectrum upgrade` to persist the contract.
```

run:

```sh
spectrum upgrade
```

This sets `schemaVersion` to `2` and writes the default `contract` block into `config.json` if one isn't already present. It's additive and idempotent — running it again on an already-upgraded project is a no-op — and it never overwrites contract customizations you've already made. Even before you upgrade, Spectrum keeps working: a schemaVersion 1 config gets the default contract applied in memory, but `doctor` will keep warning until you persist it.

## Develop

```sh
npm test    # runs the CLI test suite
```

Requires Node.js ≥ 20.
