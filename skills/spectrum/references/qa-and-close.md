# QA and close

Human QA is distinct from automated validation and code review.

## Begin QA

Load the ticket in `qa` and present its human QA checklist. Help the user exercise the changed behavior and inspect relevant code or UI.

## Handle a failed check

1. Record the failure in `QA notes` with reproduction details.
2. Add a cleanup phase and concrete work items to the ticket.
3. Transition the ticket from `qa` to `active`.
4. Implement, validate, review, and update specs as in the implementation route.
5. Return the ticket to `qa` with the failed scenario called out for retest.

Do not create a new ticket for fixes required to satisfy the current ticket. Create a follow-up issue only for a genuinely separate improvement.

## Approve and close

After the user explicitly approves QA:

1. Record the approval and date in `QA notes`.
2. Transition the ticket to `done`.
3. Run `doctor`.
4. Archive the ticket:

   ```sh
   node <skill-directory>/scripts/spectrum.mjs archive <ticket-id>
   ```

Report the archived path and any follow-up issue IDs.

Never infer approval from silence, passing automation, or the agent's own inspection.
