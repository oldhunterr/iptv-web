/**
 * Utility to clean release title string by extracting clean title name and release year.
 */
export function cleanTitle(rawName: string): { title: string; year?: string } {
  if (!rawName) return { title: "" };

  let title = rawName;
  let year: string | undefined = undefined;

  // Remove common IPTV prefixes e.g. EN|, US:, UK -
  title = title.replace(/^(EN|UK|US|FR|DE|AR|ES|PT|IT|RU|TR|IN|PK)[:| -]\s*/i, "");

  // Extract year if present in parentheses or brackets e.g., (2022), (2022-2026), [2022]
  const yearMatch = title.match(/[\(\[](\d{4})(?:-\d{4})?[\)\]]/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // Strip all parentheses/brackets and their contents (e.g. metadata, years, language tags)
  title = title.replace(/[\(\[].*?[\)\]]/g, "");

  // Remove common quality/codec/format/language tags (case insensitive, standalone words)
  const tagsRegex = /\b(3d|4k|8k|fhd|uhd|hd|sd|hevc|h264|h265|x264|x265|10bit|1080p|720p|480p|2160p|1080i|web-dl|webrip|bluray|hdrip|dvdrip|dual[- ]audio|multi[- ]audio|multi|dubbed|subbed|eng|arb|ara|ar|fr|es|de|it|ru|tr)\b/gi;
  title = title.replace(tagsRegex, "");

  // Remove season/episode indicators (e.g. S01, S1, Season 1, Season01, Ep 01, Ep1)
  title = title.replace(/\b(s\d+|season\s*\d+|ep\s*\d+|episode\s*\d+)\b/gi, "");

  // Remove Arabic words for Translated (مترجم) and Dubbed (مدبلج) and related terms
  title = title.replace(/(مترجم|المترجم|مدبلج|المدبلج|مترجم للعربية|مدبلج للعربية)/g, "");

  // Check for mixed languages (both English/Latin and Arabic characters)
  const hasLatin = /[a-zA-Z]/.test(title);
  const hasArabic = /[\u0600-\u06FF]/.test(title);

  if (hasLatin && hasArabic) {
    // If it has both, prefer the Latin (English) portion for higher TMDB match reliability
    title = title.replace(/[\u0600-\u06FF]+/g, "");
  }

  // Clean trailing/leading hyphens, slashes, pipes, underscores, and spaces
  title = title.trim()
    .replace(/^[-_\s|\\/]+|[-_\s|\\/]+$/g, "") // remove leading/trailing separators
    .replace(/\s*[-_|\\/]+\s*/g, " ")       // replace internal separators with a space
    .replace(/\s+/g, " ");                  // collapse multiple spaces

  return { title: title || rawName, year };
}
