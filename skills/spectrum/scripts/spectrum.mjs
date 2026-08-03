#!/usr/bin/env node

import { randomInt } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const ISSUE_STATES = ["open", "ready", "ticketed"];
const TICKET_STATES = ["draft", "ready", "active", "qa", "done"];
const TRANSITIONS = {
  issue: {
    open: ["ready"],
    ready: ["open", "ticketed"],
    ticketed: ["ready"],
  },
  ticket: {
    draft: ["ready"],
    ready: ["draft", "active"],
    active: ["ready", "qa"],
    qa: ["active", "done"],
    done: ["qa"],
  },
};
const DEFAULT_CONFIG = {
  schemaVersion: 2,
  paths: {
    issues: "spectrum/issues",
    tickets: "spectrum/tickets",
    issueArchive: "spectrum/archives/issues",
    ticketArchive: "spectrum/archives/tickets",
    specs: "docs/specs",
    adrs: "docs/adrs",
  },
  contract: {
    issue: {
      ready: { sections: ["Problem", "Desired outcome"] },
      ticketed: { linkedTickets: true },
    },
    ticket: {
      ready: {
        sections: ["Outcome", "Context", "Validation", "Spec updates", "ADR candidates"],
        subsections: ["In scope", "Out of scope"],
        checklists: ["Acceptance criteria", "Implementation plan", "Human QA"],
      },
      qa: {
        checklistsComplete: ["Acceptance criteria", "Implementation plan"],
        sections: ["Execution log"],
      },
      done: {
        checklistsComplete: ["Human QA"],
        qaApproved: true,
      },
    },
  },
};

// scripts/ -> skills/spectrum/ ; templates live at skills/spectrum/templates/
const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

function loadTemplate(root, name) {
  const override = join(root, "spectrum", "templates", `${name}.md`);
  if (existsSync(override)) return readFileSync(override, "utf8");
  return readFileSync(join(SKILL_DIR, "templates", `${name}.md`), "utf8");
}

class CliError extends Error {}

function fail(message) {
  throw new CliError(message);
}

function parseCommandLine(args) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const name = value.slice(2);
    if (name === "archived" || name === "no-agents") {
      flags[name] = true;
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      fail(`The --${name} option needs a value.`);
    }
    flags[name] = next;
    index += 1;
  }
  return { positionals, flags };
}

function findProjectRoot(start = process.cwd()) {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, "spectrum", "config.json"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  fail(
    "No Spectrum project was found. Run `spectrum init` from the project root first.",
  );
}

function loadProject(start) {
  const root = findProjectRoot(start);
  const configPath = join(root, "spectrum", "config.json");
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    fail(`Could not read ${relative(root, configPath)}: ${error.message}`);
  }
  validateConfig(config);
  const legacyConfig = config.schemaVersion === 1 || !config.contract;
  if (legacyConfig) {
    config.contract = DEFAULT_CONFIG.contract;
  }
  return { root, config, legacyConfig };
}

function validateConfig(config) {
  if (config?.schemaVersion !== 1 && config?.schemaVersion !== 2) {
    fail("spectrum/config.json must use Spectrum schemaVersion 1 or 2.");
  }
  if (!config.paths) {
    fail("spectrum/config.json is missing the paths object.");
  }
  if (config.schemaVersion === 2 && (typeof config.contract !== "object" || config.contract === null)) {
    fail("spectrum/config.json is missing the contract object.");
  }
  for (const name of Object.keys(DEFAULT_CONFIG.paths)) {
    const configured = config.paths[name];
    if (typeof configured !== "string" || !configured) {
      fail(`spectrum/config.json is missing the paths.${name} setting.`);
    }
    if (
      isAbsolute(configured) ||
      configured.split(/[\\/]/u).includes("..")
    ) {
      fail(`paths.${name} must be a non-empty path inside the project.`);
    }
  }
}

