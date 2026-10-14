// URLs in data.json come from scraped news feeds. Only let http(s) URLs reach
// an <img src> or <a href>; anything else (javascript:, data:, vbscript:,
// relative paths, garbage) is dropped.
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function safeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}
