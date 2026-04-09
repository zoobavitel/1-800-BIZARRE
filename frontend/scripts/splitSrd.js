#!/usr/bin/env node
/**
 * Splits docs/1(800)-Bizarre SRD.md on top-level (#) headings into public/srd/<slug>.md
 * for per-section rules pages. Run from prebuild/prestart (via copySrd.js).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const SRD_SOURCE = path.join(REPO_ROOT, 'docs', '1(800)-Bizarre SRD.md');
const OUT_DIR = path.join(__dirname, '../public/srd');
const LEGACY_MONOLITH = path.join(__dirname, '../public/game-rules-srd.md');
const RULES_NAV_PATH = path.join(__dirname, '../src/data/rulesNav.js');

/** Consecutive H1 subtitles or Resources/Downloads — fold into the previous section file. */
const MERGE_INTO_PREVIOUS = new Set([
  'downloads',
  'spin-mastery-the-playbooks-of-the-perfect-spin',
  'hamon-mastery-the-pulse-of-life',
]);

function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

function splitIntoChunks(content) {
  const lines = content.split('\n');
  const chunks = [];
  let cur = [];
  for (const line of lines) {
    if (/^#\s/.test(line) && !/^##/.test(line)) {
      if (cur.length) chunks.push(cur.join('\n'));
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) chunks.push(cur.join('\n'));
  return chunks;
}

function navSlugsFromSource(navSrc) {
  const slugs = [];
  const re = /\bslug:\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(navSrc)) !== null) {
    slugs.push(m[1]);
  }
  return slugs;
}

function main() {
  if (!fs.existsSync(SRD_SOURCE)) {
    console.warn('splitSrd: SRD not found at', SRD_SOURCE);
    return;
  }

  const content = fs.readFileSync(SRD_SOURCE, 'utf8');
  const rawChunks = splitIntoChunks(content);
  const sections = [];

  for (const chunk of rawChunks) {
    const firstLine = chunk.split('\n')[0].replace(/^#\s+/, '').trim();
    const slug = slugify(firstLine);
    if (!slug) {
      console.warn('splitSrd: skipping chunk with empty slug:', firstLine.slice(0, 80));
      continue;
    }
    if (MERGE_INTO_PREVIOUS.has(slug) && sections.length) {
      sections[sections.length - 1].body += `\n\n${chunk}`;
    } else {
      sections.push({ slug, body: chunk });
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.md')) {
      fs.unlinkSync(path.join(OUT_DIR, f));
    }
  }

  const written = new Set();
  for (const { slug, body } of sections) {
    if (written.has(slug)) {
      console.warn('splitSrd: duplicate slug (skipped):', slug);
      continue;
    }
    written.add(slug);
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.md`), body, 'utf8');
  }

  if (fs.existsSync(LEGACY_MONOLITH)) {
    fs.unlinkSync(LEGACY_MONOLITH);
  }

  console.log(`splitSrd: wrote ${written.size} section files to public/srd/`);

  if (!written.has('game-rules-srd')) {
    console.warn('splitSrd: expected overview file game-rules-srd.md missing');
  }

  if (fs.existsSync(RULES_NAV_PATH)) {
    const navSrc = fs.readFileSync(RULES_NAV_PATH, 'utf8');
    const need = navSlugsFromSource(navSrc);
    const missing = need.filter((s) => s && !written.has(s));
    if (missing.length) {
      console.warn('splitSrd: rulesNav slugs with no section file:', missing.join(', '));
    }
  }
}

main();
