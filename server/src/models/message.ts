import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    }
  },
  { timestamps: true }
);

messageSchema.index({ room: 1, createdAt: 1 });

export type MessageRecord = InferSchemaType<typeof messageSchema>;
export type MessageDocument = HydratedDocument<MessageRecord>;

export const MessageModel = mongoose.model<MessageRecord>('Message', messageSchema);
