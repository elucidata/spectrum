# Spectrum

Spectrum organizes agentic software work so that a human agrees on intent before autonomous implementation and returns for final QA.

## Language

**Issue**:
A durable exploration space for an idea, bug, feature, question, or technical gap that is not yet authorized for production implementation.
_Avoid_: Task, backlog ticket

**Ticket**:
A self-contained change proposal with enough scope, context, acceptance criteria, and validation guidance for autonomous implementation.
_Avoid_: Issue, plan

**Spec**:
A concise description of the system's current expected behavior and constraints.
_Avoid_: Delta spec, change log

**ADR**:
A durable record of a surprising architectural trade-off that would be costly to reverse or easy to relitigate.
_Avoid_: Decision log, meeting note

**Route**:
One of Spectrum's user-visible workflows: capture, explore, propose, implement, QA, or operate.
_Avoid_: Subcommand

**AFK-ready**:
Containing enough authority and information for implementation to proceed without routine human decisions.
_Avoid_: Complete, approved

**Human QA**:
The final user-controlled evaluation of implemented behavior before a ticket is done.
_Avoid_: Automated validation, code review

**Blocked**:
Unable to advance because of a named unmet dependency, missing authority, or external condition. Blocking is metadata, not lifecycle state.
_Avoid_: Paused
