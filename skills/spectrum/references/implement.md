# Implement

Execute only a ticket in `ready`, `active`, or `qa`.

## Start

1. Locate the ticket with `show <ticket-id>`.
2. Run `doctor`. Refuse a `draft` ticket and explain what prevents readiness.
3. Read the ticket plus only its referenced specs, ADRs, source issue, and code needed for the first phase.
4. Check repository instructions and current changes. Preserve unrelated user work.
5. Transition `ready` to `active`.

## Execute autonomously

Work phase by phase until the ticket reaches a terminal outcome:

- Implement within scope and mark completed work-item checkboxes.
- Test at the module interface and use existing project validation.
- Integrate parallel work before judging acceptance.
- Update the execution log with decisions, deviations, and evidence that will matter at handoff.
- If reality invalidates the ticket, make the smallest safe correction that preserves intent and record it. Stop for a product choice, missing authority, unsafe action, or material scope expansion.
- On a blocker, add a precise `blocked_by` entry, leave status `active`, and report the shortest path to unblock.

Do not silently weaken acceptance criteria. Do not turn implementation discoveries into undocumented behavior.

## Close the autonomous loop

Before human QA:

1. Check every acceptance criterion with evidence.
2. Run the relevant automated tests, formatting, type checks, builds, or focused manual checks.
3. Review the complete change for correctness, regressions, security, maintainability, scope, and repository standards. Use an independent review agent only when delegation is explicitly available.
4. Fix review findings within ticket scope and rerun affected validation.
5. Patch every referenced spec to the complete current behavior.
6. Create or revise ADRs only for qualifying decisions.
7. Run `doctor`.
8. Transition the ticket to `qa`.

Return a compact handoff: outcome, notable choices, files or surfaces changed, validation evidence, residual risks, and exact human QA scenarios.
