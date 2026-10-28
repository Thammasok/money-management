import { registerDecorator } from 'class-validator';
import type { ValidationArguments, ValidationOptions } from 'class-validator';
import { isCalendarDate } from './calendar-date';
import { characterCount } from './character-count';
import { isPositiveMinorUnits, isWithinMinorUnitLimit } from './minor-units';

/**
 * Turns a plain predicate into a class-validator property decorator, so each rule stays a small pure function and a
 * message (given by the DTO). The predicate must be false for a value of the wrong type: the validators placed below
 * it on a property run first, but nothing here may throw on any input.
 */
function propertyRule(
  name: string,
  passes: (value: unknown, args: ValidationArguments) => boolean,
) {
  return (options?: ValidationOptions): PropertyDecorator =>
    (target, propertyKey) => {
      registerDecorator({
        name,
        target: target.constructor,
        propertyName: String(propertyKey),
        options,
        validator: { validate: passes },
      });
    };
}

/** A real calendar date written `YYYY-MM-DD`. */
export const IsCalendarDate = propertyRule('isCalendarDate', (value) => isCalendarDate(value));

/** A decimal-integer string with at most 15 significant digits. */
export const IsWithinMinorUnitLimit = propertyRule(
  'isWithinMinorUnitLimit',
  (value) => typeof value === 'string' && isWithinMinorUnitLimit(value),
);

/** A decimal-integer string greater than zero. */
export const IsPositiveMinorUnits = propertyRule(
  'isPositiveMinorUnits',
  (value) => typeof value === 'string' && isPositiveMinorUnits(value),
);

/** A string of at most `max` characters, counted as Postgres counts them (code points). */
export function MaxCharacters(max: number, options?: ValidationOptions): PropertyDecorator {
  return propertyRule(
    'maxCharacters',
    (value) => typeof value === 'string' && characterCount(value) <= max,
  )(options);
}

/**
 * A calendar date not later than the date in the sibling property `otherProperty`. It is skipped (passes) when either
 * side is not a calendar date — those are reported by the properties' own date rules, so one mistake is one message.
 */
export function IsNotAfter(otherProperty: string, options?: ValidationOptions): PropertyDecorator {
  return propertyRule('isNotAfter', (value, args) => {
    const other = (args.object as Record<string, unknown>)[otherProperty];
    return !isCalendarDate(value) || !isCalendarDate(other) || value <= other;
  })(options);
}
