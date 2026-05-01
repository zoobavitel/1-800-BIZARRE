import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const frontendUrl = process.env.PERF_FRONTEND_URL || "http://127.0.0.1:3000";
const perfScoreBudget = Number(process.env.PERF_LIGHTHOUSE_MIN || 80);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

console.log(
  `Lighthouse check: url=${frontendUrl}, minimum performance score=${perfScoreBudget}`,
);

const reportDir = mkdtempSync(join(tmpdir(), "lh-report-"));
const reportPath = join(reportDir, "report.json");

await run("npx", [
  "--yes",
  "lighthouse",
  frontendUrl,
  "--only-categories=performance",
  "--chrome-flags=\"--headless --no-sandbox\"",
  `--budgets-path=scripts/perf/lighthouse-budget.json`,
  `--output=json`,
  `--output-path=${reportPath}`,
  "--quiet",
]);

let score;
try {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  score = Math.round(report.categories.performance.score * 100);
} catch (err) {
  console.error("Failed to parse Lighthouse report:", err.message);
  process.exit(1);
}

console.log(`Lighthouse performance score: ${score} (minimum: ${perfScoreBudget})`);

if (score < perfScoreBudget) {
  console.error(
    `Performance budget failed: score ${score} is below the minimum of ${perfScoreBudget}.`,
  );
  process.exit(1);
}

console.log("Performance budget check passed.");

