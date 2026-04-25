import { ValidationError } from './errors.js';

export function requireStringParam(value: string | string[] | undefined, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${fieldName} is required.`);
  }

  return value;
}
