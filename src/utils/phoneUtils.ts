// ─── Phone Utility Functions ──────────────────────────────────────────────────
// Shared helpers for phone number normalization and array chunking.

/**
 * Normalize any phone number to E.164 format (+27XXXXXXXXX for SA).
 * Strips all non-digit characters (except leading +), then applies country code rules.
 */
export function normalizePhone(raw: string, defaultCountryCode = '27'): string {
  // Strip everything except digits and leading +
  let digits = raw.replace(/[^\d+]/g, '');

  if (digits.startsWith('+')) {
    return digits; // already E.164
  }
  if (digits.startsWith('0')) {
    return `+${defaultCountryCode}${digits.slice(1)}`; // 083... → +2783...
  }
  if (digits.length === 9) {
    return `+${defaultCountryCode}${digits}`; // 83... → +2783...
  }
  return `+${digits}`;
}

/**
 * Display a phone number in full E.164 form (e.g. +27821234567).
 * Numbers are already normalized to E.164 elsewhere, so this just guarantees a
 * leading "+" and keeps every digit — never truncating or mis-grouping across
 * country codes. Returns '' for empty input.
 */
export function formatE164(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

/**
 * Split an array into chunks of at most size `n`.
 */
export function chunkArray<T>(arr: T[], n: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    chunks.push(arr.slice(i, i + n));
  }
  return chunks;
}
