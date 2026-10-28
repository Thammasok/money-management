import { characterCount } from './character-count';

// "Characters" as Postgres `char_length` counts them: code points. (validator.js's own length check, behind
// class-validator's @MaxLength, also discounts variation selectors, so it can say "60" for a text the database's
// CHECK (char_length(...) <= 60) refuses — a 500 instead of a 400.)
describe('characterCount', () => {
  it.each([
    ['an empty string', '', 0],
    ['plain ASCII', 'Cash', 4],
    ['Thai text', 'เงินสด', 6],
    ['an astral emoji (a surrogate pair is one character)', '😀', 1],
    ['a heart with its variation selector (two code points)', '❤️', 2],
    [
      'a family emoji joined by zero-width joiners (three people and two joiners: 5 code points)',
      '👨‍👩‍👧',
      5,
    ],
    ['a regional-indicator flag (two code points)', '🇹🇭', 2],
  ])('counts %s', (_why, text, expected) => {
    // Arrange / Act
    const count = characterCount(text);

    // Assert
    expect(count).toBe(expected);
  });
});
