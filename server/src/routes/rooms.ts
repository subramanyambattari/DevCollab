import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { requireStringParam } from '../lib/http-params.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createRoomSchema, joinRoomSchema, updateRoomSchema } from '../validation/schemas.js';
import { WorkspaceService } from '../services/workspace-service.js';
import { UserRepository } from '../repositories/user-repository.js';

interface RoomsRouterDeps {
  workspace: WorkspaceService;
  users: UserRepository;
}

function emitRoomsUpdated(io: unknown, userIds: string[]): void {
  if (!io || typeof io !== 'object') {
    return;
  }

  (io as { emit: (event: string, payload: { userIds: string[] }) => void }).emit('rooms:updated', { userIds });
}

export function createRoomsRouter({ workspace, users }: RoomsRouterDeps) {
  const router = Router();
  const requireAuth = createAuthMiddleware(users);

  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const rooms = await workspace.listRooms(req.user!.id);
      res.json({ rooms });
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const dto = createRoomSchema.parse(req.body);
      const room = await workspace.createRoom(req.user!.id, dto.name);
      res.status(201).json({ room });
      emitRoomsUpdated(req.app.get('io'), room.members.map((member) => member.id));
    })
  );

  router.post(
    '/join',
    asyncHandler(async (req, res) => {
      const dto = joinRoomSchema.parse(req.body);
      const room = await workspace.joinRoom(req.user!.id, dto.inviteCode);
      res.json({ room });
      emitRoomsUpdated(req.app.get('io'), room.members.map((member) => member.id));
    })
  );

  router.patch(
    '/:roomId',
    asyncHandler(async (req, res) => {
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const dto = updateRoomSchema.parse(req.body);
      const room = await workspace.updateRoom(req.user!.id, roomId, dto.name);
      res.json({ room });
      emitRoomsUpdated(req.app.get('io'), room.members.map((member) => member.id));
    })
  );

  router.delete(
    '/:roomId',
    asyncHandler(async (req, res) => {
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const deleted = await workspace.deleteRoom(req.user!.id, roomId);
      res.json({ ok: true, roomId: deleted.roomId });
      emitRoomsUpdated(req.app.get('io'), deleted.members);
    })
  );

  router.get(
    '/:roomId/dashboard',
    asyncHandler(async (req, res) => {
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const dashboard = await workspace.getDashboard(req.user!.id, roomId);
      res.json(dashboard);
    })
  );

  router.get(
    '/:roomId',
    asyncHandler(async (req, res) => {
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const room = await workspace.getRoom(req.user!.id, roomId);
      res.json({ room });
    })
  );

  return router;
}