function projectPath(project, name) {
  const target = resolve(project.root, project.config.paths[name]);
  const prefix = `${resolve(project.root)}${sep}`;
  if (!target.startsWith(prefix)) {
    fail(`The configured ${name} path escapes the project root.`);
  }
  return target;
}

const AGENTS_START = "<!-- spectrum:start -->";
const AGENTS_END = "<!-- spectrum:end -->";

function writeAgentsBootstrap(root) {
  const agentsPath = join(root, "AGENTS.md");
  const block = `${AGENTS_START}\n${loadTemplate(root, "agents").trim()}\n${AGENTS_END}`;
  if (!existsSync(agentsPath)) {
    writeFileSync(agentsPath, `${block}\n`);
    console.log("Added Spectrum guidance to AGENTS.md.");
    return;
  }
  const existing = readFileSync(agentsPath, "utf8");
  const start = existing.indexOf(AGENTS_START);
  if (start !== -1) {
    const end = existing.indexOf(AGENTS_END, start);
    if (end !== -1) {
      const updated =
        existing.slice(0, start) + block + existing.slice(end + AGENTS_END.length);
      writeFileSync(agentsPath, updated);
      console.log("Updated Spectrum guidance in AGENTS.md.");
      return;
    }
  }
  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  writeFileSync(agentsPath, `${existing}${separator}${block}\n`);
  console.log("Added Spectrum guidance to AGENTS.md.");
}

function initialize(pathArg, flags = {}) {
  const root = resolve(pathArg || process.cwd());
  const configPath = join(root, "spectrum", "config.json");
  if (existsSync(configPath)) {
    fail(`Spectrum is already initialized at ${root}. Run \`spectrum upgrade\` to update an existing project.`);
  }
  for (const path of Object.values(DEFAULT_CONFIG.paths)) {
    mkdirSync(join(root, path), { recursive: true });
  }
  writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  console.log(`Initialized Spectrum at ${root}.`);
  if (!flags["no-agents"]) {
    writeAgentsBootstrap(root);
  }
}

function now() {
  return new Date().toISOString();
}

const CROCKFORD_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

function makeId() {
  let id = "";
  for (let i = 0; i < 6; i += 1) {
    id += CROCKFORD_ALPHABET[randomInt(CROCKFORD_ALPHABET.length)];
  }
  return id;
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 60);
  return slug || "untitled";
}

function encodeValue(value) {
  return JSON.stringify(value);
}

function serializeArtifact(artifact) {
  const order = [
    "spectrum",
    "kind",
    "id",
    "title",
    "status",
    "blocked_by",
    "created",
    "updated",
    "source_issue",
    "tickets",
    "specs",
    "adrs",
  ];
  const lines = order
    .filter((key) => Object.hasOwn(artifact.data, key))
    .map((key) => `${key}: ${encodeValue(artifact.data[key])}`);
  return `---\n${lines.join("\n")}\n---\n\n${artifact.body.trim()}\n`;
}

function parseValue(raw, path, key) {
  try {
    return JSON.parse(raw);
  } catch {
    if (/^[A-Za-z0-9_.:/+-]+$/u.test(raw)) return raw;
    fail(`${path}: frontmatter field "${key}" is not a supported scalar or JSON value.`);
  }
}

function parseArtifact(path) {
  const text = readFileSync(path, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u);
  if (!match) fail(`${path}: expected YAML frontmatter wrapped in --- lines.`);
  const data = {};
  for (const line of match[1].split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const field = line.match(/^([a-z_]+):\s*(.*)$/u);
    if (!field) fail(`${path}: unsupported frontmatter line "${line}".`);
    data[field[1]] = parseValue(field[2], path, field[1]);
  }
  return { path, data, body: match[2].trim() };
}

