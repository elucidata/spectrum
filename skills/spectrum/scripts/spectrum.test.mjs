import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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

const AGENTS_START = "<!-- spectrum:start -->";
const AGENTS_END = "<!-- spectrum:end -->";

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test("init creates AGENTS.md with a single Spectrum block", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init"]);
  const agentsPath = join(project, "AGENTS.md");
  assert.ok(existsSync(agentsPath), "AGENTS.md should be created");
  const contents = readFileSync(agentsPath, "utf8");
  assert.equal(countOccurrences(contents, AGENTS_START), 1);
  assert.equal(countOccurrences(contents, AGENTS_END), 1);
  assert.match(contents, /## Spectrum workflow/u);
});

test("init appends to an existing AGENTS.md without disturbing prior content", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  const agentsPath = join(project, "AGENTS.md");
  writeFileSync(agentsPath, "# House rules\n\nBe excellent.\n");
  run(project, ["init"]);
  const contents = readFileSync(agentsPath, "utf8");
  assert.match(contents, /# House rules/u);
  assert.match(contents, /Be excellent\./u);
  assert.equal(countOccurrences(contents, AGENTS_START), 1);
  assert.ok(
    contents.indexOf("Be excellent.") < contents.indexOf(AGENTS_START),
    "prior content should precede the appended block",
  );
});

test("re-running the bootstrap replaces the block instead of duplicating it", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  const agentsPath = join(project, "AGENTS.md");
  writeFileSync(
    agentsPath,
    `# Top\n\n${AGENTS_START}\nstale spectrum guidance\n${AGENTS_END}\n\n# Bottom\n`,
  );
  run(project, ["init"]);
  const contents = readFileSync(agentsPath, "utf8");
  assert.equal(countOccurrences(contents, AGENTS_START), 1);
  assert.equal(countOccurrences(contents, AGENTS_END), 1);
  assert.doesNotMatch(contents, /stale spectrum guidance/u);
  assert.match(contents, /# Top/u);
  assert.match(contents, /# Bottom/u);
  assert.match(contents, /## Spectrum workflow/u);
});

test("init --no-agents does not create AGENTS.md", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init", "--no-agents"]);
  assert.ok(!existsSync(join(project, "AGENTS.md")), "AGENTS.md should not be created");
});

test("new artifacts use the shipped default templates", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init"]);
  run(project, ["new", "ticket", "--title", "Default template ticket"]);
  const body = readFileSync(onlyMarkdown(join(project, "spectrum", "tickets")), "utf8");
  assert.match(body, /## Outcome/u);
  assert.match(body, /## Human QA/u);
});

test("a project template override replaces the default body per kind", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init"]);
  const templates = join(project, "spectrum", "templates");
  mkdirSync(templates, { recursive: true });
  writeFileSync(join(templates, "ticket.md"), "## House outcome\n\n<!-- ours -->\n");

  run(project, ["new", "ticket", "--title", "Overridden ticket"]);
  const ticketBody = readFileSync(onlyMarkdown(join(project, "spectrum", "tickets")), "utf8");
  assert.match(ticketBody, /## House outcome/u);
  assert.doesNotMatch(ticketBody, /## Outcome\b/u);

  // Issues are untouched — override is per file.
  run(project, ["new", "issue", "--title", "Still default issue"]);
  const issueBody = readFileSync(onlyMarkdown(join(project, "spectrum", "issues")), "utf8");
  assert.match(issueBody, /## Problem/u);
});

test("an agents template override changes the AGENTS.md block body", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  const templates = join(project, "spectrum", "templates");
  mkdirSync(templates, { recursive: true });
  writeFileSync(join(templates, "agents.md"), "## Spectrum here\n\nCustom guidance.\n");
  run(project, ["init"]);
  const contents = readFileSync(join(project, "AGENTS.md"), "utf8");
  assert.match(contents, /## Spectrum here/u);
  assert.match(contents, /Custom guidance\./u);
  assert.equal(countOccurrences(contents, AGENTS_START), 1);
});

test("done gate rejects an unchecked Human QA checklist even when QA notes are approved", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init"]);

  const ticketOutput = run(project, ["new", "ticket", "--title", "Needs human QA"]);
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
  run(project, ["transition", ticketId, "active"]);

  ticket = readFileSync(ticketPath, "utf8")
    .replace("- [ ] An expired session", "- [x] An expired session")
    .replace("- [ ] Add the recovery", "- [x] Add the recovery")
    .replace("## Execution log\n", "## Execution log\n\nValidation passed. Review found no issues.\n");
  writeFileSync(ticketPath, ticket);
  run(project, ["transition", ticketId, "qa"]);

  // Approve QA notes but deliberately leave the Human QA checkbox unchecked.
  ticket = readFileSync(ticketPath, "utf8").replace(
    "## QA notes",
    "## QA notes\n\nApproved by the user.",
  );
  writeFileSync(ticketPath, ticket);

  const failure = run(project, ["transition", ticketId, "done"], 1);
  assert.match(failure, /Human QA/u);
});

test("config carries the contract and a custom required section is enforced", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init"]);

  const configPath = join(project, "spectrum", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(config.schemaVersion, 2);
  assert.deepEqual(config.contract.ticket.ready.sections.slice(0, 2), ["Outcome", "Context"]);

  // Add a project-specific required section to the ready gate.
  config.contract.ticket.ready.sections.push("Rollback");
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const output = run(project, ["new", "ticket", "--title", "Needs rollback"]);
  const ticketId = output.match(/Created ticket ([0-9a-hjkmnp-tv-z]{6})/u)[1];
  const failure = run(project, ["transition", ticketId, "ready"], 1);
  assert.match(failure, /fill the Rollback section/u);
});

function readConfig(project) {
  return JSON.parse(readFileSync(join(project, "spectrum", "config.json"), "utf8"));
}
function writeConfig(project, config) {
  writeFileSync(join(project, "spectrum", "config.json"), `${JSON.stringify(config, null, 2)}\n`);
}

test("doctor exempts a terminal, archived artifact from tightened contract checks", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init"]);
  const output = run(project, ["new", "ticket", "--title", "Terminal ticket"]);
  const ticketId = output.match(/Created ticket ([0-9a-hjkmnp-tv-z]{6})/u)[1];
  const ticketPath = onlyMarkdown(join(project, "spectrum", "tickets"));

  // Fill the ticket enough to satisfy the DEFAULT ready gate.
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, "utf8")
      .replace("<!-- Describe the observable post-change result. -->", "Terminal outcome.")
      .replace("<!-- List included behavior and surfaces. -->", "- A")
      .replace("<!-- List nearby work this ticket does not authorize. -->", "- B")
      .replace("<!-- Include only facts the implementation agent cannot cheaply rediscover. -->", "Context.")
      .replace("- [ ] Replace this placeholder with an observable criterion.", "- [ ] Observable criterion.")
      .replace("- [ ] Replace this placeholder with a concrete work item.", "- [ ] Concrete work item.")
      .replace("<!-- Name verified project commands and focused checks. -->", "`npm test`.")
      .replace("<!-- Name each spec and the complete post-change truth it must contain, or explain why none changes. -->", "None.")
      .replace("<!-- Record only durable and surprising trade-offs, or state that none are expected. -->", "None expected.")
      .replace("- [ ] Replace this placeholder with a human-observable scenario.", "- [ ] Human scenario."),
  );
  run(project, ["transition", ticketId, "ready"]);
  run(project, ["transition", ticketId, "active"]);

  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, "utf8")
      .replace("- [ ] Observable criterion.", "- [x] Observable criterion.")
      .replace("- [ ] Concrete work item.", "- [x] Concrete work item.")
      .replace("## Execution log\n", "## Execution log\n\nValidation passed.\n"),
  );
  run(project, ["transition", ticketId, "qa"]);

  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, "utf8")
      .replace("- [ ] Human scenario.", "- [x] Human scenario.")
      .replace("## QA notes", "## QA notes\n\nApproved."),
  );
  run(project, ["transition", ticketId, "done"]);
  run(project, ["archive", ticketId]);

  // Now tighten the ready gate to demand a section the archived ticket lacks.
  const config = readConfig(project);
  config.contract.ticket.ready.sections.push("Rollback");
  writeConfig(project, config);

  const doctor = run(project, ["doctor"]); // exempt: no error despite missing Rollback
  assert.match(doctor, /Spectrum is healthy: checked 1 artifact\(s\)\./u);
});

