import { BaseRepository } from './base-repository.js';
import { NoteModel, type NoteRecord } from '../models/note.js';

export class NoteRepository extends BaseRepository<NoteRecord> {
  constructor() {
    super(NoteModel);
  }

  listByRoom(roomId: string) {
    return this.model.find({ room: roomId }).sort({ updatedAt: -1 });
  }
}
