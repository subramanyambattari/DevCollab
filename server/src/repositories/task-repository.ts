import { BaseRepository } from './base-repository.js';
import { TaskModel, type TaskRecord } from '../models/task.js';
import { TaskStatus } from '../../../shared/types.js';

export class TaskRepository extends BaseRepository<TaskRecord> {
  constructor() {
    super(TaskModel);
  }

  listByRoom(roomId: string) {
    return this.model.find({ room: roomId }).sort({ status: 1, order: 1, createdAt: 1 });
  }

  countByRoomAndStatus(roomId: string, status: TaskStatus) {
    return this.model.countDocuments({ room: roomId, status });
  }
}
