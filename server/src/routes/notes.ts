import { Router, type Request } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { requireStringParam } from '../lib/http-params.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { noteSchema, noteUpdateSchema } from '../validation/schemas.js';
import { WorkspaceService } from '../services/workspace-service.js';
import { UserRepository } from '../repositories/user-repository.js';

interface NotesRouterDeps {
  workspace: WorkspaceService;
  users: UserRepository;
}

async function emitNotesUpdated(req: Request, workspace: WorkspaceService, roomId: string): Promise<void> {
  const io = req.app.get('io');
  const notes = await workspace.listNotes(req.user!.id, roomId);
  io?.to(roomId).emit('notes:updated', { roomId, notes });
}

export function createNotesRouter({ workspace, users }: NotesRouterDeps) {
  const router = Router({ mergeParams: true });
  const requireAuth = createAuthMiddleware(users);

  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const notes = await workspace.listNotes(req.user!.id, roomId);
      res.json({ notes });
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const dto = noteSchema.parse(req.body);
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const note = await workspace.createNote(req.user!.id, roomId, dto);
      await emitNotesUpdated(req, workspace, roomId);
      res.status(201).json({ note });
    })
  );

  router.patch(
    '/:noteId',
    asyncHandler(async (req, res) => {
      const dto = noteUpdateSchema.parse(req.body);
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const noteId = requireStringParam(req.params.noteId, 'noteId');
      const note = await workspace.updateNote(req.user!.id, roomId, noteId, dto);
      await emitNotesUpdated(req, workspace, roomId);
      res.json({ note });
    })
  );

  router.delete(
    '/:noteId',
    asyncHandler(async (req, res) => {
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const noteId = requireStringParam(req.params.noteId, 'noteId');
      await workspace.deleteNote(req.user!.id, roomId, noteId);
      await emitNotesUpdated(req, workspace, roomId);
      res.json({ ok: true });
    })
  );

  return router;
}
