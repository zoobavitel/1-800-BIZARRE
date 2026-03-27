/**
 * Hits the API root (GET /) against a running backend.
 *
 * - CI: Django is started on 127.0.0.1:8000 (see .github/workflows/ci.yml).
 * - Local with ngrok: point at your tunnel, e.g.
 *     INTEGRATION_API_URL=https://xxxx.ngrok-free.app npm test -- --testPathPattern=integration --watchAll=false
 */

const http = require('http');
const https = require('https');

const BASE =
  process.env.INTEGRATION_API_URL || 'http://127.0.0.1:8000';

function getJson(urlString) {
  const u = new URL(urlString);
  const lib = u.protocol === 'https:' ? https : http;
  const headers = {};
  if (u.hostname.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = '1';
  }
  return new Promise((resolve, reject) => {
    lib
      .get(urlString, { headers }, (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

describe('Backend integration', () => {
  it('serves the API root', async () => {
    const { statusCode, body } = await getJson(`${BASE}/`);
    expect(statusCode).toBe(200);
    expect(body.message).toMatch(/Bizarre/i);
  }, 15000);
});
