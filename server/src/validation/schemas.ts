import { z } from 'zod';
import { TaskStatus } from '../../../shared/types.js';

const trimmedString = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

export const authCredentialsSchema = z.object({
  username: trimmedString(3, 32),
  password: z.string().min(6).max(128)
});

export const createRoomSchema = z.object({
  name: trimmedString(1, 80)
});

export const joinRoomSchema = z.object({
  inviteCode: trimmedString(1, 12).transform((value) => value.toUpperCase())
});

export const updateRoomSchema = z.object({
  name: trimmedString(1, 80)
});

export const messageSchema = z.object({
  text: trimmedString(1, 1000)
});

export const taskSchema = z.object({
  title: trimmedString(1, 120),
  description: z.string().trim().max(500).optional().default(''),
  status: z.nativeEnum(TaskStatus).optional().default(TaskStatus.Todo),
  order: z.number().int().min(0).optional().default(0)
});

export const taskUpdateSchema = taskSchema.partial().extend({
  title: trimmedString(1, 120).optional(),
  description: z.string().trim().max(500).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  order: z.number().int().min(0).optional()
});

export const noteSchema = z.object({
  title: trimmedString(1, 120),
  content: trimmedString(1, 5000)
});

export const noteUpdateSchema = noteSchema.partial().extend({
  title: trimmedString(1, 120).optional(),
  content: trimmedString(1, 5000).optional()
});

export type AuthCredentialsDto = z.infer<typeof authCredentialsSchema>;
export type CreateRoomDto = z.infer<typeof createRoomSchema>;
export type JoinRoomDto = z.infer<typeof joinRoomSchema>;
export type UpdateRoomDto = z.infer<typeof updateRoomSchema>;
export type MessageDto = z.infer<typeof messageSchema>;
export type TaskDto = z.infer<typeof taskSchema>;
export type TaskUpdateDto = z.infer<typeof taskUpdateSchema>;
export type NoteDto = z.infer<typeof noteSchema>;
export type NoteUpdateDto = z.infer<typeof noteUpdateSchema>;