function createArtifact(kind, title, sourceIssue) {
  if (!title?.trim()) fail("A non-empty --title is required.");
  const project = loadProject();
  let linkedIssue;
  if (sourceIssue) {
    linkedIssue = findArtifact(project, sourceIssue);
    if (linkedIssue.data.kind !== "issue") fail(`${sourceIssue} is not an issue.`);
    if (linkedIssue.archived) fail(`${sourceIssue} is archived and cannot be linked.`);
  }
  const id = makeId();
  const timestamp = now();
  const data =
    kind === "issue"
      ? {
          spectrum: 1,
          kind,
          id,
          title: title.trim(),
          status: "open",
          blocked_by: [],
          created: timestamp,
          updated: timestamp,
          tickets: [],
        }
      : {
          spectrum: 1,
          kind,
          id,
          title: title.trim(),
          status: "draft",
          blocked_by: [],
          created: timestamp,
          updated: timestamp,
          source_issue: sourceIssue || null,
          specs: [],
          adrs: [],
        };
  const artifact = { data, body: loadTemplate(project.root, kind) };
  const directory = projectPath(project, kind === "issue" ? "issues" : "tickets");
  const path = join(directory, `${id}-${slugify(title)}.${kind}.md`);
  writeFileSync(path, serializeArtifact(artifact));

  if (linkedIssue) {
    linkedIssue.data.tickets = [...new Set([...(linkedIssue.data.tickets || []), id])];
    saveArtifact(linkedIssue);
  }
  console.log(`Created ${kind} ${id} at ${relative(project.root, path)}.`);
}

function artifactDirectories(project, includeArchived = true) {
  const entries = [
    ["issues", false],
    ["tickets", false],
    ["issueArchive", true],
    ["ticketArchive", true],
  ];
  return entries
    .filter(([, archived]) => includeArchived || !archived)
    .map(([name, archived]) => ({ path: projectPath(project, name), archived }));
}

function scanArtifacts(project, includeArchived = true) {
  const artifacts = [];
  for (const directory of artifactDirectories(project, includeArchived)) {
    if (!existsSync(directory.path)) continue;
    for (const name of readdirSync(directory.path).sort()) {
      if (!name.endsWith(".md")) continue;
      const artifact = parseArtifact(join(directory.path, name));
      artifact.archived = directory.archived;
      artifacts.push(artifact);
    }
  }
  return artifacts;
}

function findArtifact(project, id) {
  const matches = scanArtifacts(project).filter((artifact) => artifact.data.id === id);
  if (matches.length === 0) fail(`No Spectrum artifact has ID ${id}.`);
  if (matches.length > 1) fail(`More than one Spectrum artifact has ID ${id}. Run doctor.`);
  return matches[0];
}

function saveArtifact(artifact) {
  artifact.data.updated = now();
  writeFileSync(artifact.path, serializeArtifact(artifact));
}

function cleanSection(value) {
  return value.replace(/<!--[\s\S]*?-->/gu, "").trim();
}

function section(body, heading, level = 2) {
  const hashes = "#".repeat(level);
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(
    `^${hashes} ${escaped}[\\t ]*$([\\s\\S]*?)(?=^#{1,${level}} |(?![\\s\\S]))`,
    "imu",
  );
  const match = body.match(pattern);
  return cleanSection(match?.[1] || "");
}

function checklist(sectionText) {
  return [...sectionText.matchAll(/^- \[([ xX])\]\s+(.+)$/gmu)].map((match) => ({
    checked: match[1].toLowerCase() === "x",
    text: match[2].trim(),
  }));
}

