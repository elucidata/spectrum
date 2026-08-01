# Capture and explore

## Capture

Create an issue when the user wants to preserve something without fully resolving it:

```sh
node <skill-directory>/scripts/spectrum.mjs new issue --title "<title>"
```

Fill only known facts. Keep unknowns as explicit questions. Return the issue ID and stop unless the user also asked to explore it.

## Explore

Use an existing issue when supplied. Otherwise create one before substantial exploration so the discussion can resume later.

1. Read the issue and any specifically linked evidence.
2. Restate the problem and desired outcome in concrete terms.
3. Identify decisions that implementation cannot safely infer.
4. Ask about one decision cluster at a time. Prefer concrete scenarios and edge cases over abstract preferences.
5. Research or inspect the codebase when facts can be discovered without asking.
6. Create a throwaway prototype only when the user requests one or it materially resolves a design question. Record its location and conclusion; do not treat it as production code.
7. Update the issue after each resolved cluster: notes, decisions, rejected options, risks, and next-session tasks.
8. Set the issue to `ready` only when outcome, boundaries, acceptance examples, and remaining implementation authority are clear.

Use `blocked_by` for a real unmet dependency. Leave the progress status unchanged.

An issue may contain investigation tasks. Those tasks gather facts or resolve design; they do not authorize production changes.

## Readiness questions

Before proposing a ticket, be able to answer:

- What observable outcome changes?
- What is explicitly in and out of scope?
- Which scenarios prove success or failure?
- Which constraints and existing conventions matter?
- Which specs must change?
- Could an implementation agent proceed without a routine product or design decision?

If not, continue exploring.
