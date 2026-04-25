import { TaskStatus, type DashboardDTO } from '@shared/types';

export function usernameOf(value: unknown): string {
  if (!value) return 'Unknown';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const record = value as { username?: string; name?: string };
    return record.username || record.name || 'Unknown';
  }
  return 'Unknown';
}

export function formatTime(value: string | undefined): string {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export function groupTasks(tasks: DashboardDTO['tasks']) {
  return {
    [TaskStatus.Todo]: tasks.filter((task) => task.status === TaskStatus.Todo),
    [TaskStatus.Doing]: tasks.filter((task) => task.status === TaskStatus.Doing),
    [TaskStatus.Done]: tasks.filter((task) => task.status === TaskStatus.Done)
  };
}
