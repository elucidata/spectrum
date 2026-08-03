## Spectrum workflow

This project uses **Spectrum** to manage development work as Markdown artifacts.
Issues and tickets live in `spectrum/`; specs in `docs/specs`; ADRs in `docs/adrs`.

When asked to capture an idea or bug, triage, turn an issue into an
implementation-ready ticket, implement a ticket, run QA, or validate artifacts,
follow the Spectrum workflow. If a `spectrum` skill is available, use it. Drive
all mechanics — IDs, transitions, file moves, validation — through the Spectrum
CLI rather than hand-editing files, and run `doctor` before finishing.
