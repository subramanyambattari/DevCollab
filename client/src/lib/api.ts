import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type {
  ApiErrorResponse,
  AuthCredentials,
  CreateRoomInput,
  DashboardDTO,
  JoinRoomInput,
  MessageDTO,
  NoteDTO,
  PublicUser,
  RoomSummary,
  TaskDTO,
  TaskStatus,
  UpsertNoteInput,
  UpsertTaskInput
} from '@shared/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface CreateApiClientOptions {
  getAccessToken: () => string;
  setAccessToken: (token: string) => void;
  clearSession: () => void;
}

type AuthPayload = { user: PublicUser; token: string };
type MePayload = { user: PublicUser };
type RoomsPayload = { rooms: RoomSummary[] };
type RoomPayload = { room: RoomSummary };
type DashboardPayload = DashboardDTO;
type MessagesPayload = { messages: MessageDTO[] };
type TasksPayload = { tasks: TaskDTO[] };
type NotesPayload = { notes: NoteDTO[] };
type ActionPayload = { ok: true };
type MessagePayload = { message: MessageDTO };
type TaskPayload = { task: TaskDTO };
type NotePayload = { note: NoteDTO };

function createBaseClient(): AxiosInstance {
  return axios.create({
    baseURL: '/api',
    withCredentials: true,
    timeout: 15000
  });
}

function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const response = error.response?.data as ApiErrorResponse | undefined;
    return new ApiError(response?.message ?? error.message ?? 'Request failed.', error.response?.status, response?.code, response?.details);
  }

  if (error instanceof Error) {
    return new ApiError(error.message);
  }

  return new ApiError('Request failed.');
}

export interface TypedApiClient {
  getMe(): Promise<MePayload>;
  login(credentials: AuthCredentials): Promise<AuthPayload>;
  register(credentials: AuthCredentials): Promise<AuthPayload>;
  refresh(): Promise<AuthPayload>;
  logout(): Promise<ActionPayload>;
  loadRooms(): Promise<RoomsPayload>;
  loadDashboard(roomId: string): Promise<DashboardPayload>;
  createRoom(input: CreateRoomInput): Promise<RoomPayload>;
  joinRoom(input: JoinRoomInput): Promise<RoomPayload>;
  updateRoom(roomId: string, input: CreateRoomInput): Promise<RoomPayload>;
  deleteRoom(roomId: string): Promise<ActionPayload & { roomId: string }>;
  loadMessages(roomId: string): Promise<MessagesPayload>;
  sendMessage(roomId: string, text: string): Promise<MessagePayload>;
  loadTasks(roomId: string): Promise<TasksPayload>;
  createTask(roomId: string, input: UpsertTaskInput): Promise<TaskPayload>;
  updateTask(roomId: string, taskId: string, input: Partial<UpsertTaskInput> & { status?: TaskStatus }): Promise<TaskPayload>;
  deleteTask(roomId: string, taskId: string): Promise<ActionPayload>;
  loadNotes(roomId: string): Promise<NotesPayload>;
  createNote(roomId: string, input: UpsertNoteInput): Promise<NotePayload>;
  updateNote(roomId: string, noteId: string, input: Partial<UpsertNoteInput>): Promise<NotePayload>;
  deleteNote(roomId: string, noteId: string): Promise<ActionPayload>;
}

export function createApiClient({ getAccessToken, setAccessToken, clearSession }: CreateApiClientOptions): TypedApiClient {
  const base = createBaseClient();
  const refreshClient = createBaseClient();

  base.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  base.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiErrorResponse>) => {
      const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      if (error.response?.status === 401 && original && !original._retry && original.url !== '/auth/refresh') {
        original._retry = true;
        try {
          const refresh = await refreshClient.post<AuthPayload>('/auth/refresh');
          setAccessToken(refresh.data.token);
          original.headers.Authorization = `Bearer ${refresh.data.token}`;
          return base.request(original);
        } catch (refreshError) {
          clearSession();
          return Promise.reject(normalizeError(refreshError));
        }
      }

      return Promise.reject(normalizeError(error));
    }
  );

  async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
    const response = await promise;
    return response.data;
  }

  return {
    async getMe() {
      return unwrap(base.get<MePayload>('/auth/me'));
    },
    async login(credentials) {
      return unwrap(base.post<AuthPayload>('/auth/login', credentials));
    },
    async register(credentials) {
      return unwrap(base.post<AuthPayload>('/auth/register', credentials));
    },
    async refresh() {
      return unwrap(refreshClient.post<AuthPayload>('/auth/refresh'));
    },
    async logout() {
      return unwrap(base.post<ActionPayload>('/auth/logout'));
    },
    async loadRooms() {
      return unwrap(base.get<RoomsPayload>('/rooms'));
    },
    async loadDashboard(roomId) {
      return unwrap(base.get<DashboardPayload>(`/rooms/${roomId}/dashboard`));
    },
    async createRoom(input) {
      return unwrap(base.post<RoomPayload>('/rooms', input));
    },
    async joinRoom(input) {
      return unwrap(base.post<RoomPayload>('/rooms/join', input));
    },
    async updateRoom(roomId, input) {
      return unwrap(base.patch<RoomPayload>(`/rooms/${roomId}`, input));
    },
    async deleteRoom(roomId) {
      return unwrap(base.delete<ActionPayload & { roomId: string }>(`/rooms/${roomId}`));
    },
    async loadMessages(roomId) {
      return unwrap(base.get<MessagesPayload>(`/rooms/${roomId}/messages`));
    },
    async sendMessage(roomId, text) {
      return unwrap(base.post<MessagePayload>(`/rooms/${roomId}/messages`, { text }));
    },
    async loadTasks(roomId) {
      return unwrap(base.get<TasksPayload>(`/rooms/${roomId}/tasks`));
    },
    async createTask(roomId, input) {
      return unwrap(base.post<TaskPayload>(`/rooms/${roomId}/tasks`, input));
    },
    async updateTask(roomId, taskId, input) {
      return unwrap(base.patch<TaskPayload>(`/rooms/${roomId}/tasks/${taskId}`, input));
    },
    async deleteTask(roomId, taskId) {
      return unwrap(base.delete<ActionPayload>(`/rooms/${roomId}/tasks/${taskId}`));
    },
    async loadNotes(roomId) {
      return unwrap(base.get<NotesPayload>(`/rooms/${roomId}/notes`));
    },
    async createNote(roomId, input) {
      return unwrap(base.post<NotePayload>(`/rooms/${roomId}/notes`, input));
    },
    async updateNote(roomId, noteId, input) {
      return unwrap(base.patch<NotePayload>(`/rooms/${roomId}/notes/${noteId}`, input));
    },
    async deleteNote(roomId, noteId) {
      return unwrap(base.delete<ActionPayload>(`/rooms/${roomId}/notes/${noteId}`));
    }
  };
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
