import { Server, type Socket } from 'socket.io';
import { env } from './config/env.js';
import { verifyAccessToken } from './lib/token.js';
import { WorkspaceService } from './services/workspace-service.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types.js';

interface SocketAuth {
  token?: string;
}

interface AuthenticatedSocketData {
  userId: string;
  username: string;
  role: string;
}

export function createSocketServer(server: import('node:http').Server, workspace: WorkspaceService): Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  AuthenticatedSocketData
> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, AuthenticatedSocketData>(server, {
    cors: {
      origin: env.CLIENT_URL || true,
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const token = (socket.handshake.auth as SocketAuth | undefined)?.token;
      if (!token) {
        next(new Error('Authentication required.'));
        return;
      }

      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.username = payload.username;
      socket.data.role = payload.role;

      next();
    } catch {
      next(new Error('Authentication failed.'));
    }
  });

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, AuthenticatedSocketData>) => {
    socket.on('room:join', async ({ roomId }) => {
      try {
        const room = await workspace.getRoom(socket.data.userId, roomId);
        socket.join(room.id);
        socket.emit('room:joined', {
          roomId: room.id,
          inviteCode: room.inviteCode
        });
      } catch (error) {
        socket.emit('room:error', {
          message: error instanceof Error ? error.message : 'Room not found.'
        });
      }
    });

    socket.on('message:send', async ({ roomId, text }) => {
      try {
        const message = await workspace.sendMessage(socket.data.userId, roomId, text);
        io.to(message.room).emit('message:new', message);
      } catch (error) {
        socket.emit('room:error', {
          message: error instanceof Error ? error.message : 'Could not send message.'
        });
      }
    });
  });

  return io;
}
