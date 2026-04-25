import { useMemo } from 'react';
import { createApiClient } from '../lib/api';
import { useCollabStore } from '../store/collab-store';

export function useApiClient() {
  const token = useCollabStore((state) => state.token);
  const setAccessToken = useCollabStore((state) => state.setAccessToken);
  const clearSession = useCollabStore((state) => state.clearSession);

  return useMemo(
    () =>
      createApiClient({
        getAccessToken: () => token,
        setAccessToken,
        clearSession
      }),
    [clearSession, setAccessToken, token]
  );
}
