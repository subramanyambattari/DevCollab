import mongoose from 'mongoose';
import { BaseRepository } from './base-repository.js';
import { RoomModel, type RoomRecord } from '../models/room.js';

export class RoomRepository extends BaseRepository<RoomRecord> {
  constructor() {
    super(RoomModel);
  }

  findByMember(userId: string) {
    return this.model.find({ members: userId }).sort({ updatedAt: -1 });
  }

  findAccessible(roomId: string, userId: string) {
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return Promise.resolve(null);
    }

    return this.model.findOne({ _id: roomId, members: userId });
  }

  findOwned(roomId: string, ownerId: string) {
    return this.model.findOne({ _id: roomId, owner: ownerId });
  }
}
