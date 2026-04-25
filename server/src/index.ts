import http from 'http';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { UserRepository } from './repositories/user-repository.js';
import { RoomRepository } from './repositories/room-repository.js';
import { MessageRepository } from './repositories/message-repository.js';
import { TaskRepository } from './repositories/task-repository.js';
import { NoteRepository } from './repositories/note-repository.js';
import { AuthService } from './services/auth-service.js';
import { WorkspaceService } from './services/workspace-service.js';
import { createSocketServer } from './socket.js';

async function bootstrap(): Promise<void> {
  const users = new UserRepository();
  const rooms = new RoomRepository();
  const messages = new MessageRepository();
  const tasks = new TaskRepository();
  const notes = new NoteRepository();

  const authService = new AuthService(users);
  const workspace = new WorkspaceService(rooms, messages, tasks, notes);

  await connectDatabase();

  const app = createApp({ authService, workspace, users });
  const server = http.createServer(app);
  const io = createSocketServer(server, workspace);
  app.set('io', io);

  server.listen(env.PORT, () => {
    console.log(`DevCollab server listening on port ${env.PORT}`);
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start DevCollab server.');
  console.error(error);
  process.exit(1);
});
