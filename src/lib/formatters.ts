/**
 * Utility to clean release title string by extracting clean title name and release year.
 */
export function cleanTitle(rawName: string): { title: string; year?: string } {
  if (!rawName) return { title: "" };

  let title = rawName;
  let year: string | undefined = undefined;

  // Remove common IPTV prefixes
  title = title.replace(/^(EN\||UK\||US\||FR\||DE\||AR\||ES\||PT\||IT\||RU\||TR\||IN\||PK\|)\s*/i, "");

  // Extract year if present in parentheses or brackets e.g., (2022), (2022-2026), [2022]
  const yearMatch = title.match(/[\(\[](\d{4})(?:-\d{4})?[\)\]]/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // Strip all parentheses/brackets and their contents (e.g. metadata, years, language tags)
  title = title.replace(/[\(\[].*?[\)\]]/g, "");

  // Clean trailing hyphens and whitespace
  title = title.trim().replace(/^[-_\s]+|[-_\s]+$/g, "");

  return { title: title || rawName, year };
}
