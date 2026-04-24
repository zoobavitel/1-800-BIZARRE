import { performance } from "node:perf_hooks";

const base = process.env.PERF_API_BASE_URL || "http://127.0.0.1:8000";
const target = `${base.replace(/\/$/, "")}/`;
const budgetMs = Number(process.env.PERF_API_BUDGET_MS || 400);

const start = performance.now();
const response = await fetch(target);
const end = performance.now();
const elapsedMs = end - start;

if (!response.ok) {
  throw new Error(`API check failed: ${target} returned ${response.status}`);
}

console.log(
  `API latency check: ${elapsedMs.toFixed(2)}ms (budget ${budgetMs}ms)`,
);

if (elapsedMs > budgetMs) {
  throw new Error(
    `API latency budget exceeded: ${elapsedMs.toFixed(2)}ms > ${budgetMs}ms`,
  );
}
