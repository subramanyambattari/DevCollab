import { create } from 'zustand';
import type { DashboardDTO, PublicUser, RoomSummary } from '@shared/types';

export type FeedbackState = {
  type: 'success' | 'error';
  message: string;
} | null;

export interface CollabState {
  token: string;
  user: PublicUser | null;
  rooms: RoomSummary[];
  selectedRoomId: string;
  dashboard: DashboardDTO | null;
  feedback: FeedbackState;
  busy: boolean;
  setSession: (token: string, user: PublicUser) => void;
  setAccessToken: (token: string) => void;
  clearSession: () => void;
  setRooms: (rooms: RoomSummary[]) => void;
  setSelectedRoomId: (roomId: string) => void;
  setDashboard: (dashboard: DashboardDTO | null | ((current: DashboardDTO | null) => DashboardDTO | null)) => void;
  setFeedback: (feedback: FeedbackState) => void;
  setBusy: (busy: boolean) => void;
}

const storageKey = 'devcollab-token';

function readToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(storageKey) ?? '';
}

export const useCollabStore = create<CollabState>((set) => ({
  token: readToken(),
  user: null,
  rooms: [],
  selectedRoomId: '',
  dashboard: null,
  feedback: null,
  busy: false,
  setSession: (token, user) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, token);
    }
    set({ token, user });
  },
  setAccessToken: (token) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, token);
    }
    set({ token });
  },
  clearSession: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
    set({
      token: '',
      user: null,
      rooms: [],
      selectedRoomId: '',
      dashboard: null,
      feedback: null,
      busy: false
    });
  },
  setRooms: (rooms) => set({ rooms }),
  setSelectedRoomId: (selectedRoomId) => set({ selectedRoomId }),
  setDashboard: (dashboard) =>
    set((state) => ({
      dashboard: typeof dashboard === 'function' ? dashboard(state.dashboard) : dashboard
    })),
  setFeedback: (feedback) => set({ feedback }),
  setBusy: (busy) => set({ busy })
}));
