import type { FeedbackState } from '../store/collab-store';

interface FeedbackProps {
  feedback: FeedbackState;
}

export function Feedback({ feedback }: FeedbackProps) {
  if (!feedback) {
    return null;
  }

  const styles =
    feedback.type === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
      : 'border-rose-500/20 bg-rose-500/10 text-rose-100';

  return (
    <div className={`glass mb-4 rounded-2xl border px-4 py-3 text-sm ${styles}`}>{feedback.message}</div>
  );
}
