import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = join(dirname(fileURLToPath(import.meta.url)), "spectrum.mjs");

function run(project, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: project,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    expectedStatus,
    `Command failed: ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
  );
  return `${result.stdout}${result.stderr}`;
}

function onlyMarkdown(directory) {
  return join(
    directory,
    readdirSync(directory).find((name) => name.endsWith(".md")),
  );
}

test("runs an issue and ticket through the complete lifecycle", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init"]);

  const issueOutput = run(project, ["new", "issue", "--title", "Remember login errors"]);
  const issueId = issueOutput.match(/Created issue ([0-9a-hjkmnp-tv-z]{6})/u)[1];
  const issuePath = onlyMarkdown(join(project, "spectrum", "issues"));
  let issue = readFileSync(issuePath, "utf8")
    .replace(
      "<!-- What is happening, missing, or worth revisiting? -->",
      "Users see an unhelpful error after an expired login.",
    )
    .replace(
      "<!-- What would be observably better? -->",
      "Users can recover from an expired login.",
    );
  writeFileSync(issuePath, issue);
  run(project, ["transition", issueId, "ready"]);

  const ticketOutput = run(project, [
    "new",
    "ticket",
    "--title",
    "Improve expired login recovery",
    "--issue",
    issueId,
  ]);
  const ticketId = ticketOutput.match(/Created ticket ([0-9a-hjkmnp-tv-z]{6})/u)[1];
  const ticketPath = onlyMarkdown(join(project, "spectrum", "tickets"));
  let ticket = readFileSync(ticketPath, "utf8")
    .replace(
      "<!-- Describe the observable post-change result. -->",
      "Expired sessions offer a working sign-in recovery action.",
    )
    .replace(
      "<!-- List included behavior and surfaces. -->",
      "- Expired-session dialog\n- Recovery action",
    )
    .replace(
      "<!-- List nearby work this ticket does not authorize. -->",
      "- Authentication provider changes",
    )
    .replace(
      "<!-- Include only facts the implementation agent cannot cheaply rediscover. -->",
      "Preserve the existing sign-in route.",
    )
    .replace(
      "- [ ] Replace this placeholder with an observable criterion.",
      "- [ ] An expired session offers a sign-in action.",
    )
    .replace(
      "- [ ] Replace this placeholder with a concrete work item.",
      "- [ ] Add the recovery action and its focused test.",
    )
    .replace(
      "<!-- Name verified project commands and focused checks. -->",
      "`npm test` plus a focused dialog check.",
    )
    .replace(
      "<!-- Name each spec and the complete post-change truth it must contain, or explain why none changes. -->",
      "None — this fixture has no product specs.",
    )
    .replace(
      "<!-- Record only durable and surprising trade-offs, or state that none are expected. -->",
      "None expected.",
    )
    .replace(
      "- [ ] Replace this placeholder with a human-observable scenario.",
      "- [ ] Expire a session and use the sign-in action.",
    );
  writeFileSync(ticketPath, ticket);

  run(project, ["transition", ticketId, "ready"]);
  run(project, ["transition", issueId, "ticketed"]);
  run(project, ["archive", issueId]);
  run(project, ["transition", ticketId, "active"]);

  ticket = readFileSync(ticketPath, "utf8")
    .replace("- [ ] An expired session", "- [x] An expired session")
    .replace("- [ ] Add the recovery", "- [x] Add the recovery")
    .replace("## Execution log\n", "## Execution log\n\nValidation passed. Review found no issues.\n");
  writeFileSync(ticketPath, ticket);
  run(project, ["transition", ticketId, "qa"]);

  ticket = readFileSync(ticketPath, "utf8")
    .replace("- [ ] Expire a session", "- [x] Expire a session")
    .replace("## QA notes", "## QA notes\n\nApproved by the user.");
  writeFileSync(ticketPath, ticket);
  run(project, ["transition", ticketId, "done"]);
  run(project, ["archive", ticketId]);

  const doctor = run(project, ["doctor"]);
  assert.match(doctor, /Spectrum is healthy: checked 2 artifact\(s\)\./u);
});

test("rejects a placeholder ticket as ready with plain-language guidance", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init"]);
  const output = run(project, ["new", "ticket", "--title", "Incomplete change"]);
  const ticketId = output.match(/Created ticket ([0-9a-hjkmnp-tv-z]{6})/u)[1];
  const failure = run(project, ["transition", ticketId, "ready"], 1);
  assert.match(failure, /cannot move to ready/u);
  assert.match(failure, /fill the Outcome section/u);
});

test("keeps blockers separate from state and rejects draft-only issue completion", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init"]);
  const issueOutput = run(project, ["new", "issue", "--title", "Investigate cache misses"]);
  const issueId = issueOutput.match(/Created issue ([0-9a-hjkmnp-tv-z]{6})/u)[1];
  const issuePath = onlyMarkdown(join(project, "spectrum", "issues"));
  const issue = readFileSync(issuePath, "utf8")
    .replace(
      "<!-- What is happening, missing, or worth revisiting? -->",
      "Cache misses are unexpectedly high.",
    )
    .replace(
      "<!-- What would be observably better? -->",
      "The cause is understood and a bounded change is proposed.",
    );
  writeFileSync(issuePath, issue);
  run(project, ["transition", issueId, "ready"]);
  run(project, ["block", issueId, "Waiting for production metrics"]);

  const doctor = run(project, ["doctor"]);
  assert.match(doctor, /Spectrum is healthy/u);
  assert.match(doctor, /1 blocker\(s\) remain/u);
  run(project, ["unblock", issueId, "1"]);

  run(project, [
    "new",
    "ticket",
    "--title",
    "Explain cache misses",
    "--issue",
    issueId,
  ]);
  const failure = run(project, ["transition", issueId, "ticketed"], 1);
  assert.match(failure, /ticket that has reached ready/u);
});
