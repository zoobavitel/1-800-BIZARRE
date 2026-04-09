#!/usr/bin/env node
/**
 * Generates patchNotes.js from git log.
 * Parses conventional commits (feat:, fix:, docs:, etc.) and groups by date.
 * Run via prebuild/prestart.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const OUTPUT_PATH = path.join(__dirname, "../src/data/patchNotes.js");

const PREFIX_TO_SECTION = {
  feat: "Added",
  fix: "Fixed",
  docs: "Documentation",
  refactor: "Refactored",
  chore: "Maintenance",
  style: "Style",
  perf: "Performance",
  test: "Tests",
};

function parseCommitLine(line) {
  const match = line.match(/^([a-f0-9]+)\|(.+)\|(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  const [, hash, subject, date] = match;
  return { hash, subject: subject.trim(), date };
}

function categorizeCommit(subject) {
  const lower = subject.toLowerCase();
  for (const [prefix, section] of Object.entries(PREFIX_TO_SECTION)) {
    if (lower.startsWith(prefix + ":") || lower.startsWith(prefix + "(")) {
      const msg = subject
        .replace(new RegExp(`^${prefix}(?:\\([^)]*\\))?:\\s*`, "i"), "")
        .trim();
      return { section, message: msg || subject };
    }
  }
  return { section: "Other", message: subject };
}

function generateFromGit() {
  const cwd = REPO_ROOT;
  try {
    const out = execSync(
      'git log --pretty=format:"%h|%s|%ad" --date=short -200',
      { cwd, encoding: "utf-8", maxBuffer: 1024 * 1024 },
    );
    const lines = out.trim().split("\n").filter(Boolean);
    const byDate = new Map();

    for (const line of lines) {
      const commit = parseCommitLine(line);
      if (!commit) continue;

      const { section, message } = categorizeCommit(commit.subject);
      if (!byDate.has(commit.date)) {
        byDate.set(commit.date, {
          date: commit.date,
          version: null,
          sections: {},
        });
      }
      const entry = byDate.get(commit.date);
      if (!entry.sections[section]) entry.sections[section] = [];
      entry.sections[section].push(message);
    }

    return Array.from(byDate.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(({ date, version, sections }) => ({
        date,
        version,
        sections: Object.entries(sections).map(([title, items]) => ({
          title,
          items,
        })),
      }));
  } catch (err) {
    console.warn(
      "generatePatchNotes: git log failed, using fallback:",
      err.message,
    );
    return null;
  }
}

function getFallback() {
  return [
    {
      date: new Date().toISOString().slice(0, 10),
      version: null,
      sections: [
        { title: "Added", items: ["Patch notes page"] },
        {
          title: "Other",
          items: [
            "Patch notes are generated from git commits. Run npm run build to refresh.",
          ],
        },
      ],
    },
  ];
}

function main() {
  const notes = generateFromGit() || getFallback();
  const content = `/**
 * Auto-generated from git log. Do not edit manually.
 * Run: node frontend/scripts/generatePatchNotes.js
 */
export const PATCH_NOTES = ${JSON.stringify(notes, null, 2)};
`;
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, content, "utf-8");
  console.log("Generated patchNotes.js with", notes.length, "entries");
}

main();