function readinessProblems(artifact, targetStatus, contract, options = {}) {
  const problems = [];
  const kind = artifact.data.kind;
  const gate = contract?.[kind]?.[targetStatus] || {};

  for (const heading of gate.sections || []) {
    if (!section(artifact.body, heading)) problems.push(`fill the ${heading} section`);
  }
  for (const heading of gate.subsections || []) {
    if (!section(artifact.body, heading, 3)) problems.push(`fill the ${heading} subsection`);
  }
  for (const heading of gate.checklists || []) {
    const items = checklist(section(artifact.body, heading));
    if (items.length === 0 || items.some((item) => /placeholder/iu.test(item.text))) {
      problems.push(`replace placeholders in ${heading} with concrete checkboxes`);
    }
  }
  for (const heading of gate.checklistsComplete || []) {
    const items = checklist(section(artifact.body, heading));
    if (items.length === 0 || items.some((item) => !item.checked)) {
      problems.push(`complete every checkbox in ${heading}`);
    }
  }
  if (gate.linkedTickets) {
    if (!Array.isArray(artifact.data.tickets) || artifact.data.tickets.length === 0) {
      problems.push("link at least one ticket in frontmatter");
    }
  }
  if (gate.qaApproved) {
    if (!/\bapproved\b/iu.test(section(artifact.body, "QA notes"))) {
      problems.push('record explicit user approval in QA notes using the word "approved"');
    }
  }

  if (
    ["ready", "active", "qa", "done", "ticketed"].includes(targetStatus) &&
    !options.ignoreBlockers &&
    Array.isArray(artifact.data.blocked_by) &&
    artifact.data.blocked_by.length > 0
  ) {
    problems.push("clear every blocked_by entry");
  }
  return problems;
}

function transition(id, targetStatus) {
  const project = loadProject();
  const artifact = findArtifact(project, id);
  if (artifact.archived) fail(`${id} is archived and cannot transition.`);
  const current = artifact.data.status;
  const allowed = TRANSITIONS[artifact.data.kind]?.[current] || [];
  if (!allowed.includes(targetStatus)) {
    fail(
      `${id} cannot move from ${current} to ${targetStatus}. Allowed next states: ${
        allowed.join(", ") || "none"
      }.`,
    );
  }
  const problems = readinessProblems(artifact, targetStatus, project.config.contract);
  if (artifact.data.kind === "issue" && targetStatus === "ticketed") {
    const linked = (artifact.data.tickets || []).map((ticketId) =>
      findArtifact(project, ticketId),
    );
    if (!linked.some((ticket) => ticket.data.kind === "ticket" && ticket.data.status !== "draft")) {
      problems.push("link at least one ticket that has reached ready");
    }
  }
  if (artifact.data.kind === "ticket" && ["qa", "done"].includes(targetStatus)) {
    for (const [field, label] of [
      ["specs", "spec"],
      ["adrs", "ADR"],
    ]) {
      for (const reference of artifact.data[field] || []) {
        if (typeof reference !== "string") {
          problems.push(`make every ${field} entry a relative path string`);
          continue;
        }
        const resolved = resolve(project.root, reference);
        if (
          isAbsolute(reference) ||
          !resolved.startsWith(`${resolve(project.root)}${sep}`) ||
          !existsSync(resolved)
        ) {
          problems.push(`create the referenced ${label} ${reference} inside the project`);
        }
      }
    }
  }
  if (problems.length) {
    fail(`${id} cannot move to ${targetStatus}; ${problems.join("; ")}.`);
  }
  artifact.data.status = targetStatus;
  saveArtifact(artifact);
  console.log(`Moved ${id} from ${current} to ${targetStatus}.`);
}

function setBlock(id, reason) {
  if (!reason?.trim()) fail("A non-empty blocker reason is required.");
  const project = loadProject();
  const artifact = findArtifact(project, id);
  if (artifact.archived) fail(`${id} is archived and cannot be edited.`);
  artifact.data.blocked_by = [...(artifact.data.blocked_by || []), reason.trim()];
  saveArtifact(artifact);
  console.log(`Recorded blocker ${artifact.data.blocked_by.length} on ${id}.`);
}

function clearBlock(id, numberText) {
  const project = loadProject();
  const artifact = findArtifact(project, id);
  if (artifact.archived) fail(`${id} is archived and cannot be edited.`);
  const number = Number.parseInt(numberText, 10);
  const blockers = artifact.data.blocked_by || [];
  if (!Number.isInteger(number) || number < 1 || number > blockers.length) {
    fail(`${id} has ${blockers.length} blocker(s); choose a number in that range.`);
  }
  const [removed] = blockers.splice(number - 1, 1);
  artifact.data.blocked_by = blockers;
  saveArtifact(artifact);
  console.log(`Cleared blocker "${removed}" from ${id}.`);
}

