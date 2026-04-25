import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { requireStringParam } from '../lib/http-params.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { messageSchema } from '../validation/schemas.js';
import { WorkspaceService } from '../services/workspace-service.js';
import { UserRepository } from '../repositories/user-repository.js';

interface MessagesRouterDeps {
  workspace: WorkspaceService;
  users: UserRepository;
}

export function createMessagesRouter({ workspace, users }: MessagesRouterDeps) {
  const router = Router({ mergeParams: true });
  const requireAuth = createAuthMiddleware(users);

  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const messages = await workspace.listMessages(req.user!.id, roomId);
      res.json({ messages });
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const dto = messageSchema.parse(req.body);
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const message = await workspace.sendMessage(req.user!.id, roomId, dto.text);
      const io = req.app.get('io');
      io?.to(roomId).emit('message:new', message);
      res.status(201).json({ message });
    })
  );

  return router;
}
