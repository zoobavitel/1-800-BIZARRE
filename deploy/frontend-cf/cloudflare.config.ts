import { defineConfig } from "cf/config";

// Static frontend for 1-800-bizarre.com. No Worker code: Cloudflare serves the
// files in frontend/build (see wrangler.config.ts). The API stays on
// api.1-800-bizarre.com (Cloudflare Tunnel -> CT 103).
export default defineConfig({
  worker: {
    name: "bizarre-frontend",
    compatibilityDate: "2026-10-06",
    domains: ["1-800-bizarre.com"],
    workersDev: false,
    previewUrls: false,
    assets: {
      // Routing is hash-based (#npcs/42); this only covers a typed path.
      notFoundHandling: "single-page-application",
    },
    observability: { enabled: true },
  },
});