function listArtifacts(kind, flags) {
  const project = loadProject();
  const normalizedKind =
    kind === "issues" ? "issue" : kind === "tickets" ? "ticket" : kind || "all";
  if (!["issue", "ticket", "all"].includes(normalizedKind)) {
    fail("List accepts issues, tickets, or all.");
  }
  const artifacts = scanArtifacts(project, Boolean(flags.archived))
    .filter((artifact) => normalizedKind === "all" || artifact.data.kind === normalizedKind)
    .filter((artifact) => !flags.status || artifact.data.status === flags.status)
    .sort((a, b) => b.data.updated.localeCompare(a.data.updated));
  if (!artifacts.length) {
    console.log("No matching Spectrum artifacts.");
    return;
  }
  for (const artifact of artifacts) {
    const blockers = artifact.data.blocked_by?.length
      ? `, ${artifact.data.blocked_by.length} blocker(s)`
      : "";
    const archived = artifact.archived ? ", archived" : "";
    console.log(
      `${artifact.data.id}  ${artifact.data.status}${blockers}${archived}  ${artifact.data.title}`,
    );
  }
}

function showArtifact(id) {
  const project = loadProject();
  const artifact = findArtifact(project, id);
  console.log(`${relative(project.root, artifact.path)}\n`);
  process.stdout.write(readFileSync(artifact.path, "utf8"));
}

function archiveArtifact(id) {
  const project = loadProject();
  const artifact = findArtifact(project, id);
  if (artifact.archived) fail(`${id} is already archived.`);
  const terminal = artifact.data.kind === "issue" ? "ticketed" : "done";
  if (artifact.data.status !== terminal) {
    fail(`${id} must be ${terminal} before it can be archived.`);
  }
  const targetName = artifact.data.kind === "issue" ? "issueArchive" : "ticketArchive";
  const target = join(projectPath(project, targetName), basename(artifact.path));
  renameSync(artifact.path, target);
  console.log(`Archived ${id} at ${relative(project.root, target)}.`);
}

