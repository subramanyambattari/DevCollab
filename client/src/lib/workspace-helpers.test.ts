import { describe, expect, it } from 'vitest';
import { TaskStatus } from '@shared/types';
import { groupTasks, usernameOf } from './workspace-helpers';

describe('workspace helpers', () => {
  it('groups tasks by status', () => {
    const grouped = groupTasks([
      { id: '1', room: 'r', title: 'a', description: '', status: TaskStatus.Todo, order: 0, createdBy: { id: 'u', username: 'sam' }, createdAt: '', updatedAt: '' },
      { id: '2', room: 'r', title: 'b', description: '', status: TaskStatus.Done, order: 1, createdBy: { id: 'u', username: 'sam' }, createdAt: '', updatedAt: '' }
    ]);

    expect(grouped[TaskStatus.Todo]).toHaveLength(1);
    expect(grouped[TaskStatus.Done]).toHaveLength(1);
    expect(grouped[TaskStatus.Doing]).toHaveLength(0);
  });

  it('reads usernames from different shapes', () => {
    expect(usernameOf('alex')).toBe('alex');
    expect(usernameOf({ username: 'sam' })).toBe('sam');
    expect(usernameOf(undefined)).toBe('Unknown');
  });
});
