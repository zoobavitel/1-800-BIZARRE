/**
 * Shared helpers for scripts/perf/* harnesses.
 * Refuse known production / Pages hosts so load tests never hit live players.
 */

const FORBIDDEN_HOST_SNIPPETS = [
  "zoobavitel.github.io",
  "github.io/1-800-BIZARRE",
  "roger-premunicipal-branden.ngrok-free.dev",
  // Live API (Cloudflare Tunnel). Players are on it; never load-test it.
  "api.1-800-bizarre.com",
];

/** Live Funnel. Direct runs use 127.0.0.1:8001. Public probe uses port 8443 only. */
const LIVE_FUNNEL_HOST = "bizarre-api.tailb65341.ts.net";

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
  let parsed;
  try {
    parsed = new URL(lower.startsWith("http") ? lower : `http://${lower}`);
  } catch {
    throw new Error(`Invalid PERF target URL: ${url}`);
  }
  if (parsed.hostname === LIVE_FUNNEL_HOST) {
    if (process.env.PERF_ALLOW_REMOTE !== "1" || parsed.port !== "8443") {
      throw new Error(
        `Refusing live Funnel ${url}. Direct run: http://127.0.0.1:8001. ` +
          `Funnel run: https://${LIVE_FUNNEL_HOST}:8443 with PERF_ALLOW_REMOTE=1.`,
      );
    }
    return;
  }
  if (process.env.PERF_ALLOW_REMOTE !== "1") {
    const host = parsed.hostname;
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
  }
}

export function apiRoot(base) {
  const b = (base || "http://127.0.0.1:8000").replace(/\/$/, "");
  return b.endsWith("/api") ? b : `${b}/api`;
}

export function summarize(samples, durationMs) {
  const sorted = [...samples].sort((a, b) => a - b);
  const seconds = Math.max(durationMs / 1000, 0.001);
  return {
    n: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.length ? sorted[sorted.length - 1] : 0,
    rps: sorted.length / seconds,
  };
}

export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx];
}
