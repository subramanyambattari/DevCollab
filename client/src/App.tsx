import { lazy, Suspense } from 'react';
import { useCollabStore } from './store/collab-store';

const AuthScreen = lazy(() => import('./screens/AuthScreen').then((module) => ({ default: module.AuthScreen })));
const WorkspaceScreen = lazy(() =>
  import('./screens/WorkspaceScreen').then((module) => ({ default: module.WorkspaceScreen }))
);

function LoadingShell() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center text-slate-300">
      <div className="glass rounded-3xl px-6 py-4">Loading DevCollab...</div>
    </div>
  );
}

export default function App() {
  const token = useCollabStore((state) => state.token);

  return (
    <Suspense fallback={<LoadingShell />}>{token ? <WorkspaceScreen /> : <AuthScreen />}</Suspense>
  );
}
