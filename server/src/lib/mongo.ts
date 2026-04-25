import mongoose from 'mongoose';
import { ValidationError } from './errors.js';

export function toObjectId(value: string, fieldName = 'id'): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError(`${fieldName} is invalid.`);
  }

  return new mongoose.Types.ObjectId(value);
}
