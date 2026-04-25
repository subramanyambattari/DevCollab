import type { DashboardDTO, MessageDTO, NoteDTO, PublicUser, RoomMember, RoomSummary, TaskDTO } from '../../../shared/types.js';
import { RoomRole, UserRole } from '../../../shared/types.js';

type ObjectIdLike = { toString(): string };

type TimestampLike = Date | string;

type UserLike = {
  _id: ObjectIdLike;
  username: string;
  role?: UserRole | string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
};

type RoomLike = {
  _id: ObjectIdLike;
  name: string;
  inviteCode: string;
  owner: UserLike;
  members: UserLike[];
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
};

type MessageLike = {
  _id: ObjectIdLike;
  room: ObjectIdLike;
  sender: UserLike;
  text: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
};

type TaskLike = {
  _id: ObjectIdLike;
  room: ObjectIdLike;
  title: string;
  description: string;
  status: TaskDTO['status'];
  order: number;
  createdBy: UserLike;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
};

type NoteLike = {
  _id: ObjectIdLike;
  room: ObjectIdLike;
  title: string;
  content: string;
  createdBy: UserLike;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
};

function toISOString(value: TimestampLike): string {
  return new Date(value).toISOString();
}

export function mapPublicUser(user: UserLike): PublicUser {
  return {
    id: user._id.toString(),
    username: user.username,
    role: (user.role ?? UserRole.User) as UserRole,
    createdAt: toISOString(user.createdAt),
    updatedAt: toISOString(user.updatedAt)
  };
}

export function mapRoomSummary(room: RoomLike): RoomSummary {
  const ownerId = room.owner._id.toString();

  const members: RoomMember[] = room.members.map((member) => ({
    id: member._id.toString(),
    username: member.username,
    role: member._id.toString() === ownerId ? RoomRole.Owner : RoomRole.Member
  }));

  return {
    id: room._id.toString(),
    name: room.name,
    inviteCode: room.inviteCode,
    owner: {
      id: ownerId,
      username: room.owner.username,
      role: RoomRole.Owner
    },
    members,
    createdAt: toISOString(room.createdAt),
    updatedAt: toISOString(room.updatedAt)
  };
}

export function mapMessage(message: MessageLike): MessageDTO {
  return {
    id: message._id.toString(),
    room: message.room.toString(),
    sender: {
      id: message.sender._id.toString(),
      username: message.sender.username
    },
    text: message.text,
    createdAt: toISOString(message.createdAt),
    updatedAt: toISOString(message.updatedAt)
  };
}

export function mapTask(task: TaskLike): TaskDTO {
  return {
    id: task._id.toString(),
    room: task.room.toString(),
    title: task.title,
    description: task.description,
    status: task.status,
    order: task.order,
    createdBy: {
      id: task.createdBy._id.toString(),
      username: task.createdBy.username
    },
    createdAt: toISOString(task.createdAt),
    updatedAt: toISOString(task.updatedAt)
  };
}

export function mapNote(note: NoteLike): NoteDTO {
  return {
    id: note._id.toString(),
    room: note.room.toString(),
    title: note.title,
    content: note.content,
    createdBy: {
      id: note.createdBy._id.toString(),
      username: note.createdBy.username
    },
    createdAt: toISOString(note.createdAt),
    updatedAt: toISOString(note.updatedAt)
  };
}

export function mapDashboard(room: RoomLike, messages: MessageLike[], tasks: TaskLike[], notes: NoteLike[]): DashboardDTO {
  return {
    room: mapRoomSummary(room),
    messages: messages.map(mapMessage),
    tasks: tasks.map(mapTask),
    notes: notes.map(mapNote)
  };
}
