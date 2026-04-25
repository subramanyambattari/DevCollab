import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import { TaskStatus } from '../../../shared/types.js';

const taskSchema = new mongoose.Schema(
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
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.Todo,
      index: true
    },
    order: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

taskSchema.index({ room: 1, status: 1, order: 1, createdAt: 1 });

export type TaskRecord = InferSchemaType<typeof taskSchema>;
export type TaskDocument = HydratedDocument<TaskRecord>;

export const TaskModel = mongoose.model<TaskRecord>('Task', taskSchema);
