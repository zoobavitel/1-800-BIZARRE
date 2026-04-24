import { spawn } from "node:child_process";

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

await run("npx", [
  "--yes",
  "lighthouse",
  frontendUrl,
  "--only-categories=performance",
  "--chrome-flags=\"--headless --no-sandbox\"",
  `--budgets-path=scripts/perf/lighthouse-budget.json`,
  "--quiet",
]);
