/**
 * Hits the API root (GET /) against a running backend.
 *
 * Skipped unless RUN_BACKEND_INTEGRATION=1 or INTEGRATION_API_URL is set, so the
 * default `npm test` / CI test-frontend job does not require Django on :8000.
 *
 * - CI (with backend): integration-test job sets RUN_BACKEND_INTEGRATION=1 (see .github/workflows/ci.yml).
 * - Local: RUN_BACKEND_INTEGRATION=1 npm test -- --testPathPattern=integration --watchAll=false
 */

const http = require("http");
const https = require("https");

const BASE = process.env.INTEGRATION_API_URL || "http://127.0.0.1:8000";

const runIntegration =
  process.env.RUN_BACKEND_INTEGRATION === "1" ||
  (process.env.INTEGRATION_API_URL != null &&
    process.env.INTEGRATION_API_URL !== "");

function getJson(urlString) {
  const u = new URL(urlString);
  const lib = u.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    lib
      .get(urlString, (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
          } catch (e) {
            const preview = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
            reject(
              new Error(
                `Expected JSON from ${urlString} but could not parse body: ${preview}`,
              ),
            );
          }
        });
      })
      .on("error", reject);
  });
}

(runIntegration ? describe : describe.skip)("Backend integration", () => {
  it("serves the API root", async () => {
    const { statusCode, body } = await getJson(`${BASE}/`);
    expect(statusCode).toBe(200);
    expect(body.message).toMatch(/Bizarre/i);
  }, 15000);
});
