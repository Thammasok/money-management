/**
 * How many characters `text` has, counted the way Postgres `char_length` counts them: code points. The API's length
 * rules and the database's CHECK constraints must agree exactly, or a text that passes validation would break the CHECK
 * and become a 500. (class-validator's @MaxLength delegates to validator.js, which also discounts variation selectors,
 * so it can accept a text the database refuses.)
 */
export function characterCount(text: string): number {
  return Array.from(text).length;
}
