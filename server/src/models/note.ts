import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

noteSchema.index({ room: 1, updatedAt: -1 });

export type NoteRecord = InferSchemaType<typeof noteSchema>;
export type NoteDocument = HydratedDocument<NoteRecord>;

export const NoteModel = mongoose.model<NoteRecord>('Note', noteSchema);
