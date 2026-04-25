import { useCallback, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  MessageDTO,
  RoomErrorPayload,
  NotesUpdatedPayload,
  ServerToClientEvents,
  SocketRoomJoinedPayload,
  TasksUpdatedPayload
} from '@shared/types';

interface UseWorkspaceSocketOptions {
  token: string;
  selectedRoomId: string;
  onRoomError: (message: string) => void;
  onRoomsUpdated: () => Promise<void> | void;
  onMessage: (message: MessageDTO) => void;
  onTasksUpdated: (payload: TasksUpdatedPayload) => void;
  onNotesUpdated: (payload: NotesUpdatedPayload) => void;
  onRoomJoined?: (payload: SocketRoomJoinedPayload) => void;
}

export function useWorkspaceSocket({
  token,
  selectedRoomId,
  onRoomError,
  onRoomsUpdated,
  onMessage,
  onTasksUpdated,
  onNotesUpdated,
  onRoomJoined
}: UseWorkspaceSocketOptions) {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const selectedRoomRef = useRef(selectedRoomId);

  useEffect(() => {
    selectedRoomRef.current = selectedRoomId;
  }, [selectedRoomId]);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io<ServerToClientEvents, ClientToServerEvents>(window.location.origin, {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (selectedRoomRef.current) {
        socket.emit('room:join', { roomId: selectedRoomRef.current });
      }
    });

    socket.on('room:error', (payload: RoomErrorPayload) => {
      onRoomError(payload.message || 'Room error.');
    });

    socket.on('rooms:updated', () => {
      void Promise.resolve(onRoomsUpdated()).catch(() => {
        onRoomError('Could not refresh workspace.');
      });
    });

    socket.on('message:new', (message: MessageDTO) => {
      onMessage(message);
    });

    socket.on('tasks:updated', (payload: TasksUpdatedPayload) => {
      onTasksUpdated(payload);
    });

    socket.on('notes:updated', (payload: NotesUpdatedPayload) => {
      onNotesUpdated(payload);
    });

    socket.on('room:joined', (payload: SocketRoomJoinedPayload) => {
      onRoomJoined?.(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, onMessage, onNotesUpdated, onRoomError, onRoomJoined, onRoomsUpdated, onTasksUpdated]);

  useEffect(() => {
    if (socketRef.current && selectedRoomId) {
      socketRef.current.emit('room:join', { roomId: selectedRoomId });
    }
  }, [selectedRoomId]);

  return useCallback((roomId: string, text: string) => {
    if (!socketRef.current?.connected) {
      return false;
    }

    socketRef.current.emit('message:send', { roomId, text });
    return true;
  }, []);
}