test("doctor warns (does not error) on in-flight artifacts missing a required section", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init"]);
  const issueOutput = run(project, ["new", "issue", "--title", "Half-filled issue"]);
  const issueId = issueOutput.match(/Created issue ([0-9a-hjkmnp-tv-z]{6})/u)[1];
  const issuePath = onlyMarkdown(join(project, "spectrum", "issues"));
  writeFileSync(
    issuePath,
    readFileSync(issuePath, "utf8")
      .replace("<!-- What is happening, missing, or worth revisiting? -->", "Real problem.")
      .replace("<!-- What would be observably better? -->", "Real outcome."),
  );
  run(project, ["transition", issueId, "ready"]);

  // Now require a section the ready issue lacks.
  const config = readConfig(project);
  config.contract.issue.ready.sections.push("Risk");
  writeConfig(project, config);

  const doctor = run(project, ["doctor"]); // still exit 0
  assert.match(doctor, /Spectrum is healthy/u);
  assert.match(doctor, /fill the Risk section/u);
  assert.match(doctor, /warning\(s\)/u);
});

test("doctor errors when a template override omits a contract-required heading", () => {
  const project = mkdtempSync(join(tmpdir(), "spectrum-test-"));
  run(project, ["init"]);
  const templates = join(project, "spectrum", "templates");
  mkdirSync(templates, { recursive: true });
  // Override the ticket template but drop the required "## Outcome" heading.
  writeFileSync(join(templates, "ticket.md"), "## Context\n\n<!-- only context -->\n");

  const failure = run(project, ["doctor"], 1);
  assert.match(failure, /ticket\.md/u);
  assert.match(failure, /Outcome/u);
  assert.match(failure, /required by the contract/u);
});
