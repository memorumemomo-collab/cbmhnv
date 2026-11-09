/**
 * Parses tags from a Google Sheets cell string.
 * Supports comma (,), Japanese comma (、, ，), newlines, or whitespace separators.
 * Example: "ミステリー, 古書, 日常の謎" -> ["ミステリー", "古書", "日常の謎"]
 */
export function parseTagsFromCell(raw: string | string[] | undefined | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
  }
  return raw
    .split(/[,，、\n]+/)
    .map((t) => t.trim().replace(/^#/, ''))
    .filter((t) => t.length > 0);
}
