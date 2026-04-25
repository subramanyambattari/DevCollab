import { BaseRepository } from './base-repository.js';
import { MessageModel, type MessageRecord } from '../models/message.js';

export class MessageRepository extends BaseRepository<MessageRecord> {
  constructor() {
    super(MessageModel);
  }

  listByRoom(roomId: string, limit = 50) {
    return this.model.find({ room: roomId }).sort({ createdAt: 1 }).limit(limit);
  }

  countByRoom(roomId: string) {
    return this.model.countDocuments({ room: roomId });
  }
}
