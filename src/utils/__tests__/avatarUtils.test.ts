import { getInitials, getAvatarColor } from '../avatarUtils';

describe('getInitials', () => {
  it('returns "?" for empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('returns "?" for whitespace-only string', () => {
    expect(getInitials('   ')).toBe('?');
    expect(getInitials('\t\n')).toBe('?');
  });

  it('returns uppercase first 2 chars for single word', () => {
    expect(getInitials('alice')).toBe('AL');
    expect(getInitials('Bob')).toBe('BO');
  });

  it('returns single uppercase char for single-character word', () => {
    expect(getInitials('A')).toBe('A');
    expect(getInitials('z')).toBe('Z');
  });

  it('returns first char of first and last word for multiple words', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('Alice Bob Charlie')).toBe('AC');
  });

  it('handles numeric characters following same rules', () => {
    expect(getInitials('123')).toBe('12');
    expect(getInitials('1st Place')).toBe('1P');
  });

  it('handles special characters following same rules', () => {
    expect(getInitials('@user')).toBe('@U');
    expect(getInitials('# tag')).toBe('#T');
  });

  it('handles leading/trailing whitespace by trimming', () => {
    expect(getInitials('  hello  ')).toBe('HE');
    expect(getInitials('  John Doe  ')).toBe('JD');
  });
});

describe('getAvatarColor', () => {
  it('returns a valid hex color string', () => {
    const color = getAvatarColor('alice');
    expect(color).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('is deterministic - same input produces same output', () => {
    const color1 = getAvatarColor('testuser');
    const color2 = getAvatarColor('testuser');
    expect(color1).toBe(color2);
  });

  it('returns default gray for empty string', () => {
    expect(getAvatarColor('')).toBe('#9E9E9E');
  });

  it('returns default gray for whitespace-only string', () => {
    expect(getAvatarColor('   ')).toBe('#9E9E9E');
  });

  it('produces different colors for different usernames', () => {
    const color1 = getAvatarColor('alice');
    const color2 = getAvatarColor('bob');
    // Not guaranteed to always differ, but highly likely for distinct strings
    expect(color1).not.toBe(color2);
  });

  it('handles special characters', () => {
    const color = getAvatarColor('@user!#$');
    expect(color).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('handles unicode characters', () => {
    const color = getAvatarColor('用户名');
    expect(color).toMatch(/^#[0-9A-F]{6}$/);
  });
});