function validateArtifactShape(artifact, project, byId) {
  const errors = [];
  const warnings = [];
  const label = relative(project.root, artifact.path);
  const data = artifact.data;
  const addError = (message) => errors.push(`${label}: ${message}`);
  if (data.spectrum !== 1) addError("set spectrum frontmatter to 1.");
  if (!["issue", "ticket"].includes(data.kind)) addError("kind must be issue or ticket.");
  if (typeof data.id !== "string" || !/^[0-9a-hjkmnp-tv-z]{6}$/u.test(data.id)) {
    addError("id must be 6 Crockford base32 chars, e.g. 9f3kq2.");
  }
  if (typeof data.title !== "string" || !data.title.trim()) addError("title must not be empty.");
  const states = data.kind === "issue" ? ISSUE_STATES : TICKET_STATES;
  if (!states.includes(data.status)) addError(`status must be one of: ${states.join(", ")}.`);
  if (!Array.isArray(data.blocked_by)) addError("blocked_by must be an array.");
  if (
    typeof data.created !== "string" ||
    typeof data.updated !== "string" ||
    !Number.isFinite(Date.parse(data.created)) ||
    !Number.isFinite(Date.parse(data.updated))
  ) {
    addError("created and updated must be ISO date-time strings.");
  }
  if (!basename(artifact.path).startsWith(`${data.id}-`)) {
    addError(`filename must start with ${data.id}-.`);
  }
  if (!basename(artifact.path).endsWith(`.${data.kind}.md`)) {
    addError(`filename must end with .${data.kind}.md.`);
  }

  if (data.kind === "issue") {
    if (!Array.isArray(data.tickets)) addError("tickets must be an array.");
    for (const ticketId of data.tickets || []) {
      if (!byId.has(ticketId)) addError(`linked ticket ${ticketId} does not exist.`);
      else if (byId.get(ticketId).data.kind !== "ticket") {
        addError(`linked artifact ${ticketId} is not a ticket.`);
      }
    }
    if (
      data.status === "ticketed" &&
      !(data.tickets || []).some(
        (ticketId) =>
          byId.get(ticketId)?.data.kind === "ticket" &&
          byId.get(ticketId).data.status !== "draft",
      )
    ) {
      addError("ticketed issues must link to at least one ticket that has reached ready.");
    }
  }
  if (data.kind === "ticket") {
    if (!Array.isArray(data.specs) || !Array.isArray(data.adrs)) {
      addError("specs and adrs must be arrays.");
    }
    if (data.source_issue && !byId.has(data.source_issue)) {
      addError(`source issue ${data.source_issue} does not exist.`);
    }
    if (data.source_issue && byId.get(data.source_issue)?.data.kind !== "issue") {
      addError(`source_issue ${data.source_issue} is not an issue.`);
    }
    if (
      data.source_issue &&
      byId.get(data.source_issue)?.data.kind === "issue" &&
      !byId.get(data.source_issue).data.tickets?.includes(data.id)
    ) {
      addError(`source issue ${data.source_issue} does not link back to this ticket.`);
    }
    if (["qa", "done"].includes(data.status)) {
      for (const spec of data.specs || []) {
        if (typeof spec !== "string") {
          addError("every specs entry must be a relative path string.");
          continue;
        }
        const resolved = resolve(project.root, spec);
        if (isAbsolute(spec) || !resolved.startsWith(`${resolve(project.root)}${sep}`)) {
          addError(`referenced spec ${spec} must be a relative path inside the project.`);
        } else if (!existsSync(resolved)) {
          addError(`referenced spec ${spec} does not exist at QA time.`);
        }
      }
      for (const adr of data.adrs || []) {
        if (typeof adr !== "string") {
          addError("every adrs entry must be a relative path string.");
          continue;
        }
        const resolved = resolve(project.root, adr);
        if (isAbsolute(adr) || !resolved.startsWith(`${resolve(project.root)}${sep}`)) {
          addError(`referenced ADR ${adr} must be a relative path inside the project.`);
        } else if (!existsSync(resolved)) {
          addError(`referenced ADR ${adr} does not exist at QA time.`);
        }
      }
    }
    if (data.status === "draft") {
      warnings.push(`${label}: ticket is a non-executable draft.`);
    }
  }
  if (data.blocked_by?.length) {
    warnings.push(`${label}: ${data.blocked_by.length} blocker(s) remain.`);
  }

  const terminal =
    (data.kind === "issue" && data.status === "ticketed") ||
    (data.kind === "ticket" && data.status === "done");

  if (!artifact.archived && !terminal) {
    const requiredGates =
      data.kind === "issue"
        ? { open: [], ready: ["ready"] }[data.status] || []
        : { draft: [], ready: ["ready"], active: ["ready"], qa: ["ready", "qa"] }[data.status] || [];
    const gateProblems = new Set(
      requiredGates.flatMap((gate) =>
        readinessProblems(artifact, gate, project.config.contract, { ignoreBlockers: true }),
      ),
    );
    for (const problem of gateProblems) {
      warnings.push(`${label}: status ${data.status} is stale until you ${problem}.`);
    }
  }

  return { errors, warnings };
}

function hasHeading(templateText, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`^#{1,6} ${escaped}[\\t ]*$`, "imu").test(templateText);
}

function templateContractProblems(project) {
  const problems = [];
  for (const kind of ["issue", "ticket"]) {
    const gates = project.config.contract?.[kind] || {};
    const required = new Set();
    for (const gate of Object.values(gates)) {
      for (const heading of gate.sections || []) required.add(heading);
      for (const heading of gate.subsections || []) required.add(heading);
    }
    let template;
    try {
      template = loadTemplate(project.root, kind);
    } catch {
      problems.push(`${kind} template could not be read.`);
      continue;
    }
    for (const heading of required) {
      if (!hasHeading(template, heading)) {
        problems.push(`${kind}.md is missing the "## ${heading}" heading required by the contract.`);
      }
    }
  }
  return problems;
}

