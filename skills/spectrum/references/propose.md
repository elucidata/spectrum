# Propose

Turn an agreed issue or conversation into one AFK-ready ticket.

## Build the ticket

1. Read the source issue, relevant code, current specs, and applicable ADRs.
2. Resolve discoverable facts directly. Return to exploration for unresolved product, safety, or authority choices.
3. Create a draft:

   ```sh
   node <skill-directory>/scripts/spectrum.mjs new ticket --title "<title>" [--issue <issue-id>]
   ```

4. Replace every placeholder. Keep the ticket concise but self-contained.
5. Describe the outcome and boundaries, not line-by-line implementation, unless a fragile sequence requires it.
6. Use phases only when ordering, parallelism, or handoffs matter. Put concrete checkboxes under each phase.
7. Write acceptance criteria as observable outcomes. Include failure and edge cases that would change the implementation.
8. Name validation commands or manual checks. Never invent a command without checking the project.
9. List each current-state spec to create or revise and describe its intended final truth.
10. List ADR candidates only when the decision meets Spectrum's ADR threshold.
11. Run `doctor`, then transition the ticket:

   ```sh
   node <skill-directory>/scripts/spectrum.mjs transition <ticket-id> ready
   ```

12. After the ticket becomes ready, transition the source issue to `ticketed` and archive it if useful.

## Ticket authority

A ticket authorizes changes only inside its stated scope. Make external side effects explicit, including deployments, migrations, data changes, third-party messages, or destructive operations. If omitted, implementation must not perform them.

## Keep tickets disposable

The ticket may describe how specs need to change, but it is not a substitute for those specs. During implementation, make the real spec files describe the complete post-change behavior.
