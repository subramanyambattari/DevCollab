import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { TaskStatus, type DashboardDTO, type MessageDTO, type NotesUpdatedPayload, type TasksUpdatedPayload } from '@shared/types';
import { Feedback } from '../components/Feedback';
import { useApiClient } from '../hooks/useApiClient';
import { useWorkspaceSocket } from '../hooks/useWorkspaceSocket';
import { formatTime, groupTasks, usernameOf } from '../lib/workspace-helpers';
import { useCollabStore } from '../store/collab-store';

type RoomForm = {
  name: string;
  inviteCode: string;
};

type TaskForm = {
  title: string;
  description: string;
};

type NoteForm = {
  title: string;
  content: string;
};

const emptyRoomForm: RoomForm = { name: '', inviteCode: '' };
const emptyTaskForm: TaskForm = { title: '', description: '' };
const emptyNoteForm: NoteForm = { title: '', content: '' };

const statusMeta: Record<TaskStatus, { label: string; dot: string }> = {
  [TaskStatus.Todo]: {
    label: 'To Do',
    dot: 'bg-sky-400'
  },
  [TaskStatus.Doing]: {
    label: 'In Progress',
    dot: 'bg-amber-400'
  },
  [TaskStatus.Done]: {
    label: 'Done',
    dot: 'bg-emerald-400'
  }
};

