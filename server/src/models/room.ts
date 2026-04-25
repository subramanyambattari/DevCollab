import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  { timestamps: true }
);

roomSchema.index({ members: 1, updatedAt: -1 });

export type RoomRecord = InferSchemaType<typeof roomSchema>;
export type RoomDocument = HydratedDocument<RoomRecord>;

export const RoomModel = mongoose.model<RoomRecord>('Room', roomSchema);
