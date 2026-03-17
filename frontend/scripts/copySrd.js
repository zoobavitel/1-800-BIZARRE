#!/usr/bin/env node
/**
 * Copies the SRD markdown to public/ so it can be fetched at runtime.
 * Run via prebuild/prestart.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const SRD_SOURCE = path.join(REPO_ROOT, 'docs', '1(800)-Bizarre SRD.md');
const SRD_DEST = path.join(__dirname, '../public/game-rules-srd.md');

function main() {
  if (!fs.existsSync(SRD_SOURCE)) {
    console.warn('copySrd: SRD not found at', SRD_SOURCE);
    return;
  }
  fs.mkdirSync(path.dirname(SRD_DEST), { recursive: true });
  fs.copyFileSync(SRD_SOURCE, SRD_DEST);
  console.log('Copied SRD to public/game-rules-srd.md');
}

main();
