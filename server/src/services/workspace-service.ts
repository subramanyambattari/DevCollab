import crypto from 'crypto';
import mongoose from 'mongoose';
import { TaskStatus } from '../../../shared/types.js';
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js';
import { mapDashboard, mapMessage, mapNote, mapRoomSummary, mapTask } from '../lib/mappers.js';
import type { DashboardDTO, MessageDTO, NoteDTO, RoomSummary, TaskDTO } from '../../../shared/types.js';
import { MessageRepository } from '../repositories/message-repository.js';
import { NoteRepository } from '../repositories/note-repository.js';
import { RoomRepository } from '../repositories/room-repository.js';
import { TaskRepository } from '../repositories/task-repository.js';

async function generateInviteCode(existing: (code: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    if (!(await existing(code))) {
      return code;
    }
  }

  throw new AppError('Unable to generate invite code.', 500, 'INVITE_CODE_GENERATION_FAILED');
}

export class WorkspaceService {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly messages: MessageRepository,
    private readonly tasks: TaskRepository,
    private readonly notes: NoteRepository
  ) {}

  private async touchRoom(roomId: string): Promise<void> {
    await this.rooms.model.updateOne({ _id: roomId }, { $set: { updatedAt: new Date() } });
  }

  async listRooms(userId: string): Promise<RoomSummary[]> {
    const rooms = await this.rooms
      .findByMember(userId)
      .populate('owner', 'username createdAt updatedAt role')
      .populate('members', 'username createdAt updatedAt role');

    return rooms.map((room) => mapRoomSummary(room as unknown as Parameters<typeof mapRoomSummary>[0]));
  }

  async createRoom(userId: string, name: string): Promise<RoomSummary> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new ValidationError('Room name is required.');
    }

    const inviteCode = await generateInviteCode(async (code) => Boolean(await this.rooms.findOne({ inviteCode: code })));

    const room = await this.rooms.create({
      name: trimmedName,
      inviteCode,
      owner: new mongoose.Types.ObjectId(userId),
      members: [new mongoose.Types.ObjectId(userId)]
    });

    const populated = await room.populate('owner', 'username createdAt updatedAt role');
    await populated.populate('members', 'username createdAt updatedAt role');

    return mapRoomSummary(populated as unknown as Parameters<typeof mapRoomSummary>[0]);
  }

  async joinRoom(userId: string, inviteCode: string): Promise<RoomSummary> {
    const room = await this.rooms.findOne({ inviteCode: inviteCode.trim().toUpperCase() });
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    if (!room.members.some((memberId) => memberId.toString() === userId)) {
      room.members.push(new mongoose.Types.ObjectId(userId));
      await room.save();
    }

    await this.touchRoom(room._id.toString());

    const populated = await room.populate('owner', 'username createdAt updatedAt role');
    await populated.populate('members', 'username createdAt updatedAt role');

    return mapRoomSummary(populated as unknown as Parameters<typeof mapRoomSummary>[0]);
  }

  async getRoom(userId: string, roomId: string): Promise<RoomSummary> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const populated = await room.populate('owner', 'username createdAt updatedAt role');
    await populated.populate('members', 'username createdAt updatedAt role');

    return mapRoomSummary(populated as unknown as Parameters<typeof mapRoomSummary>[0]);
  }

  async updateRoom(userId: string, roomId: string, name: string): Promise<RoomSummary> {
    const room = await this.rooms.findOwned(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new ValidationError('Room name is required.');
    }

    room.name = trimmedName;
    await room.save();
    const populated = await room.populate('owner', 'username createdAt updatedAt role');
    await populated.populate('members', 'username createdAt updatedAt role');

    return mapRoomSummary(populated as unknown as Parameters<typeof mapRoomSummary>[0]);
  }

  async deleteRoom(userId: string, roomId: string): Promise<{ roomId: string; members: string[] }> {
    const room = await this.rooms.findOwned(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    await Promise.all([
      this.messages.model.deleteMany({ room: room._id }),
      this.tasks.model.deleteMany({ room: room._id }),
      this.notes.model.deleteMany({ room: room._id }),
      this.rooms.model.deleteOne({ _id: room._id })
    ]);

    return {
      roomId: room._id.toString(),
      members: room.members.map((memberId) => memberId.toString())
    };
  }

  async getDashboard(userId: string, roomId: string): Promise<DashboardDTO> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const [messages, tasks, notes] = await Promise.all([
      this.messages
        .listByRoom(room._id.toString())
        .populate('sender', 'username createdAt updatedAt role'),
      this.tasks
        .listByRoom(room._id.toString())
        .populate('createdBy', 'username createdAt updatedAt role'),
      this.notes
        .listByRoom(room._id.toString())
        .populate('createdBy', 'username createdAt updatedAt role')
    ]);

    const populated = await room.populate('owner', 'username createdAt updatedAt role');
    await populated.populate('members', 'username createdAt updatedAt role');

    return mapDashboard(
      populated as unknown as Parameters<typeof mapRoomSummary>[0],
      messages as unknown as Parameters<typeof mapMessage>[0][],
      tasks as unknown as Parameters<typeof mapTask>[0][],
      notes as unknown as Parameters<typeof mapNote>[0][]
    );
  }

  async listMessages(userId: string, roomId: string): Promise<MessageDTO[]> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const messages = await this.messages
      .listByRoom(room._id.toString())
      .populate('sender', 'username createdAt updatedAt role');

    return messages.map((message) => mapMessage(message as unknown as Parameters<typeof mapMessage>[0]));
  }

  async sendMessage(userId: string, roomId: string, text: string): Promise<MessageDTO> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const messageText = text.trim();
    if (!messageText) {
      throw new ValidationError('Message text is required.');
    }

    const message = await this.messages.create({
      room: room._id,
      sender: new mongoose.Types.ObjectId(userId),
      text: messageText
    });

    await this.touchRoom(room._id.toString());

    const populated = await message.populate('sender', 'username createdAt updatedAt role');
    return mapMessage(populated as unknown as Parameters<typeof mapMessage>[0]);
  }

  async listTasks(userId: string, roomId: string): Promise<TaskDTO[]> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const tasks = await this.tasks
      .listByRoom(room._id.toString())
      .populate('createdBy', 'username createdAt updatedAt role');

    return tasks.map((task) => mapTask(task as unknown as Parameters<typeof mapTask>[0]));
  }

  async createTask(userId: string, roomId: string, payload: { title: string; description?: string; status?: TaskStatus; order?: number }): Promise<TaskDTO> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const title = payload.title.trim();
    if (!title) {
      throw new ValidationError('Task title is required.');
    }

    const status = payload.status ?? TaskStatus.Todo;
    const order = payload.order ?? (await this.tasks.countByRoomAndStatus(room._id.toString(), status));

    const task = await this.tasks.create({
      room: room._id,
      title,
      description: payload.description?.trim() ?? '',
      status,
      order,
      createdBy: new mongoose.Types.ObjectId(userId)
    });

    await this.touchRoom(room._id.toString());

    const populated = await task.populate('createdBy', 'username createdAt updatedAt role');
    return mapTask(populated as unknown as Parameters<typeof mapTask>[0]);
  }

  async updateTask(
    userId: string,
    roomId: string,
    taskId: string,
    payload: {
      title?: string | undefined;
      description?: string | undefined;
      status?: TaskStatus | undefined;
      order?: number | undefined;
    }
  ): Promise<TaskDTO> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const task = await this.tasks.model.findOne({ _id: taskId, room: room._id });
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    if (typeof payload.title === 'string') {
      const title = payload.title.trim();
      if (!title) {
        throw new ValidationError('Task title cannot be empty.');
      }
      task.title = title;
    }

    if (typeof payload.description === 'string') {
      task.description = payload.description.trim();
    }

    if (payload.status) {
      task.status = payload.status;
    }

    if (typeof payload.order === 'number' && Number.isFinite(payload.order)) {
      task.order = payload.order;
    }

    await task.save();
    await this.touchRoom(room._id.toString());
    const populated = await task.populate('createdBy', 'username createdAt updatedAt role');
    return mapTask(populated as unknown as Parameters<typeof mapTask>[0]);
  }

  async deleteTask(userId: string, roomId: string, taskId: string): Promise<void> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const result = await this.tasks.model.findOneAndDelete({ _id: taskId, room: room._id });
    if (!result) {
      throw new NotFoundError('Task not found.');
    }

    await this.touchRoom(room._id.toString());
  }

  async listNotes(userId: string, roomId: string): Promise<NoteDTO[]> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const notes = await this.notes
      .listByRoom(room._id.toString())
      .populate('createdBy', 'username createdAt updatedAt role');

    return notes.map((note) => mapNote(note as unknown as Parameters<typeof mapNote>[0]));
  }

  async createNote(userId: string, roomId: string, payload: { title: string; content: string }): Promise<NoteDTO> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const title = payload.title.trim();
    const content = payload.content.trim();

    if (!title || !content) {
      throw new ValidationError('Note title and content are required.');
    }

    const note = await this.notes.create({
      room: room._id,
      title,
      content,
      createdBy: new mongoose.Types.ObjectId(userId)
    });

    await this.touchRoom(room._id.toString());

    const populated = await note.populate('createdBy', 'username createdAt updatedAt role');
    return mapNote(populated as unknown as Parameters<typeof mapNote>[0]);
  }

  async updateNote(
    userId: string,
    roomId: string,
    noteId: string,
    payload: { title?: string | undefined; content?: string | undefined }
  ): Promise<NoteDTO> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const note = await this.notes.model.findOne({ _id: noteId, room: room._id });
    if (!note) {
      throw new NotFoundError('Note not found.');
    }

    if (typeof payload.title === 'string') {
      const title = payload.title.trim();
      if (!title) {
        throw new ValidationError('Note title cannot be empty.');
      }
      note.title = title;
    }

    if (typeof payload.content === 'string') {
      const content = payload.content.trim();
      if (!content) {
        throw new ValidationError('Note content cannot be empty.');
      }
      note.content = content;
    }

    await note.save();
    await this.touchRoom(room._id.toString());
    const populated = await note.populate('createdBy', 'username createdAt updatedAt role');
    return mapNote(populated as unknown as Parameters<typeof mapNote>[0]);
  }

  async deleteNote(userId: string, roomId: string, noteId: string): Promise<void> {
    const room = await this.rooms.findAccessible(roomId, userId);
    if (!room) {
      throw new NotFoundError('Room not found.');
    }

    const result = await this.notes.model.findOneAndDelete({ _id: noteId, room: room._id });
    if (!result) {
      throw new NotFoundError('Note not found.');
    }

    await this.touchRoom(room._id.toString());
  }
}
