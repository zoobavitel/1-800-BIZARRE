/**
 * Flatten PATCH_NOTES (date + nested sections) into rows for homepage preview.
 * @param {Array<{ date: string, sections: { title: string, items: string[] }[] }>} entries
 * @param {number} limit
 * @returns {{ date: string, cat: string, text: string }[]}
 */
function toTimeValue(dateStr) {
  const t = Date.parse(dateStr || "");
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/** Newest-first by date (ISO yyyy-mm-dd), stable for equal dates. */
export function sortPatchNotesEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return [...entries]
    .map((entry, idx) => ({ entry, idx }))
    .sort((a, b) => {
      const dt = toTimeValue(b.entry?.date) - toTimeValue(a.entry?.date);
      return dt !== 0 ? dt : a.idx - b.idx;
    })
    .map((x) => x.entry);
}

export function flattenPatchNotesPreview(entries, limit = 7) {
  const rows = [];
  const sorted = sortPatchNotesEntries(entries);
  for (const entry of sorted) {
    for (const section of entry.sections || []) {
      const cat = section.title || "Other";
      for (const item of section.items || []) {
        rows.push({ date: entry.date, cat, text: item });
        if (rows.length >= limit) return rows;
      }
    }
  }
  return rows;
}
