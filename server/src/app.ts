import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { WorkspaceService } from './services/workspace-service.js';
import type { AuthService } from './services/auth-service.js';
import { createAuthRouter } from './routes/auth.js';
import { createRoomsRouter } from './routes/rooms.js';
import { createMessagesRouter } from './routes/messages.js';
import { createTasksRouter } from './routes/tasks.js';
import { createNotesRouter } from './routes/notes.js';
import { errorMiddleware } from './middleware/error.js';
import { env } from './config/env.js';
import { UserRepository } from './repositories/user-repository.js';

interface AppDeps {
  authService: AuthService;
  workspace: WorkspaceService;
  users: UserRepository;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp({ authService, workspace, users }: AppDeps) {
  const app = express();
  const staticDir = path.resolve(__dirname, '../../client/dist');
  const hasClientBuild = fs.existsSync(path.join(staticDir, 'index.html'));

  app.use(
    cors({
      origin: env.CLIENT_URL || true,
      credentials: true
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'devcollab',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/auth', createAuthRouter({ authService, users }));
  app.use('/api/rooms', createRoomsRouter({ workspace, users }));
  app.use('/api/rooms/:roomId/messages', createMessagesRouter({ workspace, users }));
  app.use('/api/rooms/:roomId/tasks', createTasksRouter({ workspace, users }));
  app.use('/api/rooms/:roomId/notes', createNotesRouter({ workspace, users }));

  if (hasClientBuild) {
    app.use(express.static(staticDir));
  }

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ message: 'Route not found.' });
      return;
    }

    if (hasClientBuild) {
      res.sendFile(path.join(staticDir, 'index.html'));
      return;
    }

    res.status(404).json({ message: 'Frontend build not found.' });
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ message: 'Route not found.' });
      return;
    }

    next();
  });

  app.use(errorMiddleware);

  return app;
}
