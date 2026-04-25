import type { FilterQuery, Model, UpdateQuery } from 'mongoose';

export class BaseRepository<TRawDocType> {
  constructor(public readonly model: Model<TRawDocType>) {}

  findOne(filter: FilterQuery<TRawDocType>) {
    return this.model.findOne(filter);
  }

  findById(id: string) {
    return this.model.findById(id);
  }

  find(filter: FilterQuery<TRawDocType>) {
    return this.model.find(filter);
  }

  create(doc: Partial<TRawDocType>) {
    return this.model.create(doc);
  }

  updateOne(filter: FilterQuery<TRawDocType>, update: UpdateQuery<TRawDocType>) {
    return this.model.updateOne(filter, update);
  }
}
