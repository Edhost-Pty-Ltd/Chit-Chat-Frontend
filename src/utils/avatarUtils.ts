// ─── Avatar Utility Functions ─────────────────────────────────────────────────
// Pure helpers for generating initials and deterministic background colors
// from a username string.

/**
 * Extract display initials from a username.
 *
 * Rules:
 * - Empty or whitespace-only → "?"
 * - Single word → uppercase first 2 characters (or 1 if word is 1 char)
 * - Multiple words → uppercase first char of first word + first char of last word
 * - Numeric and special characters follow the same word-splitting rules.
 */
export function getInitials(username: string): string {
  const trimmed = username.trim();

  if (trimmed.length === 0) {
    return '?';
  }

  const words = trimmed.split(/\s+/);

  if (words.length === 1) {
    // Single word: take first 2 characters (or 1 if only 1 char)
    return words[0].slice(0, 2).toUpperCase();
  }

  // Multiple words: first char of first word + first char of last word
  const first = words[0][0];
  const last = words[words.length - 1][0];
  return (first + last).toUpperCase();
}

/**
 * Generate a deterministic hex color string from a username.
 *
 * Uses a simple hash (sum of char codes with bit-mixing) to derive
 * RGB components. The same input always produces the same output.
 *
 * Returns a valid 6-digit hex color string (e.g., "#A3C4F3").
 * For empty/whitespace-only strings, returns a default gray.
 */
export function getAvatarColor(username: string): string {
  const trimmed = username.trim();

  if (trimmed.length === 0) {
    return '#9E9E9E'; // default gray for empty input
  }

  // Simple deterministic hash using char codes with bit mixing
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = trimmed.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Derive RGB from hash, keeping colors in a pleasant mid-range
  const r = ((hash >> 16) & 0xff) | 0x40; // ensure minimum brightness
  const g = ((hash >> 8) & 0xff) | 0x40;
  const b = (hash & 0xff) | 0x40;

  // Clamp to 0-255 range and format as hex
  const toHex = (n: number) =>
    Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0').toUpperCase();

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