export function WorkspaceScreen() {
  const api = useApiClient();
  const token = useCollabStore((state) => state.token);
  const user = useCollabStore((state) => state.user);
  const rooms = useCollabStore((state) => state.rooms);
  const selectedRoomId = useCollabStore((state) => state.selectedRoomId);
  const dashboard = useCollabStore((state) => state.dashboard);
  const feedback = useCollabStore((state) => state.feedback);
  const busy = useCollabStore((state) => state.busy);
  const setBusy = useCollabStore((state) => state.setBusy);
  const setFeedback = useCollabStore((state) => state.setFeedback);
  const setRooms = useCollabStore((state) => state.setRooms);
  const setSelectedRoomId = useCollabStore((state) => state.setSelectedRoomId);
  const setDashboard = useCollabStore((state) => state.setDashboard);
  const clearSession = useCollabStore((state) => state.clearSession);
  const setSession = useCollabStore((state) => state.setSession);
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoomForm);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm);
  const [noteForm, setNoteForm] = useState<NoteForm>(emptyNoteForm);
  const [messageText, setMessageText] = useState('');
  const [roomEditName, setRoomEditName] = useState('');

  const loadRooms = useCallback(async () => {
    const payload = await api.loadRooms();
    setRooms(payload.rooms);
    return payload.rooms;
  }, [api, setRooms]);

  const loadDashboard = useCallback(
    async (roomId: string) => {
      if (!roomId) return;
      const payload = await api.loadDashboard(roomId);
      setDashboard(payload);
      setSelectedRoomId(roomId);
      setRoomEditName(payload.room.name);
    },
    [api, setDashboard, setSelectedRoomId]
  );

  const showSuccess = useCallback(
    (message: string) => {
      setFeedback({ type: 'success', message });
    },
    [setFeedback]
  );

  const showError = useCallback(
    (message: string) => {
      setFeedback({ type: 'error', message });
    },
    [setFeedback]
  );

  const refreshWorkspace = useCallback(async () => {
    try {
      const latestRooms = await loadRooms();
      const currentRoomId = useCollabStore.getState().selectedRoomId;
      if (!currentRoomId) {
        if (latestRooms.length > 0) {
          await loadDashboard(latestRooms[0].id);
        }
        return;
      }

      try {
        await loadDashboard(currentRoomId);
      } catch {
        const stillExists = latestRooms.some((room) => room.id === currentRoomId);
        if (!stillExists) {
          setDashboard(null);
          setSelectedRoomId('');
          setRoomEditName('');
        }
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not refresh workspace.');
    }
  }, [loadDashboard, loadRooms, setDashboard, setSelectedRoomId, showError]);

  const handleSocketMessage = useCallback(
    (message: MessageDTO) => {
      if (message.room !== useCollabStore.getState().selectedRoomId) {
        return;
      }

      setDashboard((current: DashboardDTO | null) =>
        current && current.room.id === message.room
          ? { ...current, messages: [...current.messages, message] }
          : current
      );
    },
    [setDashboard]
  );

  const handleSocketTasksUpdated = useCallback(
    (payload: TasksUpdatedPayload) => {
      if (payload.roomId !== useCollabStore.getState().selectedRoomId) {
        return;
      }

      setDashboard((current: DashboardDTO | null) =>
        current && current.room.id === payload.roomId ? { ...current, tasks: payload.tasks } : current
      );
    },
    [setDashboard]
  );

  const handleSocketNotesUpdated = useCallback(
    (payload: NotesUpdatedPayload) => {
      if (payload.roomId !== useCollabStore.getState().selectedRoomId) {
        return;
      }

      setDashboard((current: DashboardDTO | null) =>
        current && current.room.id === payload.roomId ? { ...current, notes: payload.notes } : current
      );
    },
    [setDashboard]
  );

  const sendSocketMessage = useWorkspaceSocket({
    token,
    selectedRoomId,
    onRoomError: showError,
    onRoomsUpdated: refreshWorkspace,
    onMessage: handleSocketMessage,
    onTasksUpdated: handleSocketTasksUpdated,
    onNotesUpdated: handleSocketNotesUpdated
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const me = await api.getMe();
        if (cancelled) return;

        if (!user || user.id !== me.user.id) {
          setSession(token, me.user);
        }

        const latestRooms = await loadRooms();
        if (cancelled) return;

        if (selectedRoomId) {
          await loadDashboard(selectedRoomId);
        } else if (latestRooms.length > 0) {
          await loadDashboard(latestRooms[0].id);
        }
      } catch (error) {
        if (cancelled) return;
        clearSession();
        showError(error instanceof Error ? error.message : 'Session expired.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, clearSession, loadDashboard, loadRooms, selectedRoomId, setSession, showError, token, user]);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [feedback, setFeedback]);

  useEffect(() => {
    if (dashboard?.room?.name) {
      setRoomEditName(dashboard.room.name);
    }
  }, [dashboard?.room?.name]);

  const groupedTasks = useMemo(() => groupTasks(dashboard?.tasks ?? []), [dashboard?.tasks]);
  const isRoomOwner = Boolean(dashboard?.room?.owner?.id && user?.id && dashboard.room.owner.id === user.id);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearSession();
    }
  }, [api, clearSession]);

  const handleCreateRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBusy(true);
      setFeedback(null);

      try {
        const payload = await api.createRoom({ name: roomForm.name });
        setRoomForm((current) => ({ ...current, name: '' }));
        await refreshWorkspace();
        await loadDashboard(payload.room.id);
        showSuccess('Room created.');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Could not create room.');
      } finally {
        setBusy(false);
      }
    },
    [api, loadDashboard, refreshWorkspace, roomForm.name, setBusy, setFeedback, showError, showSuccess]
  );

  const handleJoinRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBusy(true);
      setFeedback(null);

      try {
        const payload = await api.joinRoom({ inviteCode: roomForm.inviteCode });
        setRoomForm((current) => ({ ...current, inviteCode: '' }));
        await refreshWorkspace();
        await loadDashboard(payload.room.id);
        showSuccess('Joined room.');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Could not join room.');
      } finally {
        setBusy(false);
      }
    },
    [api, loadDashboard, refreshWorkspace, roomForm.inviteCode, setBusy, setFeedback, showError, showSuccess]
  );

  const handleSelectRoom = useCallback(
    async (roomId: string) => {
      setSelectedRoomId(roomId);
      setFeedback(null);
      await loadDashboard(roomId);
    },
    [loadDashboard, setFeedback, setSelectedRoomId]
  );

  const handleUpdateRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedRoomId) return;

      setBusy(true);
      setFeedback(null);

      try {
        await api.updateRoom(selectedRoomId, { name: roomEditName });
        await refreshWorkspace();
        await loadDashboard(selectedRoomId);
        showSuccess('Room updated.');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Could not update room.');
      } finally {
        setBusy(false);
      }
    },
    [api, loadDashboard, refreshWorkspace, roomEditName, selectedRoomId, setBusy, setFeedback, showError, showSuccess]
  );

  const handleDeleteRoom = useCallback(async () => {
    if (!selectedRoomId) return;

    const confirmDelete = window.confirm('Delete this room and all related messages, tasks, and notes?');
    if (!confirmDelete) return;

    setBusy(true);
    setFeedback(null);

    try {
      await api.deleteRoom(selectedRoomId);
      await refreshWorkspace();
      showSuccess('Room deleted.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not delete room.');
    } finally {
      setBusy(false);
    }
  }, [api, refreshWorkspace, selectedRoomId, setBusy, setFeedback, showError, showSuccess]);

  const handleSendMessage = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const text = messageText.trim();
      if (!text || !selectedRoomId) return;

      setMessageText('');
      setFeedback(null);

      try {
        const sentViaSocket = sendSocketMessage(selectedRoomId, text);
        if (sentViaSocket) {
          return;
        }

        const payload = await api.sendMessage(selectedRoomId, text);
        setDashboard((current: DashboardDTO | null) =>
          current && current.room.id === selectedRoomId
            ? { ...current, messages: [...current.messages, payload.message] }
            : current
        );
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Could not send message.');
      }
    },
    [api, messageText, selectedRoomId, sendSocketMessage, setDashboard, setFeedback, showError]
  );

  const handleAddTask = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedRoomId) return;
      setBusy(true);
      setFeedback(null);

      try {
        await api.createTask(selectedRoomId, taskForm);
        setTaskForm(emptyTaskForm);
        await loadDashboard(selectedRoomId);
        showSuccess('Task added.');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Could not create task.');
      } finally {
        setBusy(false);
      }
    },
    [api, loadDashboard, selectedRoomId, setBusy, setFeedback, showError, showSuccess, taskForm]
  );

  const moveTask = useCallback(
    async (taskId: string, nextStatus: TaskStatus) => {
      if (!selectedRoomId) return;
      setFeedback(null);

      try {
        await api.updateTask(selectedRoomId, taskId, { status: nextStatus });
        await loadDashboard(selectedRoomId);
        showSuccess('Task updated.');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Could not update task.');
      }
    },
    [api, loadDashboard, selectedRoomId, setFeedback, showError, showSuccess]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!selectedRoomId) return;
      setFeedback(null);

      try {
        await api.deleteTask(selectedRoomId, taskId);
        await loadDashboard(selectedRoomId);
        showSuccess('Task deleted.');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Could not delete task.');
      }
    },
    [api, loadDashboard, selectedRoomId, setFeedback, showError, showSuccess]
  );

  const handleAddNote = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedRoomId) return;
      setBusy(true);
      setFeedback(null);

      try {
        await api.createNote(selectedRoomId, noteForm);
        setNoteForm(emptyNoteForm);
        await loadDashboard(selectedRoomId);
        showSuccess('Note added.');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Could not create note.');
      } finally {
        setBusy(false);
      }
    },
    [api, loadDashboard, noteForm, selectedRoomId, setBusy, setFeedback, showError, showSuccess]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      if (!selectedRoomId) return;
      setFeedback(null);

      try {
        await api.deleteNote(selectedRoomId, noteId);
        await loadDashboard(selectedRoomId);
        showSuccess('Note deleted.');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Could not delete note.');
      }
    },
    [api, loadDashboard, selectedRoomId, setFeedback, showError, showSuccess]
  );

  const copyInviteCode = useCallback(async () => {
    if (!dashboard?.room?.inviteCode) return;

    try {
      await navigator.clipboard.writeText(dashboard.room.inviteCode);
      showSuccess('Invite code copied.');
    } catch {
      showError('Could not copy invite code.');
    }
  }, [dashboard?.room?.inviteCode, showError, showSuccess]);

  if (!token) {
    return null;
  }

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center text-slate-300">
        <div className="glass rounded-3xl px-6 py-4">Restoring your workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1700px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="glass flex flex-col gap-4 rounded-[2rem] p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="section-title">DevCollab</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{user.username}</h2>
              <p className="mt-1 text-sm text-slate-400">Workspace owner or member</p>
            </div>
            <button className="button-secondary shrink-0" onClick={logout} type="button">
              Logout
            </button>
          </div>

          <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold text-slate-200">Rooms</p>
            <form className="grid gap-3" onSubmit={handleCreateRoom}>
              <input
                className="input-base"
                value={roomForm.name}
                onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })}
                placeholder="Design Sprint"
              />
              <button className="button-primary" disabled={busy} type="submit">
                Create room
              </button>
            </form>
            <form className="grid gap-3" onSubmit={handleJoinRoom}>
              <input
                className="input-base"
                value={roomForm.inviteCode}
                onChange={(event) => setRoomForm({ ...roomForm, inviteCode: event.target.value })}
                placeholder="ABC123"
              />
              <button className="button-secondary" disabled={busy} type="submit">
                Join room
              </button>
            </form>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-200">Your rooms</p>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
                {rooms.length}
              </span>
            </div>

            <div className="grid gap-2 overflow-auto pr-1">
              {rooms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                  No rooms yet. Create one to get started.
                </div>
              ) : null}
              {rooms.map((room) => {
                const active = room.id === selectedRoomId;
                return (
                  <button
                    key={room.id}
                    className={[
                      'rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5',
                      active
                        ? 'border-cyan-400/40 bg-cyan-400/10 shadow-lg shadow-cyan-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    ].join(' ')}
                    onClick={() => void handleSelectRoom(room.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-white">{room.name}</span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        {room.inviteCode}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Owner {usernameOf(room.owner)} | {room.members.length} members
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="glass rounded-[2rem] p-4 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="section-title">Shared workspace</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                  {dashboard?.room?.name || 'Select a room'}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
                  Keep everything in one place: live chat, task tracking, and shared notes all update in real time.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Messages</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{dashboard?.messages.length ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Tasks</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{dashboard?.tasks.length ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Notes</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{dashboard?.notes.length ?? 0}</div>
                </div>
                {dashboard?.room?.inviteCode ? (
                  <button className="button-secondary whitespace-nowrap" onClick={() => void copyInviteCode()} type="button">
                    Copy code {dashboard.room.inviteCode}
                  </button>
                ) : null}
              </div>
            </div>

            {dashboard && isRoomOwner ? (
              <form
                className="mt-4 grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_auto_auto] md:items-center"
                onSubmit={handleUpdateRoom}
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Room settings</p>
                  <input
                    className="input-base mt-2"
                    value={roomEditName}
                    onChange={(event) => setRoomEditName(event.target.value)}
                    placeholder="Room name"
                  />
                </div>
                <button className="button-primary md:self-end" disabled={busy} type="submit">
                  Save name
                </button>
                <button
                  className="button-secondary border-rose-500/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 md:self-end"
                  disabled={busy}
                  onClick={() => void handleDeleteRoom()}
                  type="button"
                >
                  Delete room
                </button>
              </form>
            ) : null}

            <div className="mt-4">
              <Feedback feedback={feedback} />
            </div>
          </div>

          {!dashboard ? (
            <div className="glass mt-4 grid min-h-[50vh] place-items-center rounded-[2rem] p-8 text-center">
              <div>
                <p className="section-title">No room selected</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Choose a room or create a new one</h2>
                <p className="mt-2 text-slate-400">Your workspace will appear here once a room is active.</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 2xl:grid-cols-[1.2fr_1.05fr_0.95fr]">
              <section className="glass flex min-h-[620px] flex-col rounded-[2rem] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className="section-title">Live chat</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Team conversation</h3>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
                    Live updates
                  </span>
                </div>

                <div className="mt-4 flex-1 space-y-3 overflow-auto pr-1">
                  {dashboard.messages.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                      No messages yet. Start the conversation.
                    </div>
                  ) : null}
                  {dashboard.messages.map((message) => (
                    <article key={message.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-white">{usernameOf(message.sender)}</strong>
                        <span className="text-xs text-slate-500">{formatTime(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{message.text}</p>
                    </article>
                  ))}
                </div>

                <form className="mt-4 flex gap-3" onSubmit={handleSendMessage}>
                  <input
                    className="input-base flex-1"
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Send a message..."
                  />
                  <button className="button-primary shrink-0 px-5" type="submit">
                    Send
                  </button>
                </form>
              </section>

              <section className="glass rounded-[2rem] p-4 sm:p-5">
                <div className="border-b border-white/10 pb-4">
                  <p className="section-title">Kanban</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Task board</h3>
                </div>

                <form className="mt-4 grid gap-3" onSubmit={handleAddTask}>
                  <input
                    className="input-base"
                    value={taskForm.title}
                    onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                    placeholder="Task title"
                  />
                  <input
                    className="input-base"
                    value={taskForm.description}
                    onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })}
                    placeholder="Task details"
                  />
                  <button className="button-secondary" disabled={busy} type="submit">
                    Add task
                  </button>
                </form>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  {[TaskStatus.Todo, TaskStatus.Doing, TaskStatus.Done].map((status) => {
                    const meta = statusMeta[status];
                    return (
                      <div key={status} className="rounded-3xl border border-white/10 bg-slate-950/40 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                            <h4 className="text-sm font-semibold text-white">{meta.label}</h4>
                          </div>
                          <span className="text-xs text-slate-500">{groupedTasks[status].length}</span>
                        </div>

                        <div className="space-y-3">
                          {groupedTasks[status].length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                              Empty column
                            </div>
                          ) : null}
                          {groupedTasks[status].map((task) => (
                            <article key={task.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <strong className="text-sm text-white">{task.title}</strong>
                                <button
                                  className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-rose-200 transition hover:bg-rose-500/10"
                                  onClick={() => void deleteTask(task.id)}
                                  type="button"
                                  title="Delete task"
                                >
                                  x
                                </button>
                              </div>

                              {task.description ? (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{task.description}</p>
                              ) : null}

                              <div className="mt-4 flex flex-wrap gap-2">
                                {status !== TaskStatus.Todo ? (
                                  <button className="button-ghost" onClick={() => void moveTask(task.id, TaskStatus.Todo)} type="button">
                                    To Do
                                  </button>
                                ) : null}
                                {status !== TaskStatus.Doing ? (
                                  <button className="button-ghost" onClick={() => void moveTask(task.id, TaskStatus.Doing)} type="button">
                                    Doing
                                  </button>
                                ) : null}
                                {status !== TaskStatus.Done ? (
                                  <button className="button-ghost" onClick={() => void moveTask(task.id, TaskStatus.Done)} type="button">
                                    Done
                                  </button>
                                ) : null}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="glass rounded-[2rem] p-4 sm:p-5">
                <div className="border-b border-white/10 pb-4">
                  <p className="section-title">Shared notes</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Team notes</h3>
                </div>

                <form className="mt-4 grid gap-3" onSubmit={handleAddNote}>
                  <input
                    className="input-base"
                    value={noteForm.title}
                    onChange={(event) => setNoteForm({ ...noteForm, title: event.target.value })}
                    placeholder="Note title"
                  />
                  <textarea
                    className="input-base min-h-[140px] resize-none"
                    rows={5}
                    value={noteForm.content}
                    onChange={(event) => setNoteForm({ ...noteForm, content: event.target.value })}
                    placeholder="Capture ideas, decisions, or meeting notes..."
                  />
                  <button className="button-primary" disabled={busy} type="submit">
                    Add note
                  </button>
                </form>

                <div className="mt-4 space-y-3">
                  {dashboard.notes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                      No notes yet. Add a shared note for the team.
                    </div>
                  ) : null}
                  {dashboard.notes.map((note) => (
                    <article key={note.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <strong className="text-sm text-white">{note.title}</strong>
                        <button
                          className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-rose-200 transition hover:bg-rose-500/10"
                          onClick={() => void deleteNote(note.id)}
                          type="button"
                          title="Delete note"
                        >
                          x
                        </button>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{note.content}</p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>By {usernameOf(note.createdBy)}</span>
                        <span>{formatTime(note.updatedAt || note.createdAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
