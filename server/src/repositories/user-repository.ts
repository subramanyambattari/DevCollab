import { BaseRepository } from './base-repository.js';
import { UserModel, type UserRecord } from '../models/user.js';

export class UserRepository extends BaseRepository<UserRecord> {
  constructor() {
    super(UserModel);
  }

  findByUsername(username: string) {
    return this.model.findOne({
      username: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    });
  }

  findByUsernameExact(username: string) {
    return this.model.findOne({ username });
  }

  storeRefreshToken(userId: string, refreshTokenHash: string, refreshTokenExpiresAt: Date) {
    return this.model.updateOne(
      { _id: userId },
      {
        $set: {
          refreshTokenHash,
          refreshTokenExpiresAt
        }
      }
    );
  }

  clearRefreshToken(userId: string) {
    return this.model.updateOne(
      { _id: userId },
      {
        $set: {
          refreshTokenHash: null,
          refreshTokenExpiresAt: null
        }
      }
    );
  }
}
