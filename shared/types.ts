export type ID = string;

export enum TaskStatus {
  Todo = 'todo',
  Doing = 'doing',
  Done = 'done'
}

export enum RoomRole {
  Owner = 'owner',
  Member = 'member'
}

export enum UserRole {
  User = 'user',
  Admin = 'admin'
}

export interface TimestampedEntity {
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser extends TimestampedEntity {
  id: ID;
  username: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthSession {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface RoomMember {
  id: ID;
  username: string;
  role: RoomRole;
}

export interface RoomSummary extends TimestampedEntity {
  id: ID;
  name: string;
  inviteCode: string;
  owner: RoomMember;
  members: RoomMember[];
}

export interface MessageAuthor {
  id: ID;
  username: string;
}

export interface MessageDTO extends TimestampedEntity {
  id: ID;
  room: ID;
  sender: MessageAuthor;
  text: string;
}

export interface TaskDTO extends TimestampedEntity {
  id: ID;
  room: ID;
  title: string;
  description: string;
  status: TaskStatus;
  order: number;
  createdBy: MessageAuthor;
}

export interface NoteDTO extends TimestampedEntity {
  id: ID;
  room: ID;
  title: string;
  content: string;
  createdBy: MessageAuthor;
}

export interface DashboardDTO {
  room: RoomSummary;
  messages: MessageDTO[];
  tasks: TaskDTO[];
  notes: NoteDTO[];
}

export interface HealthResponse {
  ok: true;
  service: 'devcollab';
  timestamp: string;
}

export interface ApiErrorResponse {
  message: string;
  code?: string;
  details?: Record<string, unknown> | undefined;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ListResponse<T> {
  items: T[];
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface CreateRoomInput {
  name: string;
}

export interface JoinRoomInput {
  inviteCode: string;
}

export interface UpsertTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  order?: number;
}

export interface UpsertNoteInput {
  title: string;
  content: string;
}

export interface SendMessageInput {
  text: string;
}

export interface WorkspaceStateSnapshot {
  rooms: RoomSummary[];
  selectedRoomId: ID | null;
  dashboard: DashboardDTO | null;
}

export interface SocketRoomJoinedPayload {
  roomId: ID;
  inviteCode: string;
}

export interface RoomsUpdatedPayload {
  userIds: ID[];
}

export interface MessageCreatedPayload {
  id: ID;
  room: ID;
  sender: MessageAuthor;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface TasksUpdatedPayload {
  roomId: ID;
  tasks: TaskDTO[];
}

export interface NotesUpdatedPayload {
  roomId: ID;
  notes: NoteDTO[];
}

export interface RoomErrorPayload {
  message: string;
}

export interface ClientToServerEvents {
  'room:join': (payload: { roomId: ID }) => void;
  'message:send': (payload: { roomId: ID; text: string }) => void;
}

export interface ServerToClientEvents {
  'room:joined': (payload: SocketRoomJoinedPayload) => void;
  'room:error': (payload: RoomErrorPayload) => void;
  'rooms:updated': (payload: RoomsUpdatedPayload) => void;
  'message:new': (payload: MessageDTO) => void;
  'tasks:updated': (payload: TasksUpdatedPayload) => void;
  'notes:updated': (payload: NotesUpdatedPayload) => void;
}
