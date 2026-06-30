// ─── Validation Utility Functions ─────────────────────────────────────────────
// Pure validation helpers for the user registration flow.

/**
 * Validate a username string.
 * Valid if length is between 2 and 30 characters inclusive.
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 2) {
    return { valid: false, error: 'Username must be at least 2 characters' };
  }
  if (username.length > 30) {
    return { valid: false, error: 'Username must be at most 30 characters' };
  }
  return { valid: true };
}

/**
 * Validate a phone number against E.164 format.
 * Returns true if the string matches the pattern: +[1-9][0-9]{1,14}
 */
export function validatePhone(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

/**
 * Validate an image file by size and MIME type.
 * Rejects if size exceeds 5 MB or MIME type is not JPEG/PNG.
 */
export function validateImage(
  fileSize: number,
  mimeType: string
): { valid: boolean; error?: string } {
  if (fileSize > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Image must be under 5 MB' };
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: 'Only JPEG and PNG images are supported' };
  }
  return { valid: true };
}
