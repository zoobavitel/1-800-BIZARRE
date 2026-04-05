/**
 * Flatten PATCH_NOTES (date + nested sections) into rows for homepage preview.
 * @param {Array<{ date: string, sections: { title: string, items: string[] }[] }>} entries
 * @param {number} limit
 * @returns {{ date: string, cat: string, text: string }[]}
 */
export function flattenPatchNotesPreview(entries, limit = 7) {
  const rows = [];
  if (!Array.isArray(entries)) return rows;
  for (const entry of entries) {
    for (const section of entry.sections || []) {
      const cat = section.title || 'Other';
      for (const item of section.items || []) {
        rows.push({ date: entry.date, cat, text: item });
        if (rows.length >= limit) return rows;
      }
    }
  }
  return rows;
}
