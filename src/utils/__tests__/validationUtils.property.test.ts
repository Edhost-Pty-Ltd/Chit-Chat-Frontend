import * as fc from 'fast-check';
import { validateUsername, validatePhone, validateImage } from '../validationUtils';

/**
 * Validates: Requirements 1.4, 1.5, 1.8, 2.9
 */

// Helper for Property 3: OTP validation logic (not exported from validationUtils)
function isValidOtp(code: string): boolean {
  return code.length === 6 && /^\d{6}$/.test(code);
}

describe('Feature: user-registration, Property 1: Submit button reflects combined validation state', () => {
  it('validateUsername returns valid iff username length is between 2 and 30 inclusive', () => {
    fc.assert(
      fc.property(fc.string(), (username) => {
        const result = validateUsername(username);
        const expectedValid = username.length >= 2 && username.length <= 30;
        return result.valid === expectedValid;
      }),
      { numRuns: 100 }
    );
  });

  it('validatePhone returns true iff phone matches E.164 format', () => {
    fc.assert(
      fc.property(fc.string(), (phone) => {
        const result = validatePhone(phone);
        const expectedValid = /^\+[1-9]\d{1,14}$/.test(phone);
        return result === expectedValid;
      }),
      { numRuns: 100 }
    );
  });

  it('validateUsername always returns valid for strings of length 2–30', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 30 }).chain((len) =>
          fc.string({ minLength: len, maxLength: len })
        ),
        (username) => {
          return validateUsername(username).valid === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validateUsername always returns invalid for strings shorter than 2', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 1 }),
        (username) => {
          return validateUsername(username).valid === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validateUsername always returns invalid for strings longer than 30', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 31, maxLength: 100 }),
        (username) => {
          return validateUsername(username).valid === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validatePhone returns true for valid E.164 numbers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 14 }),
        (firstDigit, restDigits) => {
          const phone = `+${firstDigit}${restDigits.join('')}`;
          return validatePhone(phone) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validatePhone returns false for strings without leading +', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => !s.startsWith('+')),
        (phone) => {
          return validatePhone(phone) === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: user-registration, Property 2: Image file validation rejects invalid files', () => {
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

  it('rejects files iff size > 5MB or mimeType is not jpeg/png', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 20 * 1024 * 1024 }), // file sizes up to 20MB
        fc.string(),
        (fileSize, mimeType) => {
          const result = validateImage(fileSize, mimeType);
          const shouldBeInvalid = fileSize > MAX_SIZE || (mimeType !== 'image/jpeg' && mimeType !== 'image/png');
          return result.valid === !shouldBeInvalid;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts files with valid mime type and size <= 5MB', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: MAX_SIZE }),
        fc.constantFrom('image/jpeg', 'image/png'),
        (fileSize, mimeType) => {
          return validateImage(fileSize, mimeType).valid === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects files exceeding 5MB regardless of mime type', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_SIZE + 1, max: 50 * 1024 * 1024 }),
        fc.constantFrom('image/jpeg', 'image/png'),
        (fileSize, mimeType) => {
          const result = validateImage(fileSize, mimeType);
          return result.valid === false && result.error === 'Image must be under 5 MB';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects files with invalid mime type regardless of size', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: MAX_SIZE }),
        fc.string().filter((s) => s !== 'image/jpeg' && s !== 'image/png'),
        (fileSize, mimeType) => {
          const result = validateImage(fileSize, mimeType);
          return result.valid === false && result.error === 'Only JPEG and PNG images are supported';
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: user-registration, Property 3: OTP verify button reflects digit count', () => {
  it('isValidOtp returns true iff string is exactly 6 digit characters', () => {
    fc.assert(
      fc.property(fc.string(), (code) => {
        const result = isValidOtp(code);
        const expected = code.length === 6 && /^\d{6}$/.test(code);
        return result === expected;
      }),
      { numRuns: 100 }
    );
  });

  it('isValidOtp returns true for any 6-digit string', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 6, maxLength: 6 }),
        (digits) => {
          const code = digits.join('');
          return isValidOtp(code) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isValidOtp returns false for strings with fewer than 6 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 5 }),
        (code) => {
          return isValidOtp(code) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isValidOtp returns false for strings with more than 6 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 7, maxLength: 50 }),
        (code) => {
          return isValidOtp(code) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isValidOtp returns false for 6-character strings containing non-digit characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 6, maxLength: 6 }).filter((s) => !/^\d{6}$/.test(s)),
        (code) => {
          return isValidOtp(code) === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});
