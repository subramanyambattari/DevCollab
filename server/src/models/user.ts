import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import { UserRole } from '../../../shared/types.js';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 32
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.User
    },
    refreshTokenHash: {
      type: String,
      default: null
    },
    refreshTokenExpiresAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

export type UserRecord = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserRecord>;

export const UserModel = mongoose.model<UserRecord>('User', userSchema);
