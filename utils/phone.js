/**
 * Parse office phone string into structured data.
 *
 * Supports formats like:
 *   "+6624212150 / 421-2160 Ext. 1630"
 *   "+6624212150 Ext. 1630"
 *   "024212150"
 *   "+6624212150 / 421-2160"
 *
 * @param {string} raw - The raw office phone string
 * @returns {{ phones: string[], ext: string|null, display: string }}
 */
function parseOfficePhone(raw) {
  if (!raw) return { phones: [], ext: null, display: '' };

  const str = String(raw).trim();

  // Extract extension (Ext. / ext / Ext / ext.)
  let ext = null;
  let withoutExt = str;
  const extMatch = str.match(/\s+ext\.?\s*(\d+)\s*$/i);
  if (extMatch) {
    ext = extMatch[1];
    withoutExt = str.slice(0, extMatch.index).trim();
  }

  // Split by / or , to get individual phone numbers
  const phones = withoutExt
    .split(/[\/,]/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return {
    phones,
    ext,
    display: str
  };
}

module.exports = { parseOfficePhone };
