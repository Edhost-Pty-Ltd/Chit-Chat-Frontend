import * as fc from 'fast-check';
import { getInitials, getAvatarColor } from '../avatarUtils';

/**
 * Feature: user-registration, Property 4: Initials derivation follows word-splitting rules
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6
 */
describe('Property 4: Initials derivation follows word-splitting rules', () => {
  it('for any non-empty, non-whitespace-only string, getInitials returns 1 or 2 uppercase characters following word-splitting rules', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.trim().length > 0),
        (username) => {
          const result = getInitials(username);
          const trimmed = username.trim();
          const words = trimmed.split(/\s+/);

          if (words.length === 1) {
            // Single word: returns min(2, word.length) uppercase chars
            const expectedLength = Math.min(2, words[0].length);
            expect(result).toHaveLength(expectedLength);
            expect(result).toBe(words[0].slice(0, 2).toUpperCase());
          } else {
            // Multiple words: exactly 2 chars — first of first word + first of last word
            expect(result).toHaveLength(2);
            const expectedFirst = words[0][0].toUpperCase();
            const expectedLast = words[words.length - 1][0].toUpperCase();
            expect(result).toBe(expectedFirst + expectedLast);
          }

          // All characters in the result should be uppercase
          expect(result).toBe(result.toUpperCase());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('never returns "?" for non-empty, non-whitespace-only inputs', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.trim().length > 0),
        (username) => {
          const result = getInitials(username);
          expect(result).not.toBe('?');
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: user-registration, Property 5: Avatar color is deterministic
 * Validates: Requirements 4.4
 */
describe('Property 5: Avatar color is deterministic', () => {
  it('for any non-empty string, getAvatarColor always returns the same valid hex color for the same input', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.trim().length > 0),
        (username) => {
          const color1 = getAvatarColor(username);
          const color2 = getAvatarColor(username);

          // Determinism: same input produces same output
          expect(color1).toBe(color2);

          // Valid hex color format: # followed by 6 hex digits (uppercase)
          expect(color1).toMatch(/^#[0-9A-F]{6}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('always produces a valid 6-digit hex color string for any non-empty input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (username) => {
          const color = getAvatarColor(username);
          // Either a valid hex color or the default gray (for whitespace-only)
          expect(color).toMatch(/^#[0-9A-F]{6}$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
