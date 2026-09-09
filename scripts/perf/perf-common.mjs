/**
 * Shared helpers for scripts/perf/* harnesses.
 * Refuse known production / Pages hosts so load tests never hit live players.
 */

const FORBIDDEN_HOST_SNIPPETS = [
  "zoobavitel.github.io",
  "github.io/1-800-BIZARRE",
  "roger-premunicipal-branden.ngrok-free.dev",
];

/** Extra deny list via PERF_FORBIDDEN_HOSTS=host1,host2 */
function envForbidden() {
  const raw = process.env.PERF_FORBIDDEN_HOSTS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function assertSafePerfTarget(url) {
  const lower = String(url || "").toLowerCase();
  if (!lower) {
    throw new Error("PERF target URL is empty");
  }
  const forbidden = [...FORBIDDEN_HOST_SNIPPETS, ...envForbidden()];
  for (const snip of forbidden) {
    if (lower.includes(snip)) {
      throw new Error(
        `Refusing perf/load harness against forbidden host matching "${snip}": ${url}. ` +
          "Use local/staging only (PERF_API_BASE_URL=http://127.0.0.1:8000).",
      );
    }
  }
  if (process.env.PERF_ALLOW_REMOTE !== "1") {
    try {
      const u = new URL(lower.startsWith("http") ? lower : `http://${lower}`);
      const host = u.hostname;
      const local =
        host === "127.0.0.1" ||
        host === "localhost" ||
        host === "::1" ||
        host.endsWith(".local");
      if (!local) {
        throw new Error(
          `Refusing non-local PERF target (${url}). Set PERF_ALLOW_REMOTE=1 for staging only.`,
        );
      }
    } catch (e) {
      if (e.message.startsWith("Refusing")) throw e;
      throw new Error(`Invalid PERF target URL: ${url}`);
    }
  }
}

export function apiRoot(base) {
  const b = (base || "http://127.0.0.1:8000").replace(/\/$/, "");
  return b.endsWith("/api") ? b : `${b}/api`;
}

export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx];
}
