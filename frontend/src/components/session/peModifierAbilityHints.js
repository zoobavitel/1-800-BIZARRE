/**
 * Highlights standard / hamon / spin abilities that often interact with
 * position or effect tiers (loose keyword + small name allowlist). For GM session UI only.
 */

/** Matches common SRD phrasing (+N effect / +N position / reposition / stat elevation). */
const PE_MODIFIER_HINT_RE = new RegExp(
  [
    String.raw`(?:\+\s*[12]|adds\s\+\s*[12]|gain(?:s)?\s\+\s*[12])\s+effects?`,
    String.raw`\b\+\s*[12]\s+positions?\b`,
    String.raw`\bgrant(?:s)?\s\+\s*[12]\s+position\b`,
    String.raw`\bgain(?:s)?\s\+\s*[12]\s+d\b`,
    String.raw`\bbetter\s+position\b`,
    String.raw`\bworse\s+position\b`,
    String.raw`\breposition(?:ing)?\b`,
    String.raw`\binstantly\s+reposition\b`,
    String.raw`\bpotency\s*\(\+?\s*[12]`,
    String.raw`\bpotency[^\n]{0,48}\beffect\b`,
    String.raw`\bpush[^\n]{0,100}\beffect\b`,
    String.raw`\bgreater\s+effect\b`,
    String.raw`\binsist\s+on\s+a\s+riskier\s+effect\b`,
    String.raw`\bignore(?:s|)\s+\d+\s+level\s+of\s+armor\b`,
    String.raw`\btreat\s+all\s+your\s+stand\s+coin\s+stats\s+as\s+one\s+grade\s+higher\b`,
  ].join("|"),
  "i",
);

/**
 * Names that materially shift position/effect but may not match the regex
 * (or use unusual wording). Lowercase.
 */
const PE_MODIFIER_NAME_ALLOWLIST = new Set([
  "bizarre step",
  "drift through dimensions",
  "elastic rebound",
  "golden track",
  "narrative override",
  "requiem",
]);

const POSITION_HINT_RE = new RegExp(
  [
    String.raw`\b\+\s*[12]\s+positions?\b`,
    String.raw`\bgrant(?:s)?\s\+\s*[12]\s+position\b`,
    String.raw`\bbetter\s+position\b`,
    String.raw`\bworse\s+position\b`,
    String.raw`\breposition(?:ing)?\b`,
    String.raw`\binstantly\s+reposition\b`,
  ].join("|"),
  "i",
);

const EFFECT_HINT_RE = new RegExp(
  [
    String.raw`(?:\+\s*[12]|adds\s\+\s*[12]|gain(?:s)?\s\+\s*[12])\s+effects?`,
    String.raw`\bpotency\s*\(\+?\s*[12]`,
    String.raw`\bpotency[^\n]{0,48}\beffect\b`,
    String.raw`\bpush[^\n]{0,100}\beffect\b`,
    String.raw`\bgreater\s+effect\b`,
    String.raw`\binsist\s+on\s+a\s+riskier\s+effect\b`,
    String.raw`\bignore(?:s|)\s+\d+\s+level\s+of\s+armor\b`,
    String.raw`\btreat\s+all\s+your\s+stand\s+coin\s+stats\s+as\s+one\s+grade\s+higher\b`,
  ].join("|"),
  "i",
);

function normName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function abilityMatchesHint(entry) {
  if (!entry || typeof entry !== "object") return false;
  const name = normName(entry.name);
  if (name && PE_MODIFIER_NAME_ALLOWLIST.has(name)) return true;
  const blob = `${entry.name || ""}\n${entry.description || ""}`;
  return PE_MODIFIER_HINT_RE.test(blob);
}

function classifyHintKind(entry) {
  const name = normName(entry?.name);
  const blob = `${entry?.name || ""}\n${entry?.description || ""}`;
  if (name && PE_MODIFIER_NAME_ALLOWLIST.has(name)) {
    if (name === "bizarre step" || name === "drift through dimensions") return "position";
    if (name === "golden track" || name === "elastic rebound" || name === "requiem") return "effect";
    return "position/effect";
  }
  const hasPos = POSITION_HINT_RE.test(blob);
  const hasEff = EFFECT_HINT_RE.test(blob);
  if (hasPos && hasEff) return "position/effect";
  if (hasPos) return "position";
  if (hasEff) return "effect";
  return "position/effect";
}

/**
 * @param {object|null|undefined} character — API character with *_ability_details arrays
 * @returns {{ name: string, bucket: string, kind: "position"|"effect"|"position/effect" }[]}
 */
export function getPositionEffectModifierHints(character) {
  if (!character || typeof character !== "object") return [];

  const heritageEntries = (() => {
    const details = character.heritage_details || {};
    const selectedBenefits = new Set(
      (Array.isArray(character.selected_benefits) ? character.selected_benefits : []).map(
        (x) => Number(x),
      ),
    );
    const selectedDetriments = new Set(
      (Array.isArray(character.selected_detriments) ? character.selected_detriments : []).map(
        (x) => Number(x),
      ),
    );
    const rows = [];
    (details.benefits || []).forEach((b) => {
      if (!b) return;
      const selected = Boolean(b.required) || selectedBenefits.has(Number(b.id));
      if (!selected) return;
      rows.push({ name: b.name, description: b.description });
    });
    (details.detriments || []).forEach((d) => {
      if (!d) return;
      const selected = Boolean(d.required) || selectedDetriments.has(Number(d.id));
      if (!selected) return;
      rows.push({ name: d.name, description: d.description });
    });
    return rows;
  })();

  const groups = [
    ["standard", character.standard_ability_details],
    ["hamon", character.hamon_ability_details],
    ["spin", character.spin_ability_details],
    ["heritage", heritageEntries],
  ];

  const out = [];
  const seen = new Set();

  for (const [bucket, raw] of groups) {
    if (!Array.isArray(raw)) continue;
    for (const a of raw) {
      if (!abilityMatchesHint(a)) continue;
      const name = String(a.name || "").trim();
      if (!name) continue;
      const dedupeKey = `${bucket}:${normName(name)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ name, bucket, kind: classifyHintKind(a) });
    }
  }

  out.sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: "base" }));
  return out;
}

export function peModifierBucketLabel(bucket) {
  switch (bucket) {
    case "hamon":
      return "Hamon";
    case "spin":
      return "Spin";
    case "heritage":
      return "Heritage";
    default:
      return "Standard";
  }
}
