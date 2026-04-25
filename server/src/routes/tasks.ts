import { Router, type Request } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { requireStringParam } from '../lib/http-params.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { taskSchema, taskUpdateSchema } from '../validation/schemas.js';
import { WorkspaceService } from '../services/workspace-service.js';
import { UserRepository } from '../repositories/user-repository.js';

interface TasksRouterDeps {
  workspace: WorkspaceService;
  users: UserRepository;
}

async function emitTasksUpdated(req: Request, workspace: WorkspaceService, roomId: string): Promise<void> {
  const io = req.app.get('io');
  const tasks = await workspace.listTasks(req.user!.id, roomId);
  io?.to(roomId).emit('tasks:updated', { roomId, tasks });
}

export function createTasksRouter({ workspace, users }: TasksRouterDeps) {
  const router = Router({ mergeParams: true });
  const requireAuth = createAuthMiddleware(users);

  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const tasks = await workspace.listTasks(req.user!.id, roomId);
      res.json({ tasks });
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const dto = taskSchema.parse(req.body);
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const task = await workspace.createTask(req.user!.id, roomId, dto);
      await emitTasksUpdated(req, workspace, roomId);
      res.status(201).json({ task });
    })
  );

  router.patch(
    '/:taskId',
    asyncHandler(async (req, res) => {
      const dto = taskUpdateSchema.parse(req.body);
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const taskId = requireStringParam(req.params.taskId, 'taskId');
      const task = await workspace.updateTask(req.user!.id, roomId, taskId, dto);
      await emitTasksUpdated(req, workspace, roomId);
      res.json({ task });
    })
  );

  router.delete(
    '/:taskId',
    asyncHandler(async (req, res) => {
      const roomId = requireStringParam(req.params.roomId, 'roomId');
      const taskId = requireStringParam(req.params.taskId, 'taskId');
      await workspace.deleteTask(req.user!.id, roomId, taskId);
      await emitTasksUpdated(req, workspace, roomId);
      res.json({ ok: true });
    })
  );

  return router;
}