function upgradeConfig(pathArg) {
  const root = findProjectRoot(resolve(pathArg || process.cwd()));
  const configPath = join(root, "spectrum", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (config.schemaVersion === 2 && config.contract) {
    console.log("Spectrum config is already current (schemaVersion 2).");
    return;
  }
  config.schemaVersion = 2;
  if (!config.contract) config.contract = DEFAULT_CONFIG.contract;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Upgraded ${relative(root, configPath)} to schemaVersion 2.`);
}

function doctor() {
  const project = loadProject();
  const errors = [];
  const warnings = [];
  if (project.legacyConfig) {
    warnings.push("config is schemaVersion 1; run `spectrum upgrade` to persist the contract.");
  }
  for (const name of Object.keys(DEFAULT_CONFIG.paths)) {
    const path = projectPath(project, name);
    if (!existsSync(path)) errors.push(`${project.config.paths[name]} is missing.`);
  }
  errors.push(...templateContractProblems(project));
  let artifacts = [];
  try {
    artifacts = scanArtifacts(project);
  } catch (error) {
    if (error instanceof CliError) errors.push(error.message);
    else throw error;
  }
  const byId = new Map();
  for (const artifact of artifacts) {
    if (byId.has(artifact.data.id)) {
      errors.push(`ID ${artifact.data.id} appears in more than one file.`);
    } else {
      byId.set(artifact.data.id, artifact);
    }
  }
  for (const artifact of artifacts) {
    const result = validateArtifactShape(artifact, project, byId);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }
  if (errors.length) {
    console.error(`Spectrum found ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
  } else {
    console.log(`Spectrum is healthy: checked ${artifacts.length} artifact(s).`);
  }
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const warning of warnings) console.log(`- ${warning}`);
  }
  if (errors.length) process.exitCode = 1;
}

function help() {
  console.log(`Spectrum

Usage:
  spectrum init [path] [--no-agents]
  spectrum upgrade [path]
  spectrum new issue --title <title>
  spectrum new ticket --title <title> [--issue <issue-id>]
  spectrum list [issues|tickets|all] [--status <status>] [--archived]
  spectrum show <id>
  spectrum transition <id> <status>
  spectrum block <id> <reason>
  spectrum unblock <id> <reason-number>
  spectrum archive <id>
  spectrum doctor
  spectrum help`);
}

function main() {
  const { positionals, flags } = parseCommandLine(process.argv.slice(2));
  const [command = "help", noun, value] = positionals;
  switch (command) {
    case "init":
      initialize(noun, flags);
      break;
    case "upgrade":
      upgradeConfig(noun);
      break;
    case "new":
      if (!["issue", "ticket"].includes(noun)) fail("New accepts issue or ticket.");
      createArtifact(noun, flags.title, flags.issue);
      break;
    case "list":
      listArtifacts(noun, flags);
      break;
    case "show":
      if (!noun) fail("Show needs an artifact ID.");
      showArtifact(noun);
      break;
    case "transition":
      if (!noun || !value) fail("Transition needs an artifact ID and target status.");
      transition(noun, value);
      break;
    case "block":
      if (!noun || !value) fail("Block needs an artifact ID and a quoted reason.");
      setBlock(noun, value);
      break;
    case "unblock":
      if (!noun || !value) fail("Unblock needs an artifact ID and blocker number.");
      clearBlock(noun, value);
      break;
    case "archive":
      if (!noun) fail("Archive needs an artifact ID.");
      archiveArtifact(noun);
      break;
    case "doctor":
      doctor();
      break;
    case "help":
    case "--help":
    case "-h":
      help();
      break;
    default:
      fail(`Unknown command "${command}". Run spectrum help.`);
  }
}

try {
  main();
} catch (error) {
  if (error instanceof CliError) {
    console.error(`Spectrum could not continue: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
